import json
import tempfile
import unittest
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from human_input import append_human, bindings, POPULATION_LABELS, REMOVED_POPULATION_COVERAGE_FIELDS
from prepare_map import Exporter
from prepare_seascape import digest, unpack


class HumanInputTests(unittest.TestCase):
    def test_exact_values_missingness_status_and_tamper_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            name = 'human-r7-static.parquet'
            ids = [h3.latlng_to_cell(lat, -123, 7) for lat in (48, 49, 50)]
            pq.write_table(pa.table({'h3_index': ids, 'h3_resolution': [7]*3,
                'cell_area_km2': [5.1]*3, 'population_count': [0., None, 12.3456789],
                'population_count_collected': [0., 4., 12.3456789],
                'population_count_collected__coverage_status': ['known_zero', 'partial', 'complete'],
                'population_count__coverage_status': ['known_zero', 'partial', 'complete'],
                'population_count__available_source_subtotal': [0., 4., 12.3456789],
                'legacy_effort': [1., 2., 3.]}), root / name)
            artifact = {'path': name, 'rows': 3, 'sha256': digest(root / name)}
            (root / 'catalog.json').write_text(json.dumps({'products': [{'artifact': artifact}]}))
            (root / 'human-r7-static.metadata.json').write_text(json.dumps({
                'schema': 'human.study.static.v1', 'artifact': artifact, 'h3_resolution': 7,
                'primary_key': ['h3_index'], 'population': {'fields': {'population_count': {
                    'units': 'persons', 'coverage_status': 'population_count__coverage_status'},
                    'population_count_collected': {'units': 'persons', 'coverage_status': 'population_count_collected__coverage_status'}}}}))
            staging = root / 'output'; staging.mkdir()
            exporter = Exporter(staging, 'test')
            catalog = {'products': {}, 'features': [], 'datasets': {}}
            append_human(exporter, catalog, root)
            self.assertEqual({f['column'] for f in catalog['features']},
                             {'population_count_collected', 'population_count_collected__coverage_status'})
            product = catalog['products']['human-population-r7']
            binding = product['columns']['population_count_collected']
            self.assertEqual(unpack(json.loads((staging / 'assets' / (binding['sha256'] + '.json')).read_text())),
                             [0., 4., 12.3456789])
            self.assertNotIn('population_count', product['columns'])
            self.assertEqual({f['family'] for f in catalog['features']}, {'Population'})
            self.assertNotIn('legacy_effort', product['columns'])
            with (root / name).open('ab') as stream:
                stream.write(b'tampered')
            with self.assertRaisesRegex(ValueError, 'binding mismatch'):
                bindings(root)

    def test_collected_estimates_retain_original_coverage_and_missing_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            field = 'population_within_100km_collected'
            base = 'population_within_100km'
            ids = [h3.latlng_to_cell(lat, -123, 7) for lat in (48, 49, 50)]
            values = [0., 12.5, 0.]
            pq.write_table(pa.table({'h3_index': ids, 'h3_resolution': [7]*3, 'cell_area_km2': [5.]*3,
                field: values, field+'__coverage_status': ['known_zero', 'partial', 'unavailable'],
                field+'__zero_imputed': [False, True, True], field+'__method': ['method']*3,
                base: [0., None, None], base+'__missing_sources': ['[]', '["missing"]', '[]'],
                base+'__unverified_geographic_support': [False, True, True]}), root/'human-r7-static.parquet')
            artifact = {'path': 'human-r7-static.parquet', 'rows': 3, 'sha256': digest(root/'human-r7-static.parquet')}
            (root/'catalog.json').write_text(json.dumps({'products': [{'artifact': artifact}], 'default_population': {'field': field}}))
            (root/'human-r7-static.metadata.json').write_text(json.dumps({'schema': 'human.study.static.v1',
                'artifact': artifact, 'h3_resolution': 7, 'primary_key': ['h3_index'],
                'population': {'fields': {base: {'units': 'persons','coverage_status': field+'__coverage_status'},
                    field: {'units': 'persons','label': 'Collected population within 100 km','coverage_status': field+'__coverage_status'}}}}))
            staging = root/'output'; staging.mkdir()
            catalog = {'products': {}, 'features': [], 'datasets': {}}
            append_human(Exporter(staging, 'test'), catalog, root)
            feature = catalog['features'][0]
            self.assertEqual(feature['column'], field)
            self.assertEqual(feature['name'], 'Population Within 100km')
            for qualifier in (field+'__zero_imputed', base+'__missing_sources', base+'__unverified_geographic_support'):
                self.assertIn(qualifier, feature['qualifiers'])
            product = catalog['products']['human-population-r7']
            self.assertTrue(REMOVED_POPULATION_COVERAGE_FIELDS.isdisjoint(product['columns']))
            self.assertTrue(REMOVED_POPULATION_COVERAGE_FIELDS.isdisjoint(feature['qualifiers']))
            self.assertTrue(REMOVED_POPULATION_COVERAGE_FIELDS.isdisjoint(f['column'] for f in catalog['features']))
            binding = product['columns'][field]
            self.assertEqual(unpack(json.loads((staging/'assets'/(binding['sha256']+'.json')).read_text())), values)

    def test_existing_cache_checks_membership_assets_before_extending_human(self):
        from human_input import prepare_existing
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            asset = root / 'source.json'
            asset.write_text('{}')
            binding = {'url': '/local-data/seascape/source.json', 'sha256': digest(asset)}
            bad = {**binding, 'sha256': 'corrupt'}
            (root / 'catalog.json').write_text(json.dumps({'version': 2, 'products': {'governance-r6': {
                'cells': binding, 'columns': {}, 'memberships': {'areas': {'asset': bad}}}}}))
            with self.assertRaisesRegex(ValueError, 'Existing map asset checksum mismatch'):
                prepare_existing(root / 'unread-human-input', root)

    def test_each_collected_support_exports_its_own_unknown_evidence(self):
        for base, field, unit in [
            ('population_within_25km', 'population_within_25km_collected', 'persons'),
            ('population_within_50km', 'population_within_50km_collected', 'persons'),
            ('population_count', 'population_density_per_km2_collected', 'persons/km2'),
        ]:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                root=Path(directory)
                name='human-r7-static.parquet'
                table={'h3_index':[h3.latlng_to_cell(48,-123,7)], 'h3_resolution':[7],
                    'cell_area_km2':[2.], field:[12.5], field+'__coverage_status':['partial'],
                    field+'__zero_imputed':[True], base+'__missing_sources':['["this-support-only"]'],
                    base+'__unverified_geographic_support':[True]}
                pq.write_table(pa.table(table),root/name)
                artifact={'path':name,'rows':1,'sha256':digest(root/name)}
                (root/'catalog.json').write_text(json.dumps({'products':[{'artifact':artifact}]}))
                (root/'human-r7-static.metadata.json').write_text(json.dumps({
                    'schema':'human.study.static.v1','artifact':artifact,'h3_resolution':7,'primary_key':['h3_index'],
                    'population':{'fields':{field:{'units':unit,'base_metric':base,
                        'coverage_status':field+'__coverage_status'}}}}))
                output=root/'output';output.mkdir()
                catalog={'products':{},'features':[],'datasets':{}}
                append_human(Exporter(output,'test'),catalog,root)
                feature=next(f for f in catalog['features'] if f['column']==field)
                self.assertEqual(feature['unit'],unit)
                self.assertIn(base+'__missing_sources',feature['qualifiers'])
                self.assertIn(base+'__unverified_geographic_support',feature['qualifiers'])
                self.assertIn(field+'__zero_imputed',feature['qualifiers'])


    def test_older_population_fields_cannot_reappear_when_extending_cache(self):
        from human_input import prepare_existing
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            table = {'h3_index': [h3.latlng_to_cell(48, -123, 7)], 'h3_resolution': [7], 'cell_area_km2': [2.]}
            fields = {}
            for base in ['population_count', 'population_density_per_km2', *[f'population_within_{r}km' for r in (25, 50, 100)]]:
                field = base + '_collected'
                table.update({base: [None], field: [12.5], base+'__available_source_subtotal': [12.5],
                    base+'__coverage_status': ['partial'], base+'__missing_sources': ['["unknown"]'],
                    base+'__unverified_geographic_support': [True], field+'__coverage_status': ['partial'],
                    field+'__zero_imputed': [True], field+'__method': ['method']})
                fields[base] = {'units': 'persons', 'coverage_status': base+'__coverage_status'}
                fields[field] = {'units': 'persons/km2' if 'density' in base else 'persons', 'coverage_status': field+'__coverage_status', 'base_metric': 'population_count' if 'density' in base else base}
            table['population_within_250km'] = [999.]
            fields['population_within_250km'] = {'units': 'persons', 'coverage_status': 'unused'}
            pq.write_table(pa.table(table), root/'human-r7-static.parquet')
            artifact = {'path': 'human-r7-static.parquet', 'rows': 1, 'sha256': digest(root/'human-r7-static.parquet')}
            (root/'catalog.json').write_text(json.dumps({'products': [{'artifact': artifact}],
                'default_population': {'field': 'population_within_100km_collected'}}))
            (root/'human-r7-static.metadata.json').write_text(json.dumps({'schema': 'human.study.static.v1',
                'artifact': artifact, 'h3_resolution': 7, 'primary_key': ['h3_index'], 'population': {'fields': fields}}))
            output = root/'output'; output.mkdir()
            (output/'catalog.json').write_text(json.dumps({'version': 2, 'features': [], 'products': {}, 'datasets': {}}))
            # Repeated cache extension must not restore an older scientific field or quality alias.
            for _ in range(2):
                prepare_existing(root, output)
                catalog = json.loads((output/'catalog.json').read_text())
                features = {f['column'] for f in catalog['features']}
                product = catalog['products']['human-population-r7']
                self.assertEqual({f['family'] for f in catalog['features']}, {'Population'})
                for field, label in POPULATION_LABELS.items():
                    self.assertEqual(next(f['name'] for f in catalog['features'] if f['column']==field), label)
                    base = field.removesuffix('_collected')
                    self.assertNotIn(base, product['columns'])
                    self.assertNotIn(base, features)
                    self.assertNotIn(base+'__coverage_status', features)
                    self.assertIn(field, features)
                    if field+'__coverage_status' in REMOVED_POPULATION_COVERAGE_FIELDS:
                        self.assertNotIn(field+'__coverage_status', features)
                        self.assertNotIn(field+'__coverage_status', product['columns'])
                    else:
                        self.assertIn(field+'__coverage_status', features)
                    support = 'population_count' if 'density' in base else base
                    self.assertIn(support+'__missing_sources', product['columns'])
                    binding = product['columns'][field]
                    path = output/binding['url'].removeprefix('/local-data/seascape/')
                    self.assertEqual(unpack(json.loads(path.read_text())), table[field])
                self.assertFalse(any('250km' in name for name in product['columns']))

    def test_native_source_records_keep_identity_geometry_and_access_separate_from_h3(self):
        from human_input import prepare_existing
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);field='population_within_100km_collected'
            pq.write_table(pa.table({'h3_index':[h3.latlng_to_cell(48,-123,7)],'h3_resolution':[7],
                'cell_area_km2':[2.],field:[42.],field+'__zero_imputed':[True],
                'population_within_100km__missing_sources':['["raw-unknown"]']}),root/'human-r7-static.parquet')
            artifact={'path':'human-r7-static.parquet','rows':1,'sha256':digest(root/'human-r7-static.parquet')}
            records=[{'type':'Feature','id':f'places:{i}','geometry':{'type':'Point','coordinates':[-123-i,48+i]},
                'properties':{'group':'places','role':'record','record_id':f'places:{i}','category':category,
                    'access_state':access,'attributes':{'name':f'Named source {i}','access':None if i==0 else 'private'}}}
                for i,(category,access) in enumerate([('park','unknown'),('beach','restricted')])]
            payload={'schema':'human.native_features.v1','type':'FeatureCollection','features':records}
            path=root/'human-native-features.geojson';path.write_text(json.dumps(payload))
            native_artifact={'path':path.name,'sha256':digest(path),'features':2,'rows':2,'context_features':0}
            native={'schema':'human.native_features.v1','crs':'EPSG:4326','artifact':native_artifact,
                'groups':{'places':{'name':'Named Destinations','family':'Places','records':2,'context_features':0,
                    'categories':{'park':1,'beach':1},'access_states':{'unknown':1,'restricted':1},'limitations':'Retained partial fixture'}}}
            path.with_suffix('.metadata.json').write_text(json.dumps(native))
            static={'schema':'human.study.static.v1','artifact':artifact,'h3_resolution':7,'primary_key':['h3_index'],
                'population':{'fields':{field:{'units':'persons','base_metric':'population_within_100km'}}},'native_features':native_artifact}
            (root/'human-r7-static.metadata.json').write_text(json.dumps(static))
            (root/'catalog.json').write_text(json.dumps({'products':[static,native],'default_population':{'field':field}}))
            output=root/'output';output.mkdir();catalog={'features':[],'products':{},'datasets':{}}
            append_human(Exporter(output,'test'),catalog,root)
            product=catalog['products']['human-population-r7'];binding=product['nativeFeatures']
            exported=json.loads((output/'assets'/(binding['sha256']+'.json')).read_text())
            self.assertTrue(all('access_state' not in f['properties'] for f in exported['features']))
            self.assertNotIn('access_states',product['nativeGroups']['places'])
            self.assertEqual(exported['features'][1]['properties']['attributes']['access'],'private')
            self.assertEqual(json.loads(path.read_text()),payload)
            feature=next(f for f in catalog['features'] if f.get('geometryGroup')=='places')
            self.assertEqual(feature['rows'],2);self.assertEqual(product['rows'],1)
            self.assertEqual(feature['categories'],['park','beach'])
            self.assertNotIn('places',product['columns'])
            path.write_text('{}')
            with self.assertRaisesRegex(ValueError,'native geometry binding mismatch'):bindings(root)


    def test_final_only_parquets_preserve_native_records_and_verify_calendar_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory);root=work/'Human';root.mkdir();receipts=work/'toolkit-metadata';receipts.mkdir()
            field='population_within_100km_collected'
            feature={'type':'Feature','id':'places:one','geometry':{'type':'Point','coordinates':[-123.,48.]},
                'properties':{'group':'places','role':'record','record_id':'places:one','category':'park',
                    'attributes':{'name':'Synthetic retained place','unknown':None}}}
            native={'schema':'human.native_features.v1','crs':'EPSG:4326','storage_counts':{'records':1,'features':1,'context_features':0},
                'groups':{'places':{'name':'Named Destinations','family':'Places','records':1,'context_features':0,
                    'categories':{'park':1},'limitations':'Synthetic partial inventory'}}}
            common={'schema':'human.delivery.final_only.v1','receipt_path':str(receipts/'catalog.json'),
                'catalog':{'default_population':{'field':field}}}
            def write(name,table,metadata):
                pq.write_table(table.replace_schema_metadata({b'human_study':json.dumps(metadata).encode(),
                    b'human_delivery':json.dumps(common).encode()}),root/name)
                return {**metadata,'artifact':{**metadata.get('storage_counts',{}),'path':name,'sha256':digest(root/name),'rows':table.num_rows}}
            native=write('static-native.parquet',pa.table({'feature_id':['places:one'],
                'geometry_json':[json.dumps(feature['geometry'])],'properties_json':[json.dumps(feature['properties'])]}),native)
            static=write('static.parquet',pa.table({'h3_index':[h3.latlng_to_cell(48,-123,7)],'h3_resolution':[7],
                'cell_area_km2':[2.],field:[0.],field+'__zero_imputed':[True]}),
                {'schema':'human.study.static.v1','h3_resolution':7,'primary_key':['h3_index'],
                    'population':{'fields':{field:{'units':'persons'}}},'native_features':native['artifact']})
            calendar=write('dynamic-calendar.parquet',pa.table({'date':['2026-03-08'],'jurisdiction':['US-WA'],
                'timezone':['America/Los_Angeles']}),{'schema':'human.study.calendar_lookup.v1','primary_key':['date','jurisdiction']})
            (receipts/'catalog.json').write_text(json.dumps({**common['catalog'],'products':[static,native,calendar]}))
            output=work/'cache';output.mkdir();catalog={'products':{},'features':[],'datasets':{}}
            append_human(Exporter(output,'test'),catalog,root)
            product=catalog['products']['human-population-r7']
            asset=product['nativeFeatures'];payload=json.loads((output/'assets'/(asset['sha256']+'.json')).read_text())
            self.assertEqual(payload['features'],[feature])
            self.assertEqual(next(f for f in catalog['features'] if f['column']==field)['sourcePath'],str(root/'static.parquet'))
            self.assertEqual({p.name for p in root.iterdir()},{'static.parquet','dynamic-calendar.parquet','static-native.parquet'})
            with (root/'dynamic-calendar.parquet').open('ab') as stream:stream.write(b'changed')
            with self.assertRaisesRegex(ValueError,'final product binding mismatch'):bindings(root)


class PortSourceRelease(unittest.TestCase):
    def test_ports_use_nga_receipt_not_the_generic_legacy_bc_vintage(self):
        from human_input import native_source_release
        native={'source_receipts':[{'source_id':'nga_world_port_index','original_provenance':{'source':{'retrieved_at_utc':'2026-10-14T02:08:21Z'}}}]}
        value=native_source_release(native,'ports')
        self.assertIn('NGA World Port Index',value)
        self.assertIn('2026-10-14',value)
        self.assertNotIn('2004',value)
        self.assertIn('unknown',value)
        self.assertIn('2004',native_source_release(native,'places'))
