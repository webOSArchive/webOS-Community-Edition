#!/bin/sh
# Builds the Backup Diagnostic ipk: a stand-alone, read-only app + node service that
# explains why woce-backup's Restore does not offer a backup (see service/service.js).
#
#   tools/backup-diagnostic/build.sh   -> build/work/ipk/org.webosarchive.backupdiag_<ver>_all.ipk
#
# Not part of the image. Install with Preware or palm-install -- the appinstaller is what
# registers the service (from packageinfo.json); a plain `ipkg install` leaves it
# unregistered. The service is named outside com.palm on purpose: a cryptofs-installed
# com.palm.* node service lands on the private bus with no outbound grant and hangs.
# No postinst, nothing to remove but the app itself.
set -e
APP=org.webosarchive.backupdiag
SVC=$APP.service
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
OUT="$ROOT/build/work/ipk"
VER=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$HERE/app/appinfo.json")
IPK="$OUT/${APP}_${VER}_all.ipk"

node --check "$HERE/service/service.js"
node --check "$HERE/app/source/DiagApp.js"
node --check "$HERE/app/depends.js"

W="$ROOT/build/work/backupdiag"; rm -rf "$W"
mkdir -p "$W/data/usr/palm/applications" "$W/data/usr/palm/services" "$W/data/usr/palm/packages/$APP" "$W/ctl" "$OUT"
cp -r "$HERE/app" "$W/data/usr/palm/applications/$APP"
cp -r "$HERE/service" "$W/data/usr/palm/services/$SVC"
sed "s/@VERSION@/$VER/" "$HERE/packageinfo.json" > "$W/data/usr/palm/packages/$APP/packageinfo.json"
cd "$W"
(cd data && tar --sort=name --owner=0 --group=0 -czf ../data.tar.gz ./usr)
SIZE=$(du -sk data | cut -f1)
sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$HERE/control" > ctl/control
echo "Installed-Size: $SIZE" >> ctl/control
echo "webOS-Package-Format-Version: 2" >> ctl/control
(cd ctl && tar --owner=0 --group=0 -czf ../control.tar.gz ./control)
echo "2.0" > debian-binary
rm -f "$IPK"
ar rc "$IPK" debian-binary control.tar.gz data.tar.gz
echo "ipk: $IPK" && ls -la "$IPK"
