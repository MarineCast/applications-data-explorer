"""Reviewed public values and independently bound source qualifiers."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from seascape_support import KEY, CORE_POLICY, CORE_SCHEMAS, audit_bindings, read_table


class ReviewedSeascape(unittest.TestCase):
    def core_fixture(self, root, area, resolution):
        cells = sorted(h3.grid_disk(h3.latlng_to_cell(48.5, -123, resolution), 1))[:3]
        source = {'H3_INDEX': cells, 'H3_RESOLUTION': [resolution]*3, 'SOURCE_QC': ['mapped', 'unknown', 'mapped']}
        public = {'h3_index': pa.array(cells)}
        mapping = {'h3_index': 'H3_INDEX'}
        for metric in CORE_SCHEMAS[area]['metrics']:
            if resolution not in metric['resolutions']:
                continue
            source[metric['source_column']] = pa.array([True, None, False]) if metric['units'] == '0/1' else pa.array([0., None, .5])
            public[metric['proposed_column']] = pa.array([1, None, 0], type=pa.int64()) if metric['units'] == '0/1' else source[metric['source_column']]
            mapping[metric['proposed_column']] = metric['source_column']
        native = pa.table(source)
        audit = root/'audit.parquet'
        pq.write_table(native, audit)
        context = {'core_schema': {'source_columns': mapping}, 'fields': {
            m['proposed_column']: {'picker_visible': True, 'unit': '1' if m['units'] == '0/1' else m['units']}
            for m in CORE_SCHEMAS[area]['metrics'] if m['proposed_column'] in public}}
        binding = {'policy': CORE_POLICY, 'area': area, 'native_rows': 3, 'native_columns': native.num_columns,
                   'audit_path': str(audit), 'audit_sha256': hashlib.sha256(audit.read_bytes()).hexdigest()}
        path = root/f'{area}-r{resolution}-static.parquet'
        pq.write_table(pa.table(public).replace_schema_metadata({KEY: json.dumps(binding).encode(), b'seascape_domain': json.dumps(context).encode()}), path)
        return path, native, public

    def test_all_core_variants_preserve_public_values_and_hide_audit_predictors(self):
        from prepare_map import Exporter
        for area, spec in CORE_SCHEMAS.items():
            for res in sorted({r for m in spec['metrics'] for r in m['resolutions']}):
                with self.subTest(area=area, res=res), tempfile.TemporaryDirectory() as directory:
                    path, native, public = self.core_fixture(Path(directory), area, res)
                    result = read_table(path, area=area)
                    context = json.loads(result.schema.metadata[b'seascape_domain'])
                    self.assertEqual(result['H3_INDEX'].to_pylist(), native['H3_INDEX'].to_pylist())
                    for name in public:
                        if name != 'h3_index':
                            self.assertEqual(result[name].to_pylist(), public[name].to_pylist())
                            self.assertEqual(result[name].type, public[name].type)
                    entries = {n: context.get('fields', {}).get(n, {}) for n in result.column_names}
                    (Path(directory)/'encoding').mkdir()
                    _, features = Exporter(Path(directory)/'encoding', 'fixture').table(
                        result, res, 'H3_INDEX', {'sha256': 'fixture', 'path': path.name, 'release': 'fixture'}, entries, 'seascape', 'fixture')
                    self.assertEqual({f['column'] for f in features}, set(public)-{'h3_index'})

    def fixture(self, root, area='seagrass'):
        cell = h3.latlng_to_cell(48.5, -123.0, 6)
        field = area.upper() + '_EXTENT_ALL_TIME_M2'
        native = pa.table({'H3_INDEX': [cell], 'H3_RESOLUTION': [6],
                           field: pa.array([None], type=pa.float64()), 'QC': ['unknown']})
        audit = root/'audit.parquet'
        pq.write_table(native, audit)
        public = pa.table({'H3_INDEX': [cell], field: [0.], area.upper()+'_EXTENT_BOOL': [0]})
        binding = {'policy': 'reviewed-static-v1', 'area': area, 'native_rows': 1,
                   'native_columns': 4, 'audit_path': str(audit),
                   'audit_sha256': hashlib.sha256(audit.read_bytes()).hexdigest()}
        public = public.replace_schema_metadata({KEY: json.dumps(binding).encode()})
        path = root/f'{area}-r6-static.parquet'
        pq.write_table(public, path)
        return path, audit

    def test_public_zero_and_integer_flag_retain_source_unknown_qc(self):
        for area in ['seagrass', 'bivalve', 'kelp']:
            with self.subTest(area=area), tempfile.TemporaryDirectory() as directory:
                path, audit = self.fixture(Path(directory), area)
                result = read_table(path, area=area)
                self.assertEqual(result[area.upper()+'_EXTENT_ALL_TIME_M2'].to_pylist(), [0.])
                self.assertEqual(result[area.upper()+'_EXTENT_BOOL'].type, pa.int64())
                self.assertEqual(result['QC'].to_pylist(), ['unknown'])
                self.assertEqual(result['H3_RESOLUTION'].to_pylist(), [6])
                self.assertEqual(set(audit_bindings([path])), {str(audit)})
                self.assertIsNone(pq.read_table(audit)[area.upper()+'_EXTENT_ALL_TIME_M2'][0].as_py())

    def test_missing_or_changed_audit_and_modified_public_fail(self):
        for damage in ['missing', 'audit', 'public', 'area']:
            with self.subTest(damage=damage), tempfile.TemporaryDirectory() as directory:
                path, audit = self.fixture(Path(directory))
                area = 'seagrass'
                if damage == 'missing':
                    audit.unlink()
                elif damage == 'audit':
                    audit.write_bytes(b'changed')
                elif damage == 'area':
                    area = 'bivalve'
                else:
                    public = pq.read_table(path)
                    public = public.set_column(2, 'SEAGRASS_EXTENT_BOOL', pa.array([1]))
                    pq.write_table(public, path)
                with self.assertRaises((ValueError, FileNotFoundError)):
                    read_table(path, area=area)

    def test_external_audit_is_watched_and_missing_support_invalidates_cache(self):
        from local_data import Sources
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root/'Data/Seascape'
            source.mkdir(parents=True)
            path, audit = self.fixture(source)
            (source/'catalog.json').write_text(json.dumps({'seagrass': {
                'last_updated_utc': '2026-10-20', 'static': {'6': path.name}}}))
            sources = Sources(root/'Data', root/'public', root/'study.json')
            self.assertIn(audit, sources.dependencies('seascape'))
            before = sources.version('seascape')
            audit.unlink()
            self.assertNotEqual(before, sources.version('seascape'))
            self.assertTrue(sources.version('seascape').startswith('unavailable:'))

    def test_compact_export_includes_flag_and_audit_source_binding(self):
        from prepare_flat_map import prepare_flat
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root/'Data/Seascape'
            source.mkdir(parents=True)
            path, audit = self.fixture(source)
            # Required companion lives outside Data delivery.
            moved = root/'audit.parquet'
            audit.rename(moved)
            public = pq.read_table(path)
            binding = json.loads(public.schema.metadata[KEY])
            binding['audit_path'] = str(moved)
            pq.write_table(public.replace_schema_metadata({KEY: json.dumps(binding).encode()}), path)
            (source/'catalog.json').write_text(json.dumps({'seagrass': {
                'last_updated_utc': '2026-10-20', 'static': {'6': path.name}}}))
            prepare_flat(source, None, root/'cache')
            catalog = json.loads((root/'cache/catalog.json').read_text())
            columns = {f['column'] for f in catalog['features']}
            self.assertEqual(columns, {'SEAGRASS_EXTENT_ALL_TIME_M2', 'SEAGRASS_EXTENT_BOOL'})
            validation = json.loads((root/'cache'/catalog['manifestSha256']/'validation.json').read_text())
            self.assertIn(str(moved), validation['source_bindings']['seascape_audits'])


if __name__ == '__main__':
    unittest.main()
