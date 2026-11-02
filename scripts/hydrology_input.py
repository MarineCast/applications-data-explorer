"""Qualify retained per-river products for the explorer; no network or source writes."""
from __future__ import annotations
import argparse
from datetime import date, timedelta
import hashlib
import json
import math
import os
from pathlib import Path
import h3
import pyarrow as pa
import pyarrow.parquet as pq

METRICS={
 'discharge_mean':('Daily mean discharge','Discharge','m3/s','Native provider daily mean discharge measured at the retained upstream gauge.'),
 'discharge_mean_7d':('7-day mean discharge','Discharge','m3/s','Trailing mean of the current and preceding 6 daily means; all 7 days must be valid.'),
 'discharge_mean_30d':('30-day mean discharge','Discharge','m3/s','Trailing mean of the current and preceding 29 daily means; all 30 days must be valid.'),
 'discharge_change_7d':('7-day discharge change','Discharge','m3/s','Current daily mean minus the mean 7 days earlier; all 8 intervening daily values must be valid.'),
 'high_flow_duration':('High-flow duration','Flow indicators','day',"Consecutive provider days strictly above each river's historical 90th-percentile flow; zero at or below the threshold. Interior gaps interpolated for this calculation only; retrospective."),
 'low_flow_duration':('Low-flow duration','Flow indicators','day','Consecutive days below the configured low-flow threshold, after a known streak start; gaps reset event history. Threshold is an unvalidated configured default.'),
 'days_since_flow_pulse':('Days since flow pulse','Flow indicators','day','Days since an observed upward crossing of the configured pulse threshold; gaps reset event history. Threshold is an unvalidated configured default.'),
 'temperature_mean':('Daily mean water temperature','Water temperature','degC','Native provider daily mean water temperature at the retained gauge.'),
 'temperature_max':('Daily maximum water temperature','Water temperature','degC','Native provider daily maximum water temperature at the retained gauge.'),
 'temperature_7dadm':('7-day average daily maximum temperature','Water temperature','degC','Trailing mean of 7 daily maxima, including the selected day; all 7 values must be valid.'),
}
BASE={'discharge_mean','temperature_mean','temperature_max'}
LEGACY_ROSTER={'fraser','cowichan','skagit','snohomish','nooksack','columbia'}
ROSTER=LEGACY_ROSTER|{'puyallup','elwha','skokomish','queets'}

def digest(path):
 with Path(path).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()

def packed(values):
 # JSON tokens distinguish signed zero, unlike Python numeric dictionary keys.
 dictionary=[];positions={};indices=[]
 for value in values:
  key=json.dumps(value,ensure_ascii=True,allow_nan=False,separators=(',',':'))
  if key not in positions:
   positions[key]=len(dictionary);dictionary.append(value)
  indices.append(positions[key])
 candidate={'dictionary':dictionary,'indices':indices}
 return candidate if len(json.dumps(candidate,separators=(',',':')))<len(json.dumps(values,separators=(',',':'))) else values

def dates_between(start,end):
 first,last=date.fromisoformat(start),date.fromisoformat(end)
 return [(first+timedelta(days=i)).isoformat() for i in range((last-first).days+1)]

def prepare(source:Path,study:Path,output:Path):
 from hydrology_causal import product_snapshot
 with product_snapshot(source) as pinned:
  return prepare_snapshot(pinned,study,output)

def prepare_snapshot(source:Path,study:Path,output:Path):
 original=source
 source=source.resolve()
 catalog=json.loads((source/'catalog.json').read_text());catalog_hash=digest(source/'catalog.json')
 if catalog['schema_version']!='hydrology-per-river-1' or set(catalog['rivers']) not in (LEGACY_ROSTER,ROSTER):raise ValueError('Unexpected Hydrology roster or catalog')
 config=json.loads(study.read_text());study_hash=digest(study)
 if config['domain']['status']!='approved' or config['grid_registry']['status']!='validated':raise ValueError('Study registry not approved/validated')
 registry=next(x for x in config['grid_registry']['memberships'] if x['resolution']==6 and x['role']=='water_reporting')
 grid_path=(study.parent/registry['relative_path']).resolve()
 if digest(grid_path)!=registry['sha256']:raise ValueError('Study registry binding changed')
 grid=grid_path.read_text().splitlines()
 if len(set(grid))!=len(grid) or len(grid)!=registry['count'] or any(not h3.is_valid_cell(c) or h3.get_resolution(c)!=6 for c in grid):raise ValueError('Invalid study grid')
 rivers=[];calendar=None;bindings={};stats={m:[] for m in METRICS};nonnull={m:0 for m in METRICS}
 source_rows=0
 for rid,entry in sorted(catalog['rivers'].items()):
  manifest_path=source/entry['manifest']
  if manifest_path!=(source/rid/'manifest.json') or digest(manifest_path)!=entry['sha256']:raise ValueError('Manifest binding mismatch')
  manifest=json.loads(manifest_path.read_text());root=source/rid
  for name,binding in manifest['files'].items():
   path=(root/name).resolve()
   if not path.is_relative_to(root) or digest(path)!=binding['sha256']:raise ValueError(f'File checksum mismatch {rid}/{name}')
  metadata=json.loads((root/'metadata.json').read_text());native=metadata['river_registry']
  if manifest['river_id']!=rid or native['river_id']!=rid or manifest['temporal_basis']!='provider_daily':raise ValueError('River/native-day identity mismatch')
  dates=dates_between(manifest['start_date'],manifest['end_date'])
  if calendar is not None and dates!=calendar:raise ValueError('Rivers have different calendars')
  calendar=dates
  station=next(s for s in native['stations'] if s['station_id']==manifest['station_id'])
  mouths=[]
  for raw in native['mouths']:
   lat,lon=raw['latitude'],raw['longitude']
   if not all(isinstance(v,(float,int)) and math.isfinite(v) for v in [lat,lon]) or abs(lat)>90 or abs(lon)>180 or not raw.get('source') or not raw.get('mouth_id'):raise ValueError('Unqualified mouth reference')
   cell=h3.latlng_to_cell(lat,lon,6)
   mouths.append({**raw,'cell':cell,'inStudyGrid':cell in grid})
  if not mouths:raise ValueError(f'No retained mouth reference for {rid}')
  tables={name:pq.read_table(root/(name+'.parquet')) for name in ['conditions','features']}
  series={}
  for name,table in tables.items():
   for key,typ in [('river_id',pa.string()),('station_id',pa.string()),('date',pa.date32()),('metric',pa.string()),('temporal_basis',pa.string()),('value',pa.float64()),('unit',pa.string()),('status',pa.string()),('reason',pa.string())]:
    if table.schema.field(key).type!=typ:raise ValueError(f'Unexpected Arrow field {name}.{key}')
   rows=table.to_pylist();source_rows+=len(rows)
   groups={}
   for row in rows:
    if row['river_id']!=rid or row['station_id']!=station['station_id'] or row['temporal_basis']!='provider_daily':raise ValueError('Cross-river/source/basis row')
    groups.setdefault(row['metric'],[]).append(row)
   for metric,items in groups.items():
    items.sort(key=lambda r:r['date'])
    if [r['date'].isoformat() for r in items]!=dates:raise ValueError('Missing/duplicate full calendar keys')
    if metric not in METRICS or (metric in BASE)!=(name=='conditions'):continue
    unit=METRICS[metric][2]
    if any(r['unit']!=unit or (r['value'] is not None and (not math.isfinite(r['value']) or r['status']!='valid')) for r in items):raise ValueError('Invalid value/status/unit support')
    values=[r['value'] for r in items]
    supported=[v for v in values if v is not None];stats[metric].extend(supported);nonnull[metric]+=len(supported)
    series[metric]={'values':packed(values),'statuses':packed([r['status'] for r in items]),'reasons':packed([r['reason'] for r in items]),'contributorSeries':packed([r.get('series_id',r.get('contributor_series')) for r in items])}
    if name=='conditions':
     series[metric].update(dayDefinition=packed([r.get('day_definition') for r in items]),flags=packed([r['raw_flags'] for r in items]),retrievedAt=packed([r['retrieved_at'] for r in items]),sourceRelease=packed([r['source_release'] for r in items]),coverage=packed([r['coverage'] for r in items]))
  if set(series)!=set(METRICS):raise ValueError('Missing required metric calendars')
  if not metadata.get('high_flow_definition'):raise ValueError('Missing relative high-flow definition')
  thresholds=metadata['configured_feature_thresholds']
  relative_notes={}
  for source_key,output_key,metric,method,quantile,threshold_key,label in [
   ('high_flow_definition','highFlowDefinition','high_flow_duration','historical-p90-high-duration-linear-interior-v1',.9,'high_flow_threshold_m3_s','high-flow'),
   ('low_flow_definition','lowFlowDefinition','low_flow_duration','historical-p10-linear-interior-v1',.1,'low_flow_threshold_m3_s','low-flow'),
   ('flow_pulse_definition','flowPulseDefinition','days_since_flow_pulse','historical-p90-linear-interior-v1',.9,'pulse_threshold_m3_s','flow-pulse')]:
   note=metadata.get(source_key)
   if note:
    expected=hashlib.sha256(json.dumps({k:v for k,v in note.items() if k!='identity'},sort_keys=True,default=str).encode()).hexdigest()
    if note.get('method')!=method or note.get('quantile')!=quantile or note.get('identity')!=expected or not note.get('retrospective') or note.get('model_eligible') is not False or note.get('threshold_m3_s')!=thresholds[threshold_key] or note.get('reference_start')!=dates[0] or note.get('reference_end')!=dates[-1]:raise ValueError('Invalid relative '+label+' definition')
    if any(row.get('method_version')!=method or row.get('climatology_id')!=note['identity'] for row in groups.get(metric,[])):raise ValueError('Relative '+label+' provenance mismatch')
    relative_notes[output_key]=note
  rivers.append({'id':rid,'name':native['name'],'stationId':station['station_id'],'stationName':station['name'],'provider':station['provider'],'gaugeCoordinates':station['geometry']['coordinates'],'gaugeRationale':station['rationale'],'mouths':mouths,'mouthStatus':native['mouth_status'],'representation':native['representation'],'manifestSha256':entry['sha256'],'metadataSha256':digest(root/'metadata.json'),'availability':metadata['availability'],'temperatureMissingness':metadata['temperature_missingness'],'thresholds':thresholds,'sourceOutcomes':manifest['source_outcomes'],'series':series})
  rivers[-1].update(relative_notes)
  bindings[rid]={'manifestSha256':entry['sha256'],'files':manifest['files']}
 definitions={}
 for key,metric,label,description in [
  ('highFlowDefinition','high_flow_duration','high-flow',"Consecutive provider days strictly above this river's full-history 90th-percentile daily mean discharge; zero at or below the threshold."),
  ('lowFlowDefinition','low_flow_duration','low-flow',"Consecutive provider days strictly below this river's full-history 10th-percentile daily mean discharge."),
  ('flowPulseDefinition','days_since_flow_pulse','flow-pulse',"Days since an upward crossing from below to at or above this river's full-history 90th-percentile daily mean discharge; zero on the crossing day, without resetting on each high-flow day.")]:
  relative=[bool(r.get(key)) for r in rivers]
  if any(relative) and not all(relative):raise ValueError('Mixed '+label+' methods across rivers')
  if all(relative):definitions[metric]=description+' Interior missing flows are linearly interpolated for this calculation only; no edge extrapolation. Values stay unavailable until the necessary event history is known. Thresholds include interpolated days. Retrospective: uses future observations and is not eligible for operational backtests.'
 metrics=[{'id':m,'name':v[0],'family':v[1],'unit':v[2],'definition':definitions.get(m,v[3]),'range':[min(stats[m]),max(stats[m])],'available':nonnull[m]} for m,v in METRICS.items() if stats[m]]
 causal=None;causal_unavailable=None
 if catalog.get('products',{}).get('causal') is not None or (source/'causal.parquet').exists():
  from hydrology_causal import read_causal
  try:
   causal_series,causal_metrics,causal,causal_rows=read_causal(source,catalog.get('products',{}).get('causal'),rivers,calendar,packed)
   for river in rivers:river['series'].update(causal_series[river['id']])
   metrics.extend(causal_metrics);nonnull.update({m['id']:m['available'] for m in causal_metrics});source_rows+=causal_rows
  except (ValueError,OSError,KeyError,TypeError) as error:
   causal_unavailable='Causal discharge unavailable: '+str(error)+'. Existing native metrics remain available.'
 station_temperature=None;station_temperature_unavailable=None
 if catalog.get('products',{}).get('station_temperature') is not None or (source/'station_temperature.parquet').exists():
  from hydrology_station_temperature import read_station_temperature
  try:station_temperature=read_station_temperature(source,catalog.get('products',{}).get('station_temperature'))
  except (ValueError,OSError,KeyError,TypeError) as error:station_temperature_unavailable='Station temperatures unavailable: '+str(error)+'. Existing river metrics remain available.'
 snapshot=hashlib.sha256(('hydrology-app-v1:'+catalog_hash+':'+study_hash+':'+digest(__file__)+':'+digest(Path(__file__).with_name('hydrology_causal.py'))+':'+digest(Path(__file__).with_name('hydrology_station_temperature.py'))).encode()).hexdigest()
 payload={'kind':'hydrology-mouths','version':1,'snapshot':snapshot,'dates':calendar,'grid':grid,'rivers':rivers,'metrics':metrics,'causal':causal,'causalUnavailable':causal_unavailable,'stationTemperature':station_temperature,'stationTemperatureUnavailable':station_temperature_unavailable}
 output.mkdir(parents=True,exist_ok=True)
 asset=output/(snapshot+'.json');temporary=asset.with_suffix('.pending')
 temporary.write_text(json.dumps(payload,separators=(',',':'),ensure_ascii=True,allow_nan=False));os.replace(temporary,asset)
 # Read back the actual serialized floats/nulls before activation.
 readback=json.loads(asset.read_text())
 assert readback==payload
 if original.resolve()!=source or digest(source/'catalog.json')!=catalog_hash or digest(study)!=study_hash:raise ValueError('Source/study changed during read')
 current={'version':1,'status':'qualified_local_product','snapshot':snapshot,'rows':source_rows,'data':{'url':'/local-data/hydrology/'+asset.name,'sha256':digest(asset)},'source':{'catalogSha256':catalog_hash,'studySha256':study_hash,'registrySha256':registry['sha256'],'productIdentity':catalog['identity'],'temporalBasis':'provider_daily','sourcePath':'Data/Hydrology','bindings':bindings}}
 pending=output/'catalog.pending.json';pending.write_text(json.dumps(current,indent=2)+'\n');os.replace(pending,output/'catalog.json')
 return {'snapshot':snapshot,'rivers':len(rivers),'mouthReferences':sum(len(r['mouths']) for r in rivers),'offGridReferences':sum(not m['inStudyGrid'] for r in rivers for m in r['mouths']),'days':len(calendar),'metrics':[m['id'] for m in metrics],'sourceRows':source_rows,'assetBytes':asset.stat().st_size,'sourceCatalogSha256':catalog_hash,'nonnull':nonnull}

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',required=True,type=Path);parser.add_argument('--study',required=True,type=Path);parser.add_argument('--output',required=True,type=Path);args=parser.parse_args();print(json.dumps(prepare(args.source,args.study.resolve(),args.output.resolve()),indent=2))
