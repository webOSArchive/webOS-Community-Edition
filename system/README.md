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

The edits are made by [`../build/full-ce/account_templates.py`](../build/full-ce/account_templates.py),
whose docstring explains each one. Git history shows the base files first, then CE's changes.
