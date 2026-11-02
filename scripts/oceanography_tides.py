"""Native seasonal context and event-list validation; never daily scalar coercion."""
import calendar
import math
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
import h3
import pyarrow as pa
import pyarrow.dataset as ds
import pyarrow.parquet as pq

METRICS=['high_tide_times_utc','low_tide_times_utc','high_tide_local_times','low_tide_local_times']

def seasonal_dates(e):
 q=e['qualification'];periods=q['periods'];dates=[];out={}
 if q['forecast_eligible'] is not False or not isinstance(q['publication_lag'],str):raise ValueError('ENSO availability qualification missing')
 for p in periods:
  d=date.fromisoformat(p['date']);month=d.year*12+d.month-3;start=date(month//12,month%12+1,1)
  if p['date']!=p['period_end'] or p['period_start']!=start.isoformat() or d.day!=calendar.monthrange(d.year,d.month)[1] or p['issue_date'] is not None or p['date'] in out:raise ValueError('Invalid ENSO native period')
  if dates and (d.year*12+d.month)-(dates[-1].year*12+dates[-1].month)!=1:raise ValueError('ENSO native period gap/order')
  dates.append(d);out[p['date']]=p
 if not dates or dates[0].isoformat()!=e['date_start'] or dates[-1].isoformat()!=e['date_end']:raise ValueError('ENSO period support mismatch')
 return dates,out

def daily_rows(path,day,columns):
 scanner=ds.dataset(path,format='parquet').scanner(filter=ds.field('date')==pa.scalar(day,pa.date32()),columns=columns,batch_size=4096,use_threads=False,batch_readahead=1,fragment_readahead=1)
 for b in scanner.to_batches():yield from b.to_pylist()

def tide_payload(path,day,metric,ids):
 rows={}
 for r in daily_rows(path,day,['h3_index',metric]):
  if r['h3_index'] in rows:raise ValueError('Duplicate tide cell')
  values=r[metric];rows[r['h3_index']]=None if values is None else [v.isoformat() if isinstance(v,datetime) else v for v in values]
 if set(rows)!=set(ids):raise ValueError('Tide date/cell support mismatch')
 return {'values':[rows[c] for c in ids]}

def validate_event_row(r,mapping,stations):
 vals=[r[m] for m in METRICS];assignment=mapping.get(r['h3_index'])
 if assignment is None:
  if any(v is not None for v in vals):raise ValueError('Unsupported tide cell has events')
  return
 if any(not isinstance(v,list) for v in vals):raise ValueError('Mapped tide event lists missing')
 zone=ZoneInfo(stations[assignment['station']]['timezone'])
 for utc,local in [(vals[0],vals[2]),(vals[1],vals[3])]:
  if len(utc)!=len(local) or utc!=sorted(utc) or len(set(utc))!=len(utc):raise ValueError('Tide event pairing/order/duplicate mismatch')
  for u,l in zip(utc,local,strict=True):
   parsed=datetime.fromisoformat(l)
   if u.date()!=r['date'] or parsed.tzinfo is None or parsed!=u or parsed.utcoffset()!=u.astimezone(zone).utcoffset() or parsed.replace(tzinfo=None)!=u.astimezone(zone).replace(tzinfo=None):raise ValueError('Tide UTC/local date or DST mismatch')

def validate_tides(store,e,study,info,stamp):
 path=store.root/e['path'];q=e['qualification'];metrics=METRICS
 if path.parent!=store.root or e['h3_resolution']!=6 or e['metrics']!=metrics or e['metric']!=metrics[0] or e['columns']!=['date','h3_index']+metrics or e['units']!='event timestamps (UTC and offset-bearing local ISO8601)' or q['forecast_eligible'] is not False or q['issue_date'] is not None:raise ValueError('Invalid tide catalog binding')
 store.bind(path,e['sha256']);pf=pq.ParquetFile(path)
 schema=pa.schema([('date',pa.date32()),('h3_index',pa.string())]+[(m,pa.list_(pa.timestamp('us',tz='UTC') if m.endswith('_utc') else pa.string())) for m in metrics])
 if pf.schema_arrow.remove_metadata()!=schema or pf.metadata.num_rows!=e['row_count']:raise ValueError('Tide schema mismatch')
 member=study['memberships']['6'];from pathlib import Path
 registry=Path(member['path']);store.bind(registry,member['sha256']);ids=sorted(registry.read_text().splitlines());allowed=set(ids)
 if len(ids)!=member['count'] or len(allowed)!=len(ids) or any(not h3.is_valid_cell(c) or h3.get_resolution(c)!=6 for c in ids):raise ValueError('Tide registry mismatch')
 stations={s['id']:s for s in q['station_metadata']};mapping=q['mapping']
 if len(stations)!=len(q['station_metadata']) or not set(mapping)<=allowed:raise ValueError('Tide station mapping mismatch')
 for c,a in mapping.items():
  if a['station'] not in stations or not math.isfinite(a['distance_km']) or not 0<=a['distance_km']<=20 or not h3.is_valid_cell(a['water_target_r8']) or h3.get_resolution(a['water_target_r8'])!=8 or h3.cell_to_parent(a['water_target_r8'],6)!=c:raise ValueError('Tide source assignment mismatch')
 start=date.fromisoformat(e['date_start']);end=date.fromisoformat(e['date_end']);days=(end-start).days+1
 if days<=0 or days*len(ids)!=e['row_count']:raise ValueError('Tide support mismatch')
 cells_payload={'ids':ids,'resolution':6,'sourceSha256':e['sha256']};cells=store.asset(cells_payload,stamp,('cells',e['id'],None,None));store.entries[e['id']]={'entry':e,'ids':ids,'metrics':metrics,'resolution':6,'cells':cells_payload};slices={};counts={m:dict(nonnull=0,null=0,events=0) for m in metrics}
 for i in range(days):
  d=start+timedelta(days=i);seen=set()
  for r in daily_rows(path,d,['date','h3_index']+metrics):
   cell=r['h3_index']
   if cell in seen or cell not in allowed:raise ValueError('Tide duplicate/membership mismatch')
   seen.add(cell);validate_event_row(r,mapping,stations)
   for m in metrics:
    v=r[m];counts[m]['null' if v is None else 'nonnull']+=1;counts[m]['events']+=len(v) if v is not None else 0
  if seen!=allowed:raise ValueError('Tide date/cell support mismatch')
  columns={m:store.asset(tide_payload(path,d,m,ids),stamp,('tide',e['id'],d.isoformat(),m)) for m in metrics}
  slices[d.isoformat()]={'rows':len(ids),'cells':cells,'columns':columns,'sourceSha256':e['sha256'],'sourcePath':e['path'],'resolution':6,'label':d.isoformat()+' · UTC event day'}
 if counts!=e['statistics']:raise ValueError('Tide event summary mismatch')
 store.catalog['products']['oceanography-tide-events']={'axis':'UTC event day','defaultSlice':start.isoformat(),'slices':slices}
 store.catalog['features'].append({'id':'tide_events','column':metrics[0],'productId':'oceanography-tide-events','dataset':'oceanography','kind':'categorical','categories':['Station predictions available'],'resolution':6,'name':'High & low tide times','family':'Ocean Conditions','unit':'station timing proxy','range':[0,1],'available':counts[metrics[0]]['nonnull'],'rows':e['row_count'],'role':'source_field','qualifiers':metrics[1:],'sourceRelease':e['source_dataset'],'sourcePath':e['path'],'sourceSha256':e['sha256'],'definition':e['description']+' '+q['method']+' '+q['date_basis']+' Issue date unknown; not an operational forecast archive.','modelingEligibility':'forecast_ineligible; issue date unknown','arrowType':'event_lists','tideEvents':{'stations':stations,'mapping':mapping}})
 store.check()
