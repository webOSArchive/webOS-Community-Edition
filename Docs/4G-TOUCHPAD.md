# The 4G TouchPad, and what this image assumes

This Doctor is built from `webosdoctorp305hstnhwifi.jar` and targets the
**Wi-Fi TouchPad** (`topaz`). HP shipped the 4G TouchPad (`topaz4g`) with its
own Doctor, so the two have always been separate images.

> **Status 2026-11-26:** a 4G/AT&T build exists and ships. 600071 (3.1.0) and
> 600122 (3.2.0) are built from HP's AT&T Doctor; the PmWanDaemon gate below
> passed on real `topaz4g` hardware (ATT-VARIANT.md §6), and 600122 scored
> 174 PASS / 0 FAIL on a fresh flash (`scripts/results-600122.txt`). See
> **[ATT-VARIANT.md](../ATT-VARIANT.md)** for the build and its test record.

This doc is a record of the one place CE behaves differently depending on
whether a radio is present. It was written before any 4G build; the sections
below keep that original reasoning.

## PmWanDaemon

Stock `/etc/event.d/PmWanDaemon` starts on `stopped configurator` and reads the
radio tokens:

```sh
if [ -f /dev/tokens/RadioType ]; then
    radioType=`cat /dev/tokens/RadioType`
    if [ "$radioType" != "0" ]; then
        exec PmWsfDaemon -c /etc/wan.d/wan.conf
    fi
elif [ -f /dev/tokens/MODEM ]; then
    ...
fi
```

With no modem it never reaches an `exec`, so the script simply ends, the
process exits 0, and `respawn` starts it again. On a Wi-Fi TouchPad that loop
runs until upstart gives up:

```
PmWanDaemon respawn_count: 12 > respawn_limit: 10
PmWanDaemon respawning too fast, stopped
```

That happens on **every** `stopped configurator` — every boot, and every
power-menu Luna Restart.

### Why CE cares

The limit-stop happens *inside* upstart's event handling, and the jobs spawned
next in that same tick die with `SIGSEGV` in `job_run_process`. Captured on
600049 and 600050, both times with exactly that preamble, and absent from three
controls that started the same jobs on the same event while PmWanDaemon was not
at its limit.

The children that died were `ce-firstboot-tweaks` and `ce-remove-preloads`,
which made it look like a CE bug for most of a day. It is not: they are simply
the other jobs on that event. The fault is a use-after-free in this very old
upstart, and the respawn thrash is what lights the fuse. Practical impact was
low — both jobs are once-per-flash and had already completed — but a SIGSEGV in
the boot path is not something to leave in a release.

CE cannot patch upstart. It can remove the thrash.

### What CE changes

A `pre-start` gate is added ahead of the stock script, applying the job's own
radio test as a *start condition*:

- **No radio** → `pre-start` exits non-zero, the job never reaches `running`,
  so there is nothing to respawn and the limit is never breached.
- **Radio present** → `pre-start` exits 0 and the stock script runs exactly as
  before, `respawn` included.

Deliberately *not* done:

- **Deleting the job** — it would break a 4G device outright.
- **Dropping `respawn`** — simpler, and enough to stop the thrash, but on 4G it
  would mean `PmWsfDaemon` never restarts if it died. That is a real regression
  on hardware neither the change nor its author can test.

### On a 4G TouchPad

The gate needed no change: on `topaz4g` the tokens are present, the `pre-start`
passes, and PmWanDaemon behaves as stock. This was predicted from the stock
job's own conditions and then confirmed on the 600071 flash (ATT-VARIANT.md §6).

The 4G TouchPad still gets its own image: the Wi-Fi Doctor is not flashed to
it, since the customization and modem firmware differ. The AT&T build is
derived from HP's AT&T Doctor; see ATT-VARIANT.md.
