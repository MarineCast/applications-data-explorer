"""Read-only encoding of Hydrology/influence.parquet and its embedded recipe."""
import hashlib
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
from hydrology_input import digest

SCHEMA = pa.schema([
    ('factor_type', pa.string()), ('river_id', pa.string()),
    ('h3_index', pa.string()), ('distance_profile', pa.string()),
    ('water_distance_m', pa.float64()), ('reachable_r8_children', pa.int64()),
    ('weight', pa.float64()), ('date', pa.date32()), ('lag_profile', pa.string()),
    ('discharge', pa.float64()), ('relative_flow', pa.float64()),
    ('interpolated_input_weight', pa.float64()),
])


def native_catalog_sha256(catalog):
    native = {k:v for k,v in catalog.items() if k != 'products'}
    return hashlib.sha256(json.dumps(native, indent=2, sort_keys=True, default=str, allow_nan=False).encode()).hexdigest()


def prepare(source, study, hydrology, output):
    source, study, hydrology, output = map(Path, (source, study, hydrology, output))
    pinned_source = source.resolve(strict=True)
    if source.name != 'influence.parquet' or pinned_source.parent != hydrology.resolve():
        raise ValueError('Influence must be Hydrology/influence.parquet')
    catalog_path = hydrology/'catalog.json'
    catalog = json.loads(catalog_path.read_text())
    original_catalog_sha = digest(catalog_path)
    entry = catalog.get('products', {}).get('influence')
    if not isinstance(entry, dict) or entry.get('path') != 'influence.parquet' or entry.get('format') != 'hydrology-influence-factors-1':
        raise ValueError('Missing or unsafe Hydrology influence catalog entry')
    if entry.get('source_status') != 'current':
        raise ValueError('Influence source changed; rebuild the configured influence product')
    content = pinned_source.read_bytes()
    original_sha = hashlib.sha256(content).hexdigest()
    if entry.get('sha256') != original_sha or entry.get('bytes') != len(content):
        raise ValueError('Influence catalog checksum/size mismatch')
    table = pq.read_table(pa.BufferReader(content))
    if not table.schema.equals(SCHEMA, check_metadata=False):
        raise ValueError('Unsupported influence Parquet schema')
    metadata = json.loads((table.schema.metadata or {}).get(b'hydrology_influence', b'{}'))
    if metadata.get('format') != 'hydrology-influence-factors-1':
        raise ValueError('Unsupported influence Parquet metadata')
    recipe = metadata['recipe']
    if entry.get('identity') != metadata.get('identity') or entry.get('rows') != table.num_rows:
        raise ValueError('Influence catalog identity/row mismatch')
    if metadata.get('identity') != hashlib.sha256(json.dumps(recipe, sort_keys=True, default=str).encode()).hexdigest():
        raise ValueError('Influence recipe identity mismatch')
    if recipe.get('method') != 'river-influence-water-r8-min-child-lag-v2' or recipe.get('model_eligible') is not False or recipe.get('retrospective') is not True or recipe.get('temporal_basis') != 'provider_daily':
        raise ValueError('Unsupported influence method')
    if any(entry.get(k) != recipe.get(k) for k in ['temporal_basis', 'model_eligible', 'retrospective']) or entry.get('metrics') != recipe['signals'] or entry.get('native_catalog_sha256') != recipe['hydrology_catalog_sha256']:
        raise ValueError('Influence catalog qualification/source mismatch')
    if recipe['study_sha256'] != digest(study) or recipe['hydrology_catalog_sha256'] != native_catalog_sha256(catalog):
        raise ValueError('Influence source changed; rebuild the configured influence product')
    if set(recipe['signals']) != {'discharge', 'relative_flow'}:
        raise ValueError('Unsupported influence signals')
    cells, dates, rivers = recipe['cells'], recipe['dates'], recipe['rivers']
    records = table.to_pylist()
    factor_hash = hashlib.sha256()
    for row in records:
        factor_hash.update(json.dumps(row, sort_keys=True, default=str, allow_nan=False, separators=(',', ':')).encode())
        factor_hash.update(b'\n')
    if factor_hash.hexdigest() != metadata.get('factors_sha256'):
        raise ValueError('Influence factor checksum mismatch')
    if {r['factor_type'] for r in records} != {'spatial', 'temporal'}:
        raise ValueError('Unexpected influence factor types')
    spatial = [r for r in records if r['factor_type'] == 'spatial']
    signals = [r for r in records if r['factor_type'] == 'temporal']
    spatial_columns = ['h3_index', 'distance_profile', 'water_distance_m', 'reachable_r8_children', 'weight']
    temporal_columns = ['date', 'lag_profile', 'discharge', 'relative_flow', 'interpolated_input_weight']
    if any(any(r[k] is not None for k in temporal_columns) for r in spatial) or any(any(r[k] is not None for k in spatial_columns) for r in signals):
        raise ValueError('Mixed influence factor support')
    config = recipe['config'];weights={};distances={};daily={}
    if len(spatial) != len(rivers)*len(cells)*len(config['distance_profiles']) or len(signals) != len(rivers)*len(dates)*len(config['lag_profiles']):
        raise ValueError('Influence factor count mismatch')
    for row in signals:
        row['date'] = row['date'].isoformat() if row['date'] is not None else None
    for river in rivers:
        rid=river['id'];selected=[r for r in spatial if r['river_id']==rid]
        weights[rid]={}
        for p in config['distance_profiles']:
            rows=[r for r in selected if r['distance_profile']==p['id']]
            indexed={r['h3_index']:r for r in rows}
            if len(indexed)!=len(cells) or len(rows)!=len(cells) or set(indexed)!=set(cells):
                raise ValueError('Influence spatial calendar/identity mismatch')
            weights[rid][p['id']]=[indexed[c]['weight'] for c in cells]
            current_distances=[indexed[c]['water_distance_m'] for c in cells]
            if rid in distances and distances[rid] != current_distances:
                raise ValueError('Influence distance differs across profiles')
            distances[rid]=current_distances
        daily[rid]={}
        for p in config['lag_profiles']:
            rows=[r for r in signals if r['river_id']==rid and r['lag_profile']==p['id']]
            indexed={r['date']:r for r in rows}
            if len(indexed)!=len(dates) or len(rows)!=len(dates) or set(indexed)!=set(dates):
                raise ValueError('Influence signal calendar/identity mismatch')
            daily[rid][p['id']]={metric:[indexed[d][metric] for d in dates] for metric in [*recipe['signals'],'interpolated_input_weight']}
    snapshot=hashlib.sha256((original_sha+digest(__file__)).encode()).hexdigest()
    payload={'version':1,'snapshot':snapshot,'recipe':recipe,'weights':weights,'distances':distances,'daily':daily}
    output.mkdir(parents=True,exist_ok=True)
    asset=output/(snapshot+'.json');asset.write_text(json.dumps(payload,separators=(',',':'),allow_nan=False))
    result={'version':1,'snapshot':snapshot,'source_sha256':original_sha,'data':{'url':'/local-data/river-influence/'+asset.name,'sha256':digest(asset)}}
    if source.resolve() != pinned_source or digest(source)!=original_sha:
        raise ValueError('Influence changed during read')
    if digest(study)!=recipe['study_sha256'] or digest(catalog_path)!=original_catalog_sha:
        raise ValueError('Source changed during influence read')
    (output/'catalog.json').write_text(json.dumps(result,indent=2)+'\n')
    return result
