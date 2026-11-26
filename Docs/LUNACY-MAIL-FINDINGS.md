# Mail sign-in: notes for Lunacy

From webOS CE, 2026-11-19, while porting Lunacy's mail work
([EMAIL-MODERNIZATION-PLAN.md](EMAIL-MODERNIZATION-PLAN.md)). Four things Lunacy may want. The
first needs a change in Lunacy before its Microsoft app registration can change; the rest are
findings from running Lunacy's code on a real TouchPad.

Nothing here has been run in Lunacy. CE's own versions are in
`system/usr/palm/services/com.palm.service.oauth/oauth-core.js` (a port of `card/OAuth.kt`)
and `packages/mailshim/`, with tests in `tools/oauth-test/test.js`.

## 1. Keep the client id with each account

**Why now.** The Microsoft app registration (`95d7ba4d-…`, "webOS Email") may be replaced by a
new one. The old one stays alive, so accounts already signed in can keep working, but only if
each account goes on refreshing with the client id it signed in with. A refresh token belongs
to the client that got it: sent with another client id, Microsoft refuses it (`invalid_grant`),
and Email asks for a new sign-in.

**What Lunacy does today.** `OAuth.kt` keeps `provider`, `email`, `access`, `got`, `expires`,
`refresh` and `broker` for an account, and `refreshed()` takes the client id (and secret) from
the provider in `providers.json`. So changing `clientId` there moves every signed-in account
to the new client at its next refresh, and every one of them fails.

**The change.**

1. In `done()`, for a sign-in made on the device (not through the broker), store the client
   id with the account, as CE's `client` field.
2. In `refreshed()`, refresh with the account's stored client id, not the provider's. A
   client secret has to follow the same rule: Google's Desktop client has one, so a second
   Google client would need its secret looked up by client id, not by provider.
3. Accounts stored before the field existed have no client id. They were all signed in with
   the old one, so `providers.json` should name it for them: a `legacyClientId` beside the new
   `clientId`, used when an account has none. CE stamps such accounts with whatever id is in
   `providers.json` when the new code first runs, which is enough for CE because nothing has
   shipped. (Status 2026-11-26: CE has since shipped, in 3.2.0, but it stamps `client` at
   sign-in (`oauth-core.js` ~231), so every 3.2.0 account already carries its id and CE
   still needs no legacy id. This finding stays open on Lunacy's side.) Lunacy has shipped: a device can go straight from an old release to one that
   already has the new id, so it needs the old id written down.
4. Signing an account in again makes it the new client's (`done()` writes the new id over the
   old), so accounts move across over time without anyone being forced.
5. The new registration needs what the old one has: the redirect URIs Lunacy uses (the
   native-client one for the page, the loopback for the browser), the delegated permissions
   `EAS.AccessAsUser.All`, `IMAP.AccessAsUser.All` and `SMTP.Send` on Office 365 Exchange
   Online, and `offline_access`, `openid` and `email`.

**One more case to handle.** If the old registration is ever deleted, Microsoft answers its
accounts' refreshes with `unauthorized_client` (AADSTS700016, "application … was not found"),
not `invalid_grant`. `refreshed()` treats only `invalid_grant` as the end of a sign-in; any
other error counts as "couldn't ask just now" and is tried again for ever, so mail would stop
with no prompt. CE now treats `unauthorized_client` and `invalid_client` on a refresh as the
end of the sign-in too.

CE's tests for all of this are the "device:" checks in `tools/oauth-test/test.js` that mention
the client id: an old account refreshing as its own client after the registration changes, a
new sign-in using the new one, signing in again moving an account across, and a deleted
registration ending the sign-in.

## 2. Microsoft's device-code flow needs no broker and no secret

CE can't show Microsoft's sign-in page, and the broker would have needed a second,
confidential registration with a secret. Microsoft's own device-code flow (RFC 8628) does the
same job with the existing public client:

- `POST …/oauth2/v2.0/devicecode` with `client_id` and `scope` gives a `user_code`, a
  `device_code` and `https://login.microsoft.com/device`.
- The person enters the code there on any device. The client polls
  `POST …/oauth2/v2.0/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code`,
  `client_id` and `device_code`, and gets `authorization_pending` until it is done.
- The tokens refresh with the provider directly, as Lunacy's on-device accounts do.

Measured on a TouchPad with the "webOS Email" registration as it stood, with no change to
it: a code was issued and redeemed for a work account and for a personal one, and the work
account's token was refreshed. Lunacy's "Sign In on Another Device" could use this for Microsoft instead of the
broker, which would then be needed for Google only. Google's device flow doesn't allow the
`https://mail.google.com/` scope, so Google stays on the broker.

Two things to know:

- **A personal account is refused Exchange's scope only when the code is redeemed.** The
  person has already signed in and approved by then. The token call answers `invalid_scope`
  (AADSTS70011), and the client has to start a second device-code sign-in with the IMAP
  scopes, which means a second code to enter. CE's page says first that the sign-in worked,
  because its first user took the second code for a failure.
- Some organisations forbid device-code sign-in by policy. Those accounts would be refused
  and need the on-device page. CE has not met one, so the error they get is not known here.

## 3. Palm's time zone form follows the mail service's own time zone

`calfilter.h` takes Palm's zone for "this year's change instants, broken down in UTC". That is
what `mojomail-eas` writes where its own zone is UTC, as in Lunacy, whose mail services run on
their own glibc with no `TZ` and no `/etc/localtime`. On a TouchPad the service runs in the
device's zone and breaks the instants down there: London's changes came out of a device set
to Detroit as "the 4th Saturday of October and of March at 21:00". Lunacy's code doesn't take
that for Palm's form, so on a real device it changed nothing.

Lunacy needs no change, as long as its mail services stay in UTC. If they are ever given the
Android device's zone, `calf_fix_tz` stops recognising Palm's zones in the same way. CE's
`packages/mailshim/lunacy/calfilter.h` has the fix (`calf_palm_offset`, marked `[CE]`), and
`packages/mailshim/README.md` has what it costs: a zone in Windows' form with no names can
then be mistaken for Palm's on some devices, which never happens in UTC.

## 4. A message put in the outbox by hand needs two fields

For anyone testing sends over the bus (`com.palm.smtp/sendMail`) instead of through Email:

- Without `flags.visible: true`, `mojomail-eas` never finds the message. It logs "found 0
  emails in outbox" several times a second for as long as the message sits there.
- Without `timestamp`, `mojomail-smtp` logs in, then fails the send as fatal ("required prop
  not found: 'timestamp'").

Email sets both, so this is only a trap for tests.
