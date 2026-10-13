# webOS Chat for CE: plan

Scope for two deliverables, 2026-10-12. Background and measurements:
`WEBOS-CHAT-FINDINGS.md`.

1. **Chat Enabler:** a stand-alone ipk for CE 3.1.0, distributed through Preware.
2. **CE 3.2.0:** chat enablement baked into the image.

Both use one package. The Chat Enabler ipk is the unit; 3.2.0 bakes it the way
`bake.py` already bakes Synergy generic, by replaying its postinst at build
time. One set of install logic, two delivery paths, and a 3.2.0 device can
upgrade it from the feed.

## Shared inputs (from the Oscar repository, pinned)

| Piece | Source in Oscar | Notes |
|---|---|---|
| `libaim.so` | `client/libaim/build-touchpad.sh` | Built against libpurple 2.14.13. The 2026-10-10 prototype loaded in CE's transport, so the ABI is proven |
| Account type `org.webosarchive.chat` | `client/webos-chat/accounts/` | Own icons since `dc79cfd` |
| Service `com.palm.webosarchive.chat` | `client/webos-chat/service/` | node 0.4, `foundations`, curl |
| Activities `start` / `hourly` / `profile` | `client/webos-chat/service/configuration/activities/` | `hourly`/`profile` persistent since `dc79cfd` |

The Oscar changes (asks 1–3 in the findings) landed in Oscar `dc79cfd`
(2026-10-12, not yet pushed). That's the commit pinned in
`packages/webos-chat/OSCAR_COMMIT`.

## 1. Chat Enabler (CE 3.1.0, Preware)

**Status (2026-10-13):** `scripts/webos-chat-enabler.sh feed` builds
`build/work/ipk/org.webosarchive.webos-chat_3.1.0_armv7.ipk`. The whole package passed install,
chat, update, Accounts removal, Preware removal and restart on topaz (CE 3.1.0), compared
side by side with a stock 3.0.5 TouchPad. Results are in `WEBOS-CHAT-HANDOFF.md`.

- **Oscar:** pinned in `packages/webos-chat/OSCAR_COMMIT` (`bf5daed`). It adds the hidden setup
  page `org.webosarchive.chat.setup`, the public `enable` method, the plugin alias patch, and
  `onDelete` in the template (removing the account removes libpurple's copy of it).
- **IM transport:** pinned in `TRANSPORT_COMMIT` (`1960854` on codepoet80/imlibpurpleservice).
  It's built by `scripts/build-imlibpurpletransport.sh` from pinned public sources and installed
  over Synergy's (the original is kept). It fixes:
  - presence after an auto-login;
  - the buddy-removal crash loop;
  - removed buddies coming back;
  - stale rows that couldn't be removed;
  - signing back in after a restart;
  - auto-away after 5 minutes;
  - signing in accounts webOS no longer has (`d3120ab`);
  - two launchers racing (`1960854`, below).
- **One launcher (`/var/imdaemon.sh`, from the same commit):** the imtransport job no longer
  launches the transport. It calls it on the bus so ls-hubd starts it, keeps it resident with a
  flag file, and restarts a copy that doesn't answer on the bus within 60 s. The transport's
  private role gets `com.palm.lunasend` for that call. This replaces the
  `imwrap-resident-wait.block` patch (the 3.1.0 enabler no longer touches `/var/imwrap.sh`, and
  puts back the original where an earlier build patched it). The block file stays only because
  the 3.2.0 bake still uses it; see "Revisit" below.
- **Public bus:** a public launcher and role (inbound `*`), because Accounts runs the setup page's
  calls on the public bus.

### Package (decided)

| Field | Value |
|---|---|
| Package id | `org.webosarchive.webos-chat`, shared with the legacy-webOS enabler |
| Title | webOS Chat Enabler (AIM) |
| Version | 3.1.1 (3.1.0 plus the chatthreader fix, KNOWN-ISSUES #15); the legacy enabler uses lower versions |
| Architecture | `armv7` (it carries `libaim.so`) |
| Preware | `Source` JSON: Feed "WOSA Modernize", Category "Modernize", `MinWebOSVersion` 3.1.0 (keeps it off legacy devices), `Post{Install,Update,Remove}Flags` `RestartDevice` |
| Launcher | no icon: there's no app, and the payload is staged under `usr/palm/webosarchive/webos-chat/` |

- **Where the sources live:**
  - `packages/webos-chat/`: control, postinst, prerm, ls2 roles and launcher,
    `VERSION`, `OSCAR_COMMIT`;
  - `scripts/webos-chat-enabler.sh`, which builds it.
- **How the build uses Oscar:**
  - It takes the pinned commit's `client/` with `git archive`.
  - It builds `libaim.so` with Oscar's own `build-touchpad.sh` into
    `build/work/`, and checks that the webOS Chat defaults are in the binary.
  - It checks the service and JSON files with node.
- **Scripts:** a control.tar.gz `postinst`/`prerm` only, with no `pm*.script`.

### postinst (copies files only)

Everything takes effect at the restart Preware asks for:
- ls-hubd reads the roles and the launcher;
- the transport loads the plugin;
- the accounts service reads the template;
- the activity manager registers the activities.

So the postinst makes no `luna-send` or `initctl` calls. It also works as an OTA
postinst: it runs in a chroot without cryptofs, and every path exits 0 except
the not-CE gate.

1. **Gate:** if `/etc/palm-build-info` doesn't say `webOS CE`, `exit 1` and
   change nothing. A missing IM transport only logs a warning.
2. **Plugin:**
   - `libaim.so` goes to `/media/cryptofs/synergy-purple-plugins/` (when
     cryptofs is mounted) and to `/usr/palm/ce-seed/cryptofs/synergy-purple-plugins/`
     (when that folder exists), so a re-initialised cryptofs gets it back.
   - Both copies go through a temp file and `mv`, so on an update the running
     transport keeps its mapped copy.
3. **Template:** `/usr/palm/public/accounts/org.webosarchive.chat/`. That's the
   rootfs location, the same as the 3.2.0 bake, and only about 6 KB.
4. **Service:**
   - the files go to `/usr/palm/services/com.palm.webosarchive.chat/`;
   - the roles go to `/usr/share/ls2/roles/{prv,pub}/`, modelled on
     `com.palm.accountservices`;
   - the launcher is `/usr/share/dbus-1/system-services/com.palm.webosarchive.chat.service`.
5. **Activities:** copied from Oscar's `configuration/activities/` to
   `/etc/palm/activities/com.palm.webosarchive.chat/`. Oscar keeps one copy,
   and the copy into the `/etc` layout is ours.
6. **Log:** `/var/log/webos-chat-enabler.log`. Root is left read-write, because
   ipkg writes its status after the postinst returns.

### prerm (detached)

On a Preware removal, the prerm runs inside LunaSysMgr. So it only writes a
cleanup script to `/var/palm` and starts it fully detached, with
`start-stop-daemon -b -x <script>`, since CE's busybox has no `setsid`. With `-x /bin/sh` it
matches any running shell and starts nothing. A one-shot boot job runs the same script again if
a restart cuts it off; measured finishing 23 s into boot. The postinst kills a pending cleanup
and deletes its job, because a removal is never followed by a postinst.

The cleanup:
1. waits for ipkg to remove the payload (ipkg's record and a payload file both gone; up to 2 min);
2. if the payload is still there, it was an **update**: do nothing. (ipkgservice doesn't run the
   prerm on an upgrade or a same-version reinstall at all; measured. Preware's remove-then-install
   `replace` applies only to types with `updateAsReplace`, and `Linux Application` isn't one);
3. otherwise:
   - delete every `org.webosarchive.chat` account as `com.palm.webosarchive.chat`, the only
     caller in the template's `writePermissions`, while the template is still there; its
     `onDelete` has the transport drop libpurple's copy;
   - cancel the service's activities by id;
   - remove the plugin from both places, plus the template, the service, the roles, the
     launcher, the activities, the setup page and the service's state;
   - put back the transport, `/var/imdaemon.sh` and the transport's role, each only if it is
     still the file this package installed.

### Oscar `dc79cfd` covers the asks

- **Icons:** its own icons.
- **Activities that survive reboots:** `hourly` and `profile` are now persistent.
- **The OOBE gap:**
  - An account only counts as made once the transport has written its
    `com.palm.imloginstate.libpurple` record.
  - If no record appears within 30 s, the service removes the account and
    makes it again, up to 5 times.
  - The service's time limit is now 360 s to fit the retries.
  - It can't simply call the transport to see if it's up: the transport's role
    file doesn't accept calls from the chat service.

### Test plan (fresh 600056 flash)

1. **Install, signed out:** Preware asks for a restart, and no Launcher icon
   appears. After the restart:
   - `com.palm.webosarchive.chat` is on the bus (`Unknown method` is success);
   - the three activities are in `com.palm.activitymanager/list`;
   - `libaim.so` is in `/usr/lib/purple-2`, through the bind mount;
   - there's no chat account.
2. **Sign in after OOBE** with a member who has a username: within seconds a
   "webOS Chat" account appears and Messaging signs in.
3. **Install while signed in:** after the restart, the `start` activity creates
   the account.
4. **Chat** both ways with Lunacy and with a stock device that has the hosts
   line.
4b. **First message from someone who isn't a buddy** (no contact, no linked
   buddy): it gets a conversation. Without a second account, inject a
   `com.palm.immessage.libpurple:1` record as `com.palm.imlibpurple` (folder
   `inbox`, `flags.visible: true`) and check it gets `conversations`
   (KNOWN-ISSUES #15).
5. **Reboot:** the activities and the account are still there, and the account
   signs in again.
6. **New pass phrase on the website:** replaced within the hour.
7. **`signOut`:** the chat account goes away.
8. **Wrong pass phrase:** while watching `journalctl -u oscard`, no tight
   retry loop.
9. **Update by reinstalling the same ipk:** the cleanup log says "update"
   and nothing is removed.
10. **Uninstall through Preware:**
    - the UI doesn't freeze;
    - after the restart, no account, files, roles or activities are left;
    - other Synergy connectors still work.
11. **Luna Restart from the power menu afterwards:** no freeze.

## 2. CE 3.2.0 (baked)

### Approach

1. **Where the ipk goes:** in `AddToImage/PatchOrReplace/` (the feed/OTA ipk
   convention).
2. **Its `bake.py` tier** is modelled on the Synergy generic tier and replays
   the postinst at build time:
   - **`libaim.so`** into the image's `usr/lib/purple-2/`. The existing
     Synergy tier copies that folder into
     `/usr/palm/ce-seed/cryptofs/synergy-purple-plugins/`, so the new tier has
     to run before that copy. The seed job then delivers it to cryptofs once
     per flash and keeps it there.
   - **The template** into `/usr/palm/public/accounts/org.webosarchive.chat/`
     (rootfs; a baked image has no postinst to put it in cryptofs).
   - **The service, roles and launcher** into rootfs, as above.
   - **The activities** into `/etc/palm/activities/com.palm.webosarchive.chat/`,
     where the configurator registers them on first boot.
   - **An ipkg status stanza,** added through `preware-seed.sh` like Govnah's
     and Synergy's (11 → 12), so Preware shows the package as installed and can
     upgrade it from the feed.
3. **The overlay manifest's `inputs_sha256`** picks up the new ipk, so the
   overlay freshness guard covers it.
4. **The chatthreader fix** (KNOWN-ISSUES #15) comes from chatthreader 1.1.0.3,
   already in `AddToImage/PatchOrReplace`. The enabler's postinst step 7 then
   finds the fixed file and leaves it alone.

### Revisit: the transport watchdog (replaced in the 3.1.0 enabler, still in the 3.2.0 bake)

**What it was:** `imwrap-resident-wait.block` (imlibpurpleservice `15f09c9` + `a40e37c`). The
imtransport job and ls-hubd both launched the transport. The job's launch waited behind the
hub's copy, and killed one that sat for 60 s with one thread blocked on a futex.

**What replaced it (imlibpurpleservice `1960854`, in the 3.1.0 enabler):** the job launches
nothing. `imdaemon.sh` calls `com.palm.imlibpurple` and ls-hubd starts it, so there is one
launcher and nothing to race. A copy stuck in startup is detected by not answering on the bus
within 60 s, not by a guess from `/proc`. This was the LuneOS project's suggestion ("start it
via dbus"). Measured on topaz 2026-10-13: a killed transport is back in 5 s; a frozen one is
replaced 60 s later and signed in 4 s after that; a 90 s Wi-Fi outage keeps the same process
(resident through the flag file).

**What's known about the hang:**
- 2 of 7 boots on 2026-10-12 (topaz), both right after files were swapped on the device. On
  2026-10-13, 6 boots with an on-device recorder (`/var/log/chatboot/`) showed none.
- The cause isn't found. The Lunacy project found two early returns in PmLogLib's constructor
  that skip releasing `sem.PmLogLib`, but topaz logged no `PmLogLib: shmget/shmat` errors on
  either hung boot. So the likelier cause is a PmLog process killed between taking and releasing
  the lock, which fixing those returns wouldn't cover.
- **Keep deleting `/dev/shm/sem.PmLogLib` before each launch.** That deletion is the only thing
  that unwedges a locked one. (An earlier version of this plan suggested stopping it; that was
  wrong.)

**For 3.2.0:**
1. Bake `imdaemon.sh` from the pinned transport commit, plus the role entry, the way the
   enabler's postinst installs them, and drop the block from `bake.py` (lines ~202 and ~1476).
   Then delete `packages/webos-chat/imwrap-resident-wait.block`.
2. Keep the boot recorder in the release test, so a hang is captured with its stack and
   semaphore holders instead of only being restarted.

### Image-specific work

- **The OOBE gap.** A sign-in during OOBE happens about 2 minutes before the
  transport and the plugin are in cryptofs. Oscar `dc79cfd` handles it: it
  makes the account again until the transport writes its login state, up to
  5 tries about 50 s apart, so roughly 4 minutes. That outlasts the measured
  2-minute gap, but not by much. If a slow seed beats it, run a `sync` from
  `ce-cryptofs-seed`'s `kick_dependents`, after the transport kick. It's also a
  test row: OOBE sign-in, then chat without rebooting.
- **First boot.** Check the activities against the first-boot readiness
  invariant: mounted isn't writable, so verify before setting any flag. The
  `start` activity runs before first use, when there's no token, and that has
  to be a harmless no-op.
- **Opt-in vs default.** This needs your decision. Baking makes it default-on
  for every signed-in member who has a username. The options:
  - default on;
  - baked but dormant until a setting is switched on;
  - leave it out of the image and offer it in the feed only.
- **Branding:** new icons only (the 3.2.0 HP-branding goal).
- **OTA 3.1.0 → 3.2.0:** OTA payloads are lists of ipks, so the enabler ipk
  goes in the payload as is. A 3.1.0 device that already installed it from
  Preware just upgrades.
- **Docs:** rows in `TEST-PLAN.md` (the enabler test plan plus the OOBE row);
  `KNOWN-ISSUES.md` if the OOBE gap ships unfixed; `OTA-PLAN.md`'s 3.2.0
  payload list.

### Order of work

1. Raise the Oscar asks (icons, persistence, waiting for the transport).
2. Build the enabler ipk and run its test plan on topaz (CE 3.1.0).
3. Publish it to the feed.
4. Add the `bake.py` tier, bake, flash, and run the OOBE and first-boot rows.
