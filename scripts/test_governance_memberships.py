"""Consumer boundary checks for the frozen producer membership contract."""
import copy
import json
from pathlib import Path
import unittest

import pyarrow as pa

from governance_memberships import (
    MEMBERSHIP_TYPE, RECORD_FIELDS, decode_membership_payload, extract_governance_memberships,
)

GROUP = 'management_areas'
COLUMN = GROUP + '__feature_memberships_v1'
COUNT = GROUP + '__recorded_feature_count'


def record(dataset='wdfw', source='19', name='San Juan Islands', code='7', parts=None):
    result = dict.fromkeys(RECORD_FIELDS)
    result.update(source_dataset_id=dataset, source_feature_id=source, feature_name=name,
                  feature_type='marine_area', authority=dataset.upper(), area_system_id=dataset + '.marine',
                  area_code=code, geometry_part_ids=parts or ['part-a', 'part-b'])
    return result


def fixture():
    dfo = {'feature_id': 'dfo:21-0', 'records': [record('dfo', 'zero', None, '21-0', ['part-c'])]}
    wdfw = {'feature_id': 'wdfw:7', 'records': [record()]}
    values = [[dfo, wdfw], None, [], [wdfw]]
    statuses = ['partial', 'unknown', 'observed', 'partial']
    table = pa.table({
        'h3_index': ['cell-a', 'cell-b', 'cell-c', 'cell-d'],
        COUNT: pa.array([2, None, 0, 1], pa.int64()), COUNT + '_status': statuses,
        COLUMN: pa.array(values, MEMBERSHIP_TYPE), COLUMN + '_status': statuses,
    })
    metadata = {'schema_version': 1, 'model_eligible': False, 'fields': {
        name: {} for name in table.column_names
    }}
    metadata['fields'][COLUMN] = {
        'membership_schema_version': 1, 'count_field': COUNT,
        'missing_reason_field': COLUMN + '_status', 'coverage_reference': GROUP,
    }
    return table, metadata, values


class GovernanceMemberships(unittest.TestCase):
    def test_roundtrip_reconciles_counts_and_keeps_scalar_columns(self):
        table, context, values = fixture()
        scalar, payloads = extract_governance_memberships(table, context)
        self.assertEqual(scalar.column_names, [n for n in table.column_names if n != COLUMN])
        for column in scalar.column_names:
            self.assertTrue(scalar[column].equals(table[column]))
        payload = payloads[COLUMN]
        self.assertEqual(decode_membership_payload(payload), values)
        self.assertEqual(payload['indices'], [[0, 1], None, [], [1]])
        self.assertEqual(payload['dictionary'][0]['records'][0]['area_code'], '21-0')
        self.assertIsNone(payload['dictionary'][0]['records'][0]['feature_name'])
        self.assertEqual(payload['dictionary'][1]['records'][0]['geometry_part_ids'], ['part-a', 'part-b'])
        self.assertEqual(payload['dictionary'][1]['records'][0]['region'], None)
        fixture_path = Path(__file__).parents[1] / 'src/data/governanceMemberships.fixture.json'
        self.assertEqual(json.loads(fixture_path.read_text()), payload)

    def test_legacy_scalar_table_passes_through_without_fake_memberships(self):
        table, context, _ = fixture()
        table = table.drop([COLUMN, COLUMN + '_status'])
        context['fields'] = {n: {} for n in table.column_names}
        scalar, payloads = extract_governance_memberships(table, context)
        self.assertIs(scalar, table)
        self.assertEqual(payloads, {})

    def test_rejects_unsupported_contracts_and_nested_columns(self):
        for modification in ('version', 'missing_advertisement', 'count_binding', 'status_binding', 'undeclared'):
            with self.subTest(modification=modification):
                table, context, _ = fixture()
                if modification == 'version': context['fields'][COLUMN]['membership_schema_version'] = 2
                if modification == 'missing_advertisement': context['fields'][COLUMN] = {}
                if modification == 'count_binding': context['fields'][COLUMN]['count_field'] = 'another_count'
                if modification == 'status_binding': context['fields'][COLUMN]['missing_reason_field'] = 'another_status'
                if modification == 'undeclared': del context['fields'][COLUMN]
                with self.assertRaisesRegex(ValueError, 'Governance memberships'):
                    extract_governance_memberships(table, context)
        table, context, values = fixture()
        loose_type = pa.list_(pa.struct([pa.field('feature_id', pa.string()), pa.field('records', MEMBERSHIP_TYPE.value_type.field('records').type)]))
        table = table.set_column(table.column_names.index(COLUMN), COLUMN, pa.array(values, loose_type))
        with self.assertRaisesRegex(ValueError, 'contract'):
            extract_governance_memberships(table, context)

    def test_rejects_count_status_and_null_empty_corruption(self):
        for field, values in [
            (COUNT, [3, None, 0, 1]), (COUNT, [2, 0, 0, 1]),
            (COLUMN + '_status', ['partial', 'unknown', 'partial', 'partial']),
            (COUNT + '_status', ['observed', 'unknown', 'observed', 'partial']),
            (COLUMN + '_status', ['invented', 'unknown', 'observed', 'partial']),
        ]:
            with self.subTest(field=field, values=values):
                table, context, _ = fixture()
                table = table.set_column(table.column_names.index(field), field, pa.array(values, table[field].type))
                with self.assertRaisesRegex(ValueError, 'support|count'):
                    extract_governance_memberships(table, context)

    def test_rejects_unpaired_or_duplicated_identities_and_parts(self):
        for modification in ('duplicate_feature', 'feature_order', 'empty_records', 'missing_source', 'duplicate_record', 'duplicate_part', 'part_order'):
            with self.subTest(modification=modification):
                table, context, values = fixture()
                values = copy.deepcopy(values)
                entry = values[0][1]
                if modification == 'duplicate_feature': values[0][0] = copy.deepcopy(entry)
                if modification == 'feature_order': values[0].reverse()
                if modification == 'empty_records': entry['records'] = []
                if modification == 'missing_source': entry['records'][0]['source_dataset_id'] = ''
                if modification == 'duplicate_record': entry['records'].append(copy.deepcopy(entry['records'][0]))
                if modification == 'duplicate_part': entry['records'][0]['geometry_part_ids'] = ['p', 'p']
                if modification == 'part_order': entry['records'][0]['geometry_part_ids'] = ['z', 'a']
                table = table.set_column(table.column_names.index(COLUMN), COLUMN, pa.array(values, MEMBERSHIP_TYPE))
                with self.assertRaisesRegex(ValueError, 'Governance memberships'):
                    extract_governance_memberships(table, context)


if __name__ == '__main__':
    unittest.main()
