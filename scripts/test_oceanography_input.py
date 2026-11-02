import json
import tempfile
import unittest
from pathlib import Path
import pyarrow.parquet as pq
from oceanography_input import append_oceanography
from prepare_map import Exporter
from prepare_seascape import digest, unpack

class OceanographyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)/'source'; self.root.mkdir()
        source=Path(__file__).resolve().parents[3]/'Data/Oceanography'
        catalog=json.loads((source/'catalog.json').read_text())
        from datetime import date
        for e in catalog['products']:
            first,last=('2009-01-31','2009-03-31') if e['id']=='enso-roni' else ('2024-07-01','2024-07-03')
            table=pq.read_table(source/e['path'],filters=[('date','>=',date.fromisoformat(first)),('date','<=',date.fromisoformat(last))])
            if e['id']=='enso-roni':e['qualification']['periods']=e['qualification']['periods'][:3]
            pq.write_table(table,self.root/e['path'])
            stats={}
            for metric in e.get('metrics',[e['metric']]):
                values=table[metric].to_pylist();present=[v for v in values if v is not None]
                stats[metric]={'nonnull':len(present),'null':len(values)-len(present)}
                if e['id']=='tide-events':stats[metric]['events']=sum(map(len,present))
                else:stats[metric].update(minimum=min(present) if present else None,maximum=max(present) if present else None)
            e.update(sha256=digest(self.root/e['path']),row_count=table.num_rows,date_start=first,date_end=last)
            if 'statistics' in e:e['statistics']=stats
            else:e.update(stats[e['metric']])
        (self.root/'catalog.json').write_text(json.dumps(catalog))
        self.out = Path(self.temp.name)/'out';self.out.mkdir()
    def run_reader(self):
        c={'features':[],'products':{},'datasets':{}}
        append_oceanography(Exporter(self.out,'test'),c,self.root)
        return c
    def test_actual_full_area_exact_readback(self):
        c=self.run_reader(); self.assertEqual(len(c['features']),16)
        self.assertTrue({'Sea Surface Temperature','Chlorophyll'}<={f['name'] for f in c['features']})
        self.assertEqual({f['family'] for f in c['features']},{'Ocean Conditions'})
        for f in c['features']:
            table=pq.read_table(self.root/f['sourcePath']).to_pylist()
            for day,p in c['products'][f['productId']]['slices'].items():
                load=lambda a:json.loads((self.out/'assets'/f"{a['sha256']}.json").read_text())
                actual=dict(zip(load(p['cells'])['ids'],unpack(load(p['columns'][f['column']]))))
                expected={r['h3_index']:r[f['column']] for r in table if r['date'].isoformat()==day}
                expected=json.loads(json.dumps(expected,default=lambda x:x.isoformat()))
                self.assertEqual(actual,expected)
                self.assertEqual(set(p['columns']),set(table[0]) - {'date','h3_index'})
    def test_tamper_rejected(self):
        with (self.root/'sst-r6-daily.parquet').open('ab') as f:f.write(b'bad')
        with self.assertRaisesRegex(ValueError,'binding'):self.run_reader()
    def test_rebound_duplicate_key_rejected(self):
        p=self.root/'sst-r6-daily.parquet';t=pq.read_table(p);pq.write_table(t.take([0]*t.num_rows),p)
        c=json.loads((self.root/'catalog.json').read_text());c['products'][0]['sha256']=digest(p);(self.root/'catalog.json').write_text(json.dumps(c))
        with self.assertRaisesRegex(ValueError,'support'):self.run_reader()
    def test_missing_product_rejected(self):
        (self.root/'chlorophyll-r5-daily.parquet').rename(self.root/'missing.parquet')
        with self.assertRaises(FileNotFoundError):self.run_reader()
