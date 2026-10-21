"""Generated offline fixtures for exact daily/hourly explorer consumption."""
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import tempfile
import unittest

import h3
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from meteorology_data import METRICS, Store, digest, prepare


def fixture(root, coastal=False, full_month=False):
    cells = [h3.latlng_to_cell(48.5, -123.2, 5), h3.latlng_to_cell(49, -124, 5)]
    days = [date(2026, 10, 7), date(2026, 10, 8)]
    if full_month:
        days = [date(2026, 1, 1) + timedelta(days=i) for i in range(31)]
    hourly_columns = list(dict.fromkeys(value[2] for value in METRICS.values()))
    daily_tables, hourly_tables = [], []
    for day in days:
        values = {column: np.full((24, 2), 10.0) for column in hourly_columns}
        values['PRECIPITATION_MM'][:] = 0
        if coastal and day == days[-1]:
            values['PRECIPITATION_MM'][-1, :] = np.nan
        values['RELATIVE_HUMIDITY_2M_PCT'][3, 0] = np.nan
        if full_month:
            for column in values:
                if column != 'RELATIVE_HUMIDITY_2M_PCT':
                    values[column][:] = day.day
            values['PRECIPITATION_MM'][:] = 2 / 24
            values['U_WIND_10M_MS'][:] = 1 if day.day % 2 else -1
            values['V_WIND_10M_MS'][:] = -10
        hour_data = {'H3_INDEX': cells * 24, 'DATETIME': pa.array([datetime.combine(day, datetime.min.time(), timezone.utc) + timedelta(hours=hour) for hour in range(24) for _ in cells], type=pa.timestamp('us', tz='UTC'))}
        hour_data.update({column: pa.array(values[column].ravel(), from_pandas=True) for column in hourly_columns})
        day_data = {'H3_INDEX': cells, 'DATE': pa.array([day] * 2, type=pa.date32())}
        day_data.update({column: pa.array(np.sum(values[value[2]], axis=0) if column == 'PRECIPITATION_MM' else np.mean(values[value[2]], axis=0), from_pandas=True) for column, value in METRICS.items()})
        hourly_tables.append(pa.table(hour_data))
        daily_tables.append(pa.table(day_data))
    catalog = {'schema_version': 1, 'method': 'ecmwf-arco-wide-h3-utc-v1', 'timezone': 'UTC', 'h3_resolution': 5,
               'start_date': str(days[0]), 'end_date': str(days[-1]), 'products': {}}
    if coastal:
        catalog.update(method='era5-retained-exact-coastal-r5-v1', membership_sha256='fixture-membership', mask_revision='fixture-mask', reporting_cell_count=2)
    for frequency, tables in [('daily', daily_tables), ('hourly', hourly_tables)]:
        units = {column: 'source-unit' for column in tables[0].column_names[2:]}
        context = {'method': catalog['method'], 'timezone': 'UTC', 'columns': units}
        metadata = {b'meteorology': json.dumps(context).encode()}
        if coastal:
            context.pop('columns')
            metadata[b'meteorology'] = json.dumps(context).encode()
            metadata[b'coastal_reporting'] = json.dumps({'membership_sha256': catalog['membership_sha256'], 'mask_revision': catalog['mask_revision']}).encode()
        schema = tables[0].schema.with_metadata(metadata)
        path = root / f'meteorology-{frequency}.parquet'
        with pq.ParquetWriter(path, schema) as writer:
            for table in tables:
                writer.write_table(table.replace_schema_metadata(schema.metadata))
        catalog['products'][frequency] = {'file': path.name, 'bytes': path.stat().st_size, 'sha256': digest(path),
            'rows': sum(table.num_rows for table in tables), 'columns': [{'name': f.name, 'units': units.get(f.name), 'dtype': str(f.type)} for f in schema],
            'value_status_counts': {column: {'COMPLETE': sum(table.num_rows - table[column].null_count for table in tables), 'UNSUPPORTED': sum(table[column].null_count for table in tables)} for column in units}}
    (root / 'catalog.json').write_text(json.dumps(catalog))
    return cells


class MeteorologyDataTests(unittest.TestCase):
    def test_calendar_aggregates_use_metric_semantics_and_complete_support(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixture(root, full_month=True)
            prepare(root, root / 'browser')
            store = Store(root, root / 'browser')
            base = {'snapshot': store.manifest['snapshot'], 'operation': 'daily', 'period': 'month', 'date': '2026-01-01'}
            def query(column, **changes):
                return store.query({**base, 'metric': column, **changes})['values']
            self.assertEqual(query('TEMPERATURE_2M_C_MEAN'), [16, 16])
            np.testing.assert_allclose(query('PRECIPITATION_MM'), [62, 62])
            self.assertEqual(query('TEMPERATURE_2M_C_MIN'), [1, 1])
            self.assertEqual(query('TEMPERATURE_2M_C_MAX'), [31, 31])
            self.assertEqual(query('RELATIVE_HUMIDITY_2M_PCT_MEAN'), [None, 10])
            expected = (np.degrees(np.arctan2(-1/31, 10)) + 360) % 360
            np.testing.assert_allclose(query('WIND_DIRECTION_10M_DEG_FROM_MEAN_VECTOR'), [expected, expected])
            self.assertEqual(query('TEMPERATURE_2M_C_MEAN', period='week', date='2026-01-05'), [8, 8])
            with self.assertRaisesRegex(ValueError, 'calendar boundary'):
                query('PRECIPITATION_MM', period='week')
            with self.assertRaisesRegex(ValueError, 'outside retained coverage'):
                query('PRECIPITATION_MM', period='week', date='2026-01-26')


    def test_coastal_contract_preserves_partial_rain_and_rejects_membership_mismatch(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            cells = fixture(root, coastal=True)
            output = root / 'browser'
            prepare(root, output)
            store = Store(root, output)
            request = {'date': '2026-10-08', 'snapshot': store.manifest['snapshot'], 'metric': 'PRECIPITATION_MM'}
            self.assertEqual(store.query({**request, 'operation': 'daily'})['values'], [None, None])
            hourly = store.query({**request, 'operation': 'hourly', 'cell': cells[0]})
            self.assertEqual(hourly['values'], [0.0] * 23 + [None])
            catalog = json.loads((root / 'catalog.json').read_text())
            catalog['membership_sha256'] = 'changed'
            (root / 'catalog.json').write_text(json.dumps(catalog))
            with self.assertRaisesRegex(ValueError, 'membership disagrees'):
                prepare(root, output)


    def test_exact_reads_and_nulls_and_bounded_hourly_queries(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            cells = fixture(root)
            output = root / 'browser'
            prepare(root, output)
            store = Store(root, output)
            base = {'date': '2026-10-07', 'snapshot': store.manifest['snapshot']}
            daily = store.query({**base, 'operation': 'daily', 'metric': 'RELATIVE_HUMIDITY_2M_PCT_MEAN'})
            self.assertEqual(daily['ids'], cells)
            self.assertEqual(daily['values'], [None, 10.0])
            hourly = store.query({**base, 'operation': 'hourly', 'metric': 'RELATIVE_HUMIDITY_2M_PCT_MEAN', 'cell': cells[0]})
            self.assertEqual(len(hourly['values']), 24)
            self.assertIsNone(hourly['values'][3])
            self.assertEqual(hourly['counts'][3], 0)
            rain = store.query({**base, 'operation': 'daily', 'metric': 'PRECIPITATION_MM'})
            self.assertEqual(rain['values'], [0.0, 0.0])
            with self.assertRaisesRegex(ValueError, 'Unknown UTC'):
                store.query({**base, 'operation': 'daily', 'metric': 'PRECIPITATION_MM', 'date': '2026-10-09'})
            with self.assertRaisesRegex(ValueError, 'snapshot changed'):
                store.query({**base, 'snapshot': 'wrong', 'operation': 'daily', 'metric': 'PRECIPITATION_MM'})
            with self.assertRaisesRegex(ValueError, 'outside native'):
                store.query({**base, 'operation': 'hourly', 'metric': 'PRECIPITATION_MM', 'cell': 'invalid'})
            (root / 'catalog.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'catalog changed'):
                store.query({**base, 'operation': 'daily', 'metric': 'PRECIPITATION_MM'})

    def test_changed_source_checksum_does_not_enable_a_dataset(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixture(root)
            with (root / 'meteorology-daily.parquet').open('ab') as stream:
                stream.write(b'changed')
            with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
                prepare(root, root / 'browser')
            self.assertFalse((root / 'browser' / 'catalog.json').exists())


if __name__ == '__main__':
    unittest.main()
