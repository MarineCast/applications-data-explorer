"""Consumer export checks; fixtures do not qualify regional source products."""
import json
import tempfile
import unittest
from pathlib import Path

import h3
import pyarrow as pa

from prepare_map import Exporter, validate_table, verify_files
from prepare_seascape import unpack


class NativeMapExport(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
