# webOS Chat Enabler: status (2026-10-13)

Tested on topaz, side by side with a stock TouchPad:
- **CE device:** `c37f7a…`, webOS CE 3.1.0.
- **Stock reference:** `1b4452…`, HP webOS 3.0.5 with the stock AIM account and an
  `/etc/hosts` line for `login.messaging.aol.com`.

Every path a user can take now works on CE. It matches or beats the stock setup everywhere
except time to sign in after boot, which is about 10 s slower. Still untested: the rows in
"Not tested yet" below. Publishing to the feed is your call.

## Package

- **Built with:** `scripts/webos-chat-enabler.sh feed`, producing
  `build/work/ipk/org.webosarchive.webos-chat_3.1.0_armv7.ipk` (version 3.1.0).
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

Yesterday's "no chat account after install" wasn't a bug. That install boot lasted 57 s before
the removal: the service had only reached `listAccounts`, and the transport was still in
pre-start.

## Not tested yet

- **Signing out of the webOS Account** should remove the chat account, and signing in should
  bring it back. Signing back in needs your password on the device.
- **A new pass phrase on the website** should be picked up by the hourly sync.
- **A wrong pass phrase** shouldn't cause a tight retry loop (watch the server log).
- **Overnight stability** with the screen off and unplugged. The test devices are on USB, which
  blocks suspend.
- **OOBE sign-in.** This belongs to 3.2.0.

## topaz's state now

- **CE device:** enabler 3.1.0 (this build) installed, signed in as `codepoet`, chatting with
  the stock device.
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
