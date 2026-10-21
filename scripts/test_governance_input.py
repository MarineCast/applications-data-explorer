"""Flat governance integration preserves native identity and source missingness."""
import json
import tempfile
import unittest
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from governance_input import append_governance, bindings
from prepare_map import Exporter
from prepare_seascape import digest, unpack


class GovernanceInput(unittest.TestCase):
    def test_memberships_static_and_dynamic_remain_separate_from_scalar_columns(self):
        from test_governance_memberships import fixture, COLUMN, COUNT
        import datetime
        for kind in ('static', 'dynamic'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                source = root / 'Governance'
                source.mkdir()
                table, context, values = fixture()
                table = table.set_column(0, 'h3_index', pa.array([h3.latlng_to_cell(lat, -123.5, 6) for lat in (48, 48.5, 49, 49.5)]))
                if kind == 'dynamic':
                    table = table.append_column('date', pa.array([datetime.date(2026, 10, 1)] * 4))
                    context['fields']['date'] = {}
                context.update(spatial={'h3_resolution': 6}, temporal={'type': kind})
                for entry in context['fields'].values(): entry['definition'] = 'Exact fixture field'
                name = f'governance-r6-{kind}.parquet'
                path = source / name
                pq.write_table(table.replace_schema_metadata({b'governance': json.dumps(context).encode()}), path)
                (source / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'domain': 'governance', 'last_updated_utc': '2026-10-14T00:00:00Z',
                    'tables': {'6': {kind: {'path': name, 'rows': 4, 'sha256': digest(path)}}}}))
                staging = root / 'cache'
                staging.mkdir()
                catalog = {'datasets': {}, 'products': {}, 'features': []}
                append_governance(Exporter(staging, 'fixture'), catalog, source)
                product = catalog['products']['governance-r6' + ('-dynamic' if kind == 'dynamic' else '')]
                if kind == 'dynamic': product = product['slices']['2026-10-01']
                self.assertNotIn(COLUMN, product['columns'])
                self.assertIn(COUNT, product['columns'])
                binding = product['memberships'][COLUMN]
                payload = json.loads((staging / 'assets' / (binding['asset']['sha256'] + '.json')).read_text())
                from governance_memberships import decode_membership_payload
                self.assertEqual(decode_membership_payload(payload), values)
                self.assertEqual(binding['rows'], product['rows'])
                identity = next(f for f in catalog['features'] if f.get('membershipColumn') == COLUMN)
                self.assertEqual(identity['kind'], 'categorical')
                self.assertEqual(identity['qualifiers'], [COUNT, COLUMN + '_status'])

    def test_reads_flat_catalog_and_rejects_changed_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'Governance'
            source.mkdir()
            cells = [h3.latlng_to_cell(lat, -123.5, 6) for lat in (48.5, 49.5)]
            context = {'schema_version': 1, 'model_eligible': False, 'spatial': {'h3_resolution': 6},
                       'temporal': {'type': 'static'}, 'fields': {
                           'h3_index': {'definition': 'H3 identity'},
                           'areas__count': {'definition': 'Recorded count', 'units': 'count', 'missing_reason_field': 'areas__count_status'},
                           'areas__count_status': {'definition': 'Source support status'}}}
            table = pa.table({'h3_index': cells, 'areas__count': [0, None], 'areas__count_status': ['observed', 'unknown']})
            name = 'governance-r6-static.parquet'
            path = source / name
            pq.write_table(table.replace_schema_metadata({b'governance': json.dumps(context).encode()}), path)
            (source / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'domain': 'governance', 'last_updated_utc': '2026-10-14T00:00:00Z',
                'tables': {'6': {'static': {'path': name, 'rows': 2, 'sha256': digest(path)}}}}))
            staging = root / 'cache'
            staging.mkdir()
            catalog = {'datasets': {}, 'products': {}, 'features': []}
            append_governance(Exporter(staging, 'fixture'), catalog, source)
            product = catalog['products']['governance-r6']
            value_path = staging / 'assets' / (product['columns']['areas__count']['sha256'] + '.json')
            self.assertEqual(unpack(json.loads(value_path.read_text())), [0, None])
            field = next(f for f in catalog['features'] if f['column'] == 'areas__count')
            self.assertEqual(field['qualifiers'], ['areas__count_status'])
            self.assertEqual(field['sourceRelease'], 'current')
            with path.open('ab') as stream:
                stream.write(b'changed')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                bindings(source)

class GovernanceCacheUpdate(unittest.TestCase):
    def test_updates_only_governance_and_verifies_reused_assets(self):
        from governance_input import prepare_existing
        from test_governance_memberships import fixture, COLUMN
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'Governance'; source.mkdir()
            table, context, _ = fixture()
            table = table.set_column(0, 'h3_index', pa.array([h3.latlng_to_cell(lat, -123.5, 6) for lat in (48, 48.5, 49, 49.5)]))
            context.update(spatial={'h3_resolution': 6}, temporal={'type': 'static'})
            for entry in context['fields'].values(): entry['definition'] = 'Exact fixture field'
            path = source / 'governance-r6-static.parquet'
            pq.write_table(table.replace_schema_metadata({b'governance': json.dumps(context).encode()}), path)
            (source / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'domain': 'governance', 'last_updated_utc': '2026-10-14T00:00:00Z',
                'tables': {'6': {'static': {'path': path.name, 'rows': 4, 'sha256': digest(path)}}}}))
            output = root / 'cache'; output.mkdir()
            asset = output / 'existing.json'; asset.write_text('{"original":true}')
            binding = {'url': '/local-data/seascape/existing.json', 'sha256': digest(asset)}
            original = {'rows': 1, 'cells': binding, 'columns': {'original': binding}}
            base = {'version': 2, 'datasets': {}, 'features': [], 'products': {'human-r7': original, 'seascape-r6': original}}
            catalog_path = output / 'catalog.json'; catalog_path.write_text(json.dumps(base))
            prepare_existing(source, output)
            current = json.loads(catalog_path.read_text())
            self.assertEqual(current['products']['human-r7'], original)
            self.assertEqual(current['products']['seascape-r6'], original)
            self.assertEqual(asset.read_text(), '{"original":true}')
            membership = current['products']['governance-r6']['memberships'][COLUMN]['asset']
            member_path = output / membership['url'].removeprefix('/local-data/seascape/')
            self.assertEqual(digest(member_path), membership['sha256'])
            member_path.write_text('corrupt')
            before = catalog_path.read_bytes()
            with self.assertRaisesRegex(ValueError, 'Existing map asset checksum mismatch'):
                prepare_existing(source, output)
            self.assertEqual(catalog_path.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()


class WildlifeRefugeInterface(unittest.TestCase):
    def test_retained_overlaps_fraction_and_support_with_exactly_three_choices(self):
        from test_governance_memberships import fixture, GROUP
        from governance_input import wildlife_refuge_features
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); source = root / 'Governance'; source.mkdir()
            table, context, values = fixture()
            renamed = [name.replace(GROUP, 'wildlife_refuges') for name in table.column_names]
            table = table.rename_columns(renamed)
            context['fields'] = {name.replace(GROUP, 'wildlife_refuges'): {k: v.replace(GROUP, 'wildlife_refuges') if isinstance(v, str) else v for k, v in entry.items()} for name, entry in context['fields'].items()}
            for entry in context['fields'].values(): entry['definition'] = 'Retained fixture'
            count = 'wildlife_refuges__recorded_feature_count'
            context['fields'][count]['units'] = 'count'
            coverage = 'wildlife_refuges__recorded_polygon_union_area_fraction'
            table = table.append_column(coverage, pa.array([.425, None, 0., 1.]))
            table = table.append_column(coverage + '_status', table[count + '_status'])
            context['fields'][coverage] = {'definition': 'Union / full H3 cell area', 'units': '1', 'missing_reason_field': coverage + '_status'}
            context['fields'][coverage + '_status'] = {'definition': 'Support'}
            table = table.set_column(0, 'h3_index', pa.array([h3.latlng_to_cell(lat, -123.5, 6) for lat in (48, 48.5, 49, 49.5)]))
            context.update(spatial={'h3_resolution': 6}, temporal={'type': 'static'})
            path = source / 'governance-r6-static.parquet'
            pq.write_table(table.replace_schema_metadata({b'governance': json.dumps(context).encode()}), path)
            (source / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'domain': 'governance', 'last_updated_utc': '2026-10-18T00:00:00Z', 'tables': {'6': {'static': {'path': path.name, 'rows': 4, 'sha256': digest(path)}}}}))
            cache = root / 'cache'; cache.mkdir()
            catalog = {'datasets': {}, 'products': {}, 'features': []}
            append_governance(Exporter(cache, 'fixture'), catalog, source)
            self.assertEqual({f['name'] for f in catalog['features']}, {'Wildlife Refuge Count', 'Wildlife Refuge Assignment', 'Wildlife Refuge Coverage'})
            self.assertEqual(len(catalog['features']), 3)
            product = catalog['products']['governance-r6']
            binding = product['columns'][coverage]
            self.assertEqual(unpack(json.loads((cache / 'assets' / (binding['sha256'] + '.json')).read_text())), [.425, None, 0., 1.])
            self.assertIn(coverage + '_status', product['columns'])
            from governance_memberships import decode_membership_payload
            binding = product['memberships']['wildlife_refuges__feature_memberships_v1']['asset']
            self.assertEqual(decode_membership_payload(json.loads((cache / 'assets' / (binding['sha256'] + '.json')).read_text())), values)
            other = {'column': 'ports__recorded_feature_count', 'name': 'Unchanged'}
            self.assertIs(wildlife_refuge_features([other])[0], other)


class TribalInterface(unittest.TestCase):
    def test_two_choices_boolean_nulls_all_country_memberships_and_retained_support(self):
        from test_governance_memberships import RECORD_FIELDS, MEMBERSHIP_TYPE, record
        prefix='tribal_first_nations_areas__'; column=prefix+'feature_memberships_v1'; count=prefix+'recorded_feature_count'; area=prefix+'mapped_area'
        entries=[{'feature_id':source+':area:001','records':[record(source,source+':record:01','Same name',None)]} for source in ('bia_administrative_lar','nrcan_indian_reserves')]
        states=['partial','unknown','observed']; values=[entries,None,[]]
        cells=[h3.latlng_to_cell(lat,-123.5,6) for lat in (48,48.5,49)]
        table=pa.table({'h3_index':cells,area:pa.array([True,None,False],pa.bool_()),area+'_status':states,
            count:pa.array([2,None,0],pa.int64()),count+'_status':states,column:pa.array(values,MEMBERSHIP_TYPE),column+'_status':states,
            prefix+'bia_land_area_reference__recorded_feature_count':pa.array([1,None,None],pa.int64())})
        context={'schema_version':1,'model_eligible':False,'spatial':{'h3_resolution':6},'temporal':{'type':'static'},'fields':{n:{'definition':'Mapped administrative references; unknown is not false'} for n in table.column_names}}
        context['fields'][column].update(membership_schema_version=1,count_field=count,missing_reason_field=column+'_status',coverage_reference='tribal_first_nations_areas',source_context={'bia_administrative_lar':{'country':'United States','agency':'BIA','boundary_type':'BIA land-area reference'}})
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/'Governance';source.mkdir();output=root/'cache';output.mkdir()
            path=source/'governance-r6-static.parquet';pq.write_table(table.replace_schema_metadata({b'governance':json.dumps(context).encode()}),path)
            (source/'catalog.json').write_text(json.dumps({'schema_version':1,'domain':'governance','last_updated_utc':'2026-10-18','tables':{'6':{'static':{'path':path.name,'rows':3,'sha256':digest(path)}}}}))
            catalog={'datasets':{},'products':{},'features':[]};append_governance(Exporter(output,'fixture'),catalog,source)
            self.assertEqual([f['name'] for f in catalog['features']],['Tribal / First Nations Area','Tribal / First Nations Assignment'])
            boolean=catalog['features'][0];self.assertEqual(boolean['categories'],[False,True]);self.assertEqual(boolean['kind'],'categorical');self.assertEqual(boolean['available'],2)
            self.assertEqual(catalog['features'][1]['sourceContext']['bia_administrative_lar']['country'],'United States')
            product=catalog['products']['governance-r6'];self.assertIn(count,product['columns']);self.assertIn(prefix+'bia_land_area_reference__recorded_feature_count',product['columns'])
            asset=product['memberships'][column]['asset'];payload=json.loads((output/'assets'/(asset['sha256']+'.json')).read_text())
            self.assertEqual(payload['counts'],[2,None,0]);self.assertEqual(len(payload['indices'][0]),2)
            self.assertEqual([entry['feature_id'] for entry in payload['dictionary']],[s+':area:001' for s in ('bia_administrative_lar','nrcan_indian_reserves')])


class WaterAssignments(unittest.TestCase):
    def test_exactly_one_water_feature_per_family_and_support_records_retained(self):
        from governance_input import water_features, WATER_FEATURES
        features=[{'column':column} for family in ('state_provincial_waters','federal_waters') for column in [family+'__recorded_feature_count',family+'__feature_memberships_v1',family+'__recorded_line_union_length_m_status',family+'__assignment__feature_memberships_v1',*(['federal_waters__international_boundary'] if family=='federal_waters' else [])]]
        other={'column':'wildlife_refuges__recorded_feature_count'}
        result=water_features([*features,other])
        self.assertEqual([f['column'] for f in result[:-1]],list(WATER_FEATURES))
        self.assertEqual([f['name'] for f in result[:-1]],list(WATER_FEATURES.values()))
        self.assertIs(result[-1],other)
        self.assertEqual(len(features),9)


class InternationalBoundaryInterface(unittest.TestCase):
    def test_moves_boundary_boolean_to_federal_and_retains_hidden_original_and_line_memberships(self):
        from test_governance_memberships import fixture, GROUP
        from governance_input import water_features
        table,context,values=fixture()
        table=table.rename_columns([n.replace(GROUP,'international_boundaries') for n in table.column_names])
        context['fields']={n.replace(GROUP,'international_boundaries'):{k:v.replace(GROUP,'international_boundaries') if isinstance(v,str) else v for k,v in e.items()} for n,e in context['fields'].items()}
        original='international_boundaries__feature_memberships_v1'
        for group in ['federal_waters__assignment','federal_waters__international_boundary']:
            for suffix in ['feature_memberships_v1','feature_memberships_v1_status','recorded_feature_count','recorded_feature_count_status']:
                src='international_boundaries__'+suffix;dst=group+'__'+suffix
                table=table.append_column(dst,table[src])
                context['fields'][dst]={k:v.replace('international_boundaries',group) if isinstance(v,str) else v for k,v in context['fields'][src].items()}
        column='federal_waters__international_boundary'
        table=table.append_column(column,pa.array([True,None,False,True],pa.bool_()))
        table=table.append_column(column+'_status',table[original+'_status'])
        context['fields'][column]={'definition':'Full closed cell intersects actual border line; false requires complete support','units':'1','support_membership_column':column+'__feature_memberships_v1','support_limitation':'Partial inventory: no-hit remains unknown'}
        context['fields'][column+'_status']={'definition':'Support'}
        table=table.set_column(0,'h3_index',pa.array([h3.latlng_to_cell(lat,-123.5,6) for lat in (48,48.5,49,49.5)]))
        context.update(spatial={'h3_resolution':6},temporal={'type':'static'})
        for field in context['fields'].values():field.setdefault('definition','Fixture')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/'Governance';source.mkdir();output=root/'cache';output.mkdir()
            path=source/'governance-r6-static.parquet';pq.write_table(table.replace_schema_metadata({b'governance':json.dumps(context).encode()}),path)
            (source/'catalog.json').write_text(json.dumps({'schema_version':1,'domain':'governance','last_updated_utc':'2026-10-18','tables':{'6':{'static':{'path':path.name,'rows':4,'sha256':digest(path)}}}}))
            catalog={'datasets':{},'products':{},'features':[]};append_governance(Exporter(output,'fixture'),catalog,source)
            self.assertEqual({f['name'] for f in catalog['features']},{'International Boundary','Country Assignment'})
            field=next(f for f in catalog['features'] if f['column']==column)
            self.assertEqual(field['categories'],[False,True]);self.assertEqual(field['supportMembershipColumn'],column+'__feature_memberships_v1')
            product=catalog['products']['governance-r6']
            for name in [original,column+'__feature_memberships_v1','federal_waters__assignment__feature_memberships_v1']:self.assertIn(name,product['memberships'])
            asset=product['columns'][column];self.assertEqual(unpack(json.loads((output/'assets'/(asset['sha256']+'.json')).read_text())),[True,None,False,True])


class RegionalBoundariesInterface(unittest.TestCase):
    def test_compact_two_field_parquet_exports_all_names_and_browser_support(self):
        from test_governance_memberships import MEMBERSHIP_TYPE, record
        from governance_memberships import decode_membership_payload, extract_governance_memberships
        import copy
        group = 'county_regional_boundaries'; column = group + '__feature_memberships_v1'; count = group + '__recorded_feature_count'
        values = [[{'feature_id': dataset + ':257', 'records': [record(dataset, '257', name, None)]}
                   for dataset, name in [('bc_abms_regional_districts', 'Capital Regional District'), ('census_counties_2025', 'San Juan County')]], None]
        table = pa.table({'h3_index': [h3.latlng_to_cell(lat, -123.5, 6) for lat in (48.5, 49)],
                          count: pa.array([2, None], pa.int64()), column: pa.array(values, MEMBERSHIP_TYPE)})
        support = {'implicit_support': 'positive_partial_null_unknown_v1', 'implicit_null_status': 'unknown'}
        context = {'schema_version': 1, 'model_eligible': False, 'spatial': {'h3_resolution': 6}, 'temporal': {'type': 'static'},
                   'fields': {name: {'definition': 'Full closed cell touches retained polygons'} for name in table.column_names}}
        context['fields'][count].update(support, units='count')
        context['fields'][column].update(support, membership_schema_version=1, count_field=count, coverage_reference=group)
        for change in ('count', 'status'):
            wrong = copy.deepcopy(context)
            if change == 'count': wrong['fields'][count]['implicit_null_status'] = 'unavailable'
            else: wrong['fields'][column]['implicit_null_status'] = 'observed'
            with self.assertRaises(ValueError): extract_governance_memberships(table, wrong)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root / 'Governance'; source.mkdir(); cache = root / 'cache'; cache.mkdir()
            path = source / 'governance-r6-static.parquet'
            pq.write_table(table.replace_schema_metadata({b'governance': json.dumps(context).encode()}), path)
            (source / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'domain': 'governance', 'last_updated_utc': '2026-10-19',
                'tables': {'6': {'static': {'path': path.name, 'rows': 2, 'sha256': digest(path)}}}}))
            catalog = {'datasets': {}, 'products': {}, 'features': []}
            append_governance(Exporter(cache, 'fixture'), catalog, source)
            self.assertEqual({field['name'] for field in catalog['features']}, {'County / District Count', 'County / District Assignment'})
            self.assertEqual({field['family'] for field in catalog['features']}, {'Administrative Boundaries'})
            product = catalog['products']['governance-r6']; binding = product['memberships'][column]['asset']
            payload = json.loads((cache / 'assets' / (binding['sha256'] + '.json')).read_text())
            self.assertEqual(decode_membership_payload(payload), values)
            self.assertEqual(payload['statuses'], ['partial', 'unknown'])
            self.assertEqual(pq.read_schema(path).names, ['h3_index', count, column])


class ManagementAreasInterface(unittest.TestCase):
    def test_two_column_product_preserves_memberships_and_metadata_support(self):
        from test_governance_memberships import fixture, COLUMN, COUNT
        from governance_memberships import decode_membership_payload, extract_governance_memberships
        import copy
        table, context, values = fixture()
        # Preserve partial null support; verified empty support is tested separately.
        table = table.take(pa.array([0, 1, 3]))
        values = [values[i] for i in [0, 1, 3]]
        table = table.drop([COUNT + '_status', COLUMN + '_status'])
        table = table.set_column(0, 'h3_index', pa.array([h3.latlng_to_cell(lat, -123.5, 6) for lat in (48, 48.5, 49)]))
        context['fields'] = {name: {'definition': 'Original field definition'} for name in table.column_names}
        support = {'implicit_support': 'uniform_count_membership_support_v1', 'implicit_status': 'partial'}
        context['fields'][COUNT].update(support, units='count')
        context['fields'][COLUMN].update(support, membership_schema_version=1, count_field=COUNT, coverage_reference='management_areas')
        context.update(spatial={'h3_resolution': 6}, temporal={'type': 'static'})
        wrong = copy.deepcopy(context); wrong['fields'][COUNT]['implicit_status'] = 'unknown'
        with self.assertRaises(ValueError): extract_governance_memberships(table, wrong)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root / 'Governance'; source.mkdir(); cache = root / 'cache'; cache.mkdir()
            path = source / 'governance-r6-static.parquet'
            pq.write_table(table.replace_schema_metadata({b'governance': json.dumps(context).encode()}), path)
            (source / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'domain': 'governance', 'last_updated_utc': '2026-10-19',
                'tables': {'6': {'static': {'path': path.name, 'rows': 3, 'sha256': digest(path)}}}}))
            catalog = {'datasets': {}, 'products': {}, 'features': []}
            append_governance(Exporter(cache, 'fixture'), catalog, source)
            self.assertEqual({field['name'] for field in catalog['features']}, {'Management Area Count', 'Management Area'})
            self.assertEqual({field['family'] for field in catalog['features']}, {'Fisheries Management Areas'})
            count_feature = next(field for field in catalog['features'] if field['column'] == COUNT)
            self.assertEqual(count_feature['qualifiers'], [COUNT + '_status'])
            product = catalog['products']['governance-r6']; binding = product['memberships'][COLUMN]['asset']
            payload = json.loads((cache / 'assets' / (binding['sha256'] + '.json')).read_text())
            self.assertEqual(decode_membership_payload(payload), values)
            self.assertEqual(payload['statuses'], ['partial'] * 3)
            self.assertEqual(pq.read_schema(path).names, ['h3_index', COUNT, COLUMN])


class AdministrativeBoundaryGrouping(unittest.TestCase):
    def test_combines_five_existing_features_without_changing_native_fields(self):
        from governance_input import REGIONAL_FEATURES, WATER_FEATURES, administrative_features, regional_features, water_features
        columns = [*REGIONAL_FEATURES, *WATER_FEATURES]
        features = [{'id': 'GOVERNANCE__' + column, 'column': column, 'definition': 'retained semantics'} for column in columns]
        other = {'id': 'port', 'column': 'ports__recorded_feature_count', 'family': 'Ports'}
        result = administrative_features(regional_features(water_features([*features, other])))
        self.assertEqual([field['column'] for field in result[:-1]], columns)
        self.assertEqual({field['family'] for field in result[:-1]}, {'Administrative Boundaries'})
        for field in result[:-1]:
            self.assertEqual(field['id'], 'GOVERNANCE__' + field['column'])
            self.assertEqual(field['definition'], 'retained semantics')
        self.assertIs(result[-1], other)


class ConservationFeatureTest(unittest.TestCase):
    def test_conservation_is_exactly_three_core_choices_and_separate_references(self):
        from governance_input import conservation_features, CONSERVATION_FEATURES, CONSERVATION_REFERENCE
        columns=[*CONSERVATION_FEATURES, CONSERVATION_REFERENCE+'__feature_memberships_v1',
                 'wildlife_refuges__recorded_feature_count', 'marine_protected_areas__recorded_feature_count',
                 'conservation_designations__reported_pa_designated__recorded_feature_count',
                 'national_marine_sanctuaries__feature_memberships_v1', 'marine_conservation_areas__recorded_feature_count_status']
        fields=[{'column':c,'name':'Old','membershipColumn':c if c.endswith('__feature_memberships_v1') else None} for c in columns]
        actual=conservation_features(fields)
        self.assertEqual([f['name'] for f in actual if f['family']=='Marine Conservation Areas'],list(CONSERVATION_FEATURES.values()))
        self.assertEqual(len(actual),4)
        self.assertEqual(actual[-1]['family'],'Proposed / Interim Conservation References')


class VesselRoutingPresentation(unittest.TestCase):
    def test_keeps_identities_and_one_boolean_with_original_qualifications(self):
        from governance_input import vessel_routing_features, VESSEL_ROUTING_RECORDED
        columns=['shipping_lanes__line_length','traffic_separation_schemes__chs_lane_part__feature_memberships_v1','speed_restriction_zones__coverage',VESSEL_ROUTING_RECORDED]
        features=[{'column':c,'id':'GOVERNANCE__'+c,'family':'Original','definition':'original source role','qualifiers':['original_status'],'membershipColumn':c if c.endswith('__feature_memberships_v1') else None} for c in columns]
        result=vessel_routing_features(features)
        self.assertEqual([f['column'] for f in result],[columns[1],VESSEL_ROUTING_RECORDED])
        self.assertEqual(result[0]['membershipColumn'],columns[1])
        self.assertTrue(all(f['definition']=='original source role' and f['qualifiers']==['original_status'] for f in result))
        self.assertEqual(result[1]['categories'],[False,True])


class TribalAdministrativeGrouping(unittest.TestCase):
    def test_preserves_both_approved_tribal_features_and_existing_administrative_choices(self):
        from governance_input import administrative_features,TRIBAL_FEATURES
        features=[{'column':column,'id':'GOVERNANCE__'+column,'family':'Original','definition':'BIA land areas / NRCan reserve administrative geometry; not traditional territory','sourceContext':{'bia':'land area','nrcan':'reserve'}} for column in [*TRIBAL_FEATURES,'county_regional_boundaries__recorded_feature_count','federal_waters__assignment__feature_memberships_v1','federal_waters__international_boundary','state_provincial_waters__assignment__feature_memberships_v1']]
        import copy
        before=copy.deepcopy(features)
        self.assertEqual(administrative_features(features),[{**f,'family':'Administrative Boundaries'} for f in before])


class CriticalHabitatPresentation(unittest.TestCase):
    def test_exactly_count_and_assignment_retains_country_qualifications_and_all_bindings(self):
        import copy
        from governance_input import critical_habitat_features,HABITAT_FEATURES
        columns=[*HABITAT_FEATURES,'critical_habitat__recorded_line_union_length_m','critical_habitat__recorded_polygon_union_area_fraction','critical_habitat__recorded_point_feature_count','critical_habitat__recorded_feature_count_status']
        fields=[{'column':c,'id':'GOVERNANCE__'+c,'membershipColumn':c if c.endswith('__feature_memberships_v1') else None,'definition':'Source IDs, not species counts','sourceContext':{'synthetic_us':{'country':'United States'},'synthetic_ca':{'country':'Canada'}},'qualifiers':['original_status']} for c in columns]
        expected=copy.deepcopy(fields[:2]);actual=critical_habitat_features(fields)
        self.assertEqual([f['name'] for f in actual],list(HABITAT_FEATURES.values()))
        for before,after in zip(expected,actual):
            for key in ('id','column','membershipColumn','definition','sourceContext','qualifiers'):self.assertEqual(before[key],after[key])
