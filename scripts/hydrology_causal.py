"""Read-only causal companion and producer-compatible shared snapshot protocol.

No sibling imports or calculations: the app validates and encodes delivered values.
"""
from contextlib import contextmanager
from datetime import date, timedelta
import fcntl
import hashlib
import json
import math
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

CAUSAL_METRICS = {
    'causal_discharge_seasonal_mean': ('Causal seasonal mean discharge', 'm3/s', 'Mean discharge in the qualified seasonal reference.', 'line'),
    'causal_discharge_seasonal_p90': ('Causal seasonal P90 discharge', 'm3/s', 'Linear-interpolated 90th percentile of the seasonal reference.', 'line'),
    'causal_discharge_seasonal_anomaly': ('Causal discharge anomaly', 'm3/s', 'As-of discharge minus the seasonal reference mean.', 'line'),
    'causal_discharge_seasonal_percentile': ('Causal discharge percentile', 'percent', '100 × (reference samples below as-of discharge + half tied samples) / reference sample count.', 'line'),
    'causal_discharge_pulse': ('Causal discharge pulse', '1', '1 for a witnessed crossing: previous-day discharge < as-of seasonal P90 ≤ as-of discharge; otherwise 0. Both endpoints use the same threshold. Missing endpoints are unavailable.', 'step'),
    'causal_days_since_discharge_pulse': ('Causal days since pulse', 'day', 'Elapsed days since a witnessed crossing. Gaps reset event knowledge; unavailable until another crossing.', 'step'),
    'causal_reference_samples': ('Causal reference samples', 'day', 'Number of eligible seasonal reference observations, including during warmup. Equal-weight provider days are not independent samples.', 'step'),
    'causal_reference_years': ('Causal reference years', 'year', 'Distinct eligible completed reference years, including during warmup.', 'step'),
}


def checksum(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


@contextmanager
def product_snapshot(destination):
    """Match the producer's public shared-lock/ownership protocol without importing it.

    Historical fixtures without canonical ownership remain readable. A causal
    companion requires canonical ownership; no lock/store is created by this reader.
    """
    target = Path(destination).expanduser().absolute()
    target = target.parent.resolve() / target.name
    if not (target/'owner.json').exists():
        if (target/'causal.parquet').exists() or (target/'station_temperature.parquet').exists():
            raise ValueError('Causal product needs an owned canonical snapshot')
        yield target
        return
    identity = hashlib.sha256(json.dumps(str(target), sort_keys=True).encode()).hexdigest()[:16]
    store = target.parent.parent/'.marinecast-work/hydrology'/identity
    owner = {'owner': 'hydrology-current-per-river-v1', 'destination': str(target)}
    with (store/'.publication.lock').open('rb') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_SH | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError('Hydrology publication is active; retry after it completes') from error
        if (target.is_symlink() or (target/'owner.json').is_symlink()
                or json.loads((store/'owner.json').read_text()) != owner
                or json.loads((target/'owner.json').read_text()) != owner
                or (store/'promotion.json').exists() or (store/'station-temperature-transaction.json').exists()):
            raise ValueError('Hydrology snapshot ownership/recovery mismatch')
        yield target


def read_causal(root, entry, rivers, dates, pack):
    if not isinstance(entry, dict) or entry.get('path') != 'causal.parquet':
        raise ValueError('Missing causal catalog binding')
    if entry.get('source_status') != 'current':
        raise ValueError('Causal sources changed; producer rebuild required')
    path = root/'causal.parquet'
    if path.is_symlink() or not path.is_file():
        raise ValueError('Bound causal.parquet is missing or unsafe')
    if checksum(path) != entry.get('sha256') or path.stat().st_size != entry.get('bytes'):
        raise ValueError('Causal checksum/size mismatch')
    table = pq.read_table(path)
    names = ['river_id','station_id','date','as_of_date','temporal_basis','metric','value','unit','status','reason','method_version']
    if table.column_names != names:
        raise ValueError('Unsupported causal schema')
    for field in table.schema:
        expected = pa.date32() if field.name in {'date','as_of_date'} else pa.float64() if field.name == 'value' else None
        if (expected and field.type != expected) or (expected is None and not (pa.types.is_string(field.type) or pa.types.is_large_string(field.type))):
            raise ValueError('Unsupported causal Arrow type')
    meta = json.loads((table.schema.metadata or {}).get(b'hydrology_causal', b'{}'))
    definition = entry.get('definition', {})
    identity = hashlib.sha256(json.dumps({k:v for k,v in definition.items() if k != 'identity'}, sort_keys=True, default=str).encode()).hexdigest()
    if (meta.get('definition') != definition or definition.get('identity') != identity
            or definition.get('method') != 'causal-seasonal-lag1-v1' or definition.get('lag_days') != 1
            or definition.get('model_eligible') is not False or definition.get('event_date_causal') is not True
            or definition.get('units') != {k:v[1] for k,v in CAUSAL_METRICS.items()}
            or not str(definition.get('operational_availability', '')).startswith('unknown')):
        raise ValueError('Causal definition/binding mismatch')
    for name, minimum, maximum in [('window_days',0,182),('min_samples',1,100000),('min_years',1,30),('history_years',1,30)]:
        value = definition.get(name)
        if type(value) is not int or not minimum <= value <= maximum:
            raise ValueError('Unsupported causal reference parameters')
    sources = {r['id']:checksum(root/r['id']/'conditions.parquet') for r in rivers}
    if entry.get('source_conditions_sha256') != sources or meta.get('sources') != sources:
        raise ValueError('Causal condition-source binding is stale')
    if (set(table['river_id'].to_pylist()) != set(sources) or table.num_rows != len(rivers)*len(dates)*len(CAUSAL_METRICS)
            or entry.get('rows') != table.num_rows):
        raise ValueError('Causal river/row support mismatch')
    as_of = [(date.fromisoformat(day)-timedelta(days=1)).isoformat() for day in dates]
    all_series = {}; stats = {key:[] for key in CAUSAL_METRICS}
    allowed_reasons = {'insufficient_reference_support','as_of_discharge_unavailable','previous_day_unavailable','pulse_history_unknown'}
    for river in rivers:
        rows = table.filter(pc.equal(table['river_id'], river['id'])).to_pylist()
        groups = {key:[] for key in CAUSAL_METRICS}
        for row in rows:
            if not isinstance(row['date'],date) or not isinstance(row['as_of_date'],date):
                raise ValueError('Causal null date key')
            if row['metric'] not in groups or row['station_id'] != river['stationId'] or row['temporal_basis'] != 'provider_daily' or row['method_version'] != definition['method']:
                raise ValueError('Causal row identity/basis mismatch')
            groups[row['metric']].append(row)
        series = {}
        for metric, items in groups.items():
            items.sort(key=lambda row:row['date'])
            if [row['date'].isoformat() for row in items] != dates or [row['as_of_date'].isoformat() for row in items] != as_of:
                raise ValueError('Causal calendar/as-of keys mismatch')
            for row in items:
                value = row['value']
                if row['unit'] != CAUSAL_METRICS[metric][1] or (value is None and (row['status'] != 'unavailable' or row['reason'] not in allowed_reasons)) or (value is not None and (not math.isfinite(value) or row['status'] != 'valid' or row['reason'] is not None)):
                    raise ValueError('Causal value/status/unit mismatch')
                if value is not None and ((metric == 'causal_discharge_pulse' and value not in (0,1)) or (metric == 'causal_discharge_seasonal_percentile' and not 0 <= value <= 100) or (metric in {'causal_days_since_discharge_pulse','causal_reference_samples','causal_reference_years'} and (value < 0 or not value.is_integer()))):
                    raise ValueError('Causal flag/count range mismatch')
            values = [row['value'] for row in items]
            supported = [v for v in values if v is not None]
            if meta.get('support', {}).get(river['id'], {}).get(metric) != len(supported):
                raise ValueError('Causal support count mismatch')
            stats[metric].extend(supported)
            series[metric] = {'values':pack(values), 'statuses':pack([r['status'] for r in items]), 'reasons':pack([r['reason'] for r in items]), 'contributorSeries':pack([None]*len(items))}
        all_series[river['id']] = series
    if checksum(path) != entry['sha256'] or any(checksum(root/rid/'conditions.parquet') != sha for rid,sha in sources.items()):
        raise ValueError('Causal inputs changed during read')
    metrics = [{'id':key,'name':info[0],'family':'Causal discharge','unit':info[1], 'definition':info[2], 'plot':info[3], 'causal':True,
                'range':[min(stats[key]),max(stats[key])] if stats[key] else [0,1], 'available':len(stats[key])} for key,info in CAUSAL_METRICS.items()]
    return all_series, metrics, {'definition':definition,'sha256':entry['sha256'],'asOfDates':as_of,'sourceConditionsSha256':sources,'dayDefinitions':meta['day_definitions']}, table.num_rows
