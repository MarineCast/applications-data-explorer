import copy
import json
from pathlib import Path
import tempfile
import unittest

import pyarrow as pa
import pyarrow.parquet as pq
from human_input import population_evidence_table, read_calendar
from prepare_seascape import digest


class HumanEvidenceTests(unittest.TestCase):
    def test_population_support_is_keyed_and_public_values_win(self):
        public = pa.table({'h3_index': ['a', 'b'], 'population_within_100km': [0., 42.]})
        audit = pa.table({'h3_index': ['b', 'a'], 'population_within_100km': [999., 888.],
                          'population_within_100km__coverage_status': ['complete', 'partial'],
                          'population_within_25km__coverage_status': ['partial', 'known_zero'],
                          'population_within_100km_collected__zero_imputed': [False, True],
                          'population_within_100km__missing_sources': ['[]', '["CA:missing"]'],
                          'unrelated': [1, 2]})
        result = population_evidence_table(public, audit)
        self.assertEqual(result['population_within_100km'].to_pylist(), [0., 42.])
        self.assertEqual(result['population_within_100km__coverage_status'].to_pylist(), ['partial', 'complete'])
        self.assertEqual(result['population_within_25km__coverage_status'].to_pylist(), ['known_zero', 'partial'])
        self.assertEqual(result['population_within_100km_collected__zero_imputed'].to_pylist(), [True, False])
        self.assertNotIn('unrelated', result.column_names)
        with self.assertRaisesRegex(ValueError, 'identity mismatch'):
            population_evidence_table(public, audit.take([0, 0]))

    def test_calendar_country_dates_dst_leap_and_binding(self):
        metadata = {'schema': 'human.study.calendar_lookup.v2',
                    'primary_key': ['date', 'country', 'timezone'],
                    'jurisdictions': [{'country': 'US', 'timezone': 'America/Los_Angeles'},
                                      {'country': 'CA', 'timezone': 'America/Vancouver'}],
                    'temporal_support': {'start': '2009-01-01', 'end_exclusive': '2027-01-01'}}
        rows = [{'date': day, 'country': country, 'timezone': zone, 'is_weekend': False,
                 'is_holiday': False, 'holiday_names': ''}
                for day in ['2009-01-01', '2024-02-29', '2026-03-08', '2026-11-01', '2026-12-31']
                for country, zone in [('US', 'America/Los_Angeles'), ('CA', 'America/Vancouver')]]
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            def write(values):
                path = root/'dynamic-calendar.parquet'
                pq.write_table(pa.Table.from_pylist(values).replace_schema_metadata({b'human_study': json.dumps(metadata).encode()}), path)
                return {**metadata, 'artifact': {'path': path.name, 'rows': len(values), 'sha256': digest(path)}}
            bound = write(rows)
            self.assertEqual(read_calendar(root, bound)['rows'], rows)
            for changes in [{'date': '2027-01-01'}, {'timezone': 'UTC'}, {'date': '2026-02-29'}]:
                invalid = copy.deepcopy(rows); invalid[0].update(changes)
                with self.assertRaises(ValueError):
                    read_calendar(root, write(invalid))
            with self.assertRaisesRegex(ValueError, 'identity mismatch'):
                read_calendar(root, write([rows[0], rows[0]]))
            bound = write(rows)
            with (root/'dynamic-calendar.parquet').open('ab') as stream:
                stream.write(b'changed')
            with self.assertRaisesRegex(ValueError, 'binding mismatch'):
                read_calendar(root, bound)
