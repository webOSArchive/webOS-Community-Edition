#!/bin/sh
# Builds AddToImage/PatchOrReplace/zoneinfo-<version>.tgz from IANA's tzdata release, which is the
# compiled /usr/share/zoneinfo bake.py lays over the stock 2011 tree.
#
#   tools/tzdata/build-zoneinfo.sh 2026f
#
# -b fat matters: the TouchPad's glibc 2.8 only reads the 32-bit data block, which slim files
# leave empty, and it needs the transitions written out through 2037. This uses the build
# host's zic on IANA's rule files; tzcode isn't needed.
#
# Then refresh system/etc/palm/timezone.txt and system/usr/palm/ext-timezones.json: offsetFromUTC
# is the standard offset and supportsDST whether the zone still changes clocks.
set -e
VER=${1:?usage: build-zoneinfo.sh <version, such as 2026f>}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
curl -fsSL "https://data.iana.org/time-zones/releases/tzdata$VER.tar.gz" | tar xz -C "$W"
(cd "$W" && zic -b fat -d zi africa antarctica asia australasia etcetera europe northamerica \
    southamerica backward factory)
OUT="$ROOT/AddToImage/PatchOrReplace/zoneinfo-$VER.tgz"
tar --sort=name --owner=0 --group=0 --numeric-owner --mode=u=rwX,go=rX --mtime=2026-01-01 \
    -C "$W/zi" -cf - . | gzip -n > "$OUT"
ls -l "$OUT"
