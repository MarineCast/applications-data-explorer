"""The flat influence Parquet is the sole delivery source; offline fixtures only."""
from datetime import date
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import h3
import pyarrow as pa
import pyarrow.parquet as pq
from hydrology_input import digest
from local_data import Reader, Sources
from river_influence_input import SCHEMA, prepare, native_catalog_sha256


def write(source, rows, recipe, *, update_hash=True):
    metadata={'format':'hydrology-influence-factors-1','identity':hashlib.sha256(json.dumps(recipe,sort_keys=True,default=str).encode()).hexdigest(),'recipe':recipe}
    value=hashlib.sha256()
    records=pa.Table.from_pylist(rows,schema=SCHEMA).to_pylist()
    for row in records:
        value.update(json.dumps(row,sort_keys=True,default=str,allow_nan=False,separators=(',',':')).encode());value.update(b'\n')
    metadata['factors_sha256']=value.hexdigest() if update_hash else '0'*64
    table=pa.Table.from_pylist(records,schema=SCHEMA).replace_schema_metadata({b'hydrology_influence':json.dumps(metadata).encode()})
    pq.write_table(table,source)
    catalog_path=source.parent/'catalog.json';catalog=json.loads(catalog_path.read_text())
    catalog['products']={'influence':{'path':'influence.parquet','format':'hydrology-influence-factors-1','sha256':digest(source),'bytes':source.stat().st_size,'rows':len(records),'identity':metadata['identity'],'source_status':'current','metrics':recipe['signals'],'temporal_basis':recipe['temporal_basis'],'model_eligible':recipe['model_eligible'],'retrospective':recipe['retrospective'],'native_catalog_sha256':recipe['hydrology_catalog_sha256']}}
    catalog_path.write_text(json.dumps(catalog))


class InfluenceInput(unittest.TestCase):
    def fixture(self, tmp):
        base=Path(tmp);data=base/'Data';hydro=data/'Hydrology';hydro.mkdir(parents=True)
        (hydro/'catalog.json').write_text('{}');source=hydro/'influence.parquet'
        study=base/'study.json';study.write_text('{}');cell=h3.latlng_to_cell(48,-123,6)
        recipe={'version':1,'method':'river-influence-water-r8-min-child-lag-v2','model_eligible':False,'retrospective':True,'temporal_basis':'provider_daily','study_sha256':digest(study),'hydrology_catalog_sha256':digest(hydro/'catalog.json'),'cells':[cell],'dates':['2026-10-15'],'rivers':[{'id':'test'}],'config':{'distance_profiles':[{'id':'d'}],'lag_profiles':[{'id':'l'}]},'signals':{'relative_flow':{},'discharge':{}}}
        rows=[{'factor_type':'spatial','river_id':'test','h3_index':cell,'distance_profile':'d','weight':.25,'water_distance_m':1000.,'reachable_r8_children':1}, {'factor_type':'temporal','river_id':'test','date':date(2026,10,15),'lag_profile':'l','relative_flow':2.,'discharge':100.,'interpolated_input_weight':0.}]
        write(source,rows,recipe)
        return data,source,study,hydro,base/'public',rows,recipe

    def test_encoding_preserves_factors_and_live_reader_tracks_flat_replacement(self):
        with tempfile.TemporaryDirectory() as tmp:
            data,source,study,hydro,public,rows,recipe=self.fixture(tmp);public.mkdir()
            before=digest(source)
            with self.reader(Sources(data,public,study)) as reader:
                def current():
                    catalog=reader.request({'path':'/local-data/river-influence/catalog.json'})['json']
                    return catalog,json.loads(Path(reader.request({'path':catalog['data']['url']})['file']).read_text())
                catalog,payload=current()
                self.assertEqual(catalog['source_sha256'],before)
                self.assertEqual(set(payload['daily']['test']['l']),{'relative_flow','discharge','interpolated_input_weight'})
                self.assertEqual(payload['weights']['test']['d'],[.25]);self.assertEqual(payload['daily']['test']['l']['relative_flow'],[2.]);self.assertEqual(digest(source),before)
                old=reader.sources.version('river-influence');rows[1]['relative_flow']=3.;write(source,rows,recipe)
                self.assertNotEqual(old,reader.sources.version('river-influence'))
                updated,payload=current();self.assertNotEqual(catalog['source_sha256'],updated['source_sha256']);self.assertEqual(payload['daily']['test']['l']['relative_flow'],[3.])
                changed=json.loads((hydro/'catalog.json').read_text());changed['native_changed']=True;(hydro/'catalog.json').write_text(json.dumps(changed))
                with self.assertRaisesRegex(ValueError,'source changed'):current()

    def test_rejects_factor_corruption_and_missing_embedded_recipe(self):
        with tempfile.TemporaryDirectory() as tmp:
            _,source,study,hydro,output,rows,recipe=self.fixture(tmp)
            write(source,rows,recipe,update_hash=False)
            with self.assertRaisesRegex(ValueError,'checksum'):prepare(source,study,hydro,output)
            pq.write_table(pa.Table.from_pylist(rows,schema=SCHEMA),source)
            with self.assertRaisesRegex(ValueError,'catalog checksum'):prepare(source,study,hydro,output)

    def test_catalog_pointer_and_checksum_are_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            _,source,study,hydro,output,_,_=self.fixture(tmp)
            path=hydro/'catalog.json';catalog=json.loads(path.read_text());before=native_catalog_sha256(catalog)
            catalog['products']['influence']['path']='../outside.parquet';path.write_text(json.dumps(catalog))
            self.assertEqual(native_catalog_sha256(catalog),before)
            with self.assertRaisesRegex(ValueError,'unsafe'):prepare(source,study,hydro,output)
            catalog['products']['influence']['path']='influence.parquet';catalog['products']['influence']['sha256']='0'*64;path.write_text(json.dumps(catalog))
            with self.assertRaisesRegex(ValueError,'catalog checksum'):prepare(source,study,hydro,output)

    def test_rejects_duplicate_keys_and_mixed_factor_support(self):
        with tempfile.TemporaryDirectory() as tmp:
            _,source,study,hydro,output,rows,recipe=self.fixture(tmp)
            write(source,[rows[0],rows[0]],recipe)
            with self.assertRaisesRegex(ValueError,'factor types'):prepare(source,study,hydro,output)
            recipe['dates'].append('2026-10-16');write(source,[rows[0],rows[1],rows[1]],recipe)
            with self.assertRaisesRegex(ValueError,'calendar/identity'):prepare(source,study,hydro,output)
            recipe['dates'].pop();rows[0]['date']=date(2026,10,15);write(source,rows,recipe)
            with self.assertRaisesRegex(ValueError,'Mixed'):prepare(source,study,hydro,output)

    @staticmethod
    def reader(sources):
        import contextlib
        @contextlib.contextmanager
        def opened():
            r=Reader(sources)
            try:yield r
            finally:r.close()
        return opened()
