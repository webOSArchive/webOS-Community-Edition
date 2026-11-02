// webOS CE: the parts of App Menu > Import Calendar that don't need Enyo, so a test can run them
// under node. ICalImport.js is the rest.
//
// The parser is webos-webcal-synergy's (webcal/README.md). The rules for what goes in are here:
// an import only ever adds, to the on-device calendar. An event already there stays as it is,
// even if the file holds a newer version of it.

var ICalEvents = {
    KIND : "com.palm.calendarevent:1",
    FILES: ["Quoting.js", "timezoneMapper.js", "iCalTimeHandling.js", "iCal.js"],

    // The on-device calendar, or nothing: never a synced calendar, because whatever goes into
    // one of those is uploaded by its sync.
    target: function (inCalendar) {
        if (inCalendar && inCalendar._id && inCalendar.accountId && inCalendar.syncSource === "Local" &&
                inCalendar._kind === "com.palm.calendar:1") {
            return {calendarId: inCalendar._id, accountId: inCalendar.accountId};
        }
        return null;
    },

    // inSources is {fileName: text}. inGlobals holds the Log, Future, Calendar and checkResult
    // that the parser's files expect to find. Answers the parser.
    instantiate: function (inSources, inGlobals) {
        var modules = {};

        function load(inFile) {
            var module = {exports: {}};
            if (modules[inFile]) {
                return modules[inFile];
            }
            /*jslint evil: true */
            new Function("require", "module", "exports", "libPath", "Log", "Future", "Calendar", "checkResult", inSources[inFile])(
                function (inPath) {
                    return load(inPath.substring(inPath.lastIndexOf("/") + 1));
                },
                module,
                module.exports,
                "",
                inGlobals.Log,
                inGlobals.Future,
                inGlobals.Calendar,
                inGlobals.checkResult
            );
            modules[inFile] = module.exports;
            return modules[inFile];
        }

        return load("iCal.js");
    },

    countEvents: function (inText) {
        var matches = inText.match(/^BEGIN:VEVENT/gim);
        return matches ? matches.length : 0;
    },

    // What an event looks like when nothing better identifies it: one typed in by hand, or a
    // file's event with no UID.
    signature: function (inEvent) {
        return [inEvent.subject || "", inEvent.dtstart, inEvent.dtend].join("\n");
    },

    newKnown: function () {
        return {uids: {}, signatures: {}};
    },
    // inRecord is an event from the database. An exception is part of its parent's series.
    rememberExisting: function (inKnown, inRecord) {
        if (inRecord.parentId) {
            return;
        }
        if (inRecord.remoteId) {
            inKnown.uids[inRecord.remoteId] = true;
        }
        inKnown.signatures[ICalEvents.signature(inRecord)] = true;
    },
    // A group is the parser's {result, exceptions}: one event or one whole series. Exceptions
    // aren't checked on their own. A new one for a series already here would mean editing that
    // series, so it waits with the rest of the changes an import doesn't make.
    isKnown: function (inKnown, inGroup) {
        var event = inGroup.result;
        return !!((event.uid && inKnown.uids[event.uid]) || inKnown.signatures[ICalEvents.signature(event)]);
    },
    remember: function (inKnown, inGroup) {
        var event = inGroup.result;
        if (event.uid) {
            inKnown.uids[event.uid] = true;
        }
        inKnown.signatures[ICalEvents.signature(event)] = true;
    },

    // inClean is CalendarEvent's constructor, which keeps the fields the calendar knows and
    // loses remoteId, so that goes on afterwards. "none" is how an event says it has no reminder.
    makeEvent: function (inParsed, inTarget, inClean) {
        var parsed = inParsed,
            event;

        if (!parsed.alarm || parsed.alarm.length === 0) {
            parsed.alarm = [{alarmTrigger: {value: "none", valueType: "DURATION"}}];
        }
        if (parsed.attendees && parsed.attendees.length === 0) {
            delete parsed.attendees;
        }
        // A lone exception has lost its series, so it's an ordinary event.
        if (!parsed.parentDtstart) {
            delete parsed.recurrenceId;
        }
        event = new inClean(parsed);
        delete event._id;
        event._kind = ICalEvents.KIND;
        event.calendarId = inTarget.calendarId;
        event.accountId = inTarget.accountId;
        if (parsed.uid) {
            event.remoteId = parsed.uid;
        }
        return event;
    }
};

if (typeof module !== "undefined") {
    module.exports = ICalEvents;
}
