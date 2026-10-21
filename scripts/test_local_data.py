"""Actual Parquet replacement through the live reader; no manual preparation step."""
import json
import tempfile
import unittest
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from local_data import Reader, Sources
from prepare_seascape import unpack


class LiveDataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root/'Data/Seascape'
        self.source.mkdir(parents=True)
        self.public = self.root/'public'
        self.public.mkdir()
        self.write([0., None])
        # Producer-retained research is not a final map product.
        (self.source/'research').mkdir()
        (self.source/'research/unused.json').write_text('{}')
        self.reader = Reader(Sources(self.root/'Data', self.public, self.root/'study.json'))

    def tearDown(self):
        self.reader.close()
        self.temp.cleanup()

    def write(self, values, added=False):
        for res in (6, 8):
            data = {'H3_INDEX': [h3.latlng_to_cell(lat, -123, res) for lat in (48, 49)],
                    'H3_RESOLUTION': [res, res], 'POPULATION': values}
            if added:
                data['NEW_MEASUREMENT'] = [2., 3.]
            table = pa.table(data).replace_schema_metadata({b'seascape_domain': json.dumps({'fields': {'POPULATION': {'unit': 'persons'}}}).encode()})
            path = self.source/f'population-r{res}-static.parquet'
            pq.write_table(table, path.with_suffix('.tmp'))
            path.with_suffix('.tmp').replace(path)
        (self.source/'catalog.json').write_text(json.dumps({'population': {'last_updated_utc': '2026-10-17T00:00:00Z', 'static': {'6': 'population-r6-static.parquet', '8': 'population-r8-static.parquet'}}}))

    def values(self, catalog, column='POPULATION'):
        binding = catalog['products']['seascape-population-static-r6']['columns'][column]
        asset = self.reader.request({'path': binding['url']})
        return unpack(json.loads(Path(asset['file']).read_text()))

    def test_replacement_changes_values_variables_and_version_without_manual_preparation(self):
        before = self.reader.request({'path': '/local-data/seascape/catalog.json'})['json']
        version = self.reader.sources.version('seascape')
        self.assertEqual(self.values(before), [0., None])
        self.write([57.125, 0.], added=True)
        self.assertNotEqual(version, self.reader.sources.version('seascape'))
        after = self.reader.request({'path': '/local-data/seascape/catalog.json'})['json']
        self.assertEqual(self.values(after), [57.125, 0.])
        self.assertEqual(self.values(after, 'NEW_MEASUREMENT'), [2., 3.])
        self.assertNotEqual(before['manifestSha256'], after['manifestSha256'])
        self.write([None, 11.])
        final = self.reader.base()
        self.assertEqual(self.values(final), [None, 11.])
        self.assertNotIn('NEW_MEASUREMENT', final['products']['seascape-population-static-r6']['columns'])
        self.assertLessEqual(len(list(self.reader.directory.glob('seascape-*'))), 2)

    def test_invalid_replacement_does_not_serve_old_data_and_recovers(self):
        catalog = self.reader.base()
        old_url = catalog['products']['seascape-population-static-r6']['columns']['POPULATION']['url']
        (self.source/'population-r6-static.parquet').write_bytes(b'incomplete replacement')
        for _ in range(3):
            with self.assertRaises(Exception):
                self.reader.base()
        with self.assertRaisesRegex(ValueError, 'not part of a current'):
            self.reader.request({'path': old_url})
        self.assertLessEqual(len(list(self.reader.directory.iterdir())), 1)
        self.write([9., None])
        self.assertEqual(self.values(self.reader.base()), [9., None])

    def test_missing_or_damaged_optional_startup_encoding_is_regenerated(self):
        import shutil
        initial = self.reader.base()
        candidate = self.reader.current['seascape']['output']
        public = self.public/'seascape'
        shutil.copytree(candidate, public)
        binding = initial['products']['seascape-population-static-r6']['columns']['POPULATION']
        asset = public/binding['url'].removeprefix('/local-data/seascape/')
        asset.write_text('damaged optional encoding')
        cold = Reader(self.reader.sources)
        try:
            result = cold.base()
            readback = cold.request({'path': result['products']['seascape-population-static-r6']['columns']['POPULATION']['url']})
            self.assertEqual(unpack(json.loads(Path(readback['file']).read_text())), [0., None])
        finally:
            cold.close()

    def test_weather_replacement_cannot_bypass_validation_by_preserving_size_and_mtime(self):
        import os
        from meteorology_data import prepare, Store
        from test_meteorology_data import fixture
        root = self.root/'Data/Meteorology'; root.mkdir()
        fixture(root)
        output = self.public/'meteorology'
        prepare(root, output)
        path = root/'meteorology-hourly.parquet'
        stat = path.stat(); body = bytearray(path.read_bytes()); body[10] ^= 1
        path.write_bytes(body)
        os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns))
        # The old stat-only startup check accepts this replacement.
        Store(root, output).check()
        with self.assertRaisesRegex(ValueError, '[Cc]hecksum'):
            self.reader.get('meteorology')

    def test_only_registered_assets_are_readable(self):
        self.reader.base()
        for path in ['/etc/passwd', '/local-data/seascape/../human/static.parquet',
                     '/local-data/seascape/arbitrary.json', '/local-data/other/catalog.json']:
            with self.assertRaises(ValueError):
                self.reader.request({'path': path})

    def test_delivered_viewshed_pilot_is_detected_without_configuration(self):
        source = self.reader.sources
        fallback = self.public/'viewshed'; fallback.mkdir()
        (fallback/'catalog.json').write_text('{}')
        before = source.version('viewshed')
        delivered = self.root/'Data/viewshed'; delivered.mkdir()
        (delivered/'runtime.json').write_text('{}')
        self.assertEqual(source.root('viewshed'), delivered)
        self.assertNotEqual(source.version('viewshed'), before)
        # Incomplete new pair outputs must not silently revive the old pilot.
        with self.assertRaises(Exception):
            self.reader.get('viewshed')

    def test_old_designated_only_conservation_seed_regenerates_without_data_changes(self):
        from conservation_input import CORE_ASSIGNMENT, ASSIGNMENT
        from governance_input import append_governance
        from prepare_map import Exporter
        from prepare_seascape import digest
        from test_conservation_input import fixture
        root=self.root/'Data/Governance'; root.mkdir()
        table,context=fixture(); path=root/'governance-r6-static.parquet'
        pq.write_table(table.replace_schema_metadata({b'governance':json.dumps(context).encode()}),path)
        (root/'catalog.json').write_text(json.dumps({'schema_version':1,'domain':'governance','last_updated_utc':'2026-10-19',
            'tables':{'6':{'static':{'path':path.name,'rows':table.num_rows,'sha256':digest(path)}}}}))
        output=self.public/'seascape';output.mkdir()
        catalog={'datasets':{},'products':{},'features':[]}
        append_governance(Exporter(output,'fixture'),catalog,root)
        field=next(f for f in catalog['features'] if f.get('membershipColumn')==ASSIGNMENT)
        # Same current source bindings, but an obsolete presentation encoding.
        field.update(column=CORE_ASSIGNMENT,membershipColumn=CORE_ASSIGNMENT)
        (output/'catalog.json').write_text(json.dumps(catalog))
        before=path.read_bytes()
        with self.assertRaisesRegex(ValueError,'status-qualified'):
            self.reader.seed_base('governance')
        live=self.reader.get('governance')['catalog']
        self.assertEqual(next(f for f in live['features'] if f['name'].endswith('Assignment'))['membershipColumn'],ASSIGNMENT)
        self.assertEqual(path.read_bytes(),before)

    def test_atomic_symlink_target_replacement_is_detected(self):
        first = self.root/'first'; second = self.root/'second'
        first.mkdir(); second.mkdir()
        for folder in (first, second):
            (folder/'catalog.json').write_text('{}')
        link = self.root/'Data/Human'
        link.symlink_to(first, target_is_directory=True)
        before = self.reader.sources.version('human')
        swap = link.with_suffix('.swap'); swap.symlink_to(second, target_is_directory=True); swap.replace(link)
        self.assertNotEqual(before, self.reader.sources.version('human'))


if __name__ == '__main__':
    unittest.main()
