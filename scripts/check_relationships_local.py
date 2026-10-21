"""Manual integration checks against an already running localhost service; no source writes."""
import argparse
import httpx,json,time
from pathlib import Path
client=httpx.Client(base_url='http://127.0.0.1:8001',timeout=90)
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,required=True,help='Directory for bounded diagnostic evidence')
args=parser.parse_args()
out=args.output
out.mkdir(parents=True,exist_ok=True)
results={}
def cat(domain='seascape',resolution=6,**kw):
 r=client.get('/api/relationships/catalog',params=dict(domain=domain,resolution=resolution,**kw));r.raise_for_status();return r.json()
def run(name,q):
 t=time.monotonic();r=client.post('/api/relationships/plan',json=q)
 if r.status_code==200:r=client.post('/api/relationships/analyze',json={**q,'bindings':r.json()['bindings']})
 v=r.json();summary={'status':r.status_code,'seconds':round(time.monotonic()-t,3)}
 if r.status_code==200:
  summary.update(grain=v['grain'],diagnostics=v['pair']['diagnostics'],statistics=v['pair']['statistics'],plot=v['pair']['plot'],response=v['response'],source_bindings=v['bindings'])
 else:summary['error']=v
 results[name]=summary;print(name,json.dumps(summary)[:700],flush=True)
 (out/'actual-data-checks.json').write_text(json.dumps(results,indent=2)+'\n')
 return v
c=cat();defaults=c['defaults'];q={'variables':[f['key'] for f in defaults],'plot':'scatter'}
v=run('static-r6',q)
(out/'static-recipe.json').write_text(json.dumps(v['recipe'],indent=2)+'\n')
# A source categorical status, explicitly opted in, never numeric IDs.
s=cat(quality='true',search='BATHYMETRY_STATUS');f=s['fields'][0]
run('numeric-category',{'variables':[defaults[0]['key'],f['key']],'includeQuality':True})
run('recorded-srkw-strict',{'variables':[defaults[0]['key']],'mode':'response','start':'2025-01-01','end':'2025-12-31'})
run('recorded-srkw-qualified',{'variables':[defaults[0]['key']],'mode':'response','precision':'reported','start':'2025-01-01','end':'2025-12-31'})
w=cat('meteorology',5);wf=[f for f in w['fields'] if f['column'] in ['PRECIPITATION_MM','TEMPERATURE_2M_C_MEAN']]
run('weather-partial-day',{'variables':[f['key'] for f in wf],'resolution':5,'start':'2026-10-09','end':'2026-10-10'})
run('weather-cross-grid-refused',{'variables':[defaults[0]['key'],wf[0]['key']]})
k=cat(search='MAPPED_BED_EXTENT_IN_FULL_H3_M2');kfs=[f for f in k['fields'] if f['slices']]
if kfs:run('survey-year-native',{'variables':[defaults[0]['key'],kfs[0]['key']],'slice':kfs[0]['slices'][-1]})
# Governance tests reader validation and observed-set encoding against installed source.
g=cat('governance');ms=[f for f in g['fields'] if f['kind']=='membership' and not f['unsupported']]
if ms:run('governance-exact-sets',{'variables':[defaults[0]['key'],ms[0]['key']],'membershipEncoding':'exact_set'})
h=cat('human',7);hf=[f for f in h['fields'] if f['kind']=='numeric' and not f['unsupported'] and f['available']]
if len(hf)>=2:run('human-native-r7',{'variables':[f['key'] for f in hf[:2]],'resolution':7})
r8=cat('seascape',8)
if len(r8.get('defaults',[]))>=2:run('static-r8',{'variables':[f['key'] for f in r8['defaults'][:2]],'resolution':8})
print('COMPLETE',flush=True)
