// Run with: node test/iCalParserTest.js
// The same file is in webos-doctor-ce at apps/com.palm.app.calendar/tests/, beside its copy of
// the parser. Keep the two the same. The time zone manager is a stub holding what the device's
// time zone service really answers; the zones and events are made up.

process.env.TZ = "UTC";

var assert = require("assert"),
    fs = require("fs"),
    path = require("path"),
    vm = require("vm"),
    webcal = path.join(__dirname, "../service/javascript/utils/"),
    calendar = path.join(__dirname, "../app/import/webcal/"),
    utils = fs.existsSync(webcal) ? webcal : calendar,
    results = [],
    pending = 0,
    iCal;

// Just enough of a Foundations future: everything here settles synchronously.
function Future(result) {
    this.callbacks = [];
    if (arguments.length) {
        this.result = result;
    }
}
Future.prototype.then = function (scope, callback) {
    var self = this, fn = callback || scope;
    fn.call(this, self);
    return this;
};
Future.prototype.getResult = function () { return this.result; };

function info(tz, year, utcOffset, dstOffset, dstStart, dstEnd) {
    return {tz: tz, year: year, hasDstChange: true, utcOffset: utcOffset, dstOffset: dstOffset, dstStart: dstStart, dstEnd: dstEnd};
}

var tzManager = {
    timezone: "UTC",
    timezones: {2027: {
        "America/New_York": info("America/New_York", 2027, -18000, -14400, 1805000400, 1825560000),
        "Australia/Sydney": info("Australia/Sydney", 2027, 36000, 39600, 1822492800, 1806768000)
    }},
    hasTimezoneInfo: function (tz, year) { return !!(this.timezones[year] && this.timezones[year][tz]); },
    loadTimezones: function () { return new Future({returnValue: true}); },
    setup: function () { return new Future({}); }
};

function load(file, globals) {
    var module = {exports: {}};
    new Function("require", "module", "exports", "libPath", "Log", "Future", "Calendar", "checkResult",
        fs.readFileSync(utils + file, "utf8"))(
        function (name) { return load(path.basename(name)); },
        module, module.exports, "",
        {log: function () {}, log_icalDebug: function () {}, debug: function () {}},
        Future,
        {TimezoneManager: function () { return tzManager; }},
        function (f) { return f.result || {returnValue: true}; }
    );
    return module.exports;
}
iCal = load("iCal.js");

function parse(lines) {
    var out;
    iCal.parseWebCalICal("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + lines.join("\r\n") + "\r\nEND:VCALENDAR\r\n").then(function (f) {
        out = f.result;
    });
    return out;
}
function vevent(lines) {
    return ["BEGIN:VEVENT"].concat(lines, ["END:VEVENT"]);
}
function timed(uid, zone) {
    return vevent(["UID:" + uid, "DTSTART;TZID=" + zone + ":20270105T100000", "DTEND;TZID=" + zone + ":20270105T110000", "SUMMARY:x"]);
}
function iso(ms) {
    return new Date(ms).toISOString().substring(0, 16);
}
function test(name, body) {
    try {
        body();
        console.log("ok   " + name);
    } catch (e) {
        console.log("FAIL " + name + ": " + e.message);
        process.exitCode = 1;
    }
}

test("a line folded with a tab is unfolded", function () {
    var r = parse(vevent(["UID:1", "DTSTART:20270105T100000Z", "SUMMARY:Long tit", "\tle here"]));
    assert.equal(r.events[0].result.subject, "Long title here");
});

test("LF-only files parse", function () {
    var out;
    iCal.parseWebCalICal("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:20270105T100000Z\nSUMMARY:x\nEND:VEVENT\nEND:VCALENDAR\n").then(function (f) { out = f.result; });
    assert.equal(out.events.length, 1);
});

test("BYSETPOS on one weekday becomes that weekday's ordinal, each position", function () {
    var r = parse(vevent(["UID:1", "DTSTART:20270112T100000Z", "RRULE:FREQ=MONTHLY;BYDAY=TU;BYSETPOS=2,4"])),
        rule = r.events[0].result.rrule.rules[0];
    assert.deepEqual(rule.ruleValue, [{day: 2, ord: 2}, {day: 2, ord: 4}]);
});

test("BYSETPOS across several weekdays keeps one event instead of a wrong rule", function () {
    var r = parse(vevent(["UID:1", "DTSTART:20270129T100000Z", "RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1"]));
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].result.rrule, null);
    assert.equal(r.events[0].result.rruleDropped, true);
});

test("COUNT and INTERVAL are numbers", function () {
    var rrule = parse(vevent(["UID:1", "DTSTART:20270105T100000Z", "RRULE:FREQ=WEEKLY;COUNT=5;INTERVAL=2;BYDAY=TU"])).events[0].result.rrule;
    assert.strictEqual(rrule.count, 5);
    assert.strictEqual(rrule.interval, 2);
});

test("plain events sharing a UID are all kept, each with a lasting UID", function () {
    var one = vevent(["UID:d", "DTSTART:20270105T100000Z", "SUMMARY:A"]),
        two = vevent(["UID:d", "DTSTART:20270106T100000Z", "SUMMARY:B"]),
        r = parse(one.concat(two, one)),
        again = parse(one.concat(two));
    assert.deepEqual(r.events.map(function (g) { return g.result.subject; }), ["A", "B"]);
    assert.notEqual(r.events[0].result.uid, r.events[1].result.uid);
    assert.equal(r.events[1].result.uid, again.events[1].result.uid);
});

test("exceptions without their parent are all kept as plain events", function () {
    var r = parse(vevent(["UID:o", "RECURRENCE-ID:20270105T100000Z", "DTSTART:20270105T120000Z", "SUMMARY:A"]).concat(
        vevent(["UID:o", "RECURRENCE-ID:20270112T100000Z", "DTSTART:20270112T120000Z", "SUMMARY:B"])));
    assert.equal(r.events.length, 2);
    assert.equal(r.events[1].result.recurrenceId, undefined);
});

test("a moved occurrence stays a child, and its date joins the parent's exdates", function () {
    var r = parse(vevent(["UID:e", "DTSTART:20270104T100000Z", "DTEND:20270104T110000Z", "SUMMARY:P", "RRULE:FREQ=WEEKLY;COUNT=5"]).concat(
        vevent(["UID:e", "RECURRENCE-ID:20270111T100000Z", "DTSTART:20270112T100000Z", "DTEND:20270112T110000Z", "SUMMARY:M"])));
    assert.equal(r.events.length, 1);
    assert.deepEqual(r.events[0].result.exdates, ["20270111"]);
    assert.equal(r.events[0].exceptions[0].subject, "M");
    assert.equal(r.events[0].exceptions[0].parentDtstart, r.events[0].result.dtstart);
});

test("all-day events end the same day, even with DTEND = DTSTART", function () {
    var r = parse(vevent(["UID:1", "DTSTART;VALUE=DATE:20270105", "DTEND;VALUE=DATE:20270106"]).concat(
        vevent(["UID:2", "DTSTART;VALUE=DATE:20270105", "DTEND;VALUE=DATE:20270105"]),
        vevent(["UID:3", "DTSTART;VALUE=DATE:20270105"])));
    r.events.forEach(function (g) {
        assert.equal(g.result.dtend - g.result.dtstart, 1000);
    });
});

test("a VTODO does not swallow the events after it", function () {
    var r = parse(["BEGIN:VTODO", "UID:t", "SUMMARY:task", "END:VTODO"].concat(vevent(["UID:1", "DTSTART:20270105T100000Z"])));
    assert.equal(r.events.length, 1);
});

test("an event with no readable start is counted, and the rest survive", function () {
    var r = parse(vevent(["UID:1", "DTSTART:someday"]).concat(vevent(["UID:2", "DTSTART:20270105T100000Z"])));
    assert.equal(r.events.length, 1);
    assert.equal(r.unreadable, 1);
});

test("zone names, quoted or not, Windows or IANA", function () {
    ["America/New_York", "\"America/New_York\"", "Eastern Standard Time", "\"Eastern Standard Time\""].forEach(function (zone) {
        assert.equal(iso(parse(timed("1", zone)).events[0].result.dtstart), "2027-01-05T15:00");
    });
});

test("the stored zone is one the calendar can look up", function () {
    assert.equal(parse(timed("1", "Eastern Standard Time")).events[0].result.tzId, "America/New_York");
    assert.equal(parse(timed("2", "America/New_York")).events[0].result.tzId, "America/New_York");
    assert.equal(parse(timed("3", "Foo/Bar")).events[0].result.tzId, "UTC");
});

test("daylight time south of the equator, from the service's rules", function () {
    assert.equal(iso(parse(timed("1", "Australia/Sydney")).events[0].result.dtstart), "2027-01-04T23:00");
});

test("exceptions are plain dates, in the event's zone", function () {
    var series = ["UID:s", "DTSTART;TZID=Australia/Sydney:20270111T090000", "RRULE:FREQ=WEEKLY;COUNT=6"];
    assert.deepEqual(parse(vevent(series.concat(["EXDATE;TZID=Australia/Sydney:20270118T090000"]))).events[0].result.exdates, ["20270118"]);
    assert.deepEqual(parse(vevent(series.concat(["EXDATE:20270117T220000Z"]))).events[0].result.exdates, ["20270118"]);
    assert.deepEqual(parse(vevent(series.concat(["EXDATE;VALUE=DATE:20270118"]))).events[0].result.exdates, ["20270118"]);
    assert.deepEqual(parse(vevent(series.concat(["EXDATE;TZID=Australia/Sydney:20270118T090000"])).concat(
        vevent(["UID:s", "RECURRENCE-ID;TZID=Australia/Sydney:20270118T090000", "DTSTART;TZID=Australia/Sydney:20270119T090000"]))).events[0].result.exdates, ["20270118"]);
});

var usVtimezone = ["BEGIN:VTIMEZONE", "TZID:(UTC-05:00) Eastern Time (US & Canada)",
    "BEGIN:STANDARD", "DTSTART:16010101T020000", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=1SU;BYMONTH=11", "END:STANDARD",
    "BEGIN:DAYLIGHT", "DTSTART:16010101T020000", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=2SU;BYMONTH=3", "END:DAYLIGHT", "END:VTIMEZONE"];

test("a name holding UTC is read from its VTIMEZONE, not taken for UTC", function () {
    var zone = "\"(UTC-05:00) Eastern Time (US & Canada)\"",
        january = parse(usVtimezone.concat(timed("1", zone))),
        july = parse(usVtimezone.concat(vevent(["UID:2", "DTSTART;TZID=" + zone + ":20270705T100000"])));
    assert.equal(iso(january.events[0].result.dtstart), "2027-01-05T15:00");
    assert.equal(iso(july.events[0].result.dtstart), "2027-07-05T14:00");
    assert.deepEqual(january.unknownTimezones, []);
});

test("VTIMEZONE changeovers fall on the right Sundays", function () {
    var zone = "\"(UTC-05:00) Eastern Time (US & Canada)\"",
        at = function (day) {
            return iso(parse(usVtimezone.concat(vevent(["UID:1", "DTSTART;TZID=" + zone + ":" + day + "T120000"]))).events[0].result.dtstart);
        };
    assert.equal(at("20270313"), "2027-03-13T17:00");
    assert.equal(at("20270314"), "2027-03-14T16:00");
    assert.equal(at("20271106"), "2027-11-06T16:00");
    assert.equal(at("20271107"), "2027-11-07T17:00");
});

test("VTIMEZONE south of the equator, and half-hour offsets", function () {
    var south = ["BEGIN:VTIMEZONE", "TZID:My Sydney",
        "BEGIN:STANDARD", "DTSTART:19700405T030000", "TZOFFSETFROM:+1100", "TZOFFSETTO:+1000", "RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=4", "END:STANDARD",
        "BEGIN:DAYLIGHT", "DTSTART:19701004T020000", "TZOFFSETFROM:+1000", "TZOFFSETTO:+1100", "RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=10", "END:DAYLIGHT", "END:VTIMEZONE"],
        india = ["BEGIN:VTIMEZONE", "TZID:My India", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0530", "TZOFFSETTO:+0530", "END:STANDARD", "END:VTIMEZONE"];
    assert.equal(iso(parse(south.concat(timed("1", "My Sydney"))).events[0].result.dtstart), "2027-01-04T23:00");
    assert.equal(iso(parse(south.concat(vevent(["UID:2", "DTSTART;TZID=My Sydney:20270705T100000"]))).events[0].result.dtstart), "2027-07-05T00:00");
    assert.equal(iso(parse(india.concat(timed("3", "My India"))).events[0].result.dtstart), "2027-01-05T04:30");
});

test("a zone nothing recognises keeps its clock time, and is reported", function () {
    var r = parse(timed("1", "Foo/Bar"));
    assert.equal(iso(r.events[0].result.dtstart), "2027-01-05T10:00");
    assert.deepEqual(r.unknownTimezones, ["Foo/Bar"]);
});
