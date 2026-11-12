# Translating webOS Community Edition

A guide for translators who already have a language pack for stock webOS 3.0.5
and want it to work on webOS CE 3.1.0 and later.

Source repository: <https://github.com/webOSArchive/webOS-Community-Edition>

## 1. How CE stores strings

CE uses the normal webOS localization layout. There is no central string catalog.
Each app keeps its own strings:

| File | Contents |
|---|---|
| `resources/<locale>.json` | the string table: `"English text": "translated text"` |
| `resources/<locale>/appinfo.json` | the app's launcher title (`"title"`) |

The locales that ship today are `de`, `en`, `es`, `fr` and `it`, with region files
`en_ca`, `es_es` and `fr_ca`. A Simplified Chinese translation goes beside them,
in the same layout the stock Phone app already uses:

```
resources/zh_cn.json            (or resources/zh.json)
resources/zh/cn/appinfo.json
```

For each app, `resources/en.json` (or the `$L("...")` calls in the source, where
there is no `en.json`) gives the complete list of keys.

Most of the system is unchanged from 3.0.5. **A 3.0.5 language pack is still
correct for everything not listed below.** The sections below list only what CE
changed.

## 2. Apps CE replaced or extended

The source for each one is in the repository's `apps/` folder.

| App | Folder | What changed | Translation work |
|---|---|---|---|
| Calendar | `apps/com.palm.app.calendar/resources/` | Import Calendar (iCal), repeat-rule rewrite | compare your 3.0.5 file to `en.json` and add the new keys |
| Photos | `apps/com.palm.app.photos/resources/` | rotate and crop editor, exhibition clock | the same |
| Calculator | `apps/com.palm.app.calculator/resources/` | new scientific (landscape) mode | the same |
| Contacts | `apps/com.palm.app.contacts/` | now built from the open-source Contacts app | **no `resources/` folder at all**. The app is English-only today. A translation needs the whole table, built from the `$L("...")` strings in the JavaScript (about 100) |
| Videos | `apps/com.palm.app.videos/resources/` | new app | new table: translate all of `en.json` (14 strings), and add `resources/<locale>/appinfo.json` for the title "Video Player" |

## 3. Changed system files

These are in the repository's `system/` folder, at their paths on the device.
`system/README.md` describes every change.

| Path | Change |
|---|---|
| `system/usr/palm/public/accounts/com.palm.palmprofile/resources/*/` | the account type is named **"webOS Account"** in every locale (stock said "HP webOS Account") |
| `system/usr/palm/frameworks/enyo/0.10/framework/lib/accounts/resources/*.json` | "Get started with your webOS account:" |
| `system/usr/palm/frameworks/contacts/submission/114/resources/*/` | the contacts framework's strings |

## 4. Small strings elsewhere

- **Launcher page "GAMES".** CE renames the launcher's Favorites page to Games.
  LunaSysMgr reads page names from
  `/usr/palm/sysmgr/localization/<locale>/strings.json`. Our build adds two keys,
  upper and lower case, to every locale that exists when the image is built:

  ```json
  "GAMES": "SPIELE",
  "games": "Spiele"
  ```

  A Chinese pack installed afterwards must add these two keys to its own
  `zh_cn/strings.json` (for example `"GAMES": "游戏"`, `"games": "游戏"`),
  or the page will show the English word.

- **"Search DuckDuckGo"** in Just Type. This is built from the existing template
  "Search #{displayName}", so if your pack already translates that template, nothing
  more is needed.

- **First-use setup (OOBE)** is the community "webOS Account" app
  (`org.webosarchive.webosaccount`). Its strings are in its own repository.
  Please send Chinese translations for it there, not to this repository.

- **Backup** is English-only in CE. Its launcher title reads "Backup" in every
  language.

## 5. Things not to use

The repository contains `build/overlays/full-ce/`. The build **generates** this
folder and deletes it on every run, so changes made there are lost. It is useful
only to see what files ship in the image.

## 6. Packaging advice for 3.2.0 and later

From 3.2.0, CE updates Calendar, Contacts, Photos and Calculator by over-the-air
update. An update **replaces the whole app folder**. Any files that an add-on
language package copied into those folders are removed.

There are two ways to make a translation last:

1. **Contribute it to the repository (recommended).** Send the `zh_cn` files for
   the apps in sections 2 and 3 as a pull request (or send them to us), and they
   will ship in every future image and update.
2. **Keep an add-on package**, but plan to reinstall it after each CE update,
   and keep it limited to files CE does not update.

## 7. Questions

Please open an issue on the repository above. Tell us the app, the file path, and
the English string, and we'll answer there.
