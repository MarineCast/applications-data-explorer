"""Combined Coast Guard display preserves typed memberships and missingness."""
import copy
import datetime
import json
import tempfile
import unittest
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from coast_guard_input import ASSIGNMENT, COUNT, COMPONENTS, SOURCE_CONTEXT, combine_coast_guard
from governance_memberships import MEMBERSHIP_TYPE, extract_governance_memberships, decode_membership_payload
from governance_input import append_governance
from prepare_map import Exporter
from prepare_seascape import digest
from test_governance_memberships import record


def fixture():
    ca = {'feature_id': 'ccg_western_region:1', 'records': [record('ccg_western_region', '1', 'Western', None)]}
    us = {'feature_id': 'uscg_app_sectors:7', 'records': [record('uscg_app_sectors', '7', 'Sector Puget Sound', None)]}
    columns = {'h3_index': [h3.latlng_to_cell(lat, -123.5, 6) for lat in (48, 48.1, 48.2, 48.3, 48.4)]}
    fields = {'h3_index': {'definition': 'Native cell'}}
    for group, rows in zip(COMPONENTS, [[[ca], None, [], None, [ca]], [[us], None, [], None, None]]):
        col = group + '__feature_memberships_v1'; count = group + '__recorded_feature_count'
        states = ['partial', 'unknown', 'observed', 'unavailable', 'partial']
        columns.update({col: pa.array(rows, MEMBERSHIP_TYPE), col + '_status': states,
                        count: pa.array([len(row) if row is not None else None for row in rows], pa.int64()), count + '_status': states})
        fields.update({name: {'definition': 'Source support'} for name in (col, col + '_status', count, count + '_status')})
        fields[col].update(membership_schema_version=1, coverage_reference=group, count_field=count, missing_reason_field=col + '_status')
    return pa.table(columns), {'schema_version': 1, 'model_eligible': False, 'fields': fields,
                               'spatial': {'h3_resolution': 6}, 'temporal': {'type': 'static'}}


class CoastGuardInput(unittest.TestCase):
    def test_all_names_ids_overlap_null_empty_unavailable_and_component_arrays_survive(self):
        table, context = fixture(); original = copy.deepcopy(context)
        combined, meta = combine_coast_guard(table, context)
        scalar, payloads = extract_governance_memberships(combined, meta)
        payload = payloads[ASSIGNMENT]
        self.assertEqual(payload['counts'], [2, None, 0, None, 1])
        self.assertEqual(payload['statuses'], ['partial', 'unknown', 'observed', 'unavailable', 'partial'])
        self.assertEqual([r['feature_name'] for e in decode_membership_payload(payload)[0] for r in e['records']], ['Western', 'Sector Puget Sound'])
        self.assertEqual(meta['fields'][ASSIGNMENT]['source_context'], SOURCE_CONTEXT)
        for name in table.column_names: self.assertTrue(table[name].equals(combined[name]), name)
        self.assertEqual(context, original)
        replay, _ = combine_coast_guard(combined, meta)
        self.assertTrue(replay.equals(combined))
        missing = [name for name in table.column_names if name.startswith(COMPONENTS[1])]
        partial_table = table.drop(missing); partial_meta = {**context, 'fields': {k:v for k,v in context['fields'].items() if k not in missing}}
        result, meta = combine_coast_guard(partial_table, partial_meta)
        self.assertEqual(result[COUNT].to_pylist(), [1, None, None, None, 1])
        extract_governance_memberships(result, meta)
        corrupt = table.set_column(table.column_names.index(COMPONENTS[0] + '__recorded_feature_count'), COMPONENTS[0] + '__recorded_feature_count', pa.array([9, None, 0, None, 1], pa.int64()))
        result, meta = combine_coast_guard(corrupt, context)
        with self.assertRaises(ValueError): extract_governance_memberships(result, meta)

    def test_one_combined_choice_preserves_static_dynamic_slices_and_encoded_names(self):
        for dynamic, compact in ((False, False), (True, False), (False, True), (True, True)):
            with self.subTest(dynamic=dynamic, compact=compact), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp); source = root/'Governance'; source.mkdir(); output = root/'cache'; output.mkdir()
                table, context = fixture(); kind = 'dynamic' if dynamic else 'static'
                if compact:
                    table, context = combine_coast_guard(table, context)
                    removed = [name for name in table.column_names if any(name.startswith(group+'__') for group in COMPONENTS)]
                    table = table.drop(removed)
                    context = {**context, 'fields': {name: context['fields'][name] for name in table.column_names}}
                    context['fields'][ASSIGNMENT].update(definition='Derived Western over BC model-water support',
                        source_context={**SOURCE_CONTEXT, 'seascape_territorial_water_support': {'boundary_type': 'Derived Western assignment'}})
                if dynamic:
                    table = table.append_column('date', pa.array([datetime.date(2026, 10, 19)]*table.num_rows))
                    context['fields']['date'] = {'definition': 'Source date'}; context['temporal']['type'] = kind
                path = source/f'governance-r6-{kind}.parquet'
                pq.write_table(table.replace_schema_metadata({b'governance': json.dumps(context).encode()}), path)
                before = path.read_bytes()
                (source/'catalog.json').write_text(json.dumps({'schema_version':1, 'domain':'governance','last_updated_utc':'2026-10-19',
                    'tables':{'6':{kind:{'path':path.name,'rows':table.num_rows,'sha256':digest(path)}}}}))
                catalog = {'datasets':{}, 'products':{}, 'features':[]}
                append_governance(Exporter(output, 'fixture'), catalog, source)
                self.assertEqual([f['name'] for f in catalog['features']], ['Coast Guard Assignment'])
                expected = context['fields'][ASSIGNMENT] if compact else {'source_context': SOURCE_CONTEXT}
                self.assertEqual(catalog['features'][0]['sourceContext'], expected['source_context'])
                if compact: self.assertEqual(catalog['features'][0]['definition'], expected['definition'])
                self.assertEqual(path.read_bytes(), before)
                product = catalog['products']['governance-r6' + ('-dynamic' if dynamic else '')]
                if dynamic: product = product['slices']['2026-10-19']
                binding = product['memberships'][ASSIGNMENT]['asset']
                payload = json.loads((output/'assets'/(binding['sha256']+'.json')).read_text())
                self.assertEqual(payload['counts'], [2,None,0,None,1])
                for group in COMPONENTS:
                    if compact: self.assertNotIn(group+'__feature_memberships_v1', product['memberships'])
                    else: self.assertIn(group+'__feature_memberships_v1', product['memberships'])
