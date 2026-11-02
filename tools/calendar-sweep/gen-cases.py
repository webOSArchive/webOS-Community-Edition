#!/usr/bin/env python3
"""Writes the expected occurrences for oracle-sweep.js. The answers come from dateutil.rrule on
wall-clock times and from tzdata itself, so no calendar or framework code takes part.

    python3 gen-cases.py [--zoneinfo DIR] [--step DAYS] > cases.json

The zone files default to AddToImage/PatchOrReplace/zoneinfo-*.tgz. All names and events are made up.
"""
import argparse, glob, json, os, tarfile, tempfile, zoneinfo
from datetime import datetime, timedelta, timezone
from dateutil.rrule import rrulestr

ap = argparse.ArgumentParser()
ap.add_argument("--zoneinfo")
ap.add_argument("--step", type=int, default=17)
args = ap.parse_args()
zi = args.zoneinfo
if not zi:
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    tgz = glob.glob(os.path.join(root, "AddToImage/PatchOrReplace/zoneinfo-*.tgz"))[0]
    zi = tempfile.mkdtemp()
    with tarfile.open(tgz) as tf:
        tf.extractall(zi, filter="data")
zoneinfo.reset_tzpath(to=[zi])

ZONES = ["Australia/Sydney", "America/Los_Angeles", "America/New_York", "Pacific/Auckland", "Asia/Kolkata",
         "Australia/Lord_Howe", "Europe/London", "Pacific/Honolulu", "America/St_Johns", "Pacific/Chatham"]
TIMES = [(0, 30), (2, 30), (9, 0), (22, 0), (23, 30)]
DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
SPAN = 150      # days of occurrences compared
WINDOW = 6      # occurrences kept for COUNT and UNTIL


def nth(d):
    return (d.day - 1) // 7 + 1


def rules(d):
    wd = DAYS[d.weekday()]
    other = DAYS[(d.weekday() + 2) % 7]
    third = DAYS[(d.weekday() + 4) % 7]
    last = (d + timedelta(days=7)).month != d.month
    out = [("daily", "FREQ=DAILY"), ("daily3", "FREQ=DAILY;INTERVAL=3"),
           ("weekly", "FREQ=WEEKLY;BYDAY=" + wd),
           ("weekly-days", "FREQ=WEEKLY;BYDAY=%s,%s,%s" % (wd, other, third)),
           ("weekly2", "FREQ=WEEKLY;INTERVAL=2;BYDAY=%s" % wd),
           ("monthly-day", "FREQ=MONTHLY"),
           ("monthly-nth", "FREQ=MONTHLY;BYDAY=%d%s" % (nth(d), wd)),
           ("yearly", "FREQ=YEARLY")]
    if last:
        out.append(("monthly-last", "FREQ=MONTHLY;BYDAY=-1" + wd))
    return out


def stamp(d):
    return d.strftime("%Y%m%dT%H%M%S")


def utc(d, tz):
    return int(d.replace(tzinfo=tz).astimezone(timezone.utc).timestamp() * 1000)


def transitions(tz):
    """Days around each clock change in 2027, where the bugs live."""
    days = []
    d = datetime(2027, 1, 1, 12)
    prev = d.replace(tzinfo=tz).utcoffset()
    while d.year == 2027:
        now = d.replace(tzinfo=tz).utcoffset()
        if now != prev:
            days += [d + timedelta(days=k) for k in (-22, -8, -2, -1, 0, 1)]
        prev = now
        d += timedelta(days=1)
    return days


cases = []
for name in ZONES:
    tz = zoneinfo.ZoneInfo(name)
    dates = [datetime(2027, 1, 1) + timedelta(days=k) for k in range(0, 365, args.step)] + transitions(tz)
    for h, mi in TIMES:
        for base in dates:
            start = base.replace(hour=h, minute=mi, second=0, microsecond=0)
            hours = 30 if (start.day + h) % 7 == 0 else 1
            for kind, rule in rules(start):
                occ = list(rrulestr("RRULE:" + rule, dtstart=start)[:40]) if False else None
                it = rrulestr("RRULE:" + rule, dtstart=start)
                occ = []
                for o in it:
                    if o > start + timedelta(days=SPAN) and len(occ) >= WINDOW:
                        break
                    if len(occ) > 200:
                        break
                    occ.append(o)
                if len(occ) < WINDOW:
                    continue
                for end in ("count", "until", "open"):
                    for cancel in (False, True):
                        if cancel and end == "open":
                            continue
                        kept = occ[:WINDOW] if end != "open" else occ
                        lines = ["DTSTART;TZID=%s:%s" % (name, stamp(start)),
                                 "DTEND;TZID=%s:%s" % (name, stamp(start + timedelta(hours=hours)))]
                        r = rule
                        if end == "count":
                            r += ";COUNT=%d" % WINDOW
                        elif end == "until":
                            last = datetime.fromtimestamp(utc(kept[-1], tz) / 1000, timezone.utc)
                            r += ";UNTIL=" + last.strftime("%Y%m%dT%H%M%SZ")
                        lines.append("RRULE:" + r)
                        expect = list(kept)
                        if cancel:
                            lines.append("EXDATE;TZID=%s:%s" % (name, stamp(kept[2])))
                            del expect[2]
                        cases.append({"tz": name, "kind": kind, "end": end, "cancel": cancel, "hours": hours,
                                      "lines": lines, "first": utc(start, tz),
                                      "last": utc(start + timedelta(days=SPAN), tz),
                                      "expect": [utc(o, tz) for o in expect if o <= start + timedelta(days=SPAN)]})
json.dump(cases, __import__("sys").stdout, separators=(",", ":"))
