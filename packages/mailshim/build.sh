#!/bin/bash
# Builds libce-mailshim.so, the preload that adapts Palm's mail services (README.md), for the
# TouchPad, after running every test on the build machine. A failing test stops the build.
#
#   packages/mailshim/build.sh      -> prebuilt/usr/lib/ssl11mail/libce-mailshim.so
#
# Switches (environment, 0 or 1; see mailshim.c): EAS16 and OAUTH (which needs EAS16), on since
# their adapters passed on a TouchPad (2026-11-19; Docs/EMAIL-MODERNIZATION-PLAN.md, D4), and
# DUMP, off: never in an image. OUT=<file> writes somewhere else, for a development build that
# must not replace the prebuilt.
#
# Toolchain: PalmPDK gcc 4.3.3 (/opt/PalmPDK/arm-gcc), as LunaCE and SmartKey. The library needs
# only libc, libdl and libpthread; curl, glib and luna-service2 are reached through dlsym, so
# none of their headers or libraries are used.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
W=${W:-$ROOT/build/work/mailshim}
TC=${TC:-/opt/PalmPDK/arm-gcc/bin/arm-none-linux-gnueabi-}
CC=${HOST_CC:-cc}
OUT=${OUT:-$HERE/prebuilt/usr/lib/ssl11mail/libce-mailshim.so}
DEFS="-DCE_MAILSHIM_EAS16=${EAS16:-1} -DCE_MAILSHIM_OAUTH=${OAUTH:-1} -DCE_MAILSHIM_DUMP=${DUMP:-0}"
CFLAGS="-std=gnu99 -O2 -Wall -Wno-unused-function -fPIC -I$HERE/lunacy"

[ -x "${TC}gcc" ] || { echo "toolchain not found: ${TC}gcc" >&2; exit 1; }
mkdir -p "$W" "$(dirname "$OUT")"

# ---- tests, on the build machine -------------------------------------------------------------
# Lunacy's, for the headers' logic (all of it, switched on or not). In UTC: their sample zones
# are Palm's as a service in UTC writes them. devicezone is CE's, for a TouchPad's own zone.
for t in mailauth wbxmlfilter composemail backoff calfilter easerr attfetch devicezone; do
    "$CC" -O2 -Wall -Wno-unused-function -I"$HERE/lunacy" "$HERE/tests/${t}_test.c" -o "$W/${t}_test"
    TZ=UTC timeout 60 "$W/${t}_test"
done
# CE's, for the glue as an image carries it: the shim between a test and a stand-in libcurl.
"$CC" $CFLAGS -shared -DCE_MAILSHIM_STDERR -DCE_MAILSHIM_TEST_YEAR=2026 -DCE_BACKOFF_FILE="\"$W/backoff\"" \
    "$HERE/mailshim.c" -o "$W/libce-mailshim-host.so" -ldl -lpthread
"$CC" -O2 -Wall -fPIC -shared "$HERE/tests/fakecurl.c" -o "$W/libfakecurl.so"
"$CC" -O2 -Wall -Wno-unused-function -I"$HERE/lunacy" -I"$HERE/tests" "$HERE/tests/glue_test.c" -o "$W/glue_test" \
    -L"$W" -Wl,--no-as-needed -lce-mailshim-host -lfakecurl -Wl,-rpath,"$W"
TZ=UTC timeout 60 "$W/glue_test" "$W/backoff"
# The OAuth glue (CE_MAILSHIM_OAUTH), with a stand-in for luna-send and the token service.
"$CC" $CFLAGS -shared -DCE_MAILSHIM_STDERR -DCE_MAILSHIM_EAS16=1 -DCE_MAILSHIM_OAUTH=1 -DCE_MAILSHIM_DUMP=1 \
    -DCE_BACKOFF_FILE="\"$W/backoff-oauth\"" -DCE_LUNA_SEND="\"$HERE/tests/fake-luna-send.sh\"" \
    "$HERE/mailshim.c" -o "$W/libce-mailshim-oauth-host.so" -ldl -lpthread
"$CC" -O2 -Wall "$HERE/tests/oauth_glue_test.c" -o "$W/oauth_glue_test" \
    -L"$W" -Wl,--no-as-needed -lce-mailshim-oauth-host -lfakecurl -Wl,-rpath,"$W"
mkdir -p "$W/fake-luna"; rm -f "$W/backoff-oauth"
CE_FAKE_DIR="$W/fake-luna" timeout 60 "$W/oauth_glue_test"

# ---- the TouchPad's ----------------------------------------------------------------------------
"${TC}gcc" $CFLAGS -march=armv7-a -mfpu=vfp -mfloat-abi=softfp -fno-strict-aliasing $DEFS -shared \
    -Wl,-soname,libce-mailshim.so "$HERE/mailshim.c" -o "$W/libce-mailshim.so" -ldl -lpthread
"${TC}strip" "$W/libce-mailshim.so"
# the device has glibc 2.8
bad=$("${TC}objdump" -T "$W/libce-mailshim.so" | grep -oE "GLIBC_2\.([9]|[1-9][0-9])" | sort -u || true)
[ -z "$bad" ] || { echo "library needs symbols the device lacks: $bad" >&2; exit 1; }
cp "$W/libce-mailshim.so" "$OUT"
echo "built $OUT ($DEFS)"
"${TC}objdump" -T "$OUT" | awk '$2=="g" && $4==".text" {print "  wraps " $NF}'
md5sum "$OUT"
