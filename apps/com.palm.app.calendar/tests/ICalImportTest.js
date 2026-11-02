// Run with: node apps/com.palm.app.calendar/tests/ICalImportTest.js
// (scripts/calendar-app.sh feed runs it too.) Runs the real ICalImport.js, the parser and
// CalendarEvent.js with Enyo and db8 stubbed. All the events here are made up.

process.env.TZ = "UTC";

var assert = require("assert"),
    fs = require("fs"),
    path = require("path"),
    vm = require("vm"),
    app = path.join(__dirname, "../app/");

// Runs its callbacks at once. Enough of a Foundations future for a stub to answer through.
function Future(result) {
    if (arguments.length) {
        this.result = result;
    }
}
Future.prototype.then = function (scope, callback) {
    (callback || scope).call(typeof scope === "function" ? this : scope, this);
    return this;
};
Future.prototype.getResult = function () { return this.result; };
Future.prototype.nest = function (inner) { this.result = inner.result; };

var LOCAL = {_id: "local-calendar", _kind: "com.palm.calendar:1", accountId: "local-account", syncSource: "Local"};

function makeWorld(inCalendar) {
    var world = {rows: [], puts: [], queue: [], results: [], failPut: false, calendar: inCalendar === undefined ? LOCAL : inCalendar},
        kinds = {},
        nextId = 0,
        sandbox;

    function db(method, params) {
        var page;
        if (method === "find") {
            assert.equal(params.query.where[0].val, LOCAL._id);
            assert.ok(params.query.limit <= 500);
            page = world.rows.slice(params.query.page || 0, (params.query.page || 0) + params.query.limit);
            return new Future({results: page,
                next: (params.query.page || 0) + page.length < world.rows.length ? (params.query.page || 0) + page.length : undefined});
        }
        assert.equal(method, "put");
        if (world.failPut) {
            var failed = new Future();
            Object.defineProperty(failed, "result", {get: function () { throw new Error("db8 said no"); }});
            return failed;
        }
        world.puts.push(params.objects);
        return new Future({results: params.objects.map(function (object) {
            nextId += 1;
            object._id = "id" + nextId;
            world.rows.push(object);
            return {id: object._id};
        })});
    }

    sandbox = {
        console: console,
        $L: function (s) { return s; },
        root: {
        Calendar: {TimezoneManager: function () {
            return {
                timezone: "UTC", timezones: {},
                hasTimezoneInfo: function () { return false; },
                loadTimezones: function () { return new Future({returnValue: true}); },
                setup: function () { return new Future({}); }
            };
        }},
        MojoLoader: {require: function () {
            return {foundations: {Control: {Future: Future}, Comms: {PalmCall: {call: function (service, method, params) {
                assert.equal(service, "palm://com.palm.db/");
                return db(method, params);
            }}}}};
        }}
        },
        enyo: {
            windows: {getRootWindow: function () { return sandbox.root; }},
            kind: function (k) { kinds[k.name] = k; },
            application: {calendarsManager: {getLocalCalendar: function () { return world.calendar; }}},
            asyncMethod: function (scope, method) { world.queue.push(function () { scope[method](); }); },
            bind: function (scope, fn) { return fn.bind(scope); },
            warn: function () {}, log: function () {},
            g11n: {Template: function (m) { this.formatChoice = function (n, a) { return a.count + "|" + m; }; }}
        },
        enyoControl: {}
    };
    sandbox.enyo.ModalDialog = sandbox.enyo.Component = sandbox.enyo.Control = sandbox.enyo.Button = sandbox.enyo.ProgressBar = {};
    vm.runInNewContext(fs.readFileSync(app + "shared/CalendarEvent.js", "utf8") + "\nthis.CalendarEvent = CalendarEvent;", sandbox);
    vm.runInNewContext(fs.readFileSync(app + "import/ICalEvents.js", "utf8") + "\nthis.ICalEvents = ICalEvents;", sandbox);
    vm.runInNewContext(fs.readFileSync(app + "import/ICalImport.js", "utf8"), sandbox);

    // Parser files come from disk rather than XHR; everything after that is the real path.
    world.run = function (inText) {
        var importer = Object.create(kinds["calendar.ICalImport"]),
            sources = {};
        sandbox.calendar = {ICalImport: kinds["calendar.ICalImport"].statics};
        world.importer = importer;
        importer.statics = kinds["calendar.ICalImport"].statics;
        importer.$ = {
            progressDialog: {openAtStart: function () {}, showProgress: function () {}, close: function () {}},
            resultDialog: {openWith: function (m) { world.results.push(m); }}
        };
        importer.text = inText;
        sandbox.ICalEvents.FILES.forEach(function (file) {
            sources[file] = fs.readFileSync(app + "import/webcal/" + file, "utf8");
        });
        importer.loadParser = function () { this.parserLoaded(sources); };
        importer.startImport();
        world.drain();
    };
    world.drain = function () {
        while (world.queue.length) {
            if (world.stopAt && world.rows.length >= world.stopAt) {
                world.importer.stopImport();
            }
            world.queue.shift()();
        }
    };
    return world;
}

function ics(events) {
    return "BEGIN:VCALENDAR\r\n" + events.join("") + "END:VCALENDAR\r\n";
}
function event(uid, day, subject, extra) {
    return "BEGIN:VEVENT\r\n" + (uid ? "UID:" + uid + "\r\n" : "") + "DTSTART:202701" + day + "T100000Z\r\nDTEND:202701" + day +
        "T110000Z\r\nSUMMARY:" + subject + "\r\n" + (extra || "") + "END:VEVENT\r\n";
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

test("events go to the on-device calendar, as plain calendar events with their UID", function () {
    var world = makeWorld();
    world.run(ics([event("a", "05", "One"), event("b", "06", "Two")]));
    assert.equal(world.rows.length, 2);
    world.rows.forEach(function (row) {
        assert.equal(row._kind, "com.palm.calendarevent:1");
        assert.equal(row.calendarId, "local-calendar");
        assert.equal(row.accountId, "local-account");
    });
    assert.equal(world.rows[0].remoteId, "a");
    assert.equal(world.rows[0].uid, undefined);
    assert.deepEqual(world.results, ["2|1#1 event imported.|##{count} events imported."]);
});

test("a synced calendar, or none, stops the import", function () {
    [null, {_id: "x", _kind: "com.palm.calendar.eas:1", accountId: "y", syncSource: "Local"},
        {_id: "x", _kind: "com.palm.calendar:1", accountId: "y", syncSource: "EAS"}].forEach(function (cal) {
        var world = makeWorld(cal);
        world.run(ics([event("a", "05", "One")]));
        assert.equal(world.rows.length, 0);
        assert.deepEqual(world.results, ["There is no on-device calendar to import events into."]);
    });
});

test("importing again adds only what's new, and changes nothing that's there", function () {
    var world = makeWorld(),
        edited;
    world.run(ics([event("a", "05", "One"), event("b", "06", "Two")]));
    edited = JSON.stringify(world.rows);
    world.run(ics([event("a", "05", "One changed"), event("b", "09", "Two moved"), event("c", "07", "Three")]));
    assert.equal(world.rows.length, 3);
    assert.equal(JSON.stringify(world.rows.slice(0, 2)), edited);
    assert.equal(world.rows[2].subject, "Three");
    assert.equal(world.puts.length, 2);
});

test("events with no UID are matched by title and time, in the file too", function () {
    var world = makeWorld();
    world.rows.push({subject: "By hand", dtstart: Date.UTC(2027, 0, 5, 10), dtend: Date.UTC(2027, 0, 5, 11)});
    world.run(ics([event(null, "05", "By hand"), event(null, "06", "Other"), event(null, "06", "Other")]));
    assert.equal(world.rows.length, 2);
    world.run(ics([event(null, "06", "Other")]));
    assert.equal(world.rows.length, 2);
});

test("a series saves its exceptions under the parent, and re-imports as one thing", function () {
    var world = makeWorld(),
        text = ics([event("s", "04", "Weekly", "RRULE:FREQ=WEEKLY;COUNT=5\r\n"),
            "BEGIN:VEVENT\r\nUID:s\r\nRECURRENCE-ID:20270111T100000Z\r\nDTSTART:20270112T100000Z\r\nDTEND:20270112T110000Z\r\nSUMMARY:Moved\r\nEND:VEVENT\r\n"]);
    world.run(text);
    assert.equal(world.rows.length, 2);
    assert.equal(world.rows[0].rrule.freq, "WEEKLY");
    assert.deepEqual(world.rows[0].exdates, ["20270111T100000Z"]);
    assert.equal(world.rows[1].parentId, world.rows[0]._id);
    assert.equal(world.rows[1].parentDtstart, world.rows[0].dtstart);
    assert.equal(world.rows[1].remoteId, undefined);
    world.run(text);
    assert.equal(world.rows.length, 2);
});

test("more events than one page of db8 or one save", function () {
    var world = makeWorld(),
        events = [],
        i;
    for (i = 0; i < 620; i += 1) {
        events.push("BEGIN:VEVENT\r\nUID:u" + i + "\r\nDTSTART:20270105T100000Z\r\nSUMMARY:n" + i + "\r\nEND:VEVENT\r\n");
    }
    world.run(ics(events));
    assert.equal(world.rows.length, 620);
    assert.ok(world.puts.every(function (batch) { return batch.length <= 50; }));
    world.run(ics(events));
    assert.equal(world.rows.length, 620);
});

test("Stop leaves the rest for next time", function () {
    var world = makeWorld(),
        events = [],
        i;
    for (i = 0; i < 120; i += 1) {
        events.push(event("u" + i, "05", "n" + i));
    }
    world.stopAt = 50;
    world.run(ics(events));
    world.stopAt = 0;
    assert.equal(world.rows.length, 50);
    assert.ok(world.results[0].indexOf("Import stopped.") === 0);
    world.run(ics(events));
    assert.equal(world.rows.length, 120);
});

test("a failed save is counted, and nothing is lost for next time", function () {
    var world = makeWorld();
    world.failPut = true;
    world.run(ics([event("a", "05", "One")]));
    assert.equal(world.rows.length, 0);
    assert.ok(/could not be saved/.test(world.results[0]));
});

test("the summary reports complex repeats and unknown zones", function () {
    var world = makeWorld();
    world.run(ics([
        event("a", "05", "Last weekday", "RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1\r\n"),
        "BEGIN:VEVENT\r\nUID:b\r\nDTSTART;TZID=Foo/Bar:20270105T100000\r\nSUMMARY:Where\r\nEND:VEVENT\r\n"
    ]));
    assert.equal(world.rows.length, 2);
    assert.equal(world.rows[0].rrule, null);
    assert.ok(/too complex/.test(world.results[0]));
    assert.ok(/not recognized/.test(world.results[0]));
});

test("no alarm in the file means no reminder, and an alarm is kept", function () {
    var world = makeWorld();
    world.run(ics([event("a", "05", "Plain"),
        event("b", "06", "Remind", "BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT15M\r\nEND:VALARM\r\n")]));
    assert.equal(world.rows[0].alarm[0].alarmTrigger.value, "none");
    assert.equal(world.rows[1].alarm[0].alarmTrigger.value, "-PT15M");
});
