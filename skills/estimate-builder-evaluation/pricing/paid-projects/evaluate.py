"""Reproduce with Python 3: evaluate.py NATIONAL.zip LABELS.zip OUTPUT_DIR."""
import csv
from collections import Counter, defaultdict
import hashlib
import io
import json
import math
from pathlib import Path
import statistics as stats
import sys
import zipfile

def records(archive, member, encoding='utf-8-sig'):
    with archive.open(member) as data:
        yield from csv.DictReader(io.TextIOWrapper(data, encoding=encoding))

def clean(s):
    return s.strip().strip("'")

def quantile(sorted_costs, p):
    at = (len(sorted_costs) - 1) * p
    lo = math.floor(at)
    return sorted_costs[lo] + (at-lo)*(sorted_costs[math.ceil(at)]-sorted_costs[lo])

def band(costs):
    values = sorted(costs)
    return tuple(quantile(values, p) for p in (.1, .5, .9))

def score(results):
    actual, predicted, lows, highs = zip(*results)
    errors = [p-a for a,p in zip(actual,predicted)]
    return dict(n=len(actual), mae=round(stats.mean(map(abs,errors)),2),
                median_absolute_error=round(stats.median(map(abs,errors)),2),
                bias=round(stats.mean(errors),2),
                within25_pct=round(100*stats.mean(abs(e)<=.25*a for e,a in zip(errors,actual)),2),
                interval_coverage_pct=round(100*stats.mean(l<=a<=h for a,l,h in zip(actual,lows,highs)),2))

def write_csv(path, rows):
    with path.open('w', newline='') as f:
        w=csv.DictWriter(f,fieldnames=rows[0]); w.writeheader(); w.writerows(rows)

def run(national, labels, output):
    output.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(labels) as z:
        names={r['Value']:r['Label'] for r in records(z,'AHS 2023 Value Labels.csv','cp1252') if r['Table']=='PROJECT' and r['NAME']=='JOBTYPE'}
    with zipfile.ZipFile(national) as z:
        divisions={r['CONTROL']:clean(r['DIVISION']) for r in records(z,'household.csv') if clean(r['TENURE'])=='1' and clean(r['INTSTATUS'])=='1'}
        train=defaultdict(list); test=[]
        for r in records(z,'project.csv'):
            key=r['CONTROL']; typ=clean(r['JOBTYPE'])
            if key not in divisions or typ not in names or typ in ('31','37'):continue
            if clean(r['JOBCOMP'])!='1' or clean(r['JOBDIY'])!='2':continue
            if any(clean(r['J'+v])!='0' for v in ['JOBCOST','JOBCOMP','JOBDIY','JOBTYPE']):continue
            cost=float(clean(r['JOBCOST']))
            if cost<=0:continue
            div=divisions[key]
            if int(hashlib.sha256(clean(key).encode()).hexdigest()[:8],16)%5==0:
                test.append((typ, div, cost))
            else:
                for group in [('all','all'),(typ,'US'),(typ,div)]:train[group].append(cost)
    bands={k:band(v) for k,v in train.items() if len(v)>=(20 if k[1]=='US' else 40)}
    ref=[]
    for (typ,div),(lo,mid,hi) in sorted(bands.items()):
        if typ=='all':continue
        ref.append(dict(type_id=typ,project=names[typ],division=div,n_train=len(train[typ,div]),p10=round(lo,2),median=round(mid,2),p90=round(hi,2)))
    write_csv(output/'historical-project-bands.csv',ref)
    scores=defaultdict(list); by_type=defaultdict(list); unsupported=Counter(); detail=[]
    for typ,div,actual in test:
        if (typ,'US') not in bands:
            unsupported[typ]+=1
            continue
        for method,key in [('pooled',('all','all')),('type',(typ,'US')),('type_and_division',(typ,div) if (typ,div) in bands else (typ,'US'))]:
            lo,mid,hi=bands[key]
            record=(actual,mid,lo,hi)
            scores[method].append(record);by_type[typ,method].append(record)
        detail.append(dict(project=names[typ],division=div,reported_usd=actual,pooled=bands['all','all'][1],project_median=bands[typ,'US'][1],regional_median=mid,p10=lo,p90=hi))
    result=dict(train_jobs=len(train['all','all']),eligible_holdout=len(test),scored=len(detail),unsupported=dict(unsupported),models={m:score(v) for m,v in scores.items()})
    (output/'metrics.json').write_text(json.dumps(result,indent=2)+'\n')
    write_csv(output/'by-project.csv',[dict(project=names[t],method=m,**score(v)) for (t,m),v in sorted(by_type.items())])
    write_csv(output/'holdout.csv',detail)
    print(json.dumps(result,indent=2))

if __name__=='__main__':
    run(*map(Path,sys.argv[1:]))
