import fs from "fs";
const zones=JSON.parse(fs.readFileSync("zones.json"));
const pages=await (await fetch("http://127.0.0.1:9223/json")).json();
const p=pages.find(p=>p.type==="page"&&p.url.includes("com.palm.app.calendar")&&p.url.endsWith("/index.html"));
const ws=new WebSocket(p.webSocketDebuggerUrl);await new Promise(o=>ws.onopen=o);
let n=0;const ev=e=>new Promise(ok=>{const id=++n;const h=m=>{const r=JSON.parse(m.data);if(r.id===id){ws.removeEventListener("message",h);ok(r)}};ws.addEventListener("message",h);ws.send(JSON.stringify({id,method:"Runtime.evaluate",params:{expression:e,awaitPromise:true,returnByValue:true}}))});
const out=[];
for(let i=0;i<zones.length;i+=60){
 const q=zones.slice(i,i+60).map(tz=>({tz,years:[2024,2025,2026,2027,2028]}));
 const e=`new Promise(function(ok){var x=new PalmServiceBridge();x.onservicecallback=function(m){ok(m)};x.call("palm://com.palm.systemservice/timezone/getTimeZoneRules",${JSON.stringify(JSON.stringify(q))})})`;
 const r=await ev(e);const v=r.result?.result?.value; if(!v){console.log("fail",i);continue}
 out.push(...JSON.parse(v).results);
}
fs.writeFileSync("fold-rules.json",JSON.stringify(out));console.log(out.length,"rows");process.exit(0);
