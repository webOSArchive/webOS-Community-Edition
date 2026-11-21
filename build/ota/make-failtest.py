#!/usr/bin/env python3
"""Build an update payload that fails inside the update ramdisk, on purpose.

    make-failtest.py transient --out DIR   # preinst fails on the first attempt only
    make-failtest.py permanent --out DIR   # preinst fails on every attempt

The package writes one marker file and changes nothing else on the rootfs. Its
preinst counts attempts in /var/ce-ota-failtest/ (the ramdisk mounts /var under
the chroot) and exits 1 to make mmipkg fail the install, which is the path that
leads to PmUpdater's retries and, after the last one, to the stock "bricked"
state (ota.sh's brick_device deletes /boot/uImage). Recovery from a device stuck
in the ramdisk: ../webos-update-exploration/OTA-UPDATE-GUIDE.md. A bricked device
probably needs the Doctor. Docs/OTA-PLAN.md section 2.0m.
"""

import argparse
import hashlib
import importlib.util
import os

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("make_payload", os.path.join(HERE, "make-payload.py"))
mp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mp)

PKG = "org.webosarchive.ce-ota-failtest"


def preinst(mode):
    fail_until = 1 if mode == "transient" else 1000000
    return f"""#!/bin/sh
# Fail-test ({mode}): exit 1 on attempts 1..{fail_until if mode == "transient" else "all"}.
O=/var/ce-ota-failtest
mkdir -p $O 2>/dev/null
n=$(cat $O/attempts 2>/dev/null || echo 0)
n=$((n+1))
echo $n > $O/attempts
date >> $O/log 2>/dev/null
echo "attempt $n" >> $O/log
sync
if [ $n -le {fail_until} ]; then
    echo "attempt $n: failing on purpose" >> $O/log
    sync
    exit 1
fi
echo "attempt $n: going on" >> $O/log
exit 0
"""


POSTINST = f"""#!/bin/sh
echo "postinst ran $(date)" >> /var/ce-ota-failtest/log 2>/dev/null
rm -f /usr/lib/ipkg/info/{PKG}.control /usr/lib/ipkg/info/{PKG}.list \\
      /usr/lib/ipkg/info/{PKG}.preinst /usr/lib/ipkg/info/{PKG}.postinst
exit 0
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=("transient", "permanent"))
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    control = (f"Package: {PKG}\nVersion: 1\nArchitecture: all\nMaintainer: webOS Archive\n"
               f"Description: update ramdisk fail-test ({a.mode}); writes one marker file\n")
    control_tgz = mp.tar_gz([mp.text_member("control", control, 0o644),
                             mp.text_member("preinst", preinst(a.mode), 0o755),
                             mp.text_member("postinst", POSTINST, 0o755)])
    data_tgz = mp.tar_gz([mp.text_member("usr/share/ce-ota/failtest-marker.txt",
                                         f"ce-ota fail-test ({a.mode})\n", 0o644)])
    ipk = mp.ar_pack([("debian-binary", b"2.0\n"), ("control.tar.gz", control_tgz),
                      ("data.tar.gz", data_tgz)])
    os.makedirs(a.out, exist_ok=True)
    path = os.path.join(a.out, f"{PKG}_{a.mode}_all.ipk")
    with open(path, "wb") as f:
        f.write(ipk)
    print("%s  %d bytes  md5 %s" % (path, len(ipk), hashlib.md5(ipk).hexdigest()))


if __name__ == "__main__":
    main()
