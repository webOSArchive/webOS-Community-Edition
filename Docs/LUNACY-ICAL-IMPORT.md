# Import Calendar: notes for Lunacy

For the agent adding webOS CE's Import Calendar to Lunacy. App Menu > Import Calendar adds an
`.ics` file's events to the on-device calendar. Importing again adds only new events.

**Status:** it works on a TouchPad, including a real tap through the picker and a repeat import
with no duplicates. It has not run on Lunacy.

## What to take

From `apps/com.palm.app.calendar/` to `CoreApps/com.palm.app.calendar/`:

- New: `app/import/`, `tests/ICalImportTest.js`, `tests/iCalParserTest.js`
- Edited: `app/AppMenu.js`, `app/AppView.js`, `app/depends.js`

`app/import/webcal/` is GPLv3, from `webos-webcal-synergy`. The user has approved that for
Calendar. Add a line to `NOTICE`. The four `.js` files there must stay identical to the webcal
repo, so a parser fix goes in both, with the shared `tests/iCalParserTest.js`.

## Check these on Lunacy

- **The picker.** It needs the fix from `LUNACY-VCARD-IMPORT.md`: anything that isn't image, audio
  or video is a `document`. Without it `.ics` files won't be listed.
- **`new Function`.** `ICalEvents.instantiate` evaluates the parser's files this way, so they stay
  unchanged and out of the global scope. A content security policy that blocks eval will stop it.
- **XHR to `import/webcal/`.** The parser loads relative to the card, `app/calendar.html`, when an
  import starts. A failure shows "This file could not be read."
- **Libraries.** It reads `MojoLoader` and `Calendar` from `enyo.windows.getRootWindow()`, because
  only the headless `index.html` has them. It needs `foundations` and `Calendar.TimezoneManager`.
- **`com.palm.systemservice/timezone/getTimeZoneRules`.** The answers need `hasDstChange`,
  `utcOffset`, `dstOffset`, `dstStart` and `dstEnd` as on a TouchPad. South of the equator,
  `dstStart` comes after `dstEnd`. A request naming only unknown zones fails on a TouchPad; with a
  mix, the unknown ones are left out. The parser relies on both.

## Rules worth keeping

- **Exceptions are plain dates.** `rrule-manager.js` tests an exception against the occurrence's
  date in the event's zone plus dtstart's clock time in the device's zone. A date and time misses
  when the two zones differ by a day or in daylight time, and the cancelled occurrence still shows.
  So `exdates` hold `YYYYMMDD` in the event's zone. `app/import/webcal/iCal.js` and
  `iCalTimeHandling.js` need updating to get this. Events imported before then keep the old form,
  and a re-import skips them, so delete and re-import any that matter.

- **On-device only.** `ICalEvents.target` accepts only `syncSource: "Local"` on the
  `com.palm.calendar:1` kind, and events use the `com.palm.calendarevent:1` kind. Otherwise the
  import stops. It must never use the default calendar, because a synced calendar uploads what
  goes in it.
- **Additive.** A series or event already there is skipped, even if the file's copy is newer.
  `remoteId` holds the `UID`. Events with no `UID`, and hand-typed ones, match on title, start and
  end. An imported event that the user deleted comes back on the next import.
- **Attendees are safe here.** Meeting mail needs `com.palm.calendarevent.eas:1`, so attendees on
  the local calendar send nothing. Keep it that way.
- **Stop.** The import starts through `enyo.asyncMethod` for the same reason as Import vCards.
- **Progress text stays put.** Changing the label while the dialog is up left the top half of the
  text frozen on a TouchPad, in both imports. The label is set once and only the bar moves.
