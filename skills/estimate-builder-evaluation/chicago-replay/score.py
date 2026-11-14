"""Rebuild the adjudicated scorecard from saved runs. Python stdlib; no live prices."""
import csv, hashlib, json, statistics as st, re
from collections import Counter
from pathlib import Path
p=Path(__file__).resolve().parent
def read(f): return [json.loads(x) for x in f.read_text().splitlines()]
def read_set(prefix):
 a=[x for f in sorted(p.glob(prefix+'-*.jsonl')) for x in read(f)]
 assert [x['id'] for x in a]==list(range(1,101)),prefix
 return a
pre,evidence,post,final=map(read_set,['pre','evidence','post','final'])
original=read(p.parent/'baseline.jsonl')
def mid(a,b):return (a+b)/2 if None not in (a,b) else None
def disp(a,b):
 if a is None:return 'pending'
 def fmt(k):return '$'+(f'{k:,.2f}'.rstrip('0').rstrip('.'))
 return fmt(a)+'+' if b is None else fmt(a) if a==b else fmt(a)+'–'+fmt(b)
def metrics(rows):
 def stats(col):
  if not rows:return {}
  d=[x[col]-x['target'] for x in rows]
  return dict(mae=round(st.mean(abs(y) for y in d),2),bias=round(st.mean(d),2),within20=sum(abs(y)<=.2*x['target'] for x,y in zip(rows,d)))
 return {'n':len(rows),'before':stats('pre'),'after':stats('post')}
# Only a single comparable current amount: no budgets, deposits, conditional extras,
# owner-direct trades, two alternatives, or quantities the owner has not approved.
bid={1:390,2:950,3:520,5:340,6:720,7:210,8:450,9:145,10:220,11:75,12:105,13:135,14:95,15:80,16:90,17:320,19:225,20:190,21:120,22:175,23:185,24:38*9,25:165,26:260,27:480,28:125,30:160,31:240,35:155,36:145,37:250,38:180,40:95,41:1800,42:4600,43:2500,44:3200,45:175,46:800,47:1250,48:2150,49:3600,50:2900,51:2400,52:60*35+400+350,53:370,54:700,55:260,56:4*18*20,57:55,58:290,59:210,60:330,61:95,62:85,63:195,64:125,65:190,67:850,68:75,69:640,70:200,71:70,72:340,73:45,74:95,75:140,76:280,77:400,78:85,80:640,82:80,83:100,84:7,86:1200,88:46*8,90:150,91:330,92:500,93:230,94:210,96:230,98:150,99:960,100:740}
latest={x['id']:x for x in json.loads((p/'final-corrections.json').read_text())}
rows=[];pairs=[]
for suffix,d in zip(['1-33','34-66','67-100'],['9f3d0ea9e040ac7db8bbfaef7f17aa09e228fb3e2fdcd3d803b6c2fb66ad3b5b','8468d5f8b558971385f8770f302c82436b6f735fb0c05dd5e4a29e8e69762660','d5ebb60a13ff963acb241af575cf29be23a75598b5000b7aaf5c8fff651e8ddf']):
 assert hashlib.sha256((p/f'pre-{suffix}.jsonl').read_bytes()).hexdigest()==d
# Review decisions supersede raw evaluator labels; preserve original notes and source.
audit={
 7:('conditional','Exact operation but Keeley’s serves DuPage County only; not a Chicago-city offer.'),
 9:('partial','Paid $275 in Mount Prospect included treating mold and resealing the soap dish as well as the tub perimeter. Cannot assign the entire payment to the requested dry seam. A Chicago provider guide gives $150–400 for removing/replacing the joint, not a paid bill.'),
 20:('conditional','Northforge also removes packaging as standard; owner wants it left. Confirm anchoring charge, no packaging credit assumed.'),
 46:('partial','Listing floor plan is not automatically a set of measured existing-condition drawings; required views, tolerance and deliverables unspecified.'),
 58:('conditional','Full total only if fractional billing, access, delivery and minimum confirmed.'),
 60:('conditional','Unit-price extension requires provider acceptance of the small job, settled backfill and initial watering.'),
 62:('partial','Per-extension pricing does not establish the minimum for a stand-alone dispatch.'),
 63:('conditional','House dimensions/stories/guards unknown. Provider normally takes debris away. The paid cleaning line at a one-story house was $120; the separate $15 cap is out of scope.'),
 82:('conditional','Hourly rate only; neither three hours of labor nor the authorized cap is the per-hour comparison.'),
}
reused={2,20,22,26,31,34,35,58,60,76,90,92}
for aa,bb,cc,dd,oo in zip(pre,evidence,post,final,original):
 i=aa['id'];assert i==oo['id']; a,b=aa['low'],aa['high']; c,d=cc['low'],cc['high']; l,u=bb['target_low'],bb['target_high']
 match,note=audit.get(i,(bb['match'],''));target=mid(l,u) if match in ('exact','conditional') else None
 pm,nm=mid(a,b),mid(c,d)
 assert a is None or b>=a
 assert c is None or d is None or d>=c
 why=''
 if i==38:why='Channel mismatch: independent $290 vs retail $179. Retail branch is shown separately in revised rationale and not pooled.'
 if i==57:why='Revised $41.44 is an aggregate booking anchor; not a quote for this lot or an independent platform.'
 if i==82:why='Hourly rates are summarized separately from per-job dollar errors.'
 err1=round(pm-target,2) if pm is not None and target is not None else None
 err2=round(nm-target,2) if nm is not None and target is not None and i not in (38,57) else None
 paired=err1 is not None and err2 is not None and not why
 if paired:pairs.append(dict(id=i,pre=pm,post=nm,target=target))
 r=dict(id=i,title=oo['title'],request=oo['request'],contractor_terms=oo['contractor_reply'],forecast_before=disp(a,b),forecast_after=disp(c,d),unit_after=cc['unit'],local_comparison=disp(l,u) if target is not None else 'no full matching price',match=match,local_source=bb.get('source_url') or bb.get('url') or bb.get('source') or '',evidence=bb['explanation'],audit=note,midpoint_delta_before=err1,midpoint_delta_after=err2,paired_replay=paired,source_in_revised_basis=i in reused,exclusion=why,forecast_basis_before=aa['basis'],forecast_basis_after=cc['basis'],assumptions=aa['assumptions'],contractor_review=dd['contractor_review'],homeowner_estimate=dd['homeowner_estimate'])
 r['contractor_primary_comparison_amount']=bid.get(i)
 r['contractor_delta_from_local_midpoint']=round(bid[i]-target,2) if i in bid and target is not None else None
 r['contractor_delta_outside_local_band']=round(bid[i]-max(l,min(bid[i],u)),2) if i in bid and target is not None else None
 r['final_provider_options_after_validation']=latest.get(i,'')
 rows.append(r)
with (p/'scorecard.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=rows[0]);w.writeheader()
 for x in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,dict) else v for k,v in x.items()})
def dump(k,x):(p/k).write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n')
v=json.loads((p/'verification.json').read_text())
m=dict(coverage=Counter(x['match'] for x in rows),numeric_before=sum(mid(x['low'],x['high']) is not None for x in pre),numeric_after=sum(mid(x['low'],x['high']) is not None for x in post),floors=sum(x['low'] is not None and x['high'] is None for x in post),paired_replay=metrics(pairs),paired_different_target_source=metrics([x for x in pairs if x['id'] not in reused]),verification_with_conditional=metrics([x for x in v if x['target'] is not None]),verification_matched=metrics([x for x in v if x['grade']=='matched']))
dump('metrics.json',m)
print(json.dumps(m,indent=1))
