#!/bin/sh
# Runs oracle-sweep.js with the device in each zone, in parallel:
#   SAMPLE=7 tools/calendar-sweep/run.sh <framework file> <parser folder> <cases.json> [examples]
# UNDERSCORE must point at Palm's underscore.js.
T=$(cd "$(dirname "$0")" && pwd)
for z in America/New_York America/Los_Angeles Europe/London Asia/Kolkata Australia/Sydney; do
    TZ=$z node "$T/oracle-sweep.js" "$@" &
done
wait
