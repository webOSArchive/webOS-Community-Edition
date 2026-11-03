# Windows zone names in the calendar framework: notes for webOS CE

From Lunacy, 2026-11-02. A repeating event from an Outlook feed showed an hour early after the
clocks changed. The patch here makes the framework understand the zone name that caused it.

**Status:** Lunacy carries it as `LunaRuntimes/calendar/patches/0003-windows-zone-names.patch`
and it is on a Galaxy Z Fold3, where the real event that showed the bug now computes to the right time.
`lunacy-windows-zone-names.patch`, beside this file, is the same change against CE's own framework
(`system/usr/palm/frameworks/calendar`), which doesn't have Lunacy's patch 0002. CE has applied it, and
it passes `tools/calendar-sweep` on both built forms. It has not been run on a TouchPad.

## The bug

- webcal 0.2.2 stores the feed's `TZID` as it came: `tzId: "Eastern Standard Time"`. The first
  `dtstart` is right, because the parser maps the name to get it.
- `getTimeZoneRules` leaves unknown zones out of its reply. Measured on the TouchPad and on Lunacy,
  which match: ask for that name and `America/New_York`, and only New York comes back.
- `TimezoneManager.getOffset` then returns 0 for the missing zone, so repeats are worked out in UTC.
  09:45 EDT is 13:45 UTC, which is 08:45 EST once the clocks go back.

webcal's own fix is in its 0.2.3 (`d80a996`), which stores a real zone name. Events already stored
keep the old name, so 0.2.2 users need this patch as well.

## The change

Three edits in `timezone-manager.js`, the same in `concatenated.js`, and in minified form in
`42calendar.js`:

- `windowsZones`, a table of 142 Windows names to IANA zones: CLDR `windowsZones.xml`, territory
  001 (Unicode licence), not the GPL parser's table.
- `zoneName(tzId)`, which returns the mapped name, or the name it was given.
- `findTzYearPairsNotInCache` and `getOffset` call it. In `getOffset` it comes before the `/UTC/`
  test, because Windows names such as `UTC-11` would otherwise read as UTC. The stored event is not changed.

## Checked

In Node, on `concatenated.js` and `42calendar.js`, with the event's real shape (weekly, three days,
09:45 Eastern, from Oct 6, 2026):

| | Nov 3, 2026, device in New York |
|---|---|
| Without the patch | 08:45 |
| With it | 09:45 |

Every Windows name in the table except those mapped to UTC gave the same occurrences as its IANA
name, with only the IANA name's rules loaded, as on a device. The test is
`Workbench/calendar-sweep/windows-zone-sweep.js` in Lunacy. `sweep.js` WEEKLY found nothing wrong.

## What to expect

**The patch can make an existing duplicate more visible.** webcal before 0.2.3 stored a series with
exceptions without an `accountId`, because `fillParentIds` gave it an `_id` before the framework's
`putObjects` would set one. The framework then couldn't find it, and made a second master once the
series had no exceptions in the feed. Unpatched, a stale repeat sat an hour from its exception; patched,
they line up. The patch doesn't create those records. webcal 0.2.3 fixes the cause and mends stored
calendars on its next sync; see "Duplicates" in that project's `CLAUDE.md`.

**Still open:** a zone that is neither IANA nor Windows still falls to UTC in `getOffset`.
