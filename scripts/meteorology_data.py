"""Validate retained ERA5 products, then serve bounded read-only explorer queries.

No provider access, source rewriting, interpolation or missing-value imputation.
One Parquet row group is one UTC day. Only checked snapshots are readable.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import sys

import h3
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

METRICS = {
    'TEMPERATURE_2M_C_MEAN': ('Mean air temperature', 'Temperature', 'TEMPERATURE_2M_C', 'Daily mean 2 m air temperature.'),
    'TEMPERATURE_2M_C_MIN': ('Minimum air temperature', 'Temperature', 'TEMPERATURE_2M_C', 'Daily minimum 2 m air temperature.'),
    'TEMPERATURE_2M_C_MAX': ('Maximum air temperature', 'Temperature', 'TEMPERATURE_2M_C', 'Daily maximum 2 m air temperature.'),
    'DEWPOINT_2M_C_MEAN': ('Mean dewpoint', 'Temperature', 'DEWPOINT_2M_C', 'Daily mean 2 m dewpoint temperature.'),
    'WIND_SPEED_10M_MS_MEAN': ('Mean wind speed', 'Wind', 'WIND_SPEED_10M_MS', 'Daily mean 10 m wind speed.'),
    'WIND_SPEED_10M_MS_MAX': ('Maximum wind speed', 'Wind', 'WIND_SPEED_10M_MS', 'Daily maximum 10 m wind speed.'),
    'U_WIND_10M_MS_MEAN': ('Eastward wind', 'Wind', 'U_WIND_10M_MS', 'Daily mean eastward 10 m wind component; negative is westward.'),
    'V_WIND_10M_MS_MEAN': ('Northward wind', 'Wind', 'V_WIND_10M_MS', 'Daily mean northward 10 m wind component; negative is southward.'),
    'WIND_DIRECTION_10M_DEG_FROM_MEAN_VECTOR': ('Wind direction', 'Wind', 'WIND_DIRECTION_10M_DEG_FROM', 'Direction the daily mean wind vector comes from, clockwise from north. Calm direction is unavailable.'),
    'RELATIVE_HUMIDITY_2M_PCT_MEAN': ('Mean relative humidity', 'Humidity', 'RELATIVE_HUMIDITY_2M_PCT', 'Daily mean supported 2 m relative humidity. Any unsupported hour leaves the daily value unavailable.'),
    'TOTAL_CLOUD_COVER_PCT_MEAN': ('Mean cloud cover', 'Cloud cover', 'TOTAL_CLOUD_COVER_PCT', 'Daily mean total cloud cover.'),
    'MEAN_SEA_LEVEL_PRESSURE_HPA_MEAN': ('Mean sea-level pressure', 'Pressure', 'MEAN_SEA_LEVEL_PRESSURE_HPA', 'Daily mean sea-level pressure.'),
    'MEAN_SEA_LEVEL_PRESSURE_HPA_MIN': ('Minimum sea-level pressure', 'Pressure', 'MEAN_SEA_LEVEL_PRESSURE_HPA', 'Daily minimum sea-level pressure.'),
    'PRECIPITATION_MM': ('Daily precipitation', 'Precipitation', 'PRECIPITATION_MM', 'Sum of the 24 following-hour accumulations from 00:00 through 24:00 UTC.'),
}


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def clean(values):
    return [None if not np.isfinite(value) else float(value) for value in values]


def prepare(root: Path, output: Path):
    catalog_path = root / 'catalog.json'
    source = json.loads(catalog_path.read_text())
    if (source.get('schema_version') != 1 or source.get('method') not in {'ecmwf-arco-wide-h3-utc-v1', 'era5-retained-exact-coastal-r5-v1'}
            or source.get('timezone') != 'UTC' or source.get('h3_resolution') != 5):
        raise ValueError('Unsupported meteorology source contract')
    source_hash = digest(catalog_path)
    bindings, files = {}, {}
    for frequency, time_key in [('daily', 'DATE'), ('hourly', 'DATETIME')]:
        record = source['products'][frequency]
        filename = f'meteorology-{frequency}.parquet'
        if record['file'] != filename:
            raise ValueError('Unexpected meteorology filename')
        path = root / filename
        before = path.stat()
        if before.st_size != record['bytes'] or digest(path) != record['sha256']:
            raise ValueError(f'Checksum mismatch: {filename}')
        bindings[filename] = {'bytes': before.st_size, 'mtimeNs': before.st_mtime_ns, 'sha256': record['sha256']}
        files[frequency] = pq.ParquetFile(path)
        context = json.loads(files[frequency].schema_arrow.metadata[b'meteorology'])
        declared = {column['name']: column['units'] for column in record['columns'] if column['units']}
        coastal = source['method'] == 'era5-retained-exact-coastal-r5-v1'
        if coastal:
            membership = json.loads(files[frequency].schema_arrow.metadata[b'coastal_reporting'])
            if (not source.get('membership_sha256') or membership.get('membership_sha256') != source['membership_sha256']
                    or membership.get('mask_revision') != source.get('mask_revision')):
                raise ValueError('Embedded coastal membership disagrees with catalog')
        if (context['method'] != source['method'] or context['timezone'] != 'UTC'
                or (not coastal and context.get('columns') != declared) or files[frequency].schema_arrow.names != [c['name'] for c in record['columns']]
                or files[frequency].metadata.num_rows != record['rows']):
            raise ValueError('Embedded source schema/units disagree with catalog')
        if frequency == 'hourly' and files[frequency].schema_arrow.field(time_key).type != pa.timestamp('us', tz='UTC'):
            raise ValueError('Hourly timestamps must be UTC microseconds')
    first, last = date.fromisoformat(source['start_date']), date.fromisoformat(source['end_date'])
    dates = [str(first + timedelta(days=i)) for i in range((last - first).days + 1)]
    if any(file.metadata.num_row_groups != len(dates) for file in files.values()):
        raise ValueError('Expected one row group per UTC day')
    ids = files['daily'].read_row_group(0, columns=['H3_INDEX'])['H3_INDEX'].to_pylist()
    if len(set(ids)) != len(ids) or any(not h3.is_valid_cell(cell) or h3.get_resolution(cell) != 5 for cell in ids):
        raise ValueError('Invalid or duplicate H3 R5 keys')
    if source['method'] == 'era5-retained-exact-coastal-r5-v1' and len(ids) != source.get('reporting_cell_count'):
        raise ValueError('Coastal cell count disagrees with catalog')
    expected_ids = pa.array(ids)
    hourly_ids = pa.array(ids * 24)
    hour_offsets = np.repeat(np.arange(24, dtype=np.int64) * 3_600_000_000, len(ids))
    stats = {frequency: {c['name']: {'nulls': 0, 'min': None, 'max': None} for c in source['products'][frequency]['columns'] if c['units']}
             for frequency in files}
    series = {name: [] for name in METRICS}
    for index, day in enumerate(dates):
        current = date.fromisoformat(day)
        tables = {frequency: file.read_row_group(index) for frequency, file in files.items()}
        daily, hourly = tables['daily'], tables['hourly']
        midnight_us = int(datetime.combine(current, datetime.min.time(), timezone.utc).timestamp()) * 1_000_000
        if (daily.num_rows != len(ids) or not daily['H3_INDEX'].combine_chunks().equals(expected_ids)
                or pc.unique(daily['DATE']).to_pylist() != [current]
                or not hourly['H3_INDEX'].combine_chunks().equals(hourly_ids)
                or not np.array_equal(pc.cast(hourly['DATETIME'], pa.int64()).to_numpy(), midnight_us + hour_offsets)):
            raise ValueError(f'Duplicate, missing, reordered or invalid time/H3 support: {day}')
        for frequency, table in tables.items():
            for column, result in stats[frequency].items():
                values = table[column].to_numpy(zero_copy_only=False)
                if np.isinf(values).any() or (np.isnan(values).sum() != table[column].null_count):
                    raise ValueError(f'Nonfinite source value: {column} {day}')
                valid = values[np.isfinite(values)]
                result['nulls'] += table[column].null_count
                if len(valid):
                    lo, hi = float(valid.min()), float(valid.max())
                    result['min'] = lo if result['min'] is None else min(lo, result['min'])
                    result['max'] = hi if result['max'] is None else max(hi, result['max'])
                    if ((column.startswith('TOTAL_CLOUD') and (lo < 0 or hi > 100.000001)) or (column == 'PRECIPITATION_MM' and lo < 0)
                            or ('DIRECTION' in column and (lo < 0 or hi >= 360))):
                        raise ValueError(f'Out-of-domain value: {column} {day}')
                if frequency == 'daily':
                    # A display summary, not an area average. Direction has no scalar mean.
                    series[column].append(None if 'DIRECTION' in column or not len(valid) else float(valid.mean()))
        if index in {0, len(dates) // 2, len(dates) - 1}:
            for column, (_, _, hourly_column, _) in METRICS.items():
                if 'DIRECTION' in column:
                    continue
                values = hourly[hourly_column].to_numpy(zero_copy_only=False).reshape(24, len(ids))
                reduced = (np.min(values, axis=0) if column.endswith('_MIN') else np.max(values, axis=0)
                           if column.endswith('_MAX') else np.sum(values, axis=0) if column == 'PRECIPITATION_MM'
                           else np.mean(values, axis=0))
                if not np.allclose(reduced, daily[column].to_numpy(zero_copy_only=False), rtol=1e-10, atol=1e-10, equal_nan=True):
                    raise ValueError(f'Hourly/daily reduction disagreement: {column} {day}')
        if index % 500 == 0:
            print(f'Checked {index + 1}/{len(dates)} UTC days', file=sys.stderr, flush=True)
    for frequency, columns in stats.items():
        for column, result in columns.items():
            counts = source['products'][frequency]['value_status_counts'][column]
            expected_nulls = sum(count for status, count in counts.items() if status != 'COMPLETE')
            if result['nulls'] != expected_nulls:
                raise ValueError('Null counts disagree with source status counts')
    if digest(catalog_path) != source_hash or any((root / name).stat().st_mtime_ns != binding['mtimeNs'] for name, binding in bindings.items()):
        raise ValueError('Source changed during preparation')
    units = {c['name']: c['units'] for c in source['products']['daily']['columns']}
    metrics = [{ 'column': column, 'name': name, 'family': family, 'hourlyColumn': hourly_column,
                 'definition': definition, 'unit': units[column], 'range': [stats['daily'][column]['min'], stats['daily'][column]['max']],
                 'rows': source['products']['daily']['rows'], 'available': source['products']['daily']['rows'] - stats['daily'][column]['nulls'],
                 'circular': 'DIRECTION' in column }
               for column, (name, family, hourly_column, definition) in METRICS.items()]
    snapshot = hashlib.sha256(json.dumps([source_hash, bindings], sort_keys=True).encode()).hexdigest()
    manifest = {'version': 1, 'status': 'validated_local_snapshot', 'snapshot': snapshot, 'dates': dates, 'cells': ids,
                'resolution': 5, 'timezone': 'UTC', 'source': source, 'sourceCatalogSha256': source_hash,
                'bindings': bindings, 'metrics': metrics, 'statistics': stats, 'dailySeries': series,
                'validation': {'days': len(dates), 'uniqueKeys': True, 'completeTimeSupport': True,
                               'checksumVerified': True, 'reductionDays': [dates[i] for i in [0, len(dates)//2, len(dates)-1]],
                               'independentObservationalAccuracy': 'not established'}}
    output.mkdir(parents=True, exist_ok=True)
    temporary = output / '.catalog.json.tmp'
    temporary.write_text(json.dumps(manifest, allow_nan=False, separators=(',', ':')))
    temporary.replace(output / 'catalog.json')
    print(json.dumps({'status': manifest['status'], 'days': len(dates), 'cells': len(ids), 'metrics': len(metrics), 'snapshot': snapshot}), flush=True)


class Store:
    def __init__(self, root, output):
        self.root = root
        self.manifest = json.loads((output / 'catalog.json').read_text())
        if self.manifest.get('status') != 'validated_local_snapshot':
            raise ValueError('Prepare and validate meteorology first')
        self.files = {frequency: pq.ParquetFile(root / f'meteorology-{frequency}.parquet') for frequency in ('daily', 'hourly')}
        self.dates = {day: index for index, day in enumerate(self.manifest['dates'])}
        self.metrics = {metric['column']: metric for metric in self.manifest['metrics']}
        self.check()

    def check(self):
        if digest(self.root / 'catalog.json') != self.manifest['sourceCatalogSha256']:
            raise ValueError('Source catalog changed; prepare meteorology again')
        for name, binding in self.manifest['bindings'].items():
            stat = (self.root / name).stat()
            if stat.st_size != binding['bytes'] or stat.st_mtime_ns != binding['mtimeNs']:
                raise ValueError('Meteorology source changed; prepare again')

    def query(self, request):
        self.check()
        if request.get('snapshot') != self.manifest['snapshot']:
            raise ValueError('Meteorology snapshot changed; reload the map')
        day, column = request.get('date'), request.get('metric')
        if day not in self.dates or column not in self.metrics:
            raise ValueError('Unknown UTC date or meteorology metric')
        operation = request.get('operation')
        period = request.get('period', 'day')
        if period not in ('day', 'week', 'month'):
            raise ValueError('Unknown weather aggregation period')
        if period != 'day':
            if operation != 'daily':
                raise ValueError('Hourly queries require a single day')
            start = date.fromisoformat(day)
            if (period == 'week' and start.weekday() != 0) or (period == 'month' and start.day != 1):
                raise ValueError('Period must start on a UTC calendar boundary')
            end = start + timedelta(days=7) if period == 'week' else (start.replace(day=28) + timedelta(days=4)).replace(day=1)
            days = [str(start + timedelta(days=i)) for i in range((end-start).days)]
            if any(value not in self.dates for value in days):
                raise ValueError('Complete calendar period is outside retained coverage')
            columns = ['U_WIND_10M_MS_MEAN', 'V_WIND_10M_MS_MEAN'] if self.metrics[column]['circular'] else [column]
            table = self.files['daily'].read_row_groups([self.dates[value] for value in days], columns=columns)
            values = {name: table[name].to_numpy(zero_copy_only=False).reshape(len(days), len(self.manifest['cells'])) for name in columns}
            if self.metrics[column]['circular']:
                u, v = (np.mean(values[name], axis=0) for name in columns)
                result = (np.degrees(np.arctan2(-u, -v)) + 360) % 360
                result[np.hypot(u, v) < 1e-12] = np.nan
            else:
                data = values[column]
                result = (np.sum(data, axis=0) if column == 'PRECIPITATION_MM' else
                          np.min(data, axis=0) if column.endswith('_MIN') else
                          np.max(data, axis=0) if column.endswith('_MAX') else np.mean(data, axis=0))
            return {'snapshot': self.manifest['snapshot'], 'date': day, 'metric': column, 'period': period,
                    'ids': self.manifest['cells'], 'values': clean(result)}
        if operation == 'daily':
            table = self.files['daily'].read_row_group(self.dates[day], columns=['H3_INDEX', column])
            return {'snapshot': self.manifest['snapshot'], 'date': day, 'metric': column,
                    'ids': table['H3_INDEX'].to_pylist(), 'values': table[column].to_pylist()}
        if operation != 'hourly':
            raise ValueError('Unsupported read-only meteorology query')
        cell = request.get('cell')
        if cell and cell not in self.manifest['cells']:
            raise ValueError('Cell is outside native meteorology support')
        metric = self.metrics[column]
        table = self.files['hourly'].read_row_group(self.dates[day], columns=[metric['hourlyColumn']])
        values = table[metric['hourlyColumn']].to_numpy(zero_copy_only=False).reshape(24, len(self.manifest['cells']))
        if cell:
            result = values[:, self.manifest['cells'].index(cell)]
            counts = np.isfinite(result).astype(int)
        else:
            counts = np.isfinite(values).sum(axis=1)
            result = np.full(24, np.nan)
            if not metric['circular']:
                np.divide(np.nansum(values, axis=1), counts, out=result, where=counts > 0)
        return {'snapshot': self.manifest['snapshot'], 'date': day, 'metric': column, 'cell': cell,
                'hourlyColumn': metric['hourlyColumn'], 'values': clean(result), 'counts': counts.tolist(),
                'hours': [f'{day}T{hour:02}:00:00Z' for hour in range(24)]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('../../Data/Meteorology'))
    parser.add_argument('--output', type=Path, default=Path('public/local-data/meteorology'))
    parser.add_argument('--prepare', action='store_true')
    args = parser.parse_args()
    if args.prepare:
        prepare(args.source.resolve(), args.output.resolve())
        return
    store = Store(args.source.resolve(), args.output.resolve())
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            response = {'id': request['id'], 'result': store.query(request)}
        except Exception as error:
            response = {'id': request.get('id'), 'error': str(error)}
        print(json.dumps(response, allow_nan=False, separators=(',', ':')), flush=True)


if __name__ == '__main__':
    main()
