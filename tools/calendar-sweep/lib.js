// Loads a build of the calendar framework. Zone answers come from Intl, not from the code under test.
const fs=require("fs"),path=require("path");
if(!process.env.UNDERSCORE)throw new Error("set UNDERSCORE to underscore/submission/7/javascript/underscore.js");
function offsetAt(tz,ms){ // seconds east of UTC, from Intl
  const d=new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"}).formatToParts(new Date(ms));
  const g=t=>+d.find(p=>p.type===t).value;
  return (Date.UTC(g("year"),g("month")-1,g("day"),g("hour"),g("minute"),g("second"))-Math.floor(ms/1000)*1000)/1000;
}
function yearRules(tz,year){ // SystemService.yearRules, with daylight = the larger offset
  const utc0=Date.UTC(year,0,1),from=utc0-offsetAt(tz,utc0)*1000,u1=Date.UTC(year+1,0,1),to=u1-offsetAt(tz,u1)*1000;
  let lo0=Infinity,hi0=-Infinity;for(let t=from;t<to;t+=864e5){const o=offsetAt(tz,t);lo0=Math.min(lo0,o);hi0=Math.max(hi0,o)}
  if(lo0===hi0)return{tz,year,hasDstChange:false,utcOffset:lo0,dstOffset:-1,dstStart:-1,dstEnd:-1};
  let s=-1,e=-1;
  for(let t=from;t<to;t+=864e5){const n=Math.min(t+864e5,to);if(offsetAt(tz,t)!==offsetAt(tz,n)){let l=t/1000|0,h=n/1000|0;const o=offsetAt(tz,t);while(h-l>1){const m=Math.floor((l+h)/2);if(offsetAt(tz,m*1000)===o)l=m;else h=m}if(offsetAt(tz,h*1000)===hi0){if(s<0)s=h}else if(e<0)e=h}}
  return{tz,year,hasDstChange:true,utcOffset:lo0,dstOffset:hi0,dstStart:s,dstEnd:e};
}
function withChanges(tz,year){const r=yearRules(tz,year);const u0=Date.UTC(year,0,1),from=u0-offsetAt(tz,u0)*1000,u1=Date.UTC(year+1,0,1),to=u1-offsetAt(tz,u1)*1000;r.firstOffset=offsetAt(tz,from);r.changes=[];for(let t=from;t<to;t+=864e5){const n=Math.min(t+864e5,to);const o=offsetAt(tz,t);if(o!==offsetAt(tz,n)){let l=t/1000|0,h=n/1000|0;while(h-l>1){const m=Math.floor((l+h)/2);if(offsetAt(tz,m*1000)===o)l=m;else h=m}r.changes.push([h,offsetAt(tz,h*1000)])}}return r}
function load(file,patch){
  let src=fs.readFileSync(file,"utf8"); if(src.startsWith("this._root")){src=src.slice(src.indexOf("\n"));src=src.slice(0,src.lastIndexOf("}"))}
  if(patch)src=patch(src);
  const _=require(process.env.UNDERSCORE)._||require(process.env.UNDERSCORE);
  const Class={create:function(a,b){const p=b||a;function K(){if(this.initialize)this.initialize.apply(this,arguments)}if(b){K.prototype=Object.create(a.prototype)}Object.assign(K.prototype,p);return K}};
  const Future=function(){};const F={Class,Data:{DB:{}},Control:{Future},ObjectUtils:{clone:o=>JSON.parse(JSON.stringify(o))},Comms:{PalmCall:{}}};
  const MojoLoader={require:()=>({underscore:{_},foundations:F})};
  const exportsObj={};
  new Function("MojoLoader","exports","console",src+"\n;exports.__U=EventManagerUtils;exports.__T=TimezoneManager;")(MojoLoader,exportsObj,console);
  return exportsObj;
}
module.exports={withChanges,load,yearRules,offsetAt};
