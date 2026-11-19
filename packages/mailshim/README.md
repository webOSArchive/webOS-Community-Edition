# libce-mailshim.so

A preload for Palm's mail services on webOS CE. It sits beside `libssl_compat.so` in
`/usr/lib/ssl11mail/` and changes what the unchanged `mojomail-*` binaries say on the wire.
The plan is `Docs/EMAIL-MODERNIZATION-PLAN.md`.

    packages/mailshim/build.sh     # tests on the build machine, then prebuilt/…/libce-mailshim.so

`build/full-ce/bake.py` (tier mail-tls13) copies `prebuilt/` into the image and adds the
library to `LD_PRELOAD` for the services in `MAILSHIM_SERVICES`. Rebuild, then update the md5
in `scripts/ce-test-full.sh` section 26, and commit all three together.

## What an image's build does (no switch on)

| | Where | Seen on a TouchPad (600102, 2026-11-19) |
|---|---|---|
| An event's time zone goes out in Windows' form | `calf_fix_zones`, on every `Cmd=Sync` body | London, from a device in Detroit, to Zoho: "last Sunday of October at 2:00, of March at 1:00" |
| A server's back-off is kept, and nothing is sent to that host until it passes | `backoff.h`, `/var/preferences/ce-eas-backoff` | a stand-in's 503 with `Retry-After: 120`; the next request stayed on the device; Zoho unaffected |
| A throttled sign-in says "unavailable", not "check your login" | `easerr.h`, in front of `LSMessageRespond` | `401_UNAUTHORIZED`/1000 became `503_SERVICE_UNAVAILABLE`/1110; a wrong password still says 401 |

Everything else is behind build switches (`EAS16=1`, `DUMP=1`; `CE_MAILSHIM_OAUTH` needs phase
2's token service and stops the build until then). Code behind a switch that is off is not in
the binary: the phase 1 library exports only `curl_easy_setopt`, `curl_multi_add_handle`,
`curl_easy_cleanup` and `LSMessageRespond`.

## Where the code comes from

Lunacy (github.com/webOSArchive/Lunacy, Apache-2.0), `LunaRuntimes/pdk/` at `f7dfc82`
(2026-11-19; its last mail change is `aad09f5`):

- `mailshim.c` is `libpreload/preload.c` from line 1260 on, with CE's differences: no webOS
  root, syslog, the build switches, CE's paths and names. Lunacy's token call (its own bus
  socket) is not carried; CE's is phase 2.
- `lunacy/*.h` are `libpreload/`'s headers. **`calfilter.h` differs from Lunacy's** (the parts
  marked `[CE]`, below); the other six are byte for byte.
- `tests/*_test.c` are Lunacy's, unchanged, except `glue_test.c`, `fakecurl.c` and
  `devicezone_test.c`, which are CE's.

To take a newer Lunacy: copy the six headers and Lunacy's tests over, merge `calfilter.h` by
hand, and diff Lunacy's `preload.c` from line 1260 against the commit above to see what
`mailshim.c` needs.

## `[CE]` in calfilter.h: Palm's zone on a real device

Lunacy measured Palm's zone as "this year's change instants, broken down in UTC". That is
what the service writes where its own zone is UTC. On a TouchPad it breaks them down on the
**device's** clock: London's changes came out of a device in Detroit as "the 4th Saturday of
October and of March at 21:00". Lunacy's code didn't take that for Palm's form and changed
nothing. `calf_palm_offset` reads each change on the process's local clock, as Palm did.
Lunacy should take this if its mail service ever runs outside UTC.

Measured over 46 zones as the event's and as the device's (1,426 pairs, 2026):

- 1,272 come out right.
- 139 are left as Palm wrote them: Nuuk, Scoresbysund and Easter Island, whose changes are
  near 22:00 (Lunacy's limit too).
- 15 come out an hour late for the change to standard time: a zone that changes in the hour
  before the device's own does (New York seen from Chicago). Only times in that one hour of
  the year are affected.
- A zone already in Windows' form with **no names** (Z-Push writes such; Exchange and Zoho name
  theirs, and named zones are never touched) is wrongly rewritten in 57 pairs, mostly on a
  device whose zone has no daylight saving. In UTC Lunacy saw almost none. Not fixed: telling
  the two forms apart there needs the event's zone id, which the request doesn't carry.

## Replacing the library on a running device

Never copy over the file in place: `mojomail-eas` has it mapped, and crashes in `_dl_fini`
when it next exits (three rdxd reports on 2026-11-19 were exactly that). Write a new file and
rename it over the old one, then stop the service.
