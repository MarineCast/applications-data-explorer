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


    def test_compact_v2_two_file_delivery_keeps_static_values_without_native_layers(self):
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory);root=work/'Human';root.mkdir();receipt=work/'catalog.json'
            field='population_within_100km_collected'
            common={'schema':'human.delivery.final_only.v2','receipt_path':str(receipt),'catalog':{}}
            def write(name, table, info):
                pq.write_table(table.replace_schema_metadata({b'human_study':json.dumps(info).encode(),
                    b'human_delivery':json.dumps(common).encode()}),root/name)
                return {**info,'artifact':{'path':name,'sha256':digest(root/name),'rows':table.num_rows}}
            static=write('static.parquet',pa.table({'h3_index':[h3.latlng_to_cell(48,-123,7)],'h3_resolution':[7],
                'cell_area_km2':[2.],field:[0.],field+'__zero_imputed':[True]}),
                {'schema':'human.study.static.v1','h3_resolution':7,'primary_key':['h3_index'],
                 'population':{'fields':{field:{'units':'persons'}}}})
            calendar=write('dynamic-calendar.parquet',pa.table({'date':['2026-01-01'],'country':['CA'],
                'timezone':['America/Vancouver'],'is_weekend':[False],'holiday_names':["New Year's Day"],'is_holiday':[True]}),
                {'schema':'human.study.calendar_lookup.v2','primary_key':['date','country','timezone'], 'jurisdictions':[{'country':'CA','timezone':'America/Vancouver'}], 'temporal_support':{'start':'2009-01-01','end_exclusive':'2027-01-01'}})
            receipt.write_text(json.dumps({'default_population':{'field':field},'products':[static,calendar]}))
            output=work/'cache';output.mkdir();catalog={'products':{},'features':[],'datasets':{}}
            append_human(Exporter(output,'test'),catalog,root)
            self.assertNotIn('nativeFeatures',catalog['products']['human-population-r7'])
            self.assertEqual(len(catalog['features']),1)
            self.assertNotIn('native',bindings(root))
            with (root/'dynamic-calendar.parquet').open('ab') as stream:stream.write(b'changed')
            with self.assertRaisesRegex(ValueError,'final product binding mismatch'):bindings(root)


    def test_compact_static_audit_restores_population_evidence(self):
        from local_data import Sources
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory);root=work/'Human';root.mkdir();receipts=work/'receipt';receipts.mkdir()
            key=h3.latlng_to_cell(48,-123,7);field='population_count_collected'
            audit_path=receipts/'static-audit.parquet'
            audit=pa.table({'h3_index':[key],'population_count__missing_sources':['["unknown-source"]'],
                'population_count_collected__zero_imputed':[True]})
            pq.write_table(audit.replace_schema_metadata({b'human_static_audit':json.dumps({'schema':'human.static.audit.v1'}).encode()}),audit_path)
            audit_binding={'schema':'human.static.audit.v1','columns':audit.column_names,'primary_key':['h3_index'],
                'artifact':{'path':str(audit_path),'sha256':digest(audit_path),'rows':1}}
            common={'schema':'human.delivery.final_only.v3','receipt_path':str(receipts/'catalog.json'),'catalog':{}}
            info={'schema':'human.study.static.v2','h3_resolution':7,'primary_key':['h3_index'],
                'static_audit':audit_binding,'population':{'fields':{field:{'units':'persons','base_metric':'population_count',
                    'coverage_status':'population_count__coverage_status','method':'area_weighted_collected_sources_missing_as_zero.v1'}}}}
            def write(name,table,metadata):
                pq.write_table(table.replace_schema_metadata({b'human_study':json.dumps(metadata).encode(),
                    b'human_delivery':json.dumps(common).encode()}),root/name)
                return {**metadata,'artifact':{'path':name,'sha256':digest(root/name),'rows':table.num_rows}}
            static=write('static.parquet',pa.table({'h3_index':[key],'h3_resolution':[7],'cell_area_km2':[4.],
                field:[0.],'population_count__coverage_status':['unavailable'],'population_count__unverified_geographic_support':[True]}),info)
            calendar=write('dynamic-calendar.parquet',pa.table({'date':['2026-01-01']}),{'schema':'human.study.calendar_lookup.v2'})
            (receipts/'catalog.json').write_text(json.dumps({'default_population':{'field':field},'products':[static,calendar]}))
            output=work/'browser';output.mkdir();catalog={'products':{},'features':[],'datasets':{}}
            append_human(Exporter(output,'compact'),catalog,root)
            product=catalog['products']['human-population-r7']
            self.assertIn('population_count__missing_sources',product['columns'])
            self.assertIn('population_count_collected__zero_imputed',product['columns'])
            feature=next(f for f in catalog['features'] if f['column']==field)
            self.assertTrue(feature['populationEvidence']['auditReceipt'])
            coverage=next(f for f in catalog['features'] if f['column']=='population_count__coverage_status')
            self.assertEqual(coverage['id'],'HUMAN__population_count_collected__coverage_status')
            self.assertIn(field,coverage['qualifiers'])
            self.assertNotIn('population_count',coverage['qualifiers'])
            self.assertEqual(bindings(root)['static_audit']['sha256'],digest(audit_path))
            sources=Sources(work,work/'public',work/'study.json')
            # Source roots are Human under the supplied Data root. An audit-only
            # edit must invalidate the watcher's version even outside Data.
            version=sources.version('human')
            with audit_path.open('ab') as stream:stream.write(b'changed')
            self.assertNotEqual(version,sources.version('human'))
            with self.assertRaisesRegex(ValueError,'audit binding mismatch'):bindings(root)


    def test_snake_case_static_preserves_qualifiers_and_saved_feature_ids(self):
        from local_data import Sources
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory);root=work/'Human';root.mkdir();receipts=work/'receipt';receipts.mkdir()
            key=h3.latlng_to_cell(48,-123,7);field='population_count_collected'
            audit_path=receipts/'static-audit.parquet'
            audit=pa.table({'h3_index':[key],'population_count__missing_sources':['["unknown-source"]'],
                'population_count_collected__zero_imputed':[True]})
            pq.write_table(audit.replace_schema_metadata({b'human_static_audit':json.dumps({'schema':'human.static.audit.v1'}).encode()}),audit_path)
            audit_binding={'schema':'human.static.audit.v1','columns':audit.column_names,'primary_key':['h3_index'],
                'artifact':{'path':str(audit_path),'sha256':digest(audit_path),'rows':1}}
            common={'schema':'human.delivery.final_only.v4','receipt_path':str(receipts/'catalog.json'),'catalog':{}}
            info={'schema':'human.study.static.v3','h3_resolution':7,'primary_key':['h3_index'],
                'column_name_mapping':{'population_count__coverage_status':'population_count_coverage_status',
                    'ports__SOURCE_RECORD_COUNT':'port_record_count'},
                'infrastructure_fields':{'port_record_count':{'family':'Ports','units':'records','qualifiers':[],
                    'label':'Port Source Records','limitation':'Partial retained inventory'}},
                'static_audit':audit_binding,'population':{'fields':{field:{'units':'persons','base_metric':'population_count',
                    'unverified_geographic_support':'population_count_unverified_geographic_support',
                    'coverage_status':'population_count_coverage_status','method':'area_weighted_collected_sources_missing_as_zero.v1'}}}}
            def write(name,table,metadata):
                pq.write_table(table.replace_schema_metadata({b'human_study':json.dumps(metadata).encode(),
                    b'human_delivery':json.dumps(common).encode()}),root/name)
                return {**metadata,'artifact':{'path':name,'sha256':digest(root/name),'rows':table.num_rows}}
            static=write('static.parquet',pa.table({'h3_index':[key],'h3_resolution':[7],'cell_area_km2':[4.],
                field:[0.],'port_record_count':[3],'population_count_coverage_status':['unavailable'],'population_count_unverified_geographic_support':[True]}),info)
            calendar=write('dynamic-calendar.parquet',pa.table({'date':['2026-01-01']}),{'schema':'human.study.calendar_lookup.v2'})
            (receipts/'catalog.json').write_text(json.dumps({'default_population':{'field':field},'products':[static,calendar]}))
            output=work/'browser';output.mkdir();catalog={'products':{},'features':[],'datasets':{}}
            append_human(Exporter(output,'compact'),catalog,root)
            product=catalog['products']['human-population-r7']
            self.assertIn('population_count__missing_sources',product['columns'])
            self.assertIn('population_count_collected__zero_imputed',product['columns'])
            feature=next(f for f in catalog['features'] if f['column']==field)
            self.assertTrue(feature['populationEvidence']['auditReceipt'])
            self.assertIn('population_count_coverage_status',feature['qualifiers'])
            self.assertIn('population_count_unverified_geographic_support',feature['qualifiers'])
            port=next(f for f in catalog['features'] if f['column']=='port_record_count')
            self.assertEqual(port['id'],'HUMAN__ports__SOURCE_RECORD_COUNT')
            self.assertIn('NGA World Port Index',port['sourceRelease'])
            coverage=next(f for f in catalog['features'] if f['column']=='population_count_coverage_status')
            self.assertEqual(coverage['id'],'HUMAN__population_count_collected__coverage_status')
            self.assertIn(field,coverage['qualifiers'])
            self.assertNotIn('population_count',coverage['qualifiers'])
            self.assertEqual(bindings(root)['static_audit']['sha256'],digest(audit_path))
            sources=Sources(work,work/'public',work/'study.json')
            # Source roots are Human under the supplied Data root. An audit-only
            # edit must invalidate the watcher's version even outside Data.
            version=sources.version('human')
            with audit_path.open('ab') as stream:stream.write(b'changed')
            self.assertNotEqual(version,sources.version('human'))
            with self.assertRaisesRegex(ValueError,'audit binding mismatch'):bindings(root)


    def test_quantities_only_static_keeps_support_external_and_removes_coverage_choice(self):
        from local_data import Sources
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory);root=work/'Human';root.mkdir();receipts=work/'receipt';receipts.mkdir()
            key=h3.latlng_to_cell(48,-123,7);field='population_count_collected'
            audit_path=receipts/'static-audit.parquet'
            audit=pa.table({'h3_index':[key],'population_count__missing_sources':['["unknown-source"]'],
                'population_count_collected__zero_imputed':[True], 'cell_area_km2':[4.],
                'population_count__coverage_status':['unavailable'],'population_count__unverified_geographic_support':[True]})
            pq.write_table(audit.replace_schema_metadata({b'human_static_audit':json.dumps({'schema':'human.static.audit.v1'}).encode()}),audit_path)
            audit_binding={'schema':'human.static.audit.v1','columns':audit.column_names,'primary_key':['h3_index'],
                'artifact':{'path':str(audit_path),'sha256':digest(audit_path),'rows':1}}
            common={'schema':'human.delivery.final_only.v5','receipt_path':str(receipts/'catalog.json'),'catalog':{}}
            info={'schema':'human.study.static.v4','h3_resolution':7,'primary_key':['h3_index'],
                'column_name_mapping':{'population_count_collected':'population_count_collected','ports__SOURCE_RECORD_COUNT':'port_record_count'},
                'infrastructure_fields':{'port_record_count':{'family':'Ports','units':'records','qualifiers':[],
                    'label':'Port Source Records','limitation':'Partial retained inventory'}},
                'static_audit':audit_binding,'population':{'fields':{field:{'units':'persons','base_metric':'population_count',
                    'support_location':'external_static_audit','audit_fields':{'coverage_status':'population_count__coverage_status','zero_imputed':'population_count_collected__zero_imputed'},'method':'area_weighted_collected_sources_missing_as_zero.v1'}}}}
            def write(name,table,metadata):
                pq.write_table(table.replace_schema_metadata({b'human_study':json.dumps(metadata).encode(),
                    b'human_delivery':json.dumps(common).encode()}),root/name)
                return {**metadata,'artifact':{'path':name,'sha256':digest(root/name),'rows':table.num_rows}}
            static=write('static.parquet',pa.table({'h3_index':[key],'h3_resolution':[7],field:[0.],'port_record_count':[3]}),info)
            calendar=write('dynamic-calendar.parquet',pa.table({'date':['2026-01-01']}),{'schema':'human.study.calendar_lookup.v2'})
            (receipts/'catalog.json').write_text(json.dumps({'default_population':{'field':field},'products':[static,calendar]}))
            output=work/'browser';output.mkdir();catalog={'products':{},'features':[],'datasets':{}}
            append_human(Exporter(output,'compact'),catalog,root)
            product=catalog['products']['human-population-r7']
            self.assertIn('population_count__missing_sources',product['columns'])
            self.assertIn('population_count_collected__zero_imputed',product['columns'])
            feature=next(f for f in catalog['features'] if f['column']==field)
            self.assertTrue(feature['populationEvidence']['auditReceipt'])
            self.assertTrue(feature['populationEvidence']['supportInAudit'])
            self.assertIn('cell_area_km2',product['columns'])
            self.assertIn('cell_area_km2',feature['qualifiers'])
            self.assertNotIn('population_count_coverage_status',product['columns'])
            port=next(f for f in catalog['features'] if f['column']=='port_record_count')
            self.assertEqual(port['id'],'HUMAN__ports__SOURCE_RECORD_COUNT')
            self.assertIn('NGA World Port Index',port['sourceRelease'])
            self.assertEqual({f['column'] for f in catalog['features']},{field,'port_record_count'})
            self.assertEqual(bindings(root)['static_audit']['sha256'],digest(audit_path))
            sources=Sources(work,work/'public',work/'study.json')
            # Source roots are Human under the supplied Data root. An audit-only
            # edit must invalidate the watcher's version even outside Data.
            version=sources.version('human')
            with audit_path.open('ab') as stream:stream.write(b'changed')
            self.assertNotEqual(version,sources.version('human'))
            with self.assertRaisesRegex(ValueError,'audit binding mismatch'):bindings(root)


    def test_consolidated_static_reads_unsuffixed_population_and_boolean_ports(self):
        from local_data import Sources
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory);root=work/'Human';root.mkdir();receipts=work/'receipt';receipts.mkdir()
            key=h3.latlng_to_cell(48,-123,7);field='population_count'
            audit_path=receipts/'static-audit.parquet'
            audit=pa.table({'h3_index':[key],'population_count__missing_sources':['["unknown-source"]'],
                'population_count_collected__zero_imputed':[True], 'cell_area_km2':[4.],
                'population_count__coverage_status':['unavailable'],'population_count__unverified_geographic_support':[True]})
            pq.write_table(audit.replace_schema_metadata({b'human_static_audit':json.dumps({'schema':'human.static.audit.v1'}).encode()}),audit_path)
            audit_binding={'schema':'human.static.audit.v1','columns':audit.column_names,'primary_key':['h3_index'],
                'artifact':{'path':str(audit_path),'sha256':digest(audit_path),'rows':1}}
            common={'schema':'human.delivery.final_only.v6','receipt_path':str(receipts/'catalog.json'),'catalog':{}}
            info={'schema':'human.study.static.v5','h3_resolution':7,'primary_key':['h3_index'],
                'column_name_mapping':{'population_count_collected':'population_count','ports__SOURCE_RECORD_COUNT':'has_port'},
                'infrastructure_fields':{'has_port':{'family':'Ports','units':'boolean','qualifiers':[],
                    'label':'Port Source Records','limitation':'Partial retained inventory'}},
                'static_audit':audit_binding,'population':{'fields':{field:{'units':'persons','base_metric':'population_count',
                    'support_location':'external_static_audit','audit_fields':{'coverage_status':'population_count__coverage_status','zero_imputed':'population_count_collected__zero_imputed'},'method':'area_weighted_collected_sources_missing_as_zero.v1'}}}}
            def write(name,table,metadata):
                pq.write_table(table.replace_schema_metadata({b'human_study':json.dumps(metadata).encode(),
                    b'human_delivery':json.dumps(common).encode()}),root/name)
                return {**metadata,'artifact':{'path':name,'sha256':digest(root/name),'rows':table.num_rows}}
            static=write('static.parquet',pa.table({'h3_index':[key],'h3_resolution':[7],field:[0.],'has_port':[True]}),info)
            calendar=write('dynamic-calendar.parquet',pa.table({'date':['2026-01-01']}),{'schema':'human.study.calendar_lookup.v2'})
            (receipts/'catalog.json').write_text(json.dumps({'default_population':{'field':field},'products':[static,calendar]}))
            output=work/'browser';output.mkdir();catalog={'products':{},'features':[],'datasets':{}}
            append_human(Exporter(output,'compact'),catalog,root)
            product=catalog['products']['human-population-r7']
            self.assertIn('population_count__missing_sources',product['columns'])
            self.assertIn('population_count_collected__zero_imputed',product['columns'])
            feature=next(f for f in catalog['features'] if f['column']==field)
            self.assertEqual(feature['id'],'HUMAN__population_count_collected')
            self.assertEqual(feature['name'],'Population Count')
            self.assertNotIn('Complete coverage is required',feature['definition'])
            self.assertTrue(feature['populationEvidence']['auditReceipt'])
            self.assertTrue(feature['populationEvidence']['supportInAudit'])
            self.assertIn('cell_area_km2',product['columns'])
            self.assertIn('cell_area_km2',feature['qualifiers'])
            self.assertNotIn('population_count_coverage_status',product['columns'])
            port=next(f for f in catalog['features'] if f['column']=='has_port')
            self.assertEqual(port['id'],'HUMAN__has_port')
            self.assertIn('NGA World Port Index',port['sourceRelease'])
            self.assertEqual(port['kind'],'categorical')
            self.assertEqual(port['categories'],[True])
            self.assertEqual(port['arrowType'],'bool')
            self.assertEqual({f['column'] for f in catalog['features']},{field,'has_port'})
            self.assertEqual(bindings(root)['static_audit']['sha256'],digest(audit_path))
            sources=Sources(work,work/'public',work/'study.json')
            # Source roots are Human under the supplied Data root. An audit-only
            # edit must invalidate the watcher's version even outside Data.
            version=sources.version('human')
            with audit_path.open('ab') as stream:stream.write(b'changed')
            self.assertNotEqual(version,sources.version('human'))
            with self.assertRaisesRegex(ValueError,'audit binding mismatch'):bindings(root)


    def test_integer_presence_fields_remain_exact_zero_one_numeric_values(self):
        from local_data import Sources
        from prepare_seascape import unpack
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory);root=work/'Human';root.mkdir();receipts=work/'receipt';receipts.mkdir()
            key=h3.latlng_to_cell(48,-123,7);field='population_count'
            audit_path=receipts/'static-audit.parquet'
            audit=pa.table({'h3_index':[key],'population_count__missing_sources':['["unknown-source"]'],
                'population_count_collected__zero_imputed':[True], 'cell_area_km2':[4.],
                'population_count__coverage_status':['unavailable'],'population_count__unverified_geographic_support':[True]})
            pq.write_table(audit.replace_schema_metadata({b'human_static_audit':json.dumps({'schema':'human.static.audit.v1'}).encode()}),audit_path)
            audit_binding={'schema':'human.static.audit.v1','columns':audit.column_names,'primary_key':['h3_index'],
                'artifact':{'path':str(audit_path),'sha256':digest(audit_path),'rows':1}}
            common={'schema':'human.delivery.final_only.v7','receipt_path':str(receipts/'catalog.json'),'catalog':{}}
            info={'schema':'human.study.static.v6','h3_resolution':7,'primary_key':['h3_index'],
                'column_name_mapping':{'population_count_collected':'population_count','ports__SOURCE_RECORD_COUNT':'has_port'},
                'infrastructure_fields':{'has_port':{'family':'Ports','units':'0/1','qualifiers':[],
                    'label':'Port Present','limitation':'Partial retained inventory'},
                    **{name:{'family':family,'units':'0/1','qualifiers':[],'label':name,'limitation':'Derived count > 0'} for name,family in [('has_boat_launch','Boat Launches'),('has_shore_access_site','Shore Access'),('has_place','Places')]}},
                'static_audit':audit_binding,'population':{'fields':{field:{'units':'persons','base_metric':'population_count',
                    'support_location':'external_static_audit','audit_fields':{'coverage_status':'population_count__coverage_status','zero_imputed':'population_count_collected__zero_imputed'},'method':'area_weighted_collected_sources_missing_as_zero.v1'}}}}
            def write(name,table,metadata):
                pq.write_table(table.replace_schema_metadata({b'human_study':json.dumps(metadata).encode(),
                    b'human_delivery':json.dumps(common).encode()}),root/name)
                return {**metadata,'artifact':{'path':name,'sha256':digest(root/name),'rows':table.num_rows}}
            static=write('static.parquet',pa.table({'h3_index':[key],'h3_resolution':[7],field:[0.],'has_port':[1],'has_boat_launch':[1],'has_shore_access_site':[0],'has_place':[1]}),info)
            calendar=write('dynamic-calendar.parquet',pa.table({'date':['2026-01-01']}),{'schema':'human.study.calendar_lookup.v2'})
            (receipts/'catalog.json').write_text(json.dumps({'default_population':{'field':field},'products':[static,calendar]}))
            output=work/'browser';output.mkdir();catalog={'products':{},'features':[],'datasets':{}}
            append_human(Exporter(output,'compact'),catalog,root)
            product=catalog['products']['human-population-r7']
            self.assertIn('population_count__missing_sources',product['columns'])
            self.assertIn('population_count_collected__zero_imputed',product['columns'])
            feature=next(f for f in catalog['features'] if f['column']==field)
            self.assertEqual(feature['id'],'HUMAN__population_count_collected')
            self.assertEqual(feature['name'],'Population Count')
            self.assertNotIn('Complete coverage is required',feature['definition'])
            self.assertTrue(feature['populationEvidence']['auditReceipt'])
            self.assertTrue(feature['populationEvidence']['supportInAudit'])
            self.assertIn('cell_area_km2',product['columns'])
            self.assertIn('cell_area_km2',feature['qualifiers'])
            self.assertNotIn('population_count_coverage_status',product['columns'])
            port=next(f for f in catalog['features'] if f['column']=='has_port')
            self.assertEqual(port['id'],'HUMAN__has_port')
            self.assertIn('NGA World Port Index',port['sourceRelease'])
            self.assertEqual(port['kind'],'numeric')
            self.assertIsNone(port['categories'])
            self.assertEqual(port['unit'],'0/1')
            self.assertEqual(port['arrowType'],'int64')
            self.assertEqual({f['column'] for f in catalog['features']},{field,'has_port','has_boat_launch','has_shore_access_site','has_place'})
            for name in ('has_port','has_boat_launch','has_shore_access_site','has_place'):
                indicator=next(f for f in catalog['features'] if f['column']==name)
                self.assertEqual(indicator['kind'],'numeric')
                self.assertEqual(indicator['arrowType'],'int64')
                binding=product['columns'][name]
                values=unpack(json.loads((output/'assets'/(binding['sha256']+'.json')).read_text()))
                self.assertTrue(all(type(value) is int and value in (0,1) for value in values))
            self.assertEqual(bindings(root)['static_audit']['sha256'],digest(audit_path))
            sources=Sources(work,work/'public',work/'study.json')
            # Source roots are Human under the supplied Data root. An audit-only
            # edit must invalidate the watcher's version even outside Data.
            version=sources.version('human')
            with audit_path.open('ab') as stream:stream.write(b'changed')
            self.assertNotEqual(version,sources.version('human'))
            with self.assertRaisesRegex(ValueError,'audit binding mismatch'):bindings(root)


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
