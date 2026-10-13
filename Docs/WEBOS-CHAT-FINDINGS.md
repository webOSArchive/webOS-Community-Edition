# webOS Chat on webOS CE: findings for the Lunacy project

From the webOS CE (webos-doctor-ce) project, 2026-10-12, in reply to Lunacy's
`webOS-Chat-for-CE.md` handoff. Facts marked *measured* were seen on the reference
TouchPad (topaz) today; everything else is a reading of the CE image or the Oscar
repository at `cf5f5d9` and should be checked.

## Short version

- The handoff's three pieces (plugin, account type, service) are the right list.
- **Two of them need to go somewhere other than where the handoff says** on CE:
  the plugin goes into the cryptofs plugin store, and the activities go into
  `/etc/palm/activities/`.
- **Two changes to the Oscar service** would make it work everywhere:
  - the activities should persist across reboots;
  - the service should cope with the IM transport not being up yet when it
    creates the account (an OOBE sign-in leaves a ~2 minute gap).
- **The transport and the sign-in need nothing.**

## Answers to the handoff's questions

### Which imlibpurpleservice commit is in the image?

**Upstream `3e1d0da` (2026-08-15), the current HEAD.**
- **Where it comes from:** CE bakes the transport from Synergy Revival's
  `com.palm.synergy.generic` 0.9.3.1. Its `imlibpurpletransport` binary is dated
  2026-08-17.
- **Why that commit:**
  - Every log string in the binary is in HEAD's source.
  - `e5191f7` (2026-08-08) is the newest commit that changes compiled code, and
    the strings it added are in the binary.
  - The two commits after it don't change the binary:
    - `a22358c` drops the `com.palm.person` kind, which the CE package doesn't
      ship.
    - `2ee1c41` only edits the OSE/LuneOS role template.
- **Login retries are fine as built:** the binary has `IMLoginFailRetryHandler`,
  and `account_login_failed_cb` doesn't retry the four credential errors
  (invalid username, authentication failed, authentication impossible, invalid
  settings).
- **So the 2026-10-10 storm came from the error type:** it was the AOL client
  login's error, not a missing fix. **No transport update is needed** for webOS
  Chat.

### Does CE's sign-in rename the `com.palm.palmprofile` account record?

**Yes, in both the baked 3.1.0 service and the catalog app 1.2.0.** Sign-out sets
it back to "Local User". *Measured* three ways:

| Path | What happened to the record | Token saved |
|---|---|---|
| Post-OOBE sign-in before the re-flash (19:40, a pre-release of the 1.2.0 service) | `'webOS User' -> 'Jonathan Wise'` (rename) | ~50 ms after the rename landed |
| `palm://com.palm.accountservices/signOut` | renamed to `Local User`; `getAccountToken` then answers `NO_TOKEN` | — |
| Post-OOBE sign-in, catalog app 1.2.0 | `'Local User' -> 'codepoet'` (rename) | ~150 ms after the rename landed |
| **OOBE sign-in** (fresh 3.1.0 flash) | **created**, not renamed: no record exists yet | ~0.3 s after the create |

Notes for the `profile` activity:
- **The record gets the display name**, not the screen name. The activity only
  needs the record to change, so that's fine; the screen name has to come from
  the Museum's chat credentials, as `service.js` already does.
- **OOBE inserts the record instead of renaming it.** A `find` watch should
  still fire on the insert, but only if the activity exists by then. During OOBE
  that's untested.
- **Signing in again as the same member renames nothing.** If the record
  already has the member's name, sign-in skips `modifyAccount`, so the watch
  doesn't fire. Chat then waits for the next boot or the hourly run.
- **The token race is real but short.** The service's 5 s × 5 retry covers it
  easily.

### The AIM template's icons

**New webOS Chat icons, please, in the Oscar repository.** CE has no
`com.palm.aol` (Synergy moves it aside), and CE 3.2.0's goal is to remove HP and
legacy branding, so shipping Palm's AIM artwork would go the wrong way.

### Default or opt-in?

Still open on the CE side. See `WEBOS-CHAT-PLAN.md`.

## Where the pieces have to go on CE

### 1. The plugin: the cryptofs plugin store, not just `/usr/lib/purple-2`

- **Why `/usr/lib/purple-2` alone fails:** every time the transport starts,
  CE's `imwrap.sh` bind-mounts `/media/cryptofs/synergy-purple-plugins` over
  `/usr/lib/purple-2`. A `libaim.so` only in `/usr/lib/purple-2` is hidden.
- **Where it actually goes:**
  - A package drops it into `/media/cryptofs/synergy-purple-plugins/`. That's
    the Synergy contract its own connectors use, and it needs no root remount.
  - The image bakes it into `/usr/palm/ce-seed/cryptofs/synergy-purple-plugins/`
    as well.
- **Stop the transport before writing there.** Synergy found that writing into
  a file the running transport has mmap'd leaves a 0-byte file on the cryptofs
  FUSE filesystem. Start it again afterwards, which also loads the new plugin.
- **Checked on the device:** no `libaim.so` or `liboscar.so` in either folder.
  Stock 3.0.5 had both, but built against libpurple 2.6.

### 2. The account type: either template root works

The accounts service reads templates from both `/usr/palm/public/accounts` and
`/media/cryptofs/apps/usr/palm/accounts`.
- **No root write needed:** a package can use the cryptofs root.
- **Reload:** the service reloads its templates through its `apps-changed`
  handler. Whether a Preware/ipkg install triggers that is untested; restarting
  the accounts service would do instead.

### 3. The service: rootfs, with roles, a launcher and `/etc/palm/activities`

- **Where the 3.0.5 configurator looks:**
  - rootfs services: `/etc/palm/activities/<id>/`;
  - installed packages: `/media/cryptofs/apps/usr/palm/{applications,services}/<id>/configuration/`.

  So a service baked into `/usr/palm/services/` never has its own
  `configuration/activities` read. The activities have to be placed in
  `/etc/palm/activities/com.palm.webosarchive.chat/`, as the transport's are.
- **Persistence (the reboot question):**
  - `/var/cache/configurator` holds stamps for db kinds, permissions and
    filecache, *measured*: none for activities.
  - The stock periodic activities that survive reboots set
    `"type": {"persist": true}` (palmprofile's `jabberrefresh.json`, chatthreader's
    watches). The Oscar repo's three don't.

  **Suggested Oscar change:** add `persist: true`, or have the service create
  its own activities through `com.palm.activitymanager/create` on its first
  `sync`, so it doesn't depend on the configurator at all.
- **Registration:** ls2 public and private roles, plus a D-Bus launcher that
  ends in `.service` (or ls-hubd ignores it), then `ls-control scan-services`.
  That's the pattern Synergy's postinst uses.
- **Runtime:** CE's node is 0.4.12, with `foundations` and `/usr/bin/curl`. The
  Community Account service uses the same and reaches the Museum fine.

## The OOBE timing gap

*Measured* on a fresh 3.1.0 flash with the sign-in done during OOBE:

| UTC | Event |
|---|---|
| 19:55:13 | `imtransport` pre-start begins waiting for its glibc in cryptofs |
| 19:58:15 | Wait times out; the transport job stops |
| 20:09:54 | OOBE sign-in creates the palmprofile record |
| 20:09:55 | Token saved |
| 20:09:57 | `first-use-finished`; the cryptofs seed starts |
| 20:11:28 | Seed complete; it kicks `imtransport` |
| 20:12:01 | Transport running |

- **The cause:** CE seeds the transport's glibc, runtime and plugins into
  cryptofs only after first use. The cryptofs store is re-initialized during
  OOBE, so anything earlier would be wiped. That leaves about 2 minutes after
  an OOBE sign-in when there's no transport and no plugin.
- **What could go wrong:** if the chat service creates the AIM account in that
  window, the account's `onEnabled` call wakes `com.palm.imlibpurple` through
  D-Bus before its ELF interpreter exists.
- **Suggested Oscar change:** before creating the account, the service checks
  that `palm://com.palm.imlibpurple` answers (or that
  `/media/cryptofs/synergy-glibc/lib/ld-linux.so.3` exists) and otherwise
  leaves it to the next activity run. Alternatively, confirm that the transport
  signs in enabled accounts when it starts; that's the main open test.
- **The post-OOBE path is unaffected:** the transport is already running there.

## The reference TouchPad is clean

It was re-flashed with CE 3.1.0 (600056) today. *Measured* afterwards:
- no `com.palm.aol` account or template;
- no `libaim.so`;
- no `/var/preferences/com.palm.purple/transport/`.

It's now signed in as `codepoet` with the catalog app 1.2.0. Lunacy's
`Docs/android5-setup.md` cleanup list doesn't apply any more.

## Asks for the Oscar repository

1. Replace the template's `../com.palm.aol/images/` icons with webOS Chat icons.
2. Make the activities persist (`persist: true`), or create them from the
   service.
3. Handle the transport not being up when the account would be created.
4. Optionally, ship the activities in a layout a rootfs install can use as is
   (`etc/palm/activities/com.palm.webosarchive.chat/`), next to the
   `configuration/` copy that cryptofs installs use.
