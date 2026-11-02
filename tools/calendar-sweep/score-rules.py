import json,datetime as D,zoneinfo,collections
rows=json.load(open('fold-rules.json'))
R={}
for r in rows: R.setdefault(r['tz'],{})[r['year']]=r
def stock(i,t):
    if not i['hasDstChange']: return i['utcOffset']
    return i['dstOffset'] if i['dstStart']<=t<i['dstEnd'] else i['utcOffset']
def ce(i,t):
    if not i['hasDstChange']: return i['utcOffset']
    s,e=i['dstStart'],i['dstEnd']
    return i['dstOffset'] if ((s<=t<e) if s<=e else (t>=s or t<e)) else i['utcOffset']
UTC=D.timezone.utc
res={}
for z,ys in R.items():
    Z=zoneinfo.ZoneInfo(z)
    for y,i in ys.items():
        t=int(D.datetime(y,1,1,tzinfo=UTC).timestamp()); end=int(D.datetime(y+1,1,1,tzinfo=UTC).timestamp())
        a=b=0;tr=0;prev=None
        while t<end:
            o=int(D.datetime.fromtimestamp(t,Z).utcoffset().total_seconds())
            if prev is not None and o!=prev: tr+=1
            prev=o
            a+= stock(i,t)!=o; b+= ce(i,t)!=o; t+=3600
        res[(z,y)]=(a,b,tr)
print("zones",len(R),"zone-years",len(res))
print("wrong zone-years: stock",sum(1 for v in res.values() if v[0]),"CE",sum(1 for v in res.values() if v[1]))
print("zones wrong: stock",len({k[0] for k,v in res.items() if v[0]}),"CE",len({k[0] for k,v in res.items() if v[1]}))
for (z,y),v in sorted(res.items(),key=lambda kv:(-kv[1][1],kv[0]))[:45]:
    if v[1]: print(f"{z:30}{y} wrong-hours {v[1]:5} (of 8760) stock {v[0]:5} real changes {v[2]}  hasDst={R[z][y]['hasDstChange']}")
