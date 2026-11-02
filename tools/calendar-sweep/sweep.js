// COUNT repeats: node sweep.js <concatenated.js or 42calendar.js> [WEEKLY|DAILY] [examples to print]
// Run with TZ set to the device's zone. STEP=days between start dates (1 is every day of 2027).
// CHANGES=1 adds Lunacy's firstOffset and changes to the zone rules.
const H=require("./lib.js");const {load,offsetAt}=H;const yearRules=process.env.CHANGES?H.withChanges:H.yearRules;
const DEV=process.env.TZ, file=process.argv[2], freq=process.argv[3]||"WEEKLY", verbose=process.argv[4];
const lib=load(file);
const tm=new lib.__T(); tm.timezone=DEV; const u=new lib.__U();
const ZONES=["Australia/Sydney","America/Los_Angeles","America/New_York","Pacific/Auckland","Asia/Kolkata","Australia/Lord_Howe","Europe/London","Pacific/Honolulu"];
for(const z of new Set([...ZONES,DEV]))for(let y=2026;y<=2029;y++){(tm.timezones[y]=tm.timezones[y]||{})[z]=yearRules(z,y)}
const memo=new Map();const off=(tz,ms)=>{const k=tz+ms;if(!memo.has(k))memo.set(k,offsetAt(tz,ms));return memo.get(k)};
function wall(tz,y,mo,d,h,mi){let g=Date.UTC(y,mo,d,h,mi);let t=g-off(tz,g)*1000;t=g-off(tz,t)*1000;return t}
const ymd=(y,m,d)=>{const x=new Date(Date.UTC(y,m,d));return ""+x.getUTCFullYear()+String(x.getUTCMonth()+1).padStart(2,"0")+String(x.getUTCDate()).padStart(2,"0")};
let cases=0,bad=0,badK={};const ex=[];
const step=freq==="WEEKLY"?7:1;
for(const tz of ZONES)for(const [h,mi] of [[0,30],[9,0],[22,0],[23,30]])for(let day=0;day<365;day+=(+process.env.STEP||1)){
 const b=new Date(Date.UTC(2027,0,1+day)),Y=b.getUTCFullYear(),M=b.getUTCMonth(),D=b.getUTCDate();
 for(const mode of ["paged","wide"])for(const cancel of [false,true]){
  const count=6,dt=wall(tz,Y,M,D,h,mi);
  const exp=[];const exdates=[];
  for(let k=0;k<count;k++){const inst=wall(tz,Y,M,D+k*step,h,mi);if(cancel&&k===2)exdates.push(ymd(Y,M,D+k*step));else exp.push(inst)}
  const ev={_id:"e",dtstart:dt,dtend:dt+36e5,tzId:tz,rrule:{freq,interval:1,count},exdates};
  if(freq==="WEEKLY")ev.rrule.rules=[{ruleType:"BYDAY",ruleValue:[{day:new Date(Date.UTC(Y,M,D)).getUTCDay()}]}];
  const got=new Set();
  const first=new Date(dt);first.setHours(0,0,0,0);first.setDate(first.getDate()-1);
  const span=count*step+4;
  if(mode==="wide"){const a=first.getTime(),z=new Date(first);z.setDate(z.getDate()+span);for(const o of u.findRepeatsInRangeCountVersion(ev,{start:a,end:z.getTime()-1,tzId:DEV}))got.add(o.currentLocalStart)}
  else for(let i=0;i<span;i++){const a=new Date(first);a.setDate(a.getDate()+i);const z=new Date(a);z.setDate(z.getDate()+1);for(const o of u.findRepeatsInRangeCountVersion(ev,{start:a.getTime(),end:z.getTime()-1,tzId:DEV}))got.add(o.currentLocalStart)}
  const e=[...exp].sort((a,b)=>a-b),g=[...got].sort((a,b)=>a-b);cases++;
  if(JSON.stringify(e)!==JSON.stringify(g)){bad++;const key=mode+(cancel?"+cancel":"");badK[key]=(badK[key]||0)+1;if(ex.length<(+verbose||0))ex.push({tz,h,mi,start:ymd(Y,M,D),mode,cancel,missing:e.filter(x=>!got.has(x)).map(x=>new Date(x).toISOString()),extra:g.filter(x=>!e.includes(x)).map(x=>new Date(x).toISOString())})}
 }}
console.log(DEV.padEnd(22),freq.padEnd(7),"cases",cases,"wrong",bad,JSON.stringify(badK));ex.forEach(x=>console.log(JSON.stringify(x)));
