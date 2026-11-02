import json
import os
import unittest
from unittest.mock import patch
from test_oceanography_input import OceanographyTests
from oceanography_store import Store,body_hash
from prepare_seascape import digest
import pyarrow.parquet as pq

class OceanographyStoreTests(OceanographyTests):
    def test_lazy_pilot_parity(self):
        eager=self.run_reader();store=Store(self.root)
        self.assertEqual(store.catalog['features'],eager['features'])
        for pid,p in eager['products'].items():
            for day,s in p['slices'].items():
                lazy=store.catalog['products'][pid]['slices'][day]
                for a,b in [(s['cells'],lazy['cells']),*[(s['columns'][k],lazy['columns'][k]) for k in s['columns']]]:
                    self.assertEqual(a['sha256'],b['sha256'])
                    self.assertEqual(body_hash(store.request(b['url'])['json']),b['sha256'])
    def test_same_size_timestamp_tamper_invalidates(self):
        store=Store(self.root);p=self.root/'sst-r6-daily.parquet';before=p.stat();data=bytearray(p.read_bytes());data[40]^=1;p.write_bytes(data);os.utime(p,ns=(before.st_atime_ns,before.st_mtime_ns))
        with self.assertRaisesRegex(ValueError,'changed'):store.request(next(iter(store.routes)))
    def test_duplicate_anywhere_rejected(self):
        p=self.root/'sst-r6-daily.parquet';t=pq.read_table(p);indexes=list(range(t.num_rows));indexes[-1]=0;pq.write_table(t.take(indexes),p,row_group_size=100)
        c=json.loads((self.root/'catalog.json').read_text());c['products'][0]['sha256']=digest(p);(self.root/'catalog.json').write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'duplicate'):Store(self.root)
    def test_unordered_rows_and_filtered_read(self):
        p=self.root/'sst-r6-daily.parquet';t=pq.read_table(p);pq.write_table(t.take(list(reversed(range(t.num_rows)))),p,row_group_size=100)
        c=json.loads((self.root/'catalog.json').read_text());c['products'][0]['sha256']=digest(p);(self.root/'catalog.json').write_text(json.dumps(c))
        with patch('pyarrow.parquet.read_table',side_effect=AssertionError('unbounded read')):
            store=Store(self.root)
            for url in store.routes:store.request(url)
    def test_publication_during_validation_requires_retry(self):
        original=Store.validate
        def change(store,*args):
            original(store,*args)
            with (self.root/'catalog.json').open('a') as f:f.write(' ')
        with patch.object(Store,'validate',change),self.assertRaisesRegex(ValueError,'changed'):
            Store(self.root)
        Store(self.root) # Valid next generation is accepted on retry.
    def test_missing_or_bad_checksum(self):
        p=self.root/'sst-r6-daily.parquet';p.rename(self.root/'absent')
        with self.assertRaises(FileNotFoundError):Store(self.root)
    def test_reader_lazy_routes_and_change_invalidation(self):
        from local_data import Reader
        from types import SimpleNamespace
        from oceanography_store import identity
        sources=SimpleNamespace(root=lambda domain:self.root,version=lambda domain:str([identity(p) for p in sorted(self.root.iterdir())]))
        reader=Reader(sources);self.addCleanup(reader.close)
        first=reader.get('oceanography');self.assertFalse(first['assets']);self.assertEqual(list(reader.directory.iterdir()),[])
        url=next(iter(first['catalog']['products']['oceanography-sst']['slices'].values()))['columns']['sst_c']['url']
        original=reader.get
        def only_ocean(domain):
            if domain!='oceanography':raise ValueError('absent fixture domain')
            return original(domain)
        with patch.object(reader,'get',only_ocean):
            self.assertEqual(body_hash(reader.request({'path':url})['json']),url.rsplit('/',1)[-1][:-5])
            p=self.root/'sst-r6-daily.parquet'
            with p.open('ab') as f:f.write(b'x')
            with self.assertRaisesRegex(ValueError,'validated product'):reader.request({'path':url})
    def test_http_encoding_matches_daily_hash(self):
        from data_api import Worker
        from local_data import Reader
        from types import SimpleNamespace
        from oceanography_store import identity
        sources=SimpleNamespace(root=lambda domain:self.root,version=lambda domain:str([identity(p) for p in sorted(self.root.iterdir())]))
        worker=Worker(sources,'seascape');worker.reader=Reader(sources)
        self.addCleanup(worker.reader.close);self.addCleanup(worker.executor.shutdown)
        store=worker.reader.get('oceanography')['store'];original=worker.reader.get
        def only_ocean(domain):
            if domain!='oceanography':raise ValueError('absent fixture domain')
            return original(domain)
        with patch.object(worker.reader,'get',only_ocean):
            for url in store.routes:
                response=worker.response({'path':url},'GET')
                import hashlib
                self.assertEqual(hashlib.sha256(response.body).hexdigest(),url.rsplit('/',1)[-1][:-5])
    def test_multimetric_contract_and_signed_semantics(self):
        store=Store(self.root)
        features={f['id']:f for f in store.catalog['features']}
        for source in ('hycom','salishsea'):
            for axis in ('east','north'):
                f=features[f'{source}__current_{axis}_m_s']
                self.assertTrue(f['signed']);self.assertLess(f['range'][0],0)
            self.assertNotIn('signed',features[f'{source}__current_speed_m_s'])
        self.assertEqual(features['hycom__salinity_psu']['unit'],'psu')
        self.assertEqual(features['salishsea__reference_salinity_g_kg']['unit'],'g/kg')
    def test_wrong_multimetric_order_rejected(self):
        p=self.root/'catalog.json';c=json.loads(p.read_text());e=next(e for e in c['products'] if e['id']=='hycom-currents');e['metrics'].reverse();p.write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'binding mismatch'):Store(self.root)
    def test_component_null_mismatch_rejected(self):
        import pyarrow as pa
        p=self.root/'hycom-currents-r5-daily.parquet';t=pq.read_table(p);v=t['current_east_m_s'].to_pylist();i=next(i for i,x in enumerate(v) if x is not None);v[i]=None;t=t.set_column(2,'current_east_m_s',pa.array(v,type=pa.float64()));pq.write_table(t,p)
        c=json.loads((self.root/'catalog.json').read_text());next(e for e in c['products'] if e['id']=='hycom-currents')['sha256']=digest(p);(self.root/'catalog.json').write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'inconsistent null'):Store(self.root)
    def test_multimetric_schema_rejected(self):
        p=self.root/'salishsea-currents-r6-daily.parquet';t=pq.read_table(p);pq.write_table(t.drop(['current_speed_m_s']),p)
        c=json.loads((self.root/'catalog.json').read_text());next(e for e in c['products'] if e['id']=='salishsea-currents')['sha256']=digest(p);(self.root/'catalog.json').write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'schema mismatch'):Store(self.root)
    def test_unknown_product_rejected(self):
        p=self.root/'catalog.json';c=json.loads(p.read_text());c['products'][-1]['id']='unqualified';p.write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'Unsupported'):Store(self.root)
    def test_negative_speed_rejected(self):
        import pyarrow as pa
        p=self.root/'hycom-currents-r5-daily.parquet';t=pq.read_table(p);v=t['current_speed_m_s'].to_pylist();v[next(i for i,x in enumerate(v) if x is not None)]=-1;t=t.set_column(4,'current_speed_m_s',pa.array(v,type=pa.float64()));pq.write_table(t,p)
        c=json.loads((self.root/'catalog.json').read_text());next(e for e in c['products'] if e['id']=='hycom-currents')['sha256']=digest(p);(self.root/'catalog.json').write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'Invalid Oceanography value'):Store(self.root)
    def test_enso_native_periods_and_availability(self):
        store=Store(self.root);p=store.catalog['products']['oceanography-enso-roni'];self.assertEqual(list(p['slices']),['2009-01-31','2009-02-28','2009-03-31']);self.assertEqual(p['axis'],'Season end')
        c=json.loads((self.root/'catalog.json').read_text());e=next(x for x in c['products'] if x['id']=='enso-roni');e['qualification']['periods'][0]['issue_date']='2009-01-31';(self.root/'catalog.json').write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'native period'):Store(self.root)
    def test_tide_local_boundary_dst_pairing_and_all_events(self):
        from oceanography_tides import validate_event_row,METRICS
        from datetime import datetime,date
        stations={'station':{'timezone':'America/Los_Angeles'}};mapping={'cell':{'station':'station'}}
        for utc,local in [('2024-07-01T03:00:00+00:00','2024-06-30T20:00:00-07:00'),('2024-01-01T03:00:00+00:00','2023-12-31T19:00:00-08:00')]:
            r={'date':date.fromisoformat(utc[:10]),'h3_index':'cell',METRICS[0]:[datetime.fromisoformat(utc)],METRICS[1]:[],METRICS[2]:[local],METRICS[3]:[]};validate_event_row(r,mapping,stations)
            r[METRICS[2]]=[local[:-6]+'+00:00']
            with self.assertRaisesRegex(ValueError,'DST mismatch'):validate_event_row(r,mapping,stations)
        r[METRICS[2]]=[local];r[METRICS[0]]*=2;r[METRICS[2]]*=2
        with self.assertRaisesRegex(ValueError,'duplicate'):validate_event_row(r,mapping,stations)
    def test_tide_mapping_and_missing_lists_rejected(self):
        from oceanography_tides import validate_event_row,METRICS
        r={'h3_index':'unknown',**{m:[] for m in METRICS}}
        with self.assertRaisesRegex(ValueError,'Unsupported'):validate_event_row(r,{}, {})
        r={'h3_index':'cell',**{m:None for m in METRICS}}
        with self.assertRaisesRegex(ValueError,'missing'):validate_event_row(r,{'cell':{'station':'s'}},{})
    def test_glorys_distinct_daily_vector_semantics_and_inland_nulls(self):
        from prepare_seascape import unpack
        store=Store(self.root);features={f['id']:f for f in store.catalog['features']}
        for axis in ('east','north'):
            f=features[f'glorys12__current_{axis}_m_s'];self.assertTrue(f['signed']);self.assertIn('tides are excluded',f['definition'])
        speed=features['glorys12__current_daily_mean_vector_speed_m_s'];self.assertNotIn('signed',speed);self.assertIn('neither mean hourly speed nor the magnitude',speed['definition'])
        self.assertEqual(features['glorys12__salinity_psu']['unit'],'psu')
        for pid in ('glorys12-salinity','glorys12-currents'):
            for part in store.catalog['products']['oceanography-'+pid]['slices'].values():
                ids=store.request(part['cells']['url'])['json']['ids']
                for a in part['columns'].values():
                    values=unpack(store.request(a['url'])['json']);self.assertEqual(sum(v is not None for v in values),245)
                    for cell in ('8528d557fffffff','8528d5c3fffffff','8528de8ffffffff'):self.assertIsNone(values[ids.index(cell)])
                    self.assertIsNotNone(values[ids.index('8528de83fffffff')])
    def test_glorys_history_provenance_is_visible(self):
        features=Store(self.root).catalog['features']
        for f in features:
            if f['id'].startswith('glorys12__'):
                self.assertIn('2009-01-01–2021-06-30: documented reanalysis',f['definition'])
                self.assertIn('2021-07-01–2026-09-22: documented interim near-real-time assimilation',f['definition'])
                self.assertIn('forcing change starts 2019-01-01',f['definition'])

    def test_glorys_unsupported_source_semantics_rejected(self):
        p=self.root/'catalog.json';c=json.loads(p.read_text());next(e for e in c['products'] if e['id']=='glorys12-currents')['qualification']['tidal_constituents_included']=True;p.write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'qualification mismatch'):Store(self.root)
    def test_glorys_negative_daily_vector_speed_rejected(self):
        import pyarrow as pa
        metric='current_daily_mean_vector_speed_m_s';p=self.root/'glorys12-currents-r5-daily.parquet';t=pq.read_table(p);v=t[metric].to_pylist();v[next(i for i,x in enumerate(v) if x is not None)]=-1;t=t.set_column(4,metric,pa.array(v,type=pa.float64()));pq.write_table(t,p)
        c=json.loads((self.root/'catalog.json').read_text());next(e for e in c['products'] if e['id']=='glorys12-currents')['sha256']=digest(p);(self.root/'catalog.json').write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'Invalid Oceanography value'):Store(self.root)
