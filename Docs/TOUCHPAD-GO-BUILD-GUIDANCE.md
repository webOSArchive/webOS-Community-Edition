# TouchPad Go meta-doctor: one fix for the next build

From the webOS CE project, 2026-11-26. This is for the coding agent building the TouchPad Go
(opal) meta-doctor that is derived from webOS CE 3.2.0 (BUILDMARK 600122).

**Result of the last build:** a fresh flash passed 172 of 173 tests in CE's automated
suite (`scripts/ce-test-full.sh`). The one failure is a false alarm: the suite expects the
TouchPad's boot logo, and the Go needs the same moon turned 90°. A comparison of the Go's
root filesystem against the 600122 image found only Go hardware changes: kernel, firmware,
the hardware-access modules, sensors, audio and video libraries, and LunaSysMgr. Nothing in
the CE software layer regressed.

## Fix the build name

`/etc/palm-build-info` on the Go currently contains:

```
BUILDNAME=Nova-ATT-Topaz
BUILDNUMBER=86
```

Both lines come from CE's AT&T TouchPad image, which keeps that device's stock values. CE
keeps each device's stock `BUILDNAME` and `BUILDNUMBER` and changes only
`PRODUCT_VERSION_STRING`, `BUILDTIME` and `BUILDMARK`. For example, the Wi-Fi TouchPad image
says `Nova-HP-Topaz` and the AT&T image says `Nova-ATT-Topaz`. Do the same for the Go: set
both lines to the values in the **stock Go image's** `/etc/palm-build-info`.

`BUILDNAME` should be `Nova-HP-Opal`. Your device already shows that value in
`/etc/palm-install-info`, which comes from the stock Go customization. Take `BUILDNUMBER` from
the stock image too. Don't guess it.

**See it for yourself.** These commands are read-only. Run them over novacom on a flashed
Go; under novacom, `luna-send` needs `</dev/null` or it hangs.

```sh
grep BUILD /etc/palm-build-info
for k in buildName machineName deviceName; do
  luna-send -n 1 palm://com.palm.preferences/systemProperties/Get \
    "{\"key\":\"com.palm.properties.$k\"}" </dev/null
done
```

Read on the last build (600122-based), 2026-11-26:

```
BUILDNAME=Nova-ATT-Topaz
BUILDNUMBER=86
BUILDTIME=20261125202929
BUILDMARK=600122
{ "com.palm.properties.buildName": "Nova-ATT-Topaz", "returnValue": true }
{ "com.palm.properties.machineName": "opal", "returnValue": true }
{ "com.palm.properties.deviceName": "webOS TouchPad Go", "returnValue": true }
```

`machineName` and `deviceName` are already correct; those are what apps use to detect the
Go. Only the build name is stale. The system reads it from `/etc/palm-build-info` and
publishes it as the `com.palm.properties.buildName` property. After the fix, both the file
and that property should read `Nova-HP-Opal`.

**Leave the other lines as CE sets them:**

- `PRODUCT_VERSION_STRING=webOS CE 3.2.0`. Device Info shows it, CE packages check it, and
  four system binaries parse it.
- `BUILDMARK` and `BUILDTIME`.

**What reads `BUILDNAME`:** no CE code reads it. These stock components do, and they were
built to see the stock Go value:

- LunaSysMgr's status bar checks it for `Nova-Demo` (demo builds).
- The device-profile service reports it.
- The touch-panel dump scripts in `/usr/bin` put it in their output file names.

## For reference, already correct, no action needed

- **Device detection.** Apps that adapt to the Go already detect it correctly.
  `com.palm.properties.machineName` is `opal`, `deviceName` is `webOS TouchPad Go`, and
  `/proc/cpuinfo` reports `Hardware: SHORTLOIN`.
- **CE's OTA updates.** CE's OTA client refuses to install on this device. It requires
  `Hardware: TENDERLOIN` and the tenderloin kernel, and the Go has neither. If the server
  offers a CE TouchPad update, the client rejects it with "this update is for the HP TouchPad".
- **Stock HP bookmarks and contacts.** The stock customization data still adds HP support
  bookmarks and contacts after first use. CE's own TouchPad images carry the same stock data,
  so this is an open item on CE's side, not something to fix in the Go build. When CE fixes
  it, the change can be carried over.
