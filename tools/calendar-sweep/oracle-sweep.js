// Compares a build of the calendar framework with gen-cases.py's expected occurrences:
//   TZ=Australia/Sydney node oracle-sweep.js <concatenated.js or 42calendar.js> <parser folder> <cases.json> [examples]
// TZ is the device's zone. Zone rules are real TouchPad getTimeZoneRules replies (touchpad-rules.json).
// .ics text goes through the real parser, and every case is paged by day, by week and in one range.
const fs = require("fs"), path = require("path"), H = require("./lib.js");
const file = process.argv[2], utils = process.argv[3].replace(/\/?$/, "/"), all = JSON.parse(fs.readFileSync(process.argv[4])), show = +process.argv[5] || 0, DEV = process.env.TZ;
const lib = H.load(file), tm = new lib.__T(), u = new lib.__U(), manager = new lib.EventManager();
tm.timezone = DEV;
tm.timezones = JSON.parse(fs.readFileSync(path.join(__dirname, "touchpad-rules.json")));
function Future(r) { if (arguments.length) this.result = r; }
Future.prototype.then = function (a, b) { (b || a).call(this, this); return this; };
Future.prototype.getResult = function () { return this.result; };
tm.hasTimezoneInfo = tm.hasTimezoneInfo || ((t, y) => !!(tm.timezones[y] && tm.timezones[y][t]));
tm.loadTimezones = () => new Future({returnValue: true});
tm.setup = () => new Future({});
function L(f) {
    const m = {exports: {}};
    new Function("require", "module", "exports", "libPath", "Log", "Future", "Calendar", "checkResult", fs.readFileSync(utils + f, "utf8"))(n => L(path.basename(n)), m, m.exports, "", {log() {}, log_icalDebug() {}, debug() {}}, Future, {TimezoneManager: () => tm}, x => x.result || {returnValue: true});
    return m.exports;
}
const iCal = L("iCal.js");
function parse(lines) {
    let o;
    iCal.parseWebCalICal(["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:u", "SUMMARY:x"].concat(lines, ["END:VEVENT", "END:VCALENDAR", ""]).join("\r\n")).then(f => { o = f.result; });
    return o.events[0].result;
}
function page(ev, a, stop, days) {
    const got = new Set(), count = ev.rrule.count;
    const e = JSON.parse(JSON.stringify(ev));
    for (let s = new Date(a); s.getTime() < stop;) {
        const n = new Date(s); n.setDate(n.getDate() + days);
        const range = {start: s.getTime(), end: Math.min(n.getTime(), stop) - 1, tzId: DEV};
        for (const o of count ? u.findRepeatsInRangeCountVersion(e, range) : u.findRepeatsInRange(e, range)) got.add(o.currentLocalStart);
        s = n;
    }
    return got;
}
// The next occurrence after each one, as reminders ask for it. Each ask gets a fresh copy of the event.
function nextChecks(ev, expect) {
    const wrong = [];
    for (let i = 0; i + 1 < expect.length; i++) {
        const got = manager.findNextOccurrence(JSON.parse(JSON.stringify(ev)), expect[i] + 60000);
        if (got !== expect[i + 1]) wrong.push({from: new Date(expect[i]).toISOString().slice(0, 16), want: new Date(expect[i + 1]).toISOString().slice(0, 16), got: got && new Date(got).toISOString().slice(0, 16)});
    }
    return wrong;
}
const tally = {}, ex = [];
let cases = 0, wrong = 0, nexts = 0, nextAsked = 0;
const SAMPLE = +process.env.SAMPLE || 1; // SAMPLE=n runs every nth case
for (let i = 0; i < all.length; i += SAMPLE) {
    const c = all[i], ev = parse(c.lines);
    const a = new Date(c.first); a.setHours(0, 0, 0, 0); a.setDate(a.getDate() - 2);
    const stop = c.last;
    const expect = new Set(c.expect);
    const sorted = [...expect].filter(x => x < stop).sort((p, q) => p - q);
    for (const w of nextChecks(ev, sorted)) {
        nexts++;
        if (ex.length < show) ex.push({tz: c.tz, kind: c.kind, end: c.end, cancel: c.cancel, mode: "next", l: c.lines.slice(0, 1).concat(c.lines.slice(2)), ...w});
    }
    nextAsked += Math.max(sorted.length - 1, 0);
    for (const [mode, days] of [["day", 1], ["week", 7], ["wide", 400]]) {
        const got = page(ev, a, stop, days);
        // An occurrence that starts just past the window can't be told from a wrong one.
        const g = [...got].filter(x => x < stop).sort((p, q) => p - q), e = [...expect].filter(x => x < stop).sort((p, q) => p - q);
        cases++;
        if (JSON.stringify(g) !== JSON.stringify(e)) {
            wrong++;
            const k = c.kind, how = g.length < e.length ? "lost" : g.length > e.length ? "gained" : "moved";
            const t = tally[k] = tally[k] || {wrong: 0, lost: 0, gained: 0, moved: 0};
            t.wrong++; t[how]++;
            if (ex.length < show && !(process.env.SKIP||"").split(",").includes(c.kind)) ex.push({tz: c.tz, kind: c.kind, end: c.end, cancel: c.cancel, mode, l: c.lines.slice(0, 1).concat(c.lines.slice(2)), missing: e.filter(x => !got.has(x)).slice(0, 3).map(x => new Date(x).toISOString().slice(0, 16)), extra: g.filter(x => !expect.has(x)).slice(0, 3).map(x => new Date(x).toISOString().slice(0, 16))});
        }
    }
}
console.log(DEV.padEnd(22), "cases", cases, "wrong", wrong, "next asked", nextAsked, "wrong", nexts, JSON.stringify(tally));
ex.forEach(x => console.log(JSON.stringify(x)));
