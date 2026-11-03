// A repeat stored with a Windows zone name, as webcal before 0.2.3 stored Outlook's, against the
// same repeat with its IANA name. node windows-zone-sweep.js <concatenated.js or 42calendar.js>
// Run with TZ set to the device's zone. A build without the name table fails with the times one
// hour out after a clock change (a fall to UTC, see LunaRuntimes/calendar/CHANGES.md, 0003).
const {load,yearRules}=require("./lib.js");
const file=process.argv[2],DEV=process.env.TZ,lib=load(file),tm=new lib.__T(),u=new lib.__U();
tm.timezone=DEV;
const names=tm.windowsZones||{"Eastern Standard Time":"America/New_York"};
const pairs=Object.keys(names).filter(w=>!/UTC/.test(names[w]));
const rule=z=>{for(let y=2026;y<=2028;y++){(tm.timezones[y]=tm.timezones[y]||{})[z]=yearRules(z,y)}};
rule(DEV);
// Ninja's Standup: Tuesdays, Wednesdays and Thursdays at 09:45 Eastern from Oct 6, 2026, 15 minutes.
const start=Date.UTC(2026,9,6,13,45);
const event=tz=>({_id:"e",dtstart:start,dtend:start+9e5,tzId:tz,rrule:{freq:"WEEKLY",interval:1,count:60,rules:[{ruleType:"BYDAY",ruleValue:[{day:2},{day:3},{day:4}]}]},exdates:[]});
const times=tz=>{const a=new Date(2026,9,1).getTime(),z=new Date(2027,0,31).getTime();return u.findRepeatsInRangeCountVersion(event(tz),{start:a,end:z,tzId:DEV}).map(o=>o.currentLocalStart).sort((x,y)=>x-y)};
let bad=0;
for(const w of pairs){rule(names[w]);if(!tm.windowsZones)continue;
 // Only the IANA name's rules are loaded, as on a device, where the bus doesn't know the other.
 const want=JSON.stringify(times(names[w])),got=JSON.stringify(times(w));if(want!==got){bad++;console.log("differs:",w,names[w])}}
const nov3=times("Eastern Standard Time").map(t=>new Date(t)).find(d=>d.getMonth()==10&&d.getDate()==3);
console.log(DEV,"names",pairs.length,"differ",bad,"| the standup on Nov 3:",nov3&&nov3.toString().slice(0,24));
