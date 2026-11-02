import json
import shutil
import tempfile
import unittest
from pathlib import Path
import pyarrow.parquet as pq
from hydrology_station_temperature import read_station_temperature
from hydrology_input import prepare
from hydrology_causal import checksum,product_snapshot
import test_hydrology_causal as causal

SOURCE=Path(__file__).resolve().parents[3]/'Data/Hydrology'
class StationTemperatureTests(unittest.TestCase):
 def fixture(self,tmp):
  root,study,out,*rest=causal.CausalInputTests().fixture(tmp)
  with product_snapshot(SOURCE):
   entry=json.loads((SOURCE/'catalog.json').read_text())['products']['station_temperature']
   shutil.copyfile(SOURCE/entry['path'],root/entry['path'])
  c=json.loads((root/'catalog.json').read_text());c['products']['station_temperature']=entry;(root/'catalog.json').write_text(json.dumps(c))
  return root,study,out,entry,rest[-1]
 def test_exact_sparse_rows_and_identity(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,study,out,entry,_=self.fixture(tmp);data=read_station_temperature(root,entry)
   rows=pq.read_table(root/entry['path']).to_pylist()
   for r in rows:r.update(date=r['date'].isoformat(),report_date=r['report_date'].isoformat())
   self.assertEqual(data['rows'],sorted(rows,key=lambda r:(r['station_id'],r['date'])))
   self.assertEqual(len(rows),entry['rows']);self.assertEqual(data['stations']['DFO-QUALARK']['latitude'],49.53281388888889)
   qualark=[r for r in rows if r['station_id']=='DFO-QUALARK'];self.assertNotIn('2026-09-19',{r['date'] for r in qualark});self.assertEqual(qualark[-1]['value'],16.1)
   self.assertEqual(len(qualark),217)
   for station,count,lat,lon in [('ECOLOGY-10A040',842,47.208287,-122.326841),('ECOLOGY-07A089',1077,47.91248,-122.10647)]:
    selected=[r for r in rows if r['station_id']==station];self.assertEqual(len(selected),count);self.assertEqual(data['stations'][station]['latitude'],lat);self.assertEqual(data['stations'][station]['longitude'],lon);self.assertIn('fixed UTC-08:00',data['stations'][station]['timezone'])
   self.assertEqual(sum(json.loads(r['quality_flags']).get('checked') is False for r in rows),27)
   elwha=[r for r in rows if r['station_id']=='ECOLOGY-EIM-18B070'];self.assertEqual(len(elwha),909);self.assertEqual(len({r['date'] for r in elwha}),303)
   for stat in ['daily_mean','daily_min','daily_max']:self.assertEqual(sum(r['statistic']==stat for r in elwha),303)
   self.assertTrue(all('Starting to pool' in json.loads(r['quality_flags'])['source_comments'] for r in elwha))
   skokomish=[r for r in rows if r['station_id']=='ECOLOGY-EIM-16A070'];self.assertEqual(len(skokomish),2256);self.assertEqual(len({r['date'] for r in skokomish}),752)
   for stat in ['daily_mean','daily_min','daily_max']:self.assertEqual(sum(r['statistic']==stat for r in skokomish),752)
   self.assertEqual(data['stations']['ECOLOGY-EIM-16A070']['latitude'],47.31000618128145)
   self.assertEqual(data['stations']['ECOLOGY-EIM-16A070']['longitude'],-123.17665889452056)
   self.assertNotIn('Starting to pool',data['stations']['ECOLOGY-EIM-16A070']['quality'])
 def test_missing_and_stale_companion_preserve_native_and_causal(self):
  for mutation in ['missing','stale']:
   with self.subTest(mutation=mutation),tempfile.TemporaryDirectory() as tmp:
    root,study,out,entry,_=self.fixture(tmp)
    if mutation=='missing':(root/entry['path']).rename(root/'missing.parquet')
    else:
     with (root/entry['path']).open('ab') as f:f.write(b'x')
    prepare(root,study,out);c=json.loads((out/'catalog.json').read_text());data=json.loads((out/Path(c['data']['url']).name).read_text())
    self.assertIsNone(data['stationTemperature']);self.assertIn('unavailable',data['stationTemperatureUnavailable']);self.assertTrue({'discharge_mean','causal_discharge_pulse'}<={m['id'] for m in data['metrics']});self.assertEqual(data['rivers'][0]['series']['discharge_mean']['values'],[1.,None,0.])
 def test_rebound_duplicate_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,_,_,entry,_=self.fixture(tmp);p=root/entry['path'];t=pq.read_table(p);pq.write_table(t.take([0]*t.num_rows),p);entry.update(sha256=checksum(p),bytes=p.stat().st_size)
   with self.assertRaisesRegex(ValueError,'identity'):read_station_temperature(root,entry)
 def test_interrupted_station_publication_blocks_snapshot(self):
  with tempfile.TemporaryDirectory() as tmp:
   root,_,_,_,store=self.fixture(tmp);(store/'station-temperature-transaction.json').write_text('{}')
   with self.assertRaisesRegex(ValueError,'recovery'):
    with product_snapshot(root):pass
