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


if __name__ == '__main__':
    unittest.main()
