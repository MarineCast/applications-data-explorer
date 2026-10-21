"""Seascape projection refresh and stale-startup reader regression checks."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from local_data import Reader, Sources
from prepare_seascape import unpack

OMITTED = ('SOURCE_OBSERVATION_DATE_STATUS', 'SEDIMENT_TEXTURE_STATUS',
           'SAND_POINT_SAMPLE_STATUS', 'SAND_MASK_STATUS', 'ROCK_POINT_SAMPLE_STATUS',
           'ROCK_MASK_STATUS', 'POINT_SUPPORT_STATUS', 'MUD_POINT_SAMPLE_STATUS',
           'MUD_MASK_STATUS', 'H3_AREAL_SUBSTRATE_COVERAGE', 'GRAVEL_POINT_SAMPLE_STATUS',
           'GRAVEL_MASK_STATUS', 'UNSUPPORTED_PHYSICAL_METRICS_REASON',
           'SOURCE_OBSERVATION_PERIOD', 'SOURCE_GRID_DEGREES')


class SubstrateReaderTests(unittest.TestCase):
    def test_replacement_invalidates_saved_encoding_and_preserves_exact_retained_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root/'Data/Seascape'; source.mkdir(parents=True)
            public = root/'public'; public.mkdir()
            table = pa.table({'H3_INDEX': [h3.latlng_to_cell(lat, -123, 6) for lat in (48, 49)],
                              'H3_RESOLUTION': [6, 6],
                              'SUBSTRATE_MODEL__MODELED_SEDIMENT_SAND_FRACTION': [0., None],
                              'SUBSTRATE_MODEL__PHYSICAL_HARDNESS': pa.array([None, None], type=pa.float64())})
            retained = table.column_names
            for name in OMITTED:
                table = table.append_column('SUBSTRATE_MODEL__'+name, pa.array(['qualification', None]))
            def write(current, stamp):
                context = {'fields': {name: {'source_column': name.rsplit('__', 1)[-1]} for name in current.column_names}}
                pq.write_table(current.replace_schema_metadata({b'seascape_domain': json.dumps(context).encode()}), source/'substrate-r6-static.parquet')
                (source/'catalog.json').write_text(json.dumps({'substrate': {'last_updated_utc': stamp, 'static': {'6': 'substrate-r6-static.parquet'}}}))
            write(table, '2026-10-18T00:00:00Z')
            sources = Sources(root/'Data', public, root/'study.json')
            reader = Reader(sources)
            try:
                initial = reader.base()
                shutil.copytree(reader.current['seascape']['output'], public/'seascape')
                self.assertEqual(len(initial['features']), 17)
                write(table.select(retained), '2026-10-19T00:00:00Z')
                current = reader.base()
                self.assertNotEqual(initial['manifestSha256'], current['manifestSha256'])
                self.assertEqual(len(current['features']), 2)
                for name in current['products']['seascape-substrate-static-r6']['columns']:
                    self.assertIn(name, retained)
                    binding = current['products']['seascape-substrate-static-r6']['columns'][name]
                    asset = reader.request({'path': binding['url']})
                    self.assertEqual(unpack(json.loads(Path(asset['file']).read_text())), table[name].to_pylist())
                cold = Reader(sources)
                try:
                    self.assertEqual(len(cold.base()['features']), 2)
                finally:
                    cold.close()
                invalid = table.select(retained).set_column(0, 'H3_INDEX', pa.array([table['H3_INDEX'][0].as_py()]*2))
                write(invalid, '2026-10-19T00:01:00Z')
                with self.assertRaisesRegex(ValueError, 'Duplicate or null'):
                    reader.base()
            finally:
                reader.close()
