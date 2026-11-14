"""Verify sealed artifacts, case counts, scope-only inputs and cost arithmetic."""
import hashlib,json,re
from pathlib import Path
p=Path(__file__).resolve().parent
def read(filename):return [json.loads(s) for s in (p/filename).read_text().splitlines() if s.strip()]
for name,checksum in json.loads((p/'locks.json').read_text()).items():
    assert hashlib.sha256((p/name).read_bytes()).hexdigest()==checksum,name
for group in ['dev','test'] + (['extra'] if (p/'new-extra.jsonl').exists() else []):
    scopes=read(f'scope-{group}.jsonl');truth=read(f'payments-{group}.jsonl')
    assert len(scopes)==len(truth) and len({x['id'] for x in truth})==len(truth)
    for scope,t in zip(scopes,truth):
        assert scope['id']==t['id']
        assert not re.search(r'https?://|\$\s*[\d.,]',json.dumps(scope,ensure_ascii=False))
        assert t['source_url'].startswith('http') and len(t['lines'])>=2
        assert abs(sum(line['usd'] for line in t['lines'])-t['total'])<.011
    for version in ('old','new'):
        fc=read(f'{version}-{group}.jsonl')
        assert [s['id'] for s in scopes]==[f['id'] for f in fc]
        for f in fc:
            if f['point'] is None:continue
            assert f['low']<=f['point']<=f['high'],f['id']
            for key in ('low','point','high'):
                components=f['components']
                if components and all(isinstance(c.get(key),(int,float)) for c in components):
                    assert abs(sum(c[key] for c in components)-f[key])<=1,(f['id'],key)
print('Sealed files, redactions, unique cases, itemized totals and forecasts verified.')
