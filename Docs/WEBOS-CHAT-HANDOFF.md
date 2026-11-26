# webOS Chat Enabler: status (2026-10-13, enabler 3.1.1)

Tested on topaz, side by side with a stock TouchPad:
- **CE device:** `c37f7a…`, webOS CE 3.1.0.
- **Stock reference:** `1b4452…`, HP webOS 3.0.5 with the stock AIM account and an
  `/etc/hosts` line for `login.messaging.aol.com`.

Every path tested works on CE. Those tests missed the first message from a sender who isn't a
linked buddy, which was broken until 3.1.1 (KNOWN-ISSUES #15). It matches or beats the stock setup everywhere
except time to sign in after boot, which is about 10 s slower. Still untested: the rows in
"Not tested yet" below. Publishing to the feed is your call.

## Package

- **Built with:** `scripts/webos-chat-enabler.sh feed`, producing
  `build/work/ipk/org.webosarchive.webos-chat_3.1.1_armv7.ipk` (version 3.1.1: 3.1.0 plus the
  chatthreader fix below).
- **Pins:**
  - Oscar `bf5daed`: adds `onDelete` to the account template.
  - transport `1960854` on codepoet80/imlibpurpleservice: one launcher (see below).
- **What changed today:**
  - **Transport launch:** the enabler no longer patches `/var/imwrap.sh`. It installs the
    transport's own `/var/imdaemon.sh`, which has ls-hubd launch the transport, and adds
    `com.palm.lunasend` to the transport's private role. Removal puts all of it back.
  - **Account removal:** the template's `onDelete` makes the transport remove libpurple's saved
    copy of the account (screen name and chat key in `accounts.xml`). Before, it outlived the
    account.
  - **Package scripts** (after the Preware feed agent's review):
    - the postinst cancels a removal's pending cleanup, so a remove followed by a quick
      reinstall can't delete the new install;
    - the prerm writes the cleanup through a temp file;
    - the prerm starts the cleanup with `start-stop-daemon -x <script>`. With `-x /bin/sh` it
      had found a running shell and started nothing, and only the nohup fallback worked;
    - the control type is `Linux Application`, as in the legacy build. `Application` gave
      Preware a Launch button for a package with no app.

## Measured, CE vs stock

| | CE 3.1.0 + enabler | Stock 3.0.5 |
|---|---|---|
| Signed in after boot (uptime) | 63–71 s, 6 of 6 boots | 59 s |
| Session stability | no drops over 30 min | reconnects every ~5 min (server keepalive?) |
| Back after Wi-Fi returns (20 s off) | 6 s | 70 s |
| Wi-Fi off 90 s | same process stays resident; back 6 s after | not measured |
| Transport killed | back in 5 s | (no keep-alive) |
| Transport frozen in startup | replaced after 60 s, signed in 4 s later | (no recovery) |
| Messages both ways, presence both ways | yes | yes |
| 1 h 43 m unplugged, screen off | asleep 88%; 9 of 9 pings delivered in 0–3 s; 10 reconnects; same transport process throughout | asleep 88%; 9 of 9 delivered in 0–2 s; 14 reconnects; same process throughout |
| Message to a sleeping tablet | wakes it, delivered | wakes it, delivered |

Sign-in is measured as an ESTABLISHED TCP connection to port 5190, not the db8 login state
(it still says "online" from before a reboot) and not `imstdout.log` (the transport's stdout
is block-buffered, so lines arrive late).

## Lifecycle paths verified on the CE device

1. **Install through ipkgservice (Preware's path), then restart:**
   - the account is created by the service;
   - it signs in at 68 s.
2. **Remove the account in Accounts** (as `com.palm.app.accounts`):
   - libpurple's copy is removed and the connection drops;
   - the next sync answers `off` and doesn't recreate it;
   - `enable` from the setup page recreates it, signed in within 8 s.
3. **Reinstall the same version:** ipkg doesn't run the prerm, and the postinst changes nothing.
4. **Upgrade** (test builds repacked as 3.1.0.1, .2, .3):
   - no prerm runs, and the account and activities stay;
   - upgrading from the earlier build puts back the original `/var/imwrap.sh`.
5. **Preware removal with a live account:**
   - the cleanup deletes the account and cancels the activities;
   - every file goes back to stock: transport `55eaa5ed…`, `imwrap.sh` `1838357a…`,
     `imdaemon.sh` `b6b9059b…`, role `9a6f67f5…`;
   - no `.webos-chat-*` files are left, and `accounts.xml` holds 0 accounts;
   - db8 keeps only palmprofile and telephony;
   - after the restart, the stock transport runs and makes no AIM connection.
6. **Remove, then reinstall straight away:** the postinst cancels the waiting cleanup, and
   nothing is deleted after it.
7. **Remove, then restart before the cleanup runs:** the boot job finishes it 23 s into boot.
   The account is deleted, every file is back to stock, and the job removes itself.

Preware updates this package type (`Linux Application`) by installing over it, with no prerm
(`packages.js`, `updateAsReplace`). Remove-then-install is only used for kernels, patches, fonts,
themes and the OS types.

Yesterday's "no chat account after install" wasn't a bug. That install boot lasted 57 s before
the removal: the service had only reached `listAccounts`, and the transport was still in
pre-start.

## Not tested yet

- **First message from someone who isn't a buddy** (no contact, no linked buddy): the first
  message from every new webOS Chat user. Every test above used `curator`, `tester` and
  `touchpadtest`, all buddies already linked to a person, so this was never exercised. It was
  broken: the chatthreader's `findPersonViaBuddy` never resolved on a buddy miss, and the
  message was stored but never filed into a conversation (found by the Lunacy agent on a
  Pixel). Fixed in chatthreader 1.1.0.3 (`AddToImage/PatchOrReplace`). Verified on topaz with
  injected db8 messages (not yet a real send from a stranger account): on 1.1.0 both a
  `lunacyprobe1` and a `curator` message hung (`findByIM` misses `curator` too on CE); after
  installing 1.1.0.3 through ipkgservice both got conversations and showed in Messaging.
  Released 3.1.0 ships the bug, so enabler 3.1.1 carries the fix (postinst step 7): it swaps in
  the fixed `newmessageassistant.js` only over the exact 3.1.0 file (md5 `37c050bc…`), keeps the
  original, and removal puts it back if the file is still ours. Verified on topaz: upgrade
  3.1.0 → 3.1.1 through ipkgservice swapped the file; after the restart an injected
  `lunacyprobe2` message was threaded at once. The removal restore is not yet exercised.
  Still owed: a real send from a stranger account. Upstream: branch
  `fix-findpersonviabuddy-miss` is pushed to `codepoet80/com.palm.messaging.chatthreader`.
  The PR against Herrie's `herrie/milestone1-channel-routing` waits until after release
  (KNOWN-ISSUES #15).
- **Signing out of the webOS Account** should remove the chat account, and signing in should
  bring it back. Signing back in needs your password on the device.
- **A new pass phrase on the website** should be picked up by the hourly sync.
- **A wrong pass phrase** shouldn't cause a tight retry loop (watch the server log).
- **Longer than 2 hours unplugged.** It went 1 h 43 m (table above). Battery drain wasn't
  measured.
- **OOBE sign-in.** This belongs to 3.2.0.

## topaz's state now

- **CE device:** enabler 3.1.1 installed, chatthreader fixed by it. **Not signed in:** at 11:41
  PDT the service replaced codepoet's account (what it does on a pass phrase change), and
  since then the server answers `AcctMgr_Bad_Authentication`. Not caused by 3.1.1 (Messaging
  already showed Offline before it was installed); not yet investigated.
- **Test instrumentation, still installed:**
  - `/var/palm/chatbootrec.sh`, run by `/var/palm/event.d/chatbootrec` (log in
    `/var/log/chatboot/`). On every boot it samples the transport every 2 s for 5 minutes, and
    dumps the kernel stack, maps and semaphore holders of a copy stuck on a futex for 20 s.
  - Remove both files when they're no longer wanted.

## Other open items

- **The PmLog boot hang:** none in 6 recorded boots. See `Docs/WEBOS-CHAT-PLAN.md`, "Revisit".
  Keep deleting `sem.PmLogLib` before each launch; that deletion is the only thing that unwedges
  it.
- **The 3.2.0 bake** still uses `imwrap-resident-wait.block`. It should switch to the same
  `imdaemon.sh` and role entry (plan doc, "Revisit").
- **The stock device reconnects every ~5 minutes.** `curator` and `tester` sign off and on
  every 304 s, while CE's session holds. That looks like the server dropping clients that don't
  send keepalives; worth a look on the Oscar server side.
- **A Synergy reinstall** overwrites the enabler's transport and `imdaemon.sh`; the user has to
  reinstall the enabler afterwards.
- **The transport's "skip nameless buddy" filter** is still upstream behaviour.
- **Away status differs from stock, on purpose for now.** Stock goes away 5 minutes after
  signing in (libpurple's auto-away, with no source of user activity). CE stays available
  (transport `2be2099`). We'll match stock later. Check whether that timer is what triggers the
  stock tablet's 304 s reconnects.
