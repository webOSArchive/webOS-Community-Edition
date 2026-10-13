# webOS Chat Enabler: where work stopped (2026-10-12, evening)

The package is **not ready for the community**. Removal is the part that isn't proven yet.

## Package

- **Built with:** `scripts/webos-chat-enabler.sh feed`, producing
  `build/work/ipk/org.webosarchive.webos-chat_3.1.0_armv7.ipk` (version 3.1.0).
- **Pins:**
  - Oscar `5886516` (pushed);
  - transport `d3120ab` on codepoet80/imlibpurpleservice, which adds "sign in only the accounts
    webOS asks for", the Lunacy project's leftover-account bug.
- **Building `d3120ab`:** it was pushed together with this handoff. If it isn't on GitHub,
  build with `IMLIB_URL=/home/jonwise/Projects/imlibpurpleservice`.

## What was verified on topaz (CE 3.1.0, `c37f7a…`)

- **Install through ipkgservice (Preware's path), then restart:**
  - the postinst patches `/var/imwrap.sh` and installs the transport;
  - the transport runs and signs in.
- **Remove, then restart immediately (the cleanup gets cut off):** the boot job finishes the
  cleanup. Back to the stock checksums and gone:

  | Item | Result |
  |---|---|
  | transport | stock checksum `55eaa5ed…` |
  | `imwrap.sh` | stock checksum `1838357a…` |
  | plugin, template, service, roles, launchers, setup page, state, activities | removed |

## Bugs found in the removal tonight, fixed in `prerm` but not re-verified on the device

1. **Every removal looked like an update, so nothing was cleaned up.** ipkg leaves empty
   directories behind. "Installed" now means ipkg's `info/*.control` record AND a payload file
   both exist.
2. **A restart within ~15 s of removal killed the cleanup.** The cleanup now lives in
   `/var/palm` and has a one-shot boot job (`/var/palm/event.d/org.webosarchive.webos-chat-cleanup`).
   Verified.
3. **Activities were never cancelled.** Cancel by name doesn't work on 3.0.5; it now cancels by
   id, every activity created by `com.palm.webosarchive.chat`. Verified.
4. **The cleanup never found the chat accounts.** The account-list parsing was wrong. It now uses
   `listAccounts {"templateId":"org.webosarchive.chat"}` and takes the `"++…"` ids, retrying until
   the accounts service answers (at boot it may not be up yet).
5. **`deleteAccount` refused the cleanup:** "Permission denied … not specified in template
   writePermission". The cleanup now calls it as the service (`luna-send -a
   com.palm.webosarchive.chat`). Verified by hand on topaz. It must run while the template still
   exists, before the template files are removed; it does.
6. **ipkg's empty staging directories were left behind.** Now removed.

**NOT YET VERIFIED:** fixes 4 and 5 in a real removal. In the last test run the service didn't
create a chat account after install (0 chat accounts after restart, even though the transport
signed in), so account deletion on removal wasn't exercised. The reason is unknown. Start there.

## Next steps

1. Find out why the service didn't create the chat account after that install. Check the
   `hive.chat.js` lines in `/var/log/messages*`, `/var/preferences/com.palm.webosarchive.chat/state.json`,
   and whether the webOS Account token is present.
2. Run one install → chat works → Preware remove → restart cycle and confirm the chat account
   is deleted. Compare against the baseline:
   - transport `55eaa5ed…`;
   - `imwrap.sh` `1838357a…`;
   - no package files, roles, launchers, template, setup app, activities or state;
   - db8 `com.palm.account:1` holds only `++OSeWc9pbomFvyJ` (telephony) and `++OSeZV7Q7WjK5b9`
     (palmprofile).
3. Only then publish to the feed.

## topaz's state now

- **Package:** removed through ipkgservice, then restarted. The boot-job cleanup should have run;
  not checked.
- **Expected:**
  - the stock transport (`/usr/bin/imlibpurpletransport` `55eaa5ed…`) and stock `/var/imwrap.sh`;
  - no chat account.
- **Saved by libpurple:** `accounts.xml` may still list `codepoet`; harmless with the stock
  transport.
- **Also installed:** webOS Account 1.2.0, signed in as `codepoet`.

## Other open items

- **The PmLog boot hang** (the reason for the watchdog). See `Docs/WEBOS-CHAT-PLAN.md`, "Revisit:
  the transport watchdog". The Lunacy project found a real bug in PmLogLib's constructor: two
  failure paths return without releasing `sem.PmLogLib`. But topaz's logs show no
  `PmLogLib: shmget/shmat error` lines across both hung boots, so the remaining cause is a PmLog
  process killed between taking and releasing the lock. Fixing the early returns won't cover that.
  The lock needs to be recoverable (for example a timed wait). Until then, don't stop the
  wrappers from deleting the semaphore: that deletion is the only thing that unwedges it.
  Not yet written into the plan doc.
- **A Synergy reinstall** overwrites the enabler's transport; the user has to reinstall the
  enabler afterwards.
- **The buddy-presence alias patch** (Oscar `8d558fc`) is in the plugin build. The transport's
  "skip nameless buddy" filter is still upstream behaviour.
