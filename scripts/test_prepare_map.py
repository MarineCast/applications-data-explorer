"""Consumer export checks; fixtures do not qualify regional source products."""
import json
import tempfile
from datetime import date
import unittest
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from prepare_map import Exporter, validate_table, verify_files
from prepare_seascape import unpack


class NativeMapExport(unittest.TestCase):
    def test_depth_units_require_declared_source_convention(self):
        from prepare_flat_map import measurement_metadata
        entry = {'source_column': 'BATHYMETRY', 'source_release': 'depth-v1'}
        context = {'source_context': {'depth-v1': {'manifest.json': {'scientific_methods': {
            'output_sign': 'positive_down metres; no transformation',
            'depth_summary_fields': ['BATHYMETRY', 'BATHYMETRY_PIXEL_COUNT']}}}}}
        self.assertEqual(measurement_metadata({}, entry), {'unit': 'Units unavailable'})
        verified = measurement_metadata(context, entry)
        self.assertEqual(verified['unit'], 'm')
        self.assertEqual(verified['measurement']['positiveDirection'], 'down')
        self.assertEqual(measurement_metadata(context, {**entry, 'source_column': 'BATHYMETRY_PIXEL_COUNT'}), {'unit': 'Units unavailable'})
        self.assertEqual(measurement_metadata(context, {**entry, 'source_release': 'unbound'}), {'unit': 'Units unavailable'})

    def test_native_period_dates_survive_json_as_lossless_iso_support(self):
        from datetime import datetime, timezone
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            table = pa.table({'H3_INDEX': [h3.latlng_to_cell(48.5, -123.5, 6)],
                'COUNT': [0.], 'source_period_start': [date(2020, 1, 1)],
                'retrieved_at': [datetime(2026, 10, 17, 12, 1, 2, 123456, tzinfo=timezone.utc)],
                'source_period_end': pa.array([None], type=pa.date32())})
            product, features = Exporter(root, 'fixture').table(table, 6, 'H3_INDEX',
                {'sha256':'test', 'path':'source.parquet', 'release':'test'},
                {name:{} for name in table.column_names}, 'seascape', 'r6')
            self.assertEqual([f['column'] for f in features], ['COUNT'])
            for name, expected in [('source_period_start', ['2020-01-01']),
                    ('retrieved_at', ['2026-10-17T12:01:02.123456+00:00']), ('source_period_end', [None])]:
                self.assertEqual(unpack(json.loads((root/'assets'/(product['columns'][name]['sha256']+'.json')).read_text())), expected)

    def test_identity_requires_one_native_cell_per_slice(self):
        cell = h3.latlng_to_cell(48.5, -123.5, 6)
        duplicate = pa.table({'H3_INDEX': [cell, cell], 'H3_RESOLUTION': [6, 6]})
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            validate_table(duplicate, 6, 'H3_INDEX')
        with self.assertRaisesRegex(ValueError, 'resolution'):
            validate_table(duplicate.slice(0, 1), 8, 'H3_INDEX')

    def test_exact_zero_null_categories_and_source_quality(self):
        ids = [h3.latlng_to_cell(lat, -123.5, 6) for lat in [48.5, 49.5]]
        table = pa.table({'H3_INDEX': ids, 'H3_RESOLUTION': [6, 6],
                          'BED_AREA_M2': [0.0, None], 'TERRAIN_FORM_PROXY': ['valley', None],
                          'POSITIVE_EVIDENCE': [False, None], 'STATUS': ['partial', 'unknown'],
                          'BATHYMETRY__R6_PARENT': ids})
        entries = {n: {'qualifiers': ['STATUS']} for n in table.column_names}
        with tempfile.TemporaryDirectory() as tmp:
            exporter = Exporter(Path(tmp), 'fixture')
            product, features = exporter.table(table, 6, 'H3_INDEX',
                {'sha256': 'fixture', 'path': 'input.parquet', 'release': 'test'}, entries, 'seascape', 'seascape-r6')
            def values(name):
                binding = product['columns'][name]
                return unpack(json.loads((Path(tmp) / 'assets' / (binding['sha256'] + '.json')).read_text()))
            self.assertEqual(values('BED_AREA_M2'), [0.0, None])
            self.assertEqual(values('POSITIVE_EVIDENCE'), [False, None])
            category = next(f for f in features if f['id'] == 'TERRAIN_FORM_PROXY')
            self.assertEqual(category['categories'], ['valley'])
            self.assertEqual(category['qualifiers'], ['STATUS'])
            self.assertEqual(category['kind'], 'categorical')
            self.assertNotIn('BATHYMETRY__R6_PARENT', [f['id'] for f in features])
            self.assertEqual(values('BATHYMETRY__R6_PARENT'), ids)

    def test_rejects_corrupt_sources_and_unsafe_numeric_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'input').write_text('changed')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                verify_files(root, {'input': {'sha256': 'incorrect'}})
            table = pa.table({'H3_INDEX': [h3.latlng_to_cell(48.5, -123.5, 6)], 'COUNT': [2**53]})
            with self.assertRaisesRegex(ValueError, 'Unsafe JavaScript integer'):
                Exporter(root, 'fixture').table(table, 6, 'H3_INDEX',
                    {'sha256': 'fixture', 'path': 'input', 'release': 'test'}, {'COUNT': {}}, 'seascape', 'r6')

    def test_flat_parquets_read_without_release_directory(self):
        from prepare_flat_map import prepare_flat

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'Data/Seascape'
            source.mkdir(parents=True)
            cell = h3.latlng_to_cell(48.5, -123.5, 6)
            table = pa.table({'H3_INDEX': [cell], 'H3_RESOLUTION': [6], 'BED_AREA_M2': [None], 'QC': ['unknown']})
            context = {'fields': {'BED_AREA_M2': {'unit': 'm2'}}, 'temporal_support': {'precision': 'year'}}
            table = table.replace_schema_metadata({b'seascape_domain': json.dumps(context).encode()})
            pq.write_table(table, source / 'kelp-r6-static.parquet')
            cell8 = h3.latlng_to_cell(48.5, -123.5, 8)
            table8 = table.set_column(0, 'H3_INDEX', pa.array([cell8])).set_column(1, 'H3_RESOLUTION', pa.array([8]))
            pq.write_table(table8, source / 'kelp-r8-static.parquet')
            pq.write_table(table.append_column('date', pa.array([date(2021, 1, 1)], type=pa.date32())), source / 'kelp-r6-dynamic.parquet')
            (source / 'catalog.json').write_text(json.dumps({'kelp': {'last_updated_utc': '2026-10-14T12:00:00+00:00', 'static': {'6': 'kelp-r6-static.parquet', '8': 'kelp-r8-static.parquet'}, 'dynamic': {'6': 'kelp-r6-dynamic.parquet'}}}))
            output = root / 'browser-cache'
            prepare_flat(source, None, output)
            catalog = json.loads((output / 'catalog.json').read_text())
            self.assertEqual(catalog['release'], 'current')
            self.assertEqual(catalog['products']['seascape-kelp-dynamic-r6']['axis'], 'Survey year')
            self.assertEqual(catalog['products']['seascape-kelp-dynamic-r6']['slices']['2021-01-01']['label'], '2021')
            self.assertEqual(len({(feature['id'], feature['resolution']) for feature in catalog['features']}), len(catalog['features']))
            product = catalog['products']['seascape-kelp-static-r6']
            value_path = output / catalog['manifestSha256'] / 'assets' / (product['columns']['BED_AREA_M2']['sha256'] + '.json')
            self.assertEqual(unpack(json.loads(value_path.read_text())), [None])
            self.assertEqual(len(list(source.iterdir())), 4)
            self.assertIn('seascape-kelp-static-r8', catalog['products'])


if __name__ == '__main__':
    unittest.main()
