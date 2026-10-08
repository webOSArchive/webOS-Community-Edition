# system/

CE's changed copies of system files that sit outside any app, at their device paths.
They are here so other projects (Lunacy) can take the finished files instead of
re-applying CE's edits. The apps themselves are in [`../apps/`](../apps/).

| Path | Base | CE change |
|---|---|---|
| `usr/palm/public/accounts/com.palm.palmprofile/` | stock 3.0.5 | named "webOS Account" in every locale |
| `usr/palm/public/accounts/com.palm.facebook/` | stock 3.0.5 | no CALENDAR or CONTACTS provider (dead APIs); PHOTO.UPLOAD kept |
| `usr/palm/public/accounts/com.palm.linkedin/` | stock 3.0.5 | `"hidden": true` (its only capability, CONTACTS, is dead) |
| `usr/palm/frameworks/enyo/0.10/framework/lib/accounts/` | community enyo-accounts 1.1.1.1 | "Get started with your webOS account:" (string-table values only) |
| `usr/palm/frameworks/contacts/` | stock 3.0.5 (submission 114) | `AppPrefs`: one prefs record per kind instead of two on first launch, and existing duplicates healed. In three copies: `javascript/AppPrefs.js`, `114/concatenated.js`, `114contacts.js` (the Node service) |
| `usr/palm/frameworks/mojo/builtins/palmcontactsVersion1_0.js` | stock 3.0.5 | the same `AppPrefs` fix in the prebuilt copy LunaSysMgr gives apps instead of `concatenated.js` |
| App Catalog icons: `usr/palm/applications/com.palm.app.{exhibitionpreferences,searchpreferences}/images/appcatalog.png`, `usr/palm/frameworks/accounts.ui/submission/41/images/{,1.5/}appcatalog-32x32.png`, the accounts library's `images/appcatalog-{32x32,48x48}.png`, `usr/lib/luna/system/luna-systemui/images/notification-{large,small}-appcatalog.png`, `usr/palm/applications/com.palm.app.swmanager/images/appcatalog_icon.png`, `usr/palm/services/com.palm.service.appcatalog/icon.png`, `usr/palm/ipkgs/payment/icon.png` | stock 3.0.5 / community enyo-accounts | the HP (or Palm) shopping bag replaced by the webOS App Catalog icon, at each file's original size (24/32/48/64 px; the 24 px notification icon is hand-made) |

The template and accounts-library edits are made by
[`../build/full-ce/account_templates.py`](../build/full-ce/account_templates.py), whose docstring
explains each one; the `AppPrefs` fix is commented in place. Git history shows the base files first, then CE's changes.
