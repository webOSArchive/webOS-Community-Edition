#!/bin/bash
# Compiles CEDriversMgr (the Doctor's driver step on a Mac) and tests it, then puts the class
# beside the two packages it installs:
#
#   tools/doctor-drivers/build.sh      -> build/doctor-drivers/CEDriversMgr.class
#
# build/harness.py adds that class and build/doctor-drivers/novacom-installer-{x86_64,arm64}.pkg
# to the JAR. The class is committed, so a Doctor build needs no Java.
#
# The test runs the class as the Doctor would call it, on this machine, told it is a Mac
# (-Dce.os.name), with stand-ins on PATH for the two Mac commands it runs: `sysctl` (which
# processor) and `open` (the Installer). It checks which package is opened, that nothing is
# opened when novacomd already answers, and that other systems go to the Doctor's own class.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
W=$ROOT/build/work/doctor-drivers
OUT=$ROOT/build/doctor-drivers
JAR=${JAR:-$ROOT/webosdoctorp305hstnhwifi.jar}
rm -rf "$W"; mkdir -p "$W/classes" "$W/bin" "$W/res/resources"
javac --release 7 -Xlint:-options -cp "$JAR" -d "$W/classes" "$HERE/CEDriversMgr.java"
cp "$OUT"/novacom-installer-*.pkg "$W/res/resources/"

cat > "$W/Probe.java" <<'JAVA'
public class Probe { public static void main(String[] a) {
  System.out.println("result=" + new com.palm.nova.installer.core.CEDriversMgr().checkAndInstallDrivers()); } }
JAVA
javac --release 7 -Xlint:-options -cp "$W/classes:$JAR" -d "$W" "$W/Probe.java"
# `open -W <pkg>`: notes the package's checksum; with START_NOVACOMD, something then answers on
# novacomd's port, as after a real install.
cat > "$W/bin/open" <<'SH'
#!/bin/sh
sha256sum "$2" | cut -d' ' -f1 > "$PROBE_DIR/opened"
[ -n "$START_NOVACOMD" ] && (python3 -c "
import socket,time
s=socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(('127.0.0.1',46968)); s.listen(5); time.sleep(8)" >/dev/null 2>&1 &)
exit 0
SH
printf '#!/bin/sh\necho "$FAKE_ARM64"\n' > "$W/bin/sysctl"
chmod +x "$W/bin/open" "$W/bin/sysctl"
probe() {  # probe <os.name> <os.arch>; env: FAKE_ARM64, START_NOVACOMD
    rm -f "$W/opened"
    PROBE_DIR="$W" PATH="$W/bin:$PATH" java -Dce.novacomd.port=46968 -Dce.os.name="$1" -Dce.os.arch="$2" -cp "$W/classes:$W/res:$W:$JAR" Probe 2>/dev/null | grep '^result=' || echo "result=none"
}
fail=0
check() { if [ "$2" = "$3" ]; then echo "ok: $1"; else echo "FAIL: $1 (got '$2', wanted '$3')"; fail=1; fi; }
sum() { sha256sum "$OUT/novacom-installer-$1.pkg" | cut -d' ' -f1; }
# (the test's novacomd port is 46968: this machine's own novacomd has the real one)
if (exec 3<>/dev/tcp/127.0.0.1/46968) 2>/dev/null; then echo "something is listening on 46968 here; the test needs it free" >&2; exit 1; fi

r=$(FAKE_ARM64=1 START_NOVACOMD=1 probe "Mac OS X" x86_64)
check "Apple silicon, Java under Rosetta: the arm64 package is opened" "$(cat "$W/opened" 2>/dev/null)" "$(sum arm64)"
check "and the step succeeds once novacomd answers" "$r" "result=true"
sleep 9
r=$(FAKE_ARM64=0 START_NOVACOMD=1 probe "Mac OS X" x86_64)
check "Intel Mac: the x86_64 package is opened" "$(cat "$W/opened" 2>/dev/null)" "$(sum x86_64)"
sleep 9
r=$(FAKE_ARM64="sysctl: unknown oid" START_NOVACOMD=1 probe "Mac OS X" aarch64)
check "no answer from sysctl, arm64 Java: the arm64 package" "$(cat "$W/opened" 2>/dev/null)" "$(sum arm64)"
sleep 9
r=$(FAKE_ARM64=0 probe "Mac OS X" x86_64)
check "the Installer closed without installing: the step fails" "$r" "result=false"
python3 -c "
import socket,time
s=socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); s.bind(('127.0.0.1',46968)); s.listen(5); time.sleep(6)" & lp=$!
sleep 1
r=$(FAKE_ARM64=1 probe "Mac OS X" aarch64)
check "novacomd already answering: nothing is opened" "$(cat "$W/opened" 2>/dev/null || echo nothing)" "nothing"
check "and the step succeeds" "$r" "result=true"
wait $lp 2>/dev/null || true
r=$(probe "Linux" amd64)
check "another system goes to the Doctor's own class (here its Linux step, which succeeds)" "$r" "result=true"
check "and opens nothing" "$(cat "$W/opened" 2>/dev/null || echo nothing)" "nothing"
[ $fail = 0 ] || { echo "doctor-drivers: tests failed" >&2; exit 1; }
cp "$W/classes/com/palm/nova/installer/core/CEDriversMgr.class" "$OUT/CEDriversMgr.class"
echo "built $OUT/CEDriversMgr.class"
