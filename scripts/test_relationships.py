"""Scientific join, coverage, sampling and temporal-contract regression tests."""
from datetime import datetime, timezone, date
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from relationships import AnalysisError, Relationships, Budget, coefficient, pair_diagnostics, unique_series, digest
from relationships_api import AnalysisQuery, create_app
from fastapi.testclient import TestClient


def field(key, kind='numeric', resolution=6, temporal='Static', column=None, family='Family'):
    return dict(key=key,id=key,column=column or key,productId='fixture',dataset=key.split(':')[0],resolution=resolution,
                name=key,family=family,unit='unit',definition='Fixture field',sourceSha256='fixture',modelingEligibility='fixture',
                available=4,rows=4,kind=kind,quality=False,temporal=temporal,slices=[],unsupported=None)


class FixtureService(Relationships):
    def __init__(self, fs=None, data=None):
        self.fs=fs or [field('seascape:a'),field('seascape:b'),field('seascape:c')]
        self.data=data or {'seascape:a':unique_series(['a','b','c','d'],[1,2,3,None]),
                          'seascape:b':unique_series(['a','b','c','d'],[4,3,1,0]),
                          'seascape:c':unique_series(['a','b','c','d'],[1,None,4,5])}
        self.closed=False
    def fields(self, domain):return [f for f in self.fs if f['dataset']==domain]
    def source_bindings(self,fs,response=False):return {'fixture':'sha256'}
    def values(self,f,q,budget):return self.data[f['key']],{'sourceRows':len(self.data[f['key']])}
    def close(self):self.closed=True


def query(**kw):
    return AnalysisQuery(variables=['seascape:a','seascape:b','seascape:c'],**kw).model_dump()


class ScientificTests(unittest.TestCase):
    def test_survey_catalog_does_not_report_inherited_cross_slice_availability(self):
        service=Relationships.__new__(Relationships)
        source=field('seascape:a') | {'productId':'survey','available':999}
        component={'catalog':{'features':[source],'products':{'survey':{'axis':'Survey year','slices':{'2023':{'rows':3},'2024':{'rows':4}}}}}}
        with patch.object(service,'component',return_value=component):
            result=service.fields('seascape')[0]
        self.assertIsNone(result['available'])
        self.assertEqual((result['rows'],result['analysisRows']),(7,4))
        self.assertEqual(result['temporal'],'Survey year')

    def test_duplicate_keys_cannot_expand_join(self):
        with self.assertRaisesRegex(AnalysisError,'many-to-many'):unique_series(['a','a'],[1,2])
        with self.assertRaises(AnalysisError):unique_series([None],[1])
    def test_outer_denominator_and_exclusion_accounting(self):
        a=unique_series(['a','b','c'],[1,None,3]);b=unique_series(['b','c','d'],[4,5,6])
        x,y,d=pair_diagnostics(a,b)
        self.assertEqual(list(x),[3]);self.assertEqual(list(y),[5])
        self.assertEqual((d['eligible'],d['matchedKeys'],d['complete'],d['excluded']),(4,2,1,3))
        self.assertEqual((d['missingLeftKey'],d['missingRightKey'],d['leftNull']),(1,1,1))
        self.assertEqual(d['coverage'],.25)
    def test_rank_ties_and_constants(self):
        value,_=coefficient([1,1,2,3],[4,4,2,1],'spearman');self.assertAlmostEqual(value,-1)
        self.assertIsNone(coefficient([1,1,1],[1,2,3],'pearson')[0])
    def test_pairwise_and_common_cohorts_have_declared_counts(self):
        s=FixtureService();r=s.analyze(query())
        m=next(m for m in r['matrix'] if m['x']=='seascape:a' and m['y']=='seascape:b')
        self.assertEqual(m['complete'],3);self.assertEqual(r['cohort']['commonCompleteRows'],2)
        r=s.analyze(query(cohort='complete'));self.assertEqual(r['pair']['diagnostics']['complete'],2)
        self.assertEqual(r['cohort']['commonExcluded'],2)
    def test_type_safe_categorical_summary(self):
        fs=[field('seascape:a'),field('seascape:b','categorical')]
        s=FixtureService(fs,{'seascape:a':unique_series(['a','b','c','d'],[1,2,4,8]),'seascape:b':unique_series(['a','b','c','d'],['10','10','20','20'])})
        q=AnalysisQuery(variables=[f['key'] for f in fs]).model_dump();r=s.analyze(q)
        self.assertEqual(r['pair']['plot'],'box');self.assertEqual(len(r['matrix']),1)
        self.assertEqual([g['median'] for g in r['pair']['groups']],[1.5,6])
        with self.assertRaisesRegex(AnalysisError,'incompatible'):s.analyze({**q,'plot':'scatter'})
    def test_category_contingency_keeps_numeric_looking_labels(self):
        fs=[field('seascape:a','categorical'),field('seascape:b','categorical')]
        s=FixtureService(fs,{'seascape:a':unique_series(['a','b','c'],['001','002','001']),'seascape:b':unique_series(['a','b','c'],['x','x','y'])})
        r=s.analyze(AnalysisQuery(variables=[f['key'] for f in fs]).model_dump())
        self.assertEqual(r['matrix'],[]);self.assertEqual(r['pair']['contingency']['x'],['001','002']);self.assertEqual(r['pair']['contingency']['n'],3)
    def test_cross_grid_weather_and_leakage_rejected(self):
        fs=[field('seascape:a'),field('meteorology:b',resolution=5,temporal='UTC day')];s=FixtureService(fs)
        with self.assertRaisesRegex(AnalysisError,'resolutions differ'):s.resolve(AnalysisQuery(variables=[f['key'] for f in fs]).model_dump())
        s=FixtureService([field('governance:a',column='critical_habitat__membership')])
        with self.assertRaisesRegex(AnalysisError,'leakage'):s.resolve(AnalysisQuery(variables=['governance:a'],mode='response').model_dump())
    def test_membership_requires_explicit_encoding(self):
        s=FixtureService([field('governance:a','membership')]);q=AnalysisQuery(variables=['governance:a']).model_dump()
        with self.assertRaisesRegex(AnalysisError,'explicit exact-set'):s.resolve(q)
        self.assertEqual(len(s.resolve({**q,'membershipEncoding':'exact_set'})),1)
    def test_changed_binding_rejected(self):
        with self.assertRaisesRegex(AnalysisError,'Sources changed'):FixtureService().analyze({**query(),'bindings':{'fixture':'old'}})
    def test_sampling_does_not_change_statistics(self):
        keys=[str(i) for i in range(4000)];a=np.arange(4000)
        s=FixtureService([field('seascape:a'),field('seascape:b')],{'seascape:a':unique_series(keys,a),'seascape:b':unique_series(keys,-a)})
        q=AnalysisQuery(variables=['seascape:a','seascape:b'],plot='scatter').model_dump();a=s.analyze(q);b=s.analyze(q)
        self.assertEqual(a['pair']['points'],b['pair']['points']);self.assertEqual(len(a['pair']['points']),2000)
        self.assertEqual(a['pair']['diagnostics']['complete'],4000);self.assertAlmostEqual(a['pair']['statistics']['value'],-1)
        self.assertEqual(s.analyze({**q,'plot':'auto'})['pair']['plot'],'density')
    def test_response_matrix_uses_positive_frame_without_repeating_static_values(self):
        service=FixtureService()
        service.data['seascape:a']=unique_series(['a','b','c','d'],[1,2,3,4])
        q=query(mode='response',precision='reported',start='2025-01-01',end='2025-12-31')
        with patch.object(service,'response_values',return_value=(unique_series(['a','c'],[5,7]),{})):
            result=service.analyze(q)
        self.assertEqual(result['cohort']['unionRows'],2)
        self.assertTrue(all(m['complete']<=2 for m in result['matrix']))
        self.assertEqual(result['quality']['seascape:a']['outsidePositiveResponseFrame'],2)
        with patch.object(service,'response_values',return_value=(unique_series([],[]),{})):
            result=service.analyze(q)
        self.assertTrue(all(m['value'] is None for m in result['matrix']))
        self.assertEqual(result['pair']['diagnostics']['eligible'],0)

    def test_cancelled_budget(self):
        b=Budget();b.cancelled.set()
        with self.assertRaisesRegex(AnalysisError,'cancelled'):FixtureService().analyze(query(),b)


class WeatherTests(unittest.TestCase):
    def test_native_days_and_partial_precipitation_are_not_imputed(self):
        import h3
        cells=[h3.latlng_to_cell(48.5,-123,5),h3.latlng_to_cell(49.5,-124,5)]
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'daily.parquet'
            schema=pa.schema([('H3_INDEX',pa.string()),('DATE',pa.date32()),('PRECIPITATION_MM',pa.float64())])
            with pq.ParquetWriter(path,schema) as writer:
                for day in [date(2026,10,9),date(2026,10,10)]:
                    writer.write_table(pa.Table.from_pydict({'H3_INDEX':cells,'DATE':[day]*2,'PRECIPITATION_MM':[1.,2.]},schema=schema))
            c={'start_date':'2026-10-09','end_date':'2026-10-10','partial_metric_coverage':[{'date':'2026-10-10','metric':'PRECIPITATION_MM','valid_hours':23,'expected_hours':24}]}
            service=object.__new__(Relationships);service.weather_source=lambda:(c,path)
            q=AnalysisQuery(variables=['meteorology:5:PRECIPITATION_MM'],resolution=5,start='2026-10-09',end='2026-10-10').model_dump()
            values,info=service.weather_values(field('meteorology:5:PRECIPITATION_MM',resolution=5,column='PRECIPITATION_MM'),q,Budget())
            self.assertEqual(len(values),4);self.assertEqual(values.notna().sum(),2)
            self.assertEqual(info['partialExcluded'],2);self.assertEqual(info['distinctCells'],2);self.assertEqual(info['distinctPeriods'],2)
            self.assertTrue(all('|' in key for key in values.index))



class ResponseTests(unittest.TestCase):
    def test_positive_records_reduce_once_per_cell_and_unknown_time_stays_out(self):
        # Use actual source interval logic, including month-boundary and undated records.
        import h3
        cell=h3.latlng_to_cell(48.5,-123,6);other=h3.latlng_to_cell(49,-124,6)
        def row(i,cell_,start,end):
            return dict(event_id=str(i),source='source',source_record_id=str(i),category='srkw',time_start_utc=start,time_end_utc=end,h3_r6=cell_,h3_precision_status='assignment_only_unknown_accuracy',native_date=None)
        dt=lambda y,m,d:datetime(y,m,d,tzinfo=timezone.utc)
        rows=[row(1,cell,dt(2025,1,2),dt(2025,1,3)),row(2,cell,dt(2025,2,2),dt(2025,2,3)),
              row(3,other,dt(2025,1,2),dt(2025,1,3)),row(4,cell,None,None),
              row(5,cell,dt(2025,1,31),dt(2025,2,2)),row(6,None,dt(2025,1,2),dt(2025,1,3))]
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);pq.write_table(pa.Table.from_pylist(rows),root/'sightings.parquet')
            catalog={'schema_version':'orca-study-sightings-v1','rows':len(rows),'files':{'sightings.parquet':{'sha256':digest(root/'sightings.parquet')}},'deduplication':'Stable within source','coverage':'Partial source coverage','rights':'fixture','temporal_policy':'UTC whole interval'}
            (root/'catalog.json').write_text(json.dumps(catalog))
            s=object.__new__(Relationships);s.sources=type('Sources',(),{'root':lambda _,domain:root})();s.orca=None;s.lock=__import__('threading').RLock();s.validate_response_source=lambda *args: None
            q=AnalysisQuery(variables=['seascape:a'],mode='response',precision='reported',start='2025-01-01',end='2025-02-28').model_dump()
            values,info=s.response_values(q,Budget())
            self.assertEqual(len(values),2);self.assertEqual(values[cell],2);self.assertEqual(info['positiveBins'],3)
            self.assertEqual(info['eligibleRecords'],3);self.assertEqual(info['exclusions']['unknown_or_cross_bin_utc_interval'],2)
            self.assertNotIn(0,values.values);self.assertEqual(info['exclusions']['missing_native_r6_assignment'],1)
            strict,info=s.response_values({**q,'precision':'strict'},Budget());self.assertEqual(len(strict),0)
            self.assertEqual(info['exclusions']['cell_confinement_not_established'],5)
            all_time,info=s.response_values({**q,'interval':'all_time','start':None,'end':None},Budget());self.assertEqual(all_time[cell],4)


class ApiTests(unittest.TestCase):
    def setUp(self):self.service=FixtureService();self.client=TestClient(create_app(self.service));self.client.__enter__()
    def tearDown(self):self.client.__exit__(None,None,None)
    def test_plan_analyze_and_health(self):
        self.assertEqual(self.client.get('/api/relationships/health').status_code,200)
        p=self.client.post('/api/relationships/plan',json=query());self.assertEqual(p.status_code,200)
        r=self.client.post('/api/relationships/analyze',json={**query(),'bindings':p.json()['bindings']});self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['pair']['diagnostics']['complete'],3)
    def test_invalid_path_limits_and_no_arbitrary_inputs(self):
        for q in [{**query(),'path':'/etc/passwd'},{**query(),'variables':['/etc/passwd']},{**query(),'variables':['x']*13},{**query(),'start':'2025-02-01','end':'2025-01-01'}]:
            self.assertEqual(self.client.post('/api/relationships/analyze',json=q).status_code,422)
        self.assertEqual(self.client.post('/api/relationships/analyze',content='x'*70000).status_code,413)
        self.assertEqual(self.client.get('/api/relationships/catalog?limit=101').status_code,422)
    def test_nonlocal_origin_and_host_rejected(self):
        self.assertEqual(self.client.post('/api/relationships/analyze',json=query(),headers={'Origin':'https://example.com'}).status_code,403)
        self.assertEqual(self.client.get('/api/relationships/health',headers={'Host':'example.com'}).status_code,400)
    def test_generation_and_busy_statuses(self):
        r=self.client.post('/api/relationships/analyze',json={**query(),'bindings':{'fixture':'old'}});self.assertEqual(r.status_code,409)
    def test_source_errors_do_not_disclose_paths(self):
        with patch.object(self.service,'analyze',side_effect=OSError('/secret/retained/source.parquet')):
            r=self.client.post('/api/relationships/analyze',json=query());self.assertEqual(r.status_code,503);self.assertNotIn('/secret',r.text)


if __name__=='__main__':unittest.main()
