# Email modernization plan: Exchange Online, Gmail and Outlook on CE

**Goal:** get webOS CE's mail as close as possible to what Lunacy 0.9.5 does.
That means Microsoft 365 over ActiveSync, and Gmail and Outlook.com over IMAP
and SMTP with OAuth, all on Palm's unchanged mail binaries. It also means
fixing Palm's Exchange time zones and throttling for every Exchange server.

**Inputs:** Lunacy at `c922796` (2026-11-09): `Docs/oauth.md`,
`Docs/outlook-eas.md`, `Docs/eas.md`, `LunaRuntimes/pdk/libpreload/`, and the
report "Lunacy's email and accounts changes, for webOS CE". Lunacy's code is an
input. We copy it and build it here; we never edit the Lunacy repo.

**Status:** plan only, 2026-11-09. Nothing is built.

**Release:** all five phases ship in **webOS CE 3.2.0**, as its main feature
(decided 2026-11-09). So 600102 is not the final 3.2.0 image. The release
waits for phase 5's bake, and that bake is tested with
`Docs/TEST-PLAN.md` §26. The phases set the build order inside 3.2.0.

---

## 1. What CE already has, checked on the 600102 overlay

| Fact | Where | What it means for this plan |
|---|---|---|
| All four mail services start under a CE preload: `LD_PRELOAD=/usr/lib/ssl11mail/libssl_compat.so`, `LD_LIBRARY_PATH=/usr/lib/ssl11mail` | `/usr/share/dbus-1/system-services/com.palm.{eas,imap,smtp,pop}.service`, written by `bake.py` `MAIL_PFX` | The shim is a **second** preload listed beside it. One edit to `MAIL_PFX` adds it to every service. |
| `libssl_compat.so` is an OpenSSL ABI shim: 92 exports, all OpenSSL names, no curl or glib | `/usr/lib/ssl11mail/` | No symbol clash with the shim, which wraps curl, glib and `LSMessageRespond`. Keep them separate libraries. |
| The mail binaries use **CE's** libcurl (`libcurl.so.4.5.0` in `ssl11mail`), not the stock 7.21.7 | same | Lunacy's curl wrappers were measured against another libcurl. They must be retested against this one. |
| The stock mail roles allow `outbound: ["*"]` | `/usr/share/ls2/roles/prv/com.palm.{eas,imap,smtp}.json` (stock) | The mail processes may call a new token service. No role edit is needed for that direction. |
| Modern curl at `/usr/bin/curl` (OpenSSL 1.1, `/usr/lib/curl11`) | rootfs | A JS service can reach TLS 1.2+ endpoints by running it. Stock Node uses OpenSSL 0.9.8 (TLS 1.0 only), so it can't make those calls itself. |
| Account templates and the accounts library come from `system/` | `system/usr/palm/public/accounts/`, `system/usr/palm/frameworks/enyo/0.10/framework/lib/accounts/` | The new templates and the subtitle patch go there as finished files. |
| `subtitleFor` exists in CE's `add-account.js`; `hidden` templates are already filtered | `add-account.js:153`, `get-accounts.js:85` | Lunacy's four-line patch applies, and hidden templates need no code change. |
| **Email is a cryptofs preload** (`/usr/palm/ipkgs/com.palm.app.email/…3.0.13600_all.ipk`) | stock rootfs | Same shape as Calendar: the bake repacks the staged ipk, and an OTA'd device needs a `ce-ota-finish` step. |

## 2. Where CE can't simply copy Lunacy

| Lunacy | CE | Plan |
|---|---|---|
| Sign-in on the device: the provider's page in a WebView, or Android's browser for Google | The TouchPad's WebKit can't run Microsoft's or Google's sign-in pages, and Google refuses web views | **Broker sign-in only** (oauth.wosa.link): sign in on another device, enter a code. On-device sign-in through Atlas is a later option (§6), and it belongs to the Atlas project. |
| Token service in Kotlin (`OAuth.kt`), refreshing directly with the provider | No Kotlin; Node can't do modern TLS | A rootfs JS service that refreshes **through the broker**, using `/usr/bin/curl`. Lunacy already tested broker refresh against its fake provider. |
| The shim gets tokens over `LUNACY_BUS` | No such link | Use `luna-send -P` to the token service with stdin from `/dev/null`, and cache the token in the process until it nears expiry. Decide in phase 1 whether a direct `LSCall` from inside the mail process is safe instead. |
| Security policies through Android's screen lock | The TouchPad enforces EAS policies natively | Nothing to do. CE is already at parity. |
| A foreground service keeps mail running | Not an issue on webOS | Nothing to do. |
| Google through the broker | The broker holds the secret and passes the refresh token, so Google's restricted-scope review may require a paid security assessment (CASA) | **Google is gated** on that review (§5, decision D2). Microsoft does not have this problem. |

## 3. Phases

Each phase ends with something testable on a TouchPad. Nothing goes into a bake
before its hand test passes.

### Phase 1: Exchange fixes without OAuth (`libce-mailshim.so`)

These fixes work against **any** Exchange server today, and they need no
server-side work.

1. Copy into `packages/mailshim/` the mail-only parts of Lunacy's preload:
   - `preload.c` from about line 1260 to the end: the `LSMessageRespond`
     wrapper, the glib channel hooks and the curl glue
   - `wbxmlfilter.h`, `composemail.h`, `calfilter.h`, `backoff.h`, `easerr.h`
     and `mailauth.h`
   - the host tests from `LunaRuntimes/pdk/tests/`

   Leave out the Android path-mapping, `popen`, semaphore and DNS hooks
   (lines 1–1260), which exist only for Lunacy. Record the Lunacy commit, and
   confirm the licence allows the copy.
2. Build with the PalmPDK gcc 4.3.3 toolchain, as SmartKey does
   (`packages/smartkey/build.sh`). Use CE's `ssl11mail` curl headers and the
   luna-service2 headers from LunaCE staging. Run the host tests in every
   build.
3. A compile-time switch splits the adapters into two groups:
   - **On in this phase:** time zones (`calfilter.h`'s zone rewrite), back-off
     (`backoff.h`), and throttle messages (`easerr.h`). Back-off state goes to
     `/var/preferences/ce-eas-backoff`.
   - **Off until phase 3:** the Exchange 16.1 adapters (version, provisioning,
     device info, the reply filter, ComposeMail, calendar items, exceptions).
     They only matter for Exchange Online, which needs a token, so they can't
     be tested on a TouchPad before then.
4. Bake: install to `/usr/lib/ssl11mail/libce-mailshim.so`, and add it to
   `MAIL_PFX` for `com.palm.eas` only. Add a `ce-test-full.sh` check (the md5,
   and the name in the `.service` Exec line).
5. Test on a TouchPad:
   - **Zoho** (legacy Exchange): add, sync, send. An event created on the
     TouchPad shows the right time in Zoho's web calendar across a DST week.
   - Recheck KNOWN-ISSUES #14.
   - Throttling: send a canned 503 with `Retry-After` from a test server.
     Email says "temporarily unavailable", not "check your login".
   - No new rdxd reports from mojomail-eas.

Phase 1 is one rootfs file plus one changed `.service` line, and the OTA
rootfs diff carries both. It can go into an interim 3.2.0 bake as soon as its
TouchPad test passes, so later phases are tested on top of it.

### Phase 2: Token service and broker

1. **Prerequisite, server side (webOSArchive, not this repo):** the broker's
   `apps/microsoft/` app needs a Web client, the redirect
   `https://oauth.wosa.link/callback.php`, and a secret on the server. This is
   the same Entra registration "webOS Email", with the EAS scope added. Google
   waits for D2.
2. **Check reachability from a TouchPad:** `/usr/bin/curl` to `oauth.wosa.link`,
   `login.microsoftonline.com` and `oauth2.googleapis.com`. Use real TLS
   verification against CE's trust store.
3. **`org.webosarchive.ce.oauth`**, a JS service baked into the rootfs. Never
   name it `com.palm.*`: a `com.palm.*` JS service installed into cryptofs
   gets a private role with `outbound: []` and hangs. Behaviour:
   - It runs the broker code flow and holds the tokens, keyed by handle, in
     `/var/palm/data/org.webosarchive.ce.oauth/accounts.json` (mode 600).
   - `token {handle, stale}` returns one of four answers, as the shim's retry
     rules need: a token; `fresh` (under a minute old); empty (the refresh was
     refused); or a distinct "provider unreachable" error.
   - It refreshes with 5 minutes to spare, through the broker, by running
     `/usr/bin/curl`.
   - It sends the template's `credentialsChanged` itself after a re-sign-in.
4. Bus permissions: a private-bus role for the service with an explicit
   `outbound` list (not `[]`, which hangs the service), and inbound from
   `luna-send` and the sign-in app.
5. Test with Lunacy's `Workbench/oauth-test/fake-provider.py` and the broker in
   Docker on the LAN, as Lunacy did. Then test against the real broker with the
   M365 test tenant.

### Phase 3: Sign-in, templates, and OAuth on the wire

1. **Sign-in app** `org.webosarchive.ce.signin`: Lunacy's `MailSignIn.js`
   (Enyo 1), pointed at the CE service, with broker code entry as the only
   path. It runs inside the accounts flow through `validator.customUI`. It
   validates with the mail service's own `validateAccount` before the account
   is made.
2. **Templates** in `system/usr/palm/public/accounts/`:
   - "Microsoft Outlook" (Exchange; subtitle "Email (Calendar and Contacts, if
     available)")
   - a hidden Microsoft IMAP template for the AADSTS70011 fallback
   - Google, behind D2

   The legacy "Microsoft Exchange" template stays as it is.
3. **Shim:** turn on the 16.1 adapters and the IMAP/SMTP XOAUTH2 translation
   (`mailauth.h`). Add the shim to `MAIL_PFX` for `com.palm.imap` and
   `com.palm.smtp`. The translation does nothing unless the password is an
   `oauth2:` handle, so plain-password accounts are untouched.
4. **Test on a TouchPad, against the M365 test tenant:**
   - sign-in through the broker with a security policy
   - all folders sync
   - Ping push
   - send, reply and forward delivered
   - contacts and calendar both ways
   - moving and deleting one occurrence of a repeating event shows in Outlook
   - an AADSTS consent error reads plainly
   - Outlook.com falls back to IMAP. That stays open while Microsoft's "User is
     authenticated but not connected" is unresolved.

### Phase 4: Email and Accounts app changes

All of these are marked `[Lunacy]` in Lunacy's files. Port the logic, not the
strings.

1. **Email "Change login settings"** (`MasterSettings.js`): for a
   `validator.customUI` type, open the sign-in page in modify mode through
   `Accounts.crossAppUI`. Email is a cryptofs preload: repack the staged ipk
   (like `edit_calendar`), and add a step to `ce-ota-finish` that lays the
   patched file over the installed Email.
2. **Subtitle patch:** `loc_subtitle` in `subtitleFor` (CE's `add-account.js`
   in `system/`).
3. **Signature bug** (`data/AccountPreferences.js`): a saved built-in signature
   counts as the default. First check that CE has the bug.
4. **`AddressingPopup.js:222`:** guard `this.$.list`. Check the line on CE's
   stock framework first.
5. **Park:** a server Change for an unknown id is stored with `_id: null`. The
   fix belongs in the `mojomail-eas` binary. A shim-level rewrite (a Change for
   an unknown ServerId becomes an Add) needs per-folder state, so it is not
   planned unless it bites.

### Phase 5: Delivery

- **Rootfs** (the shim, the service, the sign-in app, templates, the
  accounts library, `MAIL_PFX`): the 3.2.0 bake, and the OTA rootfs diff for
  3.1.0 → 3.2.0 (Path A).
- **cryptofs** (Email): the staged-ipk repack for flashes, and a
  `ce-ota-finish` step for OTA'd devices. Add it to `Docs/OTA-PLAN.md` §2.2
  next to the Calendar step.
- **Wire everything into the bake before baking.** A bake must hold every
  finished piece.
- **Stock 3.0.5 / non-CE devices:** no feed ipk planned. CE devices get
  upgrades by OTA (`Docs/OTA-PLAN.md`).
- **Lunacy:** nothing flows back except findings. Tell Lunacy if the TouchPad
  disagrees with any Lunacy measurement.

## 4. Must not break (each phase's gate)

- A legacy "Microsoft Exchange" account against a standalone server (Zoho)
  still adds, syncs and sends.
- A plain-password IMAP/SMTP account (an ISP or Yahoo app password) is
  byte-for-byte untouched on the wire.
- An OAuth IMAP account survives a failed refresh without a sign-in prompt, and
  retries in about 30 s.
- Gmail's `COMPRESS DEFLATE` connection is left alone after the switch, so
  there is no hang.
- No mojomail process crashes (rdxd count) across a reboot and a Luna Restart.

## 5. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | ~~Phase 1 in 3.2.0, or after?~~ | **Decided 2026-11-09:** all phases are in 3.2.0. |
| D2 | Google on CE: through the broker (possible CASA cost), or not at all until there is an on-device path? | Microsoft first. Google waits for Google's restricted-scope review (started 2026-11-05). |
| D3 | Token transport from the shim: `luna-send` subprocess, or an in-process `LSCall`? | `luna-send` first, because it is simple and isolated. Measure the latency on the TouchPad. |
| D4 | In interim bakes before phase 3, are the 16.1 adapters compiled out or compiled in but inert? | Compiled out. Nothing reaches a flash unverified. All of them are on in the final 3.2.0 bake. |

## 6. Later, not planned

- On-device sign-in through Atlas (a modern engine, so a provider page plus a
  loopback redirect may work). That work belongs to the Atlas project, so
  suggest it there.
- POP with OAuth (`com.palm.pop` already sits under the same preload).
- Microsoft's "orphan instance" exceptions, which Lunacy doesn't handle either.
