"""Synthetic retained-product fixtures; no collection, network or production writes."""
from pathlib import Path
import json
import tempfile
import unittest
import h3
import pyarrow as pa
import pyarrow.parquet as pq
from hydrology_input import METRICS,BASE,ROSTER,LEGACY_ROSTER,prepare,digest,packed

class HydrologyInput(unittest.TestCase):
 def test_dictionary_preserves_signed_zero(self):
  import math
  values=[0.0,-0.0]*100
  out=packed(values)
  decoded=[out['dictionary'][i] for i in out['indices']] if isinstance(out,dict) else out
  self.assertEqual([math.copysign(1,x) for x in decoded],[math.copysign(1,x) for x in values])

 def fixture(self,tmp,roster=ROSTER):
  base=Path(tmp);root=base/'Hydrology';root.mkdir();config=base/'config';config.mkdir()
  cell=h3.latlng_to_cell(49.1,-123.2,6);registry=base/'registry.txt';registry.write_text(cell+'\n')
  study=config/'study.json';study.write_text(json.dumps({'domain':{'status':'approved'},'grid_registry':{'status':'validated','memberships':[{'resolution':6,'role':'water_reporting','relative_path':'../registry.txt','count':1,'sha256':digest(registry)}]}}))
  source={'schema_version':'hydrology-per-river-1','identity':'synthetic-only','rivers':{}}
  schema=pa.schema([('river_id',pa.string()),('station_id',pa.string()),('date',pa.date32()),('metric',pa.string()),('temporal_basis',pa.string()),('value',pa.float64()),('unit',pa.string()),('status',pa.string()),('reason',pa.string()),('series_id',pa.string()),('contributor_series',pa.string()),('raw_flags',pa.string()),('retrieved_at',pa.string()),('source_release',pa.string()),('coverage',pa.float64())])
  from datetime import date
  for rid in sorted(roster):
   folder=root/rid;folder.mkdir();sid='SYNTHETIC-'+rid
   station={'station_id':sid,'name':'Synthetic gauge','provider':'TEST_ONLY','geometry':{'coordinates':[-121.5,49.4]},'rationale':'Synthetic upstream reference'}
   native={'river_id':rid,'name':rid.title(),'stations':[station],'mouths':[{'mouth_id':rid+'-test','latitude':49.1,'longitude':-123.2,'source':'https://example.invalid/synthetic','geometry_role':'test approximate mouth','accuracy':'synthetic only'}],'mouth_status':'test reference only','representation':'representative_gauge_proxy'}
   metadata={'river_registry':native,'configured_feature_thresholds':{'low_flow_threshold_m3_s':10,'pulse_threshold_m3_s':1000,'qualification':'Unvalidated synthetic fixture'},'availability':'test-only','temperature_missingness':'not_requested is acquisition scope'}
   note={'method':'historical-p90-high-duration-linear-interior-v1','quantile':.9,'threshold_m3_s':.9,'reference_start':'2026-10-13','reference_end':'2026-10-15','observed_days':2,'interpolated_days':1,'unfilled_days':0,'retrospective':True,'model_eligible':False,'qualification':'Synthetic retrospective fixture'}
   import hashlib
   note['identity']=hashlib.sha256(json.dumps(note,sort_keys=True,default=str).encode()).hexdigest()
   metadata['high_flow_definition']=note;metadata['configured_feature_thresholds']['high_flow_threshold_m3_s']=.9
   (folder/'metadata.json').write_text(json.dumps(metadata))
   for kind in ['conditions','features']:
    rows=[]
    selected=BASE if kind=='conditions' else set(METRICS)|{'discharge_seasonal_anomaly'}
    for metric in sorted(selected):
     for index,day in enumerate([date(2026,10,13),date(2026,10,14),date(2026,10,15)]):
      missing=metric.startswith('temperature') and rid!='columbia'
      value=None if missing or metric in ['days_since_flow_pulse','discharge_seasonal_anomaly'] or index==1 else [1,None,0][index]
      unit=METRICS.get(metric,('','','m3/s',''))[2]
      rows.append(dict(river_id=rid,station_id=sid,date=day,metric=metric,temporal_basis='provider_daily',value=value,unit=unit,status='valid' if value is not None else 'not_applicable' if missing else 'unavailable',reason=None if value is not None else 'not_requested' if missing else 'no_observation',series_id=sid,contributor_series=sid,raw_flags='{"test":true}',retrieved_at='2026-10-16T00:00:00Z',source_release='test-source',coverage=1.0))
    table=pa.Table.from_pylist(rows,schema=schema)
    if kind=='features':
     table=table.append_column('method_version',pa.array([note['method'] if r['metric']=='high_flow_duration' else 'features-1' for r in rows]))
     table=table.append_column('climatology_id',pa.array([note['identity'] if r['metric']=='high_flow_duration' else None for r in rows]))
    pq.write_table(table,folder/(kind+'.parquet'))
   manifest={'river_id':rid,'station_id':sid,'temporal_basis':'provider_daily','start_date':'2026-10-13','end_date':'2026-10-15','source_outcomes':{'discharge_mean':'observed'},'files':{name:{'sha256':digest(folder/name)} for name in ['conditions.parquet','features.parquet','metadata.json']}}
   (folder/'manifest.json').write_text(json.dumps(manifest));source['rivers'][rid]={'manifest':rid+'/manifest.json','sha256':digest(folder/'manifest.json')}
  (root/'catalog.json').write_text(json.dumps(source));return root,study,base/'browser'

 def refresh(self,root,rid,name):
  manifest_path=root/rid/'manifest.json';manifest=json.loads(manifest_path.read_text());manifest['files'][name]['sha256']=digest(root/rid/name);manifest_path.write_text(json.dumps(manifest));catalog=json.loads((root/'catalog.json').read_text());catalog['rivers'][rid]['sha256']=digest(manifest_path);(root/'catalog.json').write_text(json.dumps(catalog))

 def test_preserves_exact_values_nulls_native_dates_and_all_mouth_identities(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp);before={str(p):digest(p) for p in root.rglob('*') if p.is_file()};report=prepare(root,study,output)
   self.assertEqual(report['rivers'],10);self.assertEqual(report['mouthReferences'],10);self.assertNotIn('days_since_flow_pulse',report['metrics']);self.assertNotIn('discharge_seasonal_anomaly',report['metrics'])
   catalog=json.loads((output/'catalog.json').read_text());payload=json.loads((output/Path(catalog['data']['url']).name).read_text());self.assertEqual(payload['dates'],['2026-10-13','2026-10-14','2026-10-15'])
   self.assertEqual(payload['rivers'][0]['series']['discharge_mean']['values'],[1.0,None,0.0]);self.assertEqual({str(p):digest(p) for p in root.rglob('*') if p.is_file()},before)

 def test_fails_on_checksum_drift(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp);(root/'fraser/metadata.json').write_text('{}')
   with self.assertRaisesRegex(ValueError,'checksum mismatch'):prepare(root,study,output)

 def test_relative_pulse_definition_values_and_mixed_methods(self):
  import hashlib
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp)
   for rid in sorted(ROSTER):
    p=root/rid/'metadata.json';meta=json.loads(p.read_text());note={'method':'historical-p90-linear-interior-v1','quantile':.9,'threshold_m3_s':.8,'reference_start':'2026-10-13','reference_end':'2026-10-15','observed_days':2,'interpolated_days':1,'unfilled_days':0,'retrospective':True,'model_eligible':False,'qualification':'Synthetic retrospective fixture'}
    note['identity']=hashlib.sha256(json.dumps(note,sort_keys=True,default=str).encode()).hexdigest();meta['flow_pulse_definition']=note;meta['configured_feature_thresholds']['pulse_threshold_m3_s']=.8;p.write_text(json.dumps(meta));self.refresh(root,rid,'metadata.json')
    p=root/rid/'features.parquet';table=pq.read_table(p);rows=table.to_pylist()
    for row in rows:
     if row['metric']=='days_since_flow_pulse':row.update(value=0.,status='valid',reason=None)
    table=pa.Table.from_pylist(rows,schema=table.schema);low=[m=='days_since_flow_pulse' for m in table.column('metric').to_pylist()];table=table.set_column(table.schema.get_field_index('method_version'),'method_version',pa.array([note['method'] if v else old for v,old in zip(low,table.column('method_version').to_pylist())]));table=table.set_column(table.schema.get_field_index('climatology_id'),'climatology_id',pa.array([note['identity'] if v else old for v,old in zip(low,table.column('climatology_id').to_pylist())]));pq.write_table(table,p);self.refresh(root,rid,'features.parquet')
   prepare(root,study,output);catalog=json.loads((output/'catalog.json').read_text());payload=json.loads((output/Path(catalog['data']['url']).name).read_text())
   self.assertEqual(payload['rivers'][0]['flowPulseDefinition']['quantile'],.9)
   self.assertIn('90th-percentile',next(m for m in payload['metrics'] if m['id']=='days_since_flow_pulse')['definition'])
   p=root/'fraser/metadata.json';meta=json.loads(p.read_text());meta.pop('flow_pulse_definition');p.write_text(json.dumps(meta));self.refresh(root,'fraser','metadata.json')
   with self.assertRaisesRegex(ValueError,'Mixed flow-pulse'):prepare(root,study,output)

 def test_high_flow_definition_values_and_mixed_methods(self):
  import hashlib
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp)
   for rid in sorted(ROSTER):
    p=root/rid/'metadata.json';meta=json.loads(p.read_text());note={'method':'historical-p90-high-duration-linear-interior-v1','quantile':.9,'threshold_m3_s':.8,'reference_start':'2026-10-13','reference_end':'2026-10-15','observed_days':2,'interpolated_days':1,'unfilled_days':0,'retrospective':True,'model_eligible':False,'qualification':'Synthetic retrospective fixture'}
    note['identity']=hashlib.sha256(json.dumps(note,sort_keys=True,default=str).encode()).hexdigest();meta['high_flow_definition']=note;meta['configured_feature_thresholds']['high_flow_threshold_m3_s']=.8;p.write_text(json.dumps(meta));self.refresh(root,rid,'metadata.json')
    p=root/rid/'features.parquet';table=pq.read_table(p);rows=table.to_pylist()
    for row in rows:
     if row['metric']=='high_flow_duration':row.update(value=0.,status='valid',reason=None)
    table=pa.Table.from_pylist(rows,schema=table.schema);low=[m=='high_flow_duration' for m in table.column('metric').to_pylist()];table=table.set_column(table.schema.get_field_index('method_version'),'method_version',pa.array([note['method'] if v else old for v,old in zip(low,table.column('method_version').to_pylist())]));table=table.set_column(table.schema.get_field_index('climatology_id'),'climatology_id',pa.array([note['identity'] if v else old for v,old in zip(low,table.column('climatology_id').to_pylist())]));pq.write_table(table,p);self.refresh(root,rid,'features.parquet')
   prepare(root,study,output);catalog=json.loads((output/'catalog.json').read_text());payload=json.loads((output/Path(catalog['data']['url']).name).read_text())
   self.assertEqual(payload['rivers'][0]['highFlowDefinition']['quantile'],.9)
   self.assertIn('90th-percentile',next(m for m in payload['metrics'] if m['id']=='high_flow_duration')['definition'])
   p=root/'fraser/metadata.json';meta=json.loads(p.read_text());meta.pop('high_flow_definition');p.write_text(json.dumps(meta));self.refresh(root,'fraser','metadata.json')
   with self.assertRaisesRegex(ValueError,'Missing relative high-flow'):prepare(root,study,output)

 def test_relative_low_flow_provenance_and_mixed_method_rejection(self):
  import hashlib
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp)
   for rid in sorted(ROSTER):
    p=root/rid/'metadata.json';meta=json.loads(p.read_text())
    note={'method':'historical-p10-linear-interior-v1','quantile':.1,'threshold_m3_s':.2,'reference_start':'2026-10-13','reference_end':'2026-10-15','observed_days':2,'interpolated_days':1,'unfilled_days':0,'retrospective':True,'model_eligible':False,'qualification':'Synthetic retrospective fixture'}
    note['identity']=hashlib.sha256(json.dumps(note,sort_keys=True,default=str).encode()).hexdigest()
    meta['low_flow_definition']=note;meta['configured_feature_thresholds']['low_flow_threshold_m3_s']=.2;p.write_text(json.dumps(meta));self.refresh(root,rid,'metadata.json')
    f=root/rid/'features.parquet';table=pq.read_table(f);low=[m=='low_flow_duration' for m in table.column('metric').to_pylist()]
    table=table.set_column(table.schema.get_field_index('method_version'),'method_version',pa.array([note['method'] if v else old for v,old in zip(low,table.column('method_version').to_pylist())]));table=table.set_column(table.schema.get_field_index('climatology_id'),'climatology_id',pa.array([note['identity'] if v else old for v,old in zip(low,table.column('climatology_id').to_pylist())]));pq.write_table(table,f);self.refresh(root,rid,'features.parquet')
   prepare(root,study,output);catalog=json.loads((output/'catalog.json').read_text());payload=json.loads((output/Path(catalog['data']['url']).name).read_text())
   self.assertEqual(payload['rivers'][0]['lowFlowDefinition']['interpolated_days'],1)
   self.assertIn('10th-percentile',next(m for m in payload['metrics'] if m['id']=='low_flow_duration')['definition'])
   p=root/'fraser/metadata.json';meta=json.loads(p.read_text());meta.pop('low_flow_definition');p.write_text(json.dumps(meta));self.refresh(root,'fraser','metadata.json')
   with self.assertRaisesRegex(ValueError,'Mixed low-flow'):prepare(root,study,output)

 def test_rejects_gauge_substitution_when_mouth_reference_missing(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp);p=root/'fraser/metadata.json';v=json.loads(p.read_text());v['river_registry']['mouths']=[];p.write_text(json.dumps(v));self.refresh(root,'fraser','metadata.json')
   with self.assertRaisesRegex(ValueError,'No retained mouth reference'):prepare(root,study,output)

 def test_rejects_cross_river_measurements(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp);p=root/'fraser/conditions.parquet';table=pq.read_table(p);table=table.set_column(0,'river_id',pa.array(['wrong']*len(table)));pq.write_table(table,p);self.refresh(root,'fraser','conditions.parquet')
   with self.assertRaisesRegex(ValueError,'Cross-river'):prepare(root,study,output)

 def test_rejects_duplicate_or_missing_calendar_days(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp);p=root/'fraser/conditions.parquet';table=pq.read_table(p);table=table.slice(1);pq.write_table(table,p);self.refresh(root,'fraser','conditions.parquet')
   with self.assertRaisesRegex(ValueError,'calendar keys'):prepare(root,study,output)

 def test_does_not_snap_an_exact_reference_outside_study_grid(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp);p=root/'fraser/metadata.json';v=json.loads(p.read_text());v['river_registry']['mouths'][0].update(latitude=48.5,longitude=-124.5);p.write_text(json.dumps(v));self.refresh(root,'fraser','metadata.json');report=prepare(root,study,output);self.assertEqual(report['offGridReferences'],1)
   catalog=json.loads((output/'catalog.json').read_text());data=json.loads((output/Path(catalog['data']['url']).name).read_text());mouth=next(r for r in data['rivers'] if r['id']=='fraser')['mouths'][0];self.assertEqual(mouth['cell'],h3.latlng_to_cell(48.5,-124.5,6));self.assertFalse(mouth['inStudyGrid'])



 def test_legacy_six_river_product_remains_readable(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,study,output=self.fixture(tmp,LEGACY_ROSTER)
   self.assertEqual(prepare(root,study,output)['rivers'],6)

 def test_partial_or_unknown_expansion_roster_fails_closed(self):
  for roster in [LEGACY_ROSTER|{'puyallup'},ROSTER|{'unreviewed-river'}]:
   with self.subTest(roster=roster),tempfile.TemporaryDirectory() as tmp:
    root,study,output=self.fixture(tmp,roster)
    with self.assertRaisesRegex(ValueError,'roster'):prepare(root,study,output)

if __name__=='__main__':unittest.main()
