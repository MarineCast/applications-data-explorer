"""Small synthetic causal companions; no source acquisition or computation."""
from datetime import date, timedelta
import fcntl
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import pyarrow as pa
import pyarrow.parquet as pq
from hydrology_causal import CAUSAL_METRICS, product_snapshot, read_causal
from hydrology_input import prepare, packed, digest
import test_hydrology_input as native


class CausalInputTests(unittest.TestCase):
    def fixture(self, folder):
        root, study, output = native.HydrologyInput().fixture(folder)
        target=Path(folder)/'workspace/Data/Hydrology';target.parent.mkdir(parents=True);root.rename(target);root=target.resolve()
        owner={'owner':'hydrology-current-per-river-v1','destination':str(root)}
        key=hashlib.sha256(json.dumps(str(root),sort_keys=True).encode()).hexdigest()[:16]
        store=root.parent.parent/'.marinecast-work/hydrology'/key
        store.mkdir(parents=True);(store/'owner.json').write_text(json.dumps(owner));(store/'.publication.lock').touch()
        (root/'owner.json').write_text(json.dumps(owner))
        catalog=json.loads((root/'catalog.json').read_text());dates=['2026-10-13','2026-10-14','2026-10-15']
        definition={'method':'causal-seasonal-lag1-v1','lag_days':1,'model_eligible':False,'event_date_causal':True,'window_days':15,'min_samples':60,'min_years':3,'history_years':10,'operational_availability':'unknown; lag is not proof of provider availability','temporal_support':'native provider civil dates; not UTC','leap_day':'February 29 pools with February 28','units':{k:v[1] for k,v in CAUSAL_METRICS.items()}}
        definition['identity']=hashlib.sha256(json.dumps(definition,sort_keys=True).encode()).hexdigest()
        sources={rid:digest(root/rid/'conditions.parquet') for rid in catalog['rivers']};rows=[];rivers=[]
        support={}
        for rid in catalog['rivers']:
            sid=json.loads((root/rid/'manifest.json').read_text())['station_id'];rivers.append({'id':rid,'stationId':sid});support[rid]={}
            for metric in CAUSAL_METRICS:
                values=[0.,60.,61.] if metric=='causal_reference_samples' else [0.,3.,3.] if metric=='causal_reference_years' else [None,0.,1.]
                support[rid][metric]=sum(v is not None for v in values)
                for day,value in zip(dates,values):
                    rows.append(dict(river_id=rid,station_id=sid,date=date.fromisoformat(day),as_of_date=date.fromisoformat(day)-timedelta(days=1),temporal_basis='provider_daily',metric=metric,value=value,unit=CAUSAL_METRICS[metric][1],status='valid' if value is not None else 'unavailable',reason=None if value is not None else 'insufficient_reference_support',method_version=definition['method']))
        meta={'definition':definition,'sources':sources,'support':support,'day_definitions':{rid:['provider day unverified'] for rid in sources}}
        entry={'path':'causal.parquet','source_status':'current','definition':definition,'source_conditions_sha256':sources}
        def write(items):
            path=root/'causal.parquet';pq.write_table(pa.Table.from_pylist(items).replace_schema_metadata({b'hydrology_causal':json.dumps(meta).encode()}),path)
            entry.update(sha256=digest(path),bytes=path.stat().st_size,rows=len(items));catalog['products']={'causal':entry};(root/'catalog.json').write_text(json.dumps(catalog))
        write(list(reversed(rows)))
        return root,study,output,rivers,dates,entry,rows,write,store

    def test_all_metrics_exact_keyed_calendar_and_native_preservation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,study,out,rivers,dates,entry,rows,write,store=self.fixture(tmp)
            before={str(p):digest(p) for p in root.rglob('*') if p.is_file()}
            result=prepare(root,study,out);manifest=json.loads((out/'catalog.json').read_text());payload=json.loads((out/Path(manifest['data']['url']).name).read_text())
            self.assertTrue(set(CAUSAL_METRICS)<=set(result['metrics']))
            self.assertEqual(payload['causal']['asOfDates'],['2026-10-12','2026-10-13','2026-10-14'])
            self.assertEqual(payload['rivers'][0]['series']['causal_discharge_pulse']['values'],[None,0.,1.])
            self.assertEqual(payload['rivers'][0]['series']['discharge_mean']['values'],[1.,None,0.])
            self.assertEqual(before,{str(p):digest(p) for p in root.rglob('*') if p.is_file()})

    def test_stale_missing_and_tampered_companion_keep_native_metrics(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,study,out,rivers,dates,entry,rows,write,store=self.fixture(tmp)
            for kind in ('stale','missing','tampered','source-drift'):
                write(rows)
                if kind=='stale':
                    catalog=json.loads((root/'catalog.json').read_text());catalog['products']['causal']['source_status']='requires_rebuild';(root/'catalog.json').write_text(json.dumps(catalog))
                elif kind=='missing':(root/'causal.parquet').rename(root/'missing-test.parquet')
                elif kind=='tampered':
                    with (root/'causal.parquet').open('ab') as stream:stream.write(b'changed')
                else:
                    catalog=json.loads((root/'catalog.json').read_text());catalog['products']['causal']['source_conditions_sha256']={};(root/'catalog.json').write_text(json.dumps(catalog))
                report=prepare(root,study,out);manifest=json.loads((out/'catalog.json').read_text());payload=json.loads((out/Path(manifest['data']['url']).name).read_text())
                self.assertIn('discharge_mean',report['metrics']);self.assertFalse(set(CAUSAL_METRICS)&set(report['metrics']));self.assertIn('Causal discharge unavailable',payload['causalUnavailable']);self.assertIsNone(payload['causal'])

    def test_rejects_wrong_keys_asof_units_status_and_pulse(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,study,out,rivers,dates,entry,rows,write,store=self.fixture(tmp)
            for change in ({'station_id':'wrong'},{'as_of_date':date(2026,10,13)},{'unit':'wrong'},{'value':1.,'status':'unavailable'},{'metric':'unknown'}):
                invalid=[dict(r) for r in rows];invalid[0].update(change);write(invalid)
                with self.assertRaises(ValueError):read_causal(root,entry,rivers,dates,packed)
            invalid=[dict(r) for r in rows];invalid[0]=dict(invalid[1]);write(invalid)
            with self.assertRaises(ValueError):read_causal(root,entry,rivers,dates,packed)
            invalid=[dict(r) for r in rows]
            next(r for r in invalid if r['metric']=='causal_discharge_pulse' and r['value']==1.)['value']=2.;write(invalid)
            with self.assertRaisesRegex(ValueError,'range mismatch'):read_causal(root,entry,rivers,dates,packed)

    def test_shared_snapshot_refuses_writer_and_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            root,study,out,rivers,dates,entry,rows,write,store=self.fixture(tmp)
            with (store/'.publication.lock').open('rb') as lock:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
                with self.assertRaisesRegex(ValueError,'publication is active'):
                    with product_snapshot(root):pass
            (store/'promotion.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'recovery mismatch'):
                with product_snapshot(root):pass
