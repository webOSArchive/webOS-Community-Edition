// Compares two builds on what ordinary repeats store: events in the device's own zone, written the
// way Calendar's editor, Exchange and imports write them. Anything that differs has to be explained.
//   TZ=America/New_York node stock-compare.js <stock concatenated.js> <new concatenated.js>
const fs = require("fs"), path = require("path"), H = require("./lib.js");
const DEV = process.env.TZ, rules = JSON.parse(fs.readFileSync(path.join(__dirname, "touchpad-rules.json")));
function build(file) {
    const lib = H.load(file), tm = new lib.__T(), u = new lib.__U();
    tm.timezone = DEV; tm.timezones = rules;
    return {u, m: new lib.EventManager()};
}
const A = build(process.argv[2]), B = build(process.argv[3]);
const local = (y, m, d, h, mi) => new Date(y, m, d, h, mi).getTime();
const stamp = ms => new Date(ms).toISOString().replace(/[-:]|\.\d+/g, "");
function events() {
    const out = [];
    const RULES = [
        ["daily", {freq: "DAILY", interval: 1}], ["daily3", {freq: "DAILY", interval: "3"}],
        ["weekly", d => ({freq: "WEEKLY", interval: 1, rules: [{ruleType: "BYDAY", ruleValue: [{day: d.getDay()}]}]})],
        ["weekly-days", d => ({freq: "WEEKLY", interval: 1, rules: [{ruleType: "BYDAY", ruleValue: [{day: d.getDay()}, {day: (d.getDay() + 2) % 7}]}]})],
        ["weekly2", d => ({freq: "WEEKLY", interval: 2, rules: [{ruleType: "BYDAY", ruleValue: [{day: d.getDay()}]}]})],
        ["weekly-none", {freq: "WEEKLY", interval: 1}],
        ["monthly", {freq: "MONTHLY", interval: 1}],
        ["monthly-nth", d => ({freq: "MONTHLY", interval: 1, rules: [{ruleType: "BYDAY", ruleValue: [{ord: Math.ceil(d.getDate() / 7), day: d.getDay()}]}]})],
        ["yearly", {freq: "YEARLY", interval: 1}]
    ];
    for (let day = 3; day < 365; day += 19) for (const [h, mi] of [[0, 0], [9, 0], [17, 30], [23, 30]]) for (const [name, r] of RULES) for (const form of ["open", "count", "until-picker", "until-real", "until-day", "ex-utc", "ex-local", "ex-date", "tz-blank", "allday", "long"]) {
        const dt = local(2027, 0, day, h, mi), d = new Date(dt), rrule = JSON.parse(JSON.stringify(typeof r === "function" ? r(d) : r));
        const ev = {_id: "e", subject: "x", dtstart: dt, dtend: dt + 36e5, tzId: DEV, rrule, allDay: false};
        const n = name.startsWith("monthly") ? 5 : name === "yearly" ? 3 : 8, step = name === "yearly" ? 366 : name.startsWith("monthly") ? 31 : 7;
        const near = new Date(dt); near.setDate(near.getDate() + n * step);
        if (form === "count") rrule.count = 6;
        if (form === "until-picker") rrule.until = near.getTime();
        if (form === "until-real") rrule.until = near.getTime() + 123000;
        if (form === "until-day") rrule.until = new Date(near.getFullYear(), near.getMonth(), near.getDate(), 23, 59, 59).getTime();
        const later = new Date(dt); later.setDate(later.getDate() + (name === "daily" ? 2 : name === "daily3" ? 6 : 14));
        if (form === "ex-utc") ev.exdates = [stamp(later.getTime())];
        if (form === "ex-local") ev.exdates = [later.getFullYear() + String(later.getMonth() + 1).padStart(2, "0") + String(later.getDate()).padStart(2, "0") + "T" + String(h).padStart(2, "0") + String(mi).padStart(2, "0") + "00"];
        if (form === "ex-date") ev.exdates = [later.getFullYear() + String(later.getMonth() + 1).padStart(2, "0") + String(later.getDate()).padStart(2, "0")];
        if (form === "tz-blank") ev.tzId = "";
        if (form === "allday") { ev.allDay = true; ev.dtstart = local(2027, 0, day, 0, 0); ev.dtend = ev.dtstart + 86399000; }
        if (form === "long") ev.dtend = dt + 30 * 36e5;
        out.push({name, form, ev});
    }
    return out;
}
function run(b, c, a, stop) {
    const ev = JSON.parse(JSON.stringify(c.ev)), got = [];
    for (let s = new Date(a); s.getTime() < stop;) {
        const n = new Date(s); n.setDate(n.getDate() + 7);
        const range = {start: s.getTime(), end: n.getTime() - 1, tzId: DEV};
        for (const o of ev.rrule.count ? b.u.findRepeatsInRangeCountVersion(ev, range) : b.u.findRepeatsInRange(ev, range)) got.push(o.currentLocalStart + "-" + o.currentLocalEnd);
        s = n;
    }
    return [...new Set(got)].sort().join();
}
const list = events(); let same = 0, diff = 0, next = 0; const kinds = {}, ex = [];
// A day the device's clocks change on, near an occurrence, is where stock is known to be wrong.
for (const c of list) {
    const a = new Date(c.ev.dtstart); a.setHours(0, 0, 0, 0); a.setDate(a.getDate() - 3);
    const stop = c.ev.dtstart + 400 * 864e5;
    const x = run(A, c, a, stop), y = run(B, c, a, stop);
    if (x === y) same++; else { diff++; const k = c.name + "/" + c.form; kinds[k] = (kinds[k] || 0) + 1; if (ex.length < 4) { const p = x.split(","), q = y.split(","); ex.push({k, dtstart: new Date(c.ev.dtstart).toString().slice(0, 24), stockOnly: p.filter(v => !q.includes(v)).slice(0, 2).map(v => new Date(+v.split("-")[0]).toString().slice(0, 21)), newOnly: q.filter(v => !p.includes(v)).slice(0, 2).map(v => new Date(+v.split("-")[0]).toString().slice(0, 21))}); } }
    const from = c.ev.dtstart + 45 * 864e5, e1 = JSON.parse(JSON.stringify(c.ev)), e2 = JSON.parse(JSON.stringify(c.ev));
    if (A.m.findNextOccurrence(e1, from) !== B.m.findNextOccurrence(e2, from)) next++;
}
console.log(DEV.padEnd(22), "repeats", list.length, "same", same, "different", diff, "next-occurrence differs", next, JSON.stringify(kinds).slice(0, 400));
ex.forEach(e => console.log(JSON.stringify(e)));
