#!/usr/bin/env bash
# webOS CE Doctor — Phase 0 build orchestrator.
#
# Thin wrapper around harness.py that fixes conventional paths. Produces a
# patched, unsigned CE Doctor JAR from the OEM Doctor plus an optional overlay.
#
# Usage:
#   ./build-ce-doctor.sh [OVERLAY_DIR]
#
# Env overrides:
#   CE_VARIANT  hp | att            (default: hp — the Wi-Fi TouchPad)
#   JAR    OEM Doctor JAR         (default: the variant's JAR in the project root)
#   OUT    output CE Doctor JAR   (default: ../out/webosdoctorp320hstnh-ce-<BUILDMARK>.jar
#                                 for a full-ce overlay, else ...-ce.jar)
#   WORK   work directory         (default: ./work)
#   REEXTRACT=1  force re-extract of the OEM JAR into WORK
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# OEM variant. The AT&T 3G TouchPad Doctor is the same 3.0.5 build as the Wi-Fi
# one (see bake.py's VARIANTS block for the byte-level comparison), so it needs
# no separate pipeline — only its own JAR, work dir and overlay tree.
CE_VARIANT="${CE_VARIANT:-hp}"
case "$CE_VARIANT" in
    hp)  V_JAR="webosdoctorp305hstnhwifi.jar"; V_WORK="work";     V_NAME="webosdoctorp320hstnh-ce" ;;
    att) V_JAR="webosdoctorp305hstnhatt.jar";  V_WORK="work-att"; V_NAME="webosdoctorp320hstnhatt-ce" ;;
    *)   echo "ERROR: unknown CE_VARIANT=$CE_VARIANT (known: hp, att)" >&2; exit 1 ;;
esac

JAR="${JAR:-$HERE/../$V_JAR}"
WORK="${WORK:-$HERE/$V_WORK}"
OVERLAY="${1:-}"

# Default output name carries the BUILDMARK for a full-ce build, so every JAR
# in out/ says which bake it is and a rebuild never overwrites an earlier mark
# (the -<mark>-rc.jar release files used to be renamed by hand).
#
# The name is CE's own, not the OEM's: webosdoctorp320hstnh-ce-<mark>.jar
# (p310 for the 3.1.0 release, 600070/600071).
# "p305" was HP's product code for the 3.0.5 Doctor we repack -- this build is
# 3.1.0, and shipping it under the OEM's version misdescribes what a tester
# downloads. Changed 2026-08-29, from 600064 on; 600063 and earlier keep the
# old webosdoctorp305hstnh-3.1CE-<mark>.jar names they were built and flashed
# under, and the manifests record those paths.
#
# The INPUT keeps its own name: webosdoctorp305hstnhwifi.jar is HP's file and
# a fact about it, not a choice of ours.
if [ -z "${OUT:-}" ]; then
    if [[ "${OVERLAY:-}" == *overlays/full-ce* ]] && [ -f "$HERE/full-ce/BUILDMARK" ]; then
        OUT="$HERE/../out/$V_NAME-$(cat "$HERE/full-ce/BUILDMARK").jar"
    else
        OUT="$HERE/../out/$V_NAME.jar"
    fi
fi

mkdir -p "$(dirname "$OUT")"

# Refuse to build while a Doctor is open on this JAR. The harness now renames
# the new JAR into place (so an in-flight flash keeps its own inode and cannot
# be corrupted), but a Doctor started AFTER the swap would silently flash a
# different image than the one its window was launched for. Near-miss
# 2026-08-18: a rebuild landed 63s after a flash finished reading this path.
if pgrep -f "java .*-jar .*$(basename "$OUT")" > /dev/null 2>&1; then
    echo "ERROR: a webOS Doctor is running on $(basename "$OUT")." >&2
    echo "       Close it before rebuilding, or set OUT= to a different path." >&2
    echo "       (pids: $(pgrep -f "java .*-jar .*$(basename "$OUT")" | tr '\n' ' '))" >&2
    exit 1
fi

# Refuse to repack a full-ce overlay whose inputs have changed since it was
# baked. The overlay is generated output that happens to be tracked in git, so
# nothing about it reveals that AddToImage/ moved on -- the 2026-08-25 core-apps
# refresh left a committed overlay missing the new db8 grants, and this script
# would have shipped it without a word. bake.py records a sha256 over every
# AddToImage/ file (+ the LunaCE binary) in the manifest; recompute and compare.
if [[ "${OVERLAY:-}" == *overlays/full-ce* ]] && [ -f "$HERE/full-ce/BUILDMARK" ]; then
    MANIFEST="$HERE/full-ce/manifests/$(cat "$HERE/full-ce/BUILDMARK").json"
    if [ -f "$MANIFEST" ]; then
        RECORDED="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("inputs_sha256",""))' "$MANIFEST")"
        M_VARIANT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("variant","hp"))' "$MANIFEST")"
        if [ "$M_VARIANT" != "$CE_VARIANT" ]; then
            echo "ERROR: BUILDMARK $(cat "$HERE/full-ce/BUILDMARK") was baked for variant" >&2
            echo "       '$M_VARIANT', but this build is CE_VARIANT=$CE_VARIANT." >&2
            echo "       Re-bake for this variant: CE_VARIANT=$CE_VARIANT python3 full-ce/bake.py" >&2
            exit 1
        fi
        CURRENT="$(cd "$HERE/full-ce" && python3 -c 'import bake; print(bake.inputs_stamp())')"
        if [ -z "$RECORDED" ]; then
            echo "WARNING: $(basename "$MANIFEST") predates the inputs stamp; cannot verify the overlay is fresh." >&2
        elif [ "$RECORDED" != "$CURRENT" ]; then
            echo "ERROR: overlays/full-ce is STALE: AddToImage/ (or the LunaCE binary) changed" >&2
            echo "       since BUILDMARK $(cat "$HERE/full-ce/BUILDMARK") was baked." >&2
            echo "       Run: python3 full-ce/bake.py   (or ALLOW_STALE_OVERLAY=1 to override)" >&2
            [ "${ALLOW_STALE_OVERLAY:-0}" = "1" ] || exit 1
        else
            echo ">>> overlay inputs verified against $(basename "$MANIFEST")"
        fi
    fi
fi

args=(build --jar "$JAR" --out "$OUT" --work "$WORK")
[ -n "$OVERLAY" ] && args+=(--overlay "$OVERLAY")
[ "${REEXTRACT:-0}" = "1" ] && args+=(--reextract)

echo ">>> variant : $CE_VARIANT"
echo ">>> OEM JAR : $JAR"
echo ">>> overlay : ${OVERLAY:-<none>}"
echo ">>> output  : $OUT"
echo ">>> work    : $WORK"
echo

python3 "$HERE/harness.py" "${args[@]}"

OUT_SHA="$(sha256sum "$OUT" | awk '{print $1}')"

# complete the full-ce build manifest (written by full-ce/bake.py, keyed by
# BUILDMARK) with the output JAR's hash, when this build used that overlay
if [[ "${OVERLAY:-}" == *overlays/full-ce* ]] && [ -f "$HERE/full-ce/BUILDMARK" ]; then
    MANIFEST="$HERE/full-ce/manifests/$(cat "$HERE/full-ce/BUILDMARK").json"
    if [ -f "$MANIFEST" ]; then
        M="$MANIFEST" O="$OUT" S="$OUT_SHA" python3 - <<'PY'
import json, os
m = os.environ["M"]
d = json.load(open(m))
d["output_jar"] = {"path": os.environ["O"], "sha256": os.environ["S"]}
with open(m, "w") as f:
    json.dump(d, f, indent=2)
    f.write("\n")
PY
        echo ">>> manifest: $MANIFEST (output sha256 recorded)"
    fi
fi

echo
echo ">>> built: $OUT"
echo ">>> sha256: $OUT_SHA"
echo ">>> NOTE: unsigned + checkToFlash patched off. Flash-test on real hardware"
echo "    before distributing (no on-device rollback — recovery is re-Doctoring)."
