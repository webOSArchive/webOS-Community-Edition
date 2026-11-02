// UNTIL repeats, .ics through the real parser into the real framework:
// node until-sweep.js <concatenated.js or 42calendar.js> <folder of the parser's .js files>
// Run with TZ set to the device's zone. STEP=days between start dates. CHANGES=1 as in sweep.js.
const fs=require("fs"),path=require("path");
const H=require("./lib.js");const {load,offsetAt}=H;const yearRules=process.env.CHANGES?H.withChanges:H.yearRules;
const file=process.argv[2],utils=process.argv[3].replace(/\/?$/,"/"),DEV=process.env.TZ;
const lib=load(file);
const tm=new lib.__T();tm.timezone=DEV;const u=new lib.__U();
const ZONES=["Australia/Sydney","America/Los_Angeles","America/New_York","Pacific/Auckland","Asia/Kolkata","Europe/London"];
for(const z of new Set([...ZONES,DEV]))for(let y=2026;y<=2029;y++)(tm.timezones[y]=tm.timezones[y]||{})[z]=yearRules(z,y);
function Future(r){if(arguments.length)this.result=r}Future.prototype.then=function(a,b){(b||a).call(this,this);return this};Future.prototype.getResult=function(){return this.result};
tm.hasTimezoneInfo=(t,y)=>!!(tm.timezones[y]&&tm.timezones[y][t]);tm.loadTimezones=()=>new Future({returnValue:true});tm.setup=()=>new Future({});
function L(f){const m={exports:{}};new Function("require","module","exports","libPath","Log","Future","Calendar","checkResult",fs.readFileSync(utils+f,"utf8"))(n=>L(path.basename(n)),m,m.exports,"",{log(){},log_icalDebug(){},debug(){}},Future,{TimezoneManager:()=>tm},f=>f.result||{returnValue:true});return m.exports}
const iCal=L("iCal.js");
const parse=l=>{let o;iCal.parseWebCalICal("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"+l.join("\r\n")+"\r\nEND:VCALENDAR\r\n").then(f=>{o=f.result});return o.events[0].result};
const memo=new Map();const off=(t,ms)=>{const k=t+ms;if(!memo.has(k))memo.set(k,offsetAt(t,ms));return memo.get(k)};
const wall=(t,y,m,d,h,mi)=>{const g=Date.UTC(y,m,d,h,mi);let r=g-off(t,g)*1000;return g-off(t,r)*1000};
const st=(y,m,d,h,mi)=>{const x=new Date(Date.UTC(y,m,d,h,mi));const p=n=>String(n).padStart(2,"0");return `${x.getUTCFullYear()}${p(x.getUTCMonth()+1)}${p(x.getUTCDate())}T${p(x.getUTCHours())}${p(x.getUTCMinutes())}00`};
const z=ms=>st(1970,0,1,0,0).slice(0,0)+new Date(ms).toISOString().replace(/[-:]/g,"").slice(0,15)+"Z";
let n=0,bad=0,ex=[],sum={};
for(const tz of ZONES)for(const [h,mi,len] of [[0,30,1],[9,0,1],[22,0,1],[23,30,3]])for(const [freq,step] of [["WEEKLY",7],["DAILY",1]])for(let day=0;day<365;day+=+process.env.STEP||7){
 const b=new Date(Date.UTC(2027,0,1+day)),Y=b.getUTCFullYear(),M=b.getUTCMonth(),D=b.getUTCDate(),cnt=4;
 const lastInst=wall(tz,Y,M,D+(cnt-1)*step,h,mi);
 const e=parse(["BEGIN:VEVENT","UID:u","SUMMARY:x",`DTSTART;TZID=${tz}:${st(Y,M,D,h,mi)}`,`DTEND;TZID=${tz}:${st(Y,M,D,h+len,mi)}`,`RRULE:FREQ=${freq};UNTIL=${z(lastInst)}`,"END:VEVENT"]);
 const exp=[];for(let k=0;k<cnt;k++)exp.push(wall(tz,Y,M,D+k*step,h,mi));
 const got=new Set(),a=new Date(exp[0]);a.setHours(0,0,0,0);a.setDate(a.getDate()-2);
 for(let i=0;i<cnt*step+9;i++){const s=new Date(a);s.setDate(s.getDate()+i);const t=new Date(s);t.setDate(t.getDate()+1);for(const o of u.findRepeatsInRange(e,{start:s.getTime(),end:t.getTime()-1,tzId:DEV}))got.add(o.currentLocalStart)}
 n++;const g=[...got].sort((p,q)=>p-q);
 if(JSON.stringify(g)!==JSON.stringify(exp)){bad++;const k=g.length<cnt?"lost":g.length>cnt?"gained":"hour";sum[k]=(sum[k]||0)+1;if(ex.length<3&&k!=="hour")ex.push({tz,h,freq,start:st(Y,M,D,h,mi),k,got:g.map(x=>new Date(x).toISOString().slice(5,16)),until:new Date(e.rrule.until).toISOString(),exdates:e.exdates})}
}
console.log(DEV.padEnd(22),"UNTIL cases",n,"wrong",bad,JSON.stringify(sum));ex.forEach(x=>console.log(JSON.stringify(x).slice(0,300)));
