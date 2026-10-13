"""Read a published frozen release into a local, ignored browser cache.

No scientific calculation, acquisition, release promotion or source modification.
Requires Python 3.14 and pyarrow (the toolkit consumer environment is suitable).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import tempfile
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def packed(values):
    # Lossless categorical compression; numeric values keep their JSON precision.
    if all(v is None or isinstance(v, (str, bool)) for v in values):
        dictionary = list(dict.fromkeys(values))
        indexes = {v: i for i, v in enumerate(dictionary)}
        return {'dictionary': dictionary, 'indices': [indexes[v] for v in values]}
    return {'values': values}


def unpack(data):
    return data.get('values', [data['dictionary'][i] for i in data['indices']] if 'indices' in data else [])


def unit(column):
    # Explicit producer depth conventions and unambiguous storage suffixes only.
    if column.startswith('BATHYMETRY_PIXEL_COUNT') or column.endswith('_COUNT'):
        return 'count'
    if column.startswith('BATHYMETRY_FRAC_') or column.endswith(('_FRAC', '_FRACTION')):
        return 'fraction'
    if column.startswith('BATHYMETRY') and 'PIXEL' not in column:
        return 'm'
    if column in ('SLOPE', 'ASPECT', 'SLOPE_MEAN_NATIVE_RASTER', 'SLOPE_Q90_NATIVE_RASTER') or column.endswith('_DEG'):
        return '°'
    if column.endswith('_M2'):
        return 'm²'
    if column.endswith('_M'):
        return 'm'
    if column.endswith('_YEAR'):
        return 'year'
    return 'source units'


def prepare(release, output):
    release = release.resolve()
    receipt_path = release.parents[1] / 'publication-receipts' / (release.name + '.json')
    receipt = json.loads(receipt_path.read_text())
    manifest_hash = digest(release / 'manifest.json')
    if receipt['manifest_sha256'] != manifest_hash or not receipt['status'].startswith('published_'):
        raise ValueError('Release lacks a matching published receipt')
    manifest = json.loads((release / 'manifest.json').read_text())
    files = {item['path']: item for item in manifest['files']}
    for name in files:
        if digest(release / name) != files[name]['sha256']:
            raise ValueError(f'Source checksum mismatch: {name}')
    dictionary = json.loads((release / 'FIELD_DICTIONARY.json').read_text())
    output.mkdir(parents=True, exist_ok=True)
    snapshot = output / manifest_hash
    if snapshot.exists():
        raise FileExistsError(f'Cache already exists: {snapshot}. Use a fresh --output for an independent readback.')
    staging = Path(tempfile.mkdtemp(prefix='.prepare-', dir=output))
    catalog = {'version': 1, 'release': release.name, 'artifact': manifest['artifact'], 'manifestSha256': manifest_hash,
               'receiptStatus': receipt['status'], 'publishedAt': receipt['published_at_utc'], 'sourceCompleteness': manifest['source_completeness'],
               'defaultResolution': 6, 'resolutions': {}, 'features': []}
    report = {'release': release.name, 'manifest_sha256': manifest_hash, 'resolutions': {}}
    try:
        for res in (6, 8):
            directory = staging / f'r{res}'
            directory.mkdir()
            source = f'metrics/SEASCAPE_STATIC_NATIVE_R{res}.parquet'
            table = pq.read_table(release / source)
            ids = table['H3_INDEX'].to_pylist()
            if len(ids) != len(set(ids)) or None in ids or set(table['H3_RESOLUTION'].to_pylist()) != {res}:
                raise ValueError('Invalid native H3 identity/resolution')
            def write(name, payload):
                path = directory / (name + '.json')
                path.write_text(json.dumps(payload, allow_nan=False, separators=(',', ':')))
                return {'url': f'/local-data/seascape/{manifest_hash}/r{res}/{name}.json', 'sha256': digest(path)}
            cells_file = write('cells', {'ids': ids, 'resolution': res, 'sourceSha256': files[source]['sha256']})
            entries = [row for row in dictionary if row['resolution'] == res]
            by_column = {row['output_column']: row for row in entries}
            columns = {}
            # Keep all fields, including unavailable metrics and categorical qualifiers.
            for field in table.schema:
                if field.name in ('H3_INDEX', 'H3_RESOLUTION'):
                    continue
                values = table[field.name].to_pylist()
                if any(isinstance(v, int) and not isinstance(v, bool) and abs(v) > 2**53 - 1 for v in values):
                    raise ValueError(f'Unsafe JavaScript integer in {field.name}; explicit string encoding needed')
                if any(isinstance(v, float) and not math.isfinite(v) for v in values):
                    raise ValueError(f'Nonfinite source field {field.name}; explicit source policy needed')
                binding = write(field.name, packed(values))
                # Independent JSON readback compares every value/null in source row order.
                if unpack(json.loads((directory / (field.name + '.json')).read_text())) != values:
                    raise ValueError(f'Lossless readback failed for {field.name}')
                columns[field.name] = binding
                if not (pa.types.is_integer(field.type) or pa.types.is_floating(field.type)):
                    continue
                if any(token in field.name for token in ('H3_CENTRE_', 'H3_CENTER_')):
                    continue
                entry = by_column[field.name]
                present = [v for v in values if v is not None]
                col = entry['source_column'] or field.name
                family = field.name.split('__')[0] if '__' in field.name else 'PREFERRED'
                label = col.replace('_', ' ').capitalize()
                if field.name == 'BATHYMETRY':
                    label = 'Bathymetry · mean depth (positive down)'
                qualifiers = list(dict.fromkeys(entry.get('row_quality_and_coverage_columns', []) + entry.get('source_observation_period_columns', []) + [entry.get('source_release_id_column')]))
                qualifiers = [q for q in qualifiers if q and q in table.column_names]
                catalog['features'].append({'id': field.name, 'resolution': res, 'name': label, 'family': family,
                    'unit': unit(col), 'range': [min(present), max(present)] if present else [0, 1],
                    'available': len(present), 'rows': len(ids), 'role': entry['role'], 'qualifiers': qualifiers,
                    'sourceRelease': entry['source_release'], 'sourcePath': entry['source_path'], 'sourceSha256': entry['source_sha256'],
                    'definition': entry.get('units_and_support', ''), 'modelingEligibility': entry.get('modeling_eligibility', ''),
                    'aliasOf': entry.get('alias_of'), 'arrowType': str(field.type)})
            catalog['resolutions'][str(res)] = {'rows': len(ids), 'cells': cells_file, 'columns': columns, 'sourcePath': source, 'sourceSha256': files[source]['sha256']}
            report['resolutions'][str(res)] = {'rows': len(ids), 'fields_exactly_read_back': len(columns), 'source_sha256': files[source]['sha256']}
        (staging / 'consumption-guide.txt').write_bytes((release / 'CONSUMPTION_GUIDE.txt').read_bytes())
        (staging / 'scope.json').write_bytes((release / 'SCOPE_AND_JOIN_CONTRACT_SCHEMA3.json').read_bytes())
        (staging / 'validation.json').write_text(json.dumps(report, indent=2))
        (staging / 'catalog.json').write_text(json.dumps(catalog, allow_nan=False, separators=(',', ':')))
        staging.rename(snapshot)
        # Catalog is the commit point; its asset URLs identify immutable source bytes.
        temporary = output / '.catalog.json.tmp'
        temporary.write_bytes((snapshot / 'catalog.json').read_bytes())
        temporary.replace(output / 'catalog.json')
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--release', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/local-data/seascape')
    args = parser.parse_args()
    prepare(args.release, args.output)
