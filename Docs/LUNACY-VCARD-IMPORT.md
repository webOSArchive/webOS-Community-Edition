# Import vCards: notes for Lunacy

For the agent adding webOS CE's Import vCards to Lunacy. The feature is in this repo at
commit `7bd5641` (Contacts 3.2.0). It works on a TouchPad, including a real tap through the
file picker. It has not been run on Lunacy. The Lunacy findings below come from reading its
source on 2026-11-02 (Lunacy commit `dbd305a`).

**One thing must change in Lunacy first: the picker will come up empty for `.vcf` files**
(see "Required change"). Nothing else was found that needs a Lunacy code change.

## What to take

Take finished files, as usual. Nothing here needs re-applying as a patch.

| From this repo | Where it goes | Changed |
|---|---|---|
| `apps/com.palm.app.contacts/` | `CoreApps/com.palm.app.contacts/` | New `app/utils/VCardParser.js`, `app/utils/VCardBatchImport.js`, `tests/VCardParserTest.js`; edited `app/ContactsApp.js`, `depends.js` |
| `apps/org.webosarchive.photos.service/service.js` and `services.json` | Lunacy's copy of the service (`Workbench/vendor/webos-ce/apps/`, which feeds `local-assets`) | Accepts Contacts as a caller; new `remove` command |

Take both. The service still works for Photos as before. `services.json` matters as much as
`service.js`, because `remove` is declared there.

Contacts stays at version 3.2.0, so nothing will show that the tree changed: check for
`app/utils/VCardBatchImport.js`. The `contacts` framework and the system files are unchanged.

## Required change: `.vcf` is filtered out of the picker

Contacts opens the picker with `fileType: "document", extensions: ["vcf", "VCF"]`.

- **On a TouchPad,** `document` is the media indexer's `com.palm.media.misc.file:1`: every
  file that isn't an image, audio or video. So `.vcf` is a document, and `extensions` narrows
  the list to it.
- **On Lunacy,** `LunacyService.typeOf()` has an allowlist of document extensions without
  `vcf`, so it returns `other`. `listFiles` drops the file on `types: ["document"]` before
  the picker's `filtered()` ever applies `extensions`.

The result would be an empty picker. The general fix is the TouchPad's rule: anything that
isn't image, audio or video is a `document`. `FileIndex.isDocument()` already works that way.
Adding `vcf` to the list would fix this one app and leave the difference for the next.

`filtered()` lowercases the extension, so `"VCF"` in the list simply never matches; an
uppercase `.VCF` file still matches `"vcf"`.

## Checked, and fine as it stands

- **Reading the file.** The app does an XHR to `file:///media/internal/...`, with a
  percent-encoded path and `overrideMimeType`. `net.js` maps that URL through
  `__lunacyFileUrl` and supports `overrideMimeType`, and `AppServer` resolves it through
  `UserFiles`, so mapped folders like `downloads` should work.
- **Writing photos.** `host.js` wraps `mkdirSync`, `openSync`, `renameSync` and `unlinkSync`,
  and `.contactphotos` has no Android mapping, so it lands in Lunacy's own tree. The service
  creates the folder if it is missing.
- **Database paging.** `Db8.kt` caps `limit` at 500 and pages through `page` and `next`, as
  db8 does. The app asks for 500 at a time.
- **Picker result.** `listFiles` returns `fullPath`, which is all the app reads. Cancel
  returning an empty list is handled.

## Behaviour to watch when testing

- **Saves go straight to db8.** The import calls `Contact.save()`, a plain `DB.put`, not the
  linker's `saveNewPersonAndContacts`. So people appear only through `linkerWatch`, a little
  after each save. If contacts save but the list stays empty, look at that activity first.
  On the TouchPad, people kept draining for a couple of minutes after a bulk delete of 742,
  so give the linker time before comparing counts.
- **A contact and a person aren't one to one.** The real test file gave 209 contacts and 208
  people, because the linker merged a pair. That is correct.
- **Failed duplicate reads are quiet.** If the query for existing contacts fails, the app logs
  a warning (`VCardBatchImport: could not read existing contacts`) and imports anyway, so
  duplicates are the symptom. It queries `com.palm.contact:1` on `accountId` with `select`
  and depends on the kind's index for that.
- **Photos fail softly.** A missing or failing service leaves contacts without photos, and the
  summary reports "N photos could not be added". That is honest behaviour, not a bus problem
  to paper over; rule 2 applies as usual. After the first service failure, the remaining
  photos are not attempted.
- **Check `com.palm.image/convert` on odd sizes.** The app cuts photos with
  `{focusX: 0.5, focusY: 0.5, suggestedXsize: <short side>}`, so the scale is
  `196 / short side`, then `50 / short side`. `ImageService.kt` returns the image whole at
  exactly scale 1, per `Docs/architecture.md`. A non-square photo whose short side is exactly
  196 or 50 would therefore stay non-square. I didn't test that case on a TouchPad, so measure
  it there before changing anything. Also try a PNG source: 7 of the 33 photos in the test
  file were PNGs, and they came out as JPEGs.
- **Stop depends on event capture.** The import starts through `enyo.asyncMethod` because a
  closing popup releases the event capture. Started directly from the confirm dialog's `onOK`,
  the progress dialog's Stop button goes dead. If your Enyo fork changes popup capture, retest
  Stop during a running import, not with the dialog idle: it worked when idle even while
  broken.

## Test plan

Use made-up contacts only. A real person's contacts must not go into either repo, its docs or
its logs.

`node apps/com.palm.app.contacts/tests/VCardParserTest.js` runs the parser's 20 tests with no
device or framework. Then on Lunacy:

| Test | Expected |
|---|---|
| Open the picker with a `.vcf` in `downloads` and other files beside it | Only the `.vcf` is listed |
| Import 4 cards, one with a photo | "4 contacts imported."; the photo shows in the list and in details |
| Import the same file again | "4 were already in Contacts or empty." |
| Note with a folded line, name with `AT&T <Labs>`, address with `\,` and `\n` | Text is intact; no `&amp;`, no backslashes |
| `BDAY;X-APPLE-OMIT-YEAR=1604:1604-03-15` | Stored as `1900-03-15`, shown with no year |
| 300 cards, press Stop, import again | "Import stopped. N contacts imported.", then the rest with N skipped |
| More than 500 existing contacts, then re-import the newest | Skipped, which proves paging |
| A corrupt photo (`/9j/AAAAAAAAAAAA`) and a HEIC one | Contacts imported, "2 photos could not be added." |
| A Latin-1 file | Accented names are correct |
| A `.vcf` holding no cards | "There are no contacts in this file." |

On the TouchPad, 209 real cards with 33 photos took under a minute. Every photo became a
196×196 and a 50×50 JPEG, and the temporary source files were removed. Expect
`/media/internal/.contactphotos` to hold only `<timestamp>.jpg` files afterwards; a `vcard-*`
or `*.ce-edit` file there means a step failed.

## Lunacy docs this makes stale

- `Docs/architecture.md`, Photos: the service "takes only Photos' calls". Contacts now calls it
  too, for `/media/internal/.contactphotos` alone.
- `Docs/architecture.md`, Contacts: "vCard import and export ... untried".
- `Docs/roadmap.md`: Contacts vCards, likewise.
- `CoreApps/com.palm.app.contacts/NOTICE`: worth a line about Import vCards.

The stock `com.palm.service.contacts/importVCard` is still what runs when a `.vcf` is opened
from outside the app (`launchParams.target`). This feature doesn't replace that path, so
importing a `.vcf` that way can still show the old importer's faults.
