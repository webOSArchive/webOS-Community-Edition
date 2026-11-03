# Calendar repeat sweeps

These run Palm's calendar framework under Node and compare every occurrence with independent
answers. Run them on any change to `system/usr/palm/frameworks/calendar/` or the Import Calendar
parser, on `concatenated.js` and `42calendar.js`. Nothing here runs on a device except
`fold-rules.mjs`.

    export UNDERSCORE=<a TouchPad's frameworks>/underscore/submission/7/javascript/underscore.js
    python3 gen-cases.py --step 13 > /tmp/cases.json
    tools/calendar-sweep/run.sh <framework file> apps/com.palm.app.calendar/app/import/webcal /tmp/cases.json 3

- **`gen-cases.py`, `oracle-sweep.js`:** the main check. `dateutil` and tzdata supply the answers, so
  no calendar code takes part. Ten event zones, five start times, daily, weekly on one or several
  days, every second week, monthly by date and by weekday, and yearly, ending with COUNT, UNTIL or
  not at all, with and without a cancelled date, around every clock change. The text goes through
  the real parser, and each case is paged by day, by week and in one range. It also asks
  `findNextOccurrence` for the occurrence after each one, as reminders do. `SAMPLE=n` runs every
  nth case.
- **`touchpad-rules.json`:** real `getTimeZoneRules` replies from a TouchPad with tzdata 2026f, which
  is what the framework reads. Recapture it when the zone data changes.
- **`stock-compare.js`:** two builds on ordinary repeats in the device's own zone, stored the way
  Calendar's editor, Exchange and imports store them, including `findNextOccurrence`. Any difference
  from stock has to be explained.
- **`windows-zone-sweep.js`:** a repeat stored with a Windows zone name, as older webcal stored
  Outlook's, against the same repeat with its IANA name, for every name in `timezone-manager.js`.
- **`sweep.js`, `until-sweep.js`, `lib.js`:** Lunacy's sweeps. Their answers and rules both come from
  `Intl`, so they can't see a fault in its data.
- **`fold-rules.mjs`, `score-rules.py`, `zones.json`:** read `getTimeZoneRules` from a Lunacy card and
  score the replies against Python's zone data.

A start inside a skipped hour isn't tested, because the stored format can't hold it: `dtstart` is
real time, so the clock reading is gone.
