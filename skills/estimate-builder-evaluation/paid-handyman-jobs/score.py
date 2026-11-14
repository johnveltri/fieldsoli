"""Score frozen nominal-dollar forecasts against the released payments (standard library)."""
from pathlib import Path
import csv, json, statistics as st, hashlib
root=Path(__file__).resolve().parent
def read(name):
    rows=[json.loads(s) for s in (root/name).read_text().splitlines() if s.strip()]
    result={r['id']:r for r in rows}
    assert len(rows)==len(result),name
    return result
def metric(rows,tag):
    scored=[r for r in rows if r[tag+'_point'] is not None]
    if not scored:return {'n':0}
    err=[r[tag+'_point']-r['paid'] for r in scored]
    rel=[abs(e/r['paid']) for e,r in zip(err,scored)]
    return dict(n=len(scored),mae=round(st.mean(map(abs,err)),2),median_ape_pct=round(100*st.median(rel),1),bias=round(st.mean(err),2),within20=sum(e<=.2 for e in rel),inside_range=sum(r[tag+'_low']<=r['paid']<=r[tag+'_high'] for r in scored),mean_range_width=round(st.mean(r[tag+'_high']-r[tag+'_low'] for r in scored),2))
def build():
    output=[]; summary={}; lines=[]
    for group in ['dev','test'] + (['extra'] if (root/'new-extra.jsonl').exists() else []):
        scopes=read('scope-'+group+'.jsonl'); truth=read('payments-'+group+'.jsonl')
        old=read('old-'+group+'.jsonl');new=read('new-'+group+'.jsonl')
        assert scopes.keys()==truth.keys()==old.keys()
        if new:assert new.keys()==truth.keys()
        for k in scopes:
            t=truth[k];s=scopes[k]
            assert abs(sum(x['usd'] for x in t['lines'])-t['total'])<.011,(k,'unreconciled total')
            assert t['total']>0
            row=dict(id=k,group=group,city=s['city'],date=s['date'],scope=s['scope'],paid=t['total'],line_items=json.dumps(t['lines'],ensure_ascii=False),payment_basis=t['payment_evidence'],source=t['source_url'])
            for tag,coll in [('old',old),('new',new)]:
                x=coll.get(k,{})
                for f in ('low','point','high'):row[tag+'_'+f]=x.get(f)
                row[tag+'_basis']=x.get('basis','')
                if x.get('point') is not None: assert 0<=x['low']<=x['point']<=x['high']
                row[tag+'_error']=None if x.get('point') is None else round(x['point']-row['paid'],2)
            # Case intake preserves the receipt line order; compare like categories. A
            # component can be unpriced when the estimator withholds a complete job total.
            for j,line in enumerate(t['lines']):
                lr=dict(id=k,group=group,receipt_item=line['name'],paid=line['usd'])
                for tag,coll in [('old',old),('new',new)]:
                    forecast=coll.get(k,{})
                    items=forecast.get('components',[])
                    assert len(items)==len(t['lines']),(k,tag,'component count')
                    item=items[j]
                    lr[tag+'_item']=item['description']
                    lr[tag+'_point']=item['point']
                    lr[tag+'_error']=None if item['point'] is None else round(item['point']-line['usd'],2)
                lines.append(lr)
            output.append(row)
        sub=[r for r in output if r['group']==group]
        summary[group]=dict(jobs=len(sub),original=metric(sub,'old'))
        if new:
            paired=[r for r in sub if r['old_point'] is not None and r['new_point'] is not None]
            summary[group].update(revised=metric(sub,'new'),paired_original=metric(paired,'old'),paired_revised=metric(paired,'new'),closer=sum(abs(r['new_error'])<abs(r['old_error']) for r in paired),farther=sum(abs(r['new_error'])>abs(r['old_error']) for r in paired))
    with (root/'job-comparisons.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=output[0]);w.writeheader();w.writerows(output)
    with (root/'line-review.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=lines[0]);w.writeheader();w.writerows(lines)
    (root/'metrics.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))
if __name__=='__main__':build()
