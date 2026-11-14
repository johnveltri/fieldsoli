"""Fetch US Department of Labor O*NET hourly OEWS rows. Usage: collect.py cache_dir dest.csv"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import csv
import io
from pathlib import Path
from urllib.request import Request, urlopen

STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split()
TRADES = {'49-9071.00':'General maintenance', '47-2031.00':'Carpentry', '47-2111.00':'Electrical', '47-2152.00':'Plumbing', '47-2141.00':'Painting', '37-3011.00':'Landscaping', '47-2044.00':'Tile and stone', '49-9021.00':'HVAC'}
SELECTED = ['CA','IL','MA','TX','WA','GA']

def fetch(job):
    soc, state, cache = job
    url=f'https://www.onetonline.org/link/localwagestable/{soc}/LocalWages_{soc}_{state}.csv?fmt=csv&st={state}'
    path=cache/f'{soc}_{state}.csv'
    if not path.exists():
        with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as res:
            data=res.read().decode('utf-8-sig')
        if 'Hourly Median' not in data.splitlines()[0]:
            raise ValueError(f'Unexpected response: {url}')
        path.write_text(data)
    rows=[]
    for row in csv.DictReader(io.StringIO(path.read_text())):
        columns=['Hourly QL (25%)','Hourly Median (50%)','Hourly QU (75%)']
        values=[row[c].removeprefix('$').strip() if row[c] else '' for c in columns]
        if all(v.replace('.','',1).isdigit() for v in values):
            rows.append([soc,TRADES[soc],row['Location'],*values,state])
    return rows

def main():
    a=argparse.ArgumentParser();a.add_argument('cache',type=Path);a.add_argument('output',type=Path)
    args=a.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
    jobs=[(soc,st,args.cache) for soc in TRADES for st in (STATES if soc=='49-9071.00' else SELECTED)]
    seen={}
    with ThreadPoolExecutor(max_workers=3) as executor:
        for batch in executor.map(fetch,jobs):
            for r in batch: seen.setdefault((r[0],r[2]),r)
    with args.output.open('w',newline='') as f:
        w=csv.writer(f);w.writerow(['soc','trade','area','p25_usd_hr','median_usd_hr','p75_usd_hr','source_state']);w.writerows(seen[k] for k in sorted(seen))
    print(len(seen),'area/occupation rows',len(jobs),'source tables')
if __name__=='__main__':main()
