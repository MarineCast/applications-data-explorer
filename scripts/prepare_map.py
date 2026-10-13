"""Prepare all supplied Data map products, without modifying or computing source values.

Static native tables, annual kelp and directional rays retain independent products/grains.
Requires pyarrow and h3. Output is an ignored, immutable local browser snapshot.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import tempfile
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from prepare_seascape import digest, packed, unpack, unit


def verify_files(root, files):
    for name, binding in files.items():
        path = (root / name).resolve()
        if not path.is_relative_to(root.resolve()) or digest(path) != binding['sha256']:
            raise ValueError(f'Source checksum mismatch: {name}')


def validate_table(table, resolution, key):
    ids = table[key].to_pylist()
    if None in ids or len(set(ids)) != len(ids):
        raise ValueError('Duplicate or null native cell keys in selected slice')
    if any(not h3.is_valid_cell(i) or h3.get_resolution(i) != resolution for i in ids):
        raise ValueError('Invalid native H3 identity/resolution')
    for name in ('H3_RESOLUTION', 'h3_resolution'):
        if name in table.column_names and set(table[name].to_pylist()) != {resolution}:
            raise ValueError('Mixed native resolution in selected slice')
    return ids


def map_kind(field, entry):
    name = field.name
    if any(token in name for token in ('H3_CENTRE_', 'H3_CENTER_', 'LONGITUDE', 'LATITUDE', 'EASTING', 'NORTHING')):
        return None
    if name.split('__')[-1] in ('H3_INDEX', 'h3_index', 'H3_RESOLUTION', 'R6_PARENT', 'OBSERVATION_YEAR', 'BEARING_INDEX', 'BEARING', 'BEARING_DEG'):
        return None
    if pa.types.is_integer(field.type) or pa.types.is_floating(field.type) or pa.types.is_null(field.type):
        return 'numeric'
    if pa.types.is_boolean(field.type):
        return 'categorical'
    if pa.types.is_string(field.type) or pa.types.is_large_string(field.type):
        # IDs, serialized inventories and method/provenance strings stay in the inspector.
        if entry.get('role') == 'immutable_release_identifier' or any(token in name for token in ('_JSON', '_ID', '_VERSION', 'SOURCE_RELEASE', 'SOURCE_DATASET', 'SOURCE_LAYER', '_METHOD', '_FORMULA', '_SEMANTICS', 'ORIGIN_SOURCE_H3')):
            return None
        return 'categorical'
    raise ValueError(f'Unsupported source type: {name}: {field.type}')


class Exporter:
    def __init__(self, staging, snapshot_id):
        self.staging = staging
        self.snapshot_id = snapshot_id
        self.blobs = staging / 'assets'
        self.blobs.mkdir()
        self.report = []

    def write(self, payload):
        body = json.dumps(payload, allow_nan=False, separators=(',', ':')).encode()
        checksum = hashlib.sha256(body).hexdigest()
        path = self.blobs / f'{checksum}.json'
        if not path.exists():
            path.write_bytes(body)
        elif path.read_bytes() != body:
            raise ValueError('Existing asset differs from source bytes')
        return {'url': f'/local-data/seascape/{self.snapshot_id}/assets/{checksum}.json', 'sha256': checksum}

    def table(self, table, resolution, key, source, entries, dataset, product_id, feature_prefix='', slice_value=None):
        ids = validate_table(table, resolution, key)
        cells = self.write({'ids': ids, 'resolution': resolution, 'sourceSha256': source['sha256']})
        columns, features = {}, []
        for field in table.schema:
            if field.name in (key, 'H3_RESOLUTION'):
                continue
            values = table[field.name].to_pylist()
            if any(isinstance(v, int) and not isinstance(v, bool) and abs(v) > 2**53 - 1 for v in values):
                raise ValueError(f'Unsafe JavaScript integer: {field.name}')
            if any(isinstance(v, float) and not math.isfinite(v) for v in values):
                raise ValueError(f'Nonfinite source value: {field.name}')
            binding = self.write(packed(values))
            path = self.blobs / f"{binding['sha256']}.json"
            if unpack(json.loads(path.read_text())) != values:
                raise ValueError(f'Lossless readback failed: {field.name}')
            columns[field.name] = binding
            entry = entries[field.name]
            kind = map_kind(field, entry)
            if not kind:
                continue
            present = [v for v in values if v is not None]
            categories = sorted(set(present), key=lambda v: (type(v).__name__, str(v))) if kind == 'categorical' else None
            col = entry.get('source_column') or field.name
            qualifiers = entry.get('qualifiers', [])
            qualifiers = list(dict.fromkeys(qualifiers + entry.get('row_quality_and_coverage_columns', []) + entry.get('source_observation_period_columns', []) + [entry.get('source_release_id_column')]))
            qualifiers = [q for q in qualifiers if q and q in table.column_names and q not in (key, 'H3_RESOLUTION')]
            features.append({
                'id': feature_prefix + field.name, 'column': field.name, 'productId': product_id,
                'dataset': dataset, 'kind': kind, 'categories': categories,
                'resolution': resolution, 'name': col.replace('_', ' ').capitalize(),
                'family': entry.get('family', field.name.split('__')[0] if '__' in field.name else 'PREFERRED'),
                'unit': entry.get('unit', unit(col)) if kind == 'numeric' else 'category',
                'range': [min(present), max(present)] if present and kind == 'numeric' else [0, max(1, len(categories or []) - 1)],
                'available': len(present), 'rows': len(ids), 'role': entry.get('role', 'source_field'),
                'qualifiers': qualifiers, 'sourceRelease': entry.get('source_release', source['release']),
                'sourcePath': entry.get('source_path', source['path']), 'sourceSha256': entry.get('source_sha256', source['sha256']),
                'definition': entry.get('definition', entry.get('units_and_support', 'Unchanged source values; retain linked source qualifications.')),
                'modelingEligibility': entry.get('modeling_eligibility', 'not_assigned; preserve source semantics'),
                'aliasOf': entry.get('alias_of'), 'arrowType': str(field.type),
            })
        self.report.append({'product': product_id, 'slice': slice_value, 'rows': len(ids), 'fields_exactly_read_back': len(columns), 'map_fields': len(features), 'source_sha256': source['sha256']})
        return {'rows': len(ids), 'cells': cells, 'columns': columns, 'sourceSha256': source['sha256'], 'sourcePath': source['path'], 'resolution': resolution}, features


def prepare(seascape, governance, output):
    seascape, governance = seascape.resolve(), governance.resolve()
    manifest_hash = digest(seascape / 'manifest.json')
    receipt = json.loads((seascape.parents[1] / 'publication-receipts' / f'{seascape.name}.json').read_text())
    receipt_hash = receipt.get('manifest_sha256', receipt.get('manifest_raw_content_sha256'))
    if receipt_hash != manifest_hash or not (receipt['status'].startswith('published_') or receipt['status'].startswith('PASS_atomic_immutable_')):
        raise ValueError('Seascape release lacks a matching publication receipt')
    manifest = json.loads((seascape / 'manifest.json').read_text())
    verify_files(seascape, {f['path']: f for f in manifest['files']})
    generation = json.loads((governance / 'generation.json').read_text())
    verify_files(governance, generation['files'])
    if json.loads((governance / 'validation.json').read_text())['status'] != 'passed':
        raise ValueError('Governance generation lacks passed validation')
    sidecars = json.loads((seascape / 'SIDECAR_BINDINGS.json').read_text())
    for binding in sidecars:
        if digest(Path(binding['absolute_path'])) != binding['sha256']:
            raise ValueError('Sidecar checksum mismatch')
    source_bindings = {'seascape': manifest_hash, 'governance': digest(governance / 'generation.json'), 'sidecars': sidecars, 'exporter': digest(Path(__file__)), 'helpers': digest(Path(__file__).with_name('prepare_seascape.py'))}
    snapshot_id = hashlib.sha256(json.dumps(source_bindings, sort_keys=True).encode()).hexdigest()
    output.mkdir(parents=True, exist_ok=True)
    snapshot = output / snapshot_id
    staging = Path(tempfile.mkdtemp(prefix='.prepare-map-', dir=output))
    try:
        exporter = Exporter(staging, snapshot_id)
        catalog = {'version': 2, 'release': seascape.name, 'artifact': manifest['artifact'], 'manifestSha256': snapshot_id,
                   'receiptStatus': receipt['status'], 'publishedAt': receipt['published_at_utc'], 'sourceCompleteness': 'partial',
                   'resolutions': {}, 'products': {}, 'features': [], 'datasets': {
                       'seascape': {'name': 'Seascape', 'release': seascape.name, 'manifestSha256': manifest_hash, 'status': 'published partial source release', 'publishedAt': receipt['published_at_utc'], 'limitations': 'Partial source coverage; retained source observations may be historical or undated.'},
                       'governance': {'name': 'Governance', 'release': governance.name, 'manifestSha256': source_bindings['governance'], 'status': 'validated local research inventory', 'publishedAt': generation['created_at_utc'], 'limitations': 'Research only; model-ineligible. Recorded geometry does not establish current law, effective dates or complete jurisdiction.'},
                       'kelp': {'name': 'Annual kelp', 'release': Path(sidecars[0]['absolute_path']).parents[1].name, 'status': 'source-qualified mapped evidence', 'limitations': 'Select one recorded survey year. Positive mapped evidence is not current presence; missing survey support is not absence.'},
                       'coastal-rays': {'name': 'Directional coastal bounds', 'release': Path(sidecars[1]['absolute_path']).parent.name, 'status': 'source-qualified geometric bounds', 'limitations': 'Select one of 16 bearings. Origin-defined mapped water bounds are not qualified physical fetch.'},
                   }, 'unavailableProducts': [{'name': 'Viewshed in Data/', 'reason': 'Readiness records only; no completed regional metric product in Data/viewshed. The separate Viewshed page uses its explicitly sourced research pilot.'}]}
        dictionary = json.loads((seascape / 'FIELD_DICTIONARY.json').read_text())
        for res in (6, 8):
            source_path = f'metrics/SEASCAPE_STATIC_NATIVE_R{res}.parquet'
            source = {'path': source_path, 'sha256': digest(seascape / source_path), 'release': seascape.name}
            entries = {x['output_column']: x for x in dictionary if x['resolution'] == res}
            table = pq.read_table(seascape / source_path)
            # Every namespace's original fields remain available when inspecting any of its map layers.
            for name, entry in entries.items():
                ns = name.split('__')[0] + '__'
                entry['qualifiers'] = [x for x in table.column_names if '__' in name and x.startswith(ns)]
            product_id = f'seascape-r{res}'
            product, features = exporter.table(table, res, 'H3_INDEX', source, entries, 'seascape', product_id)
            catalog['products'][product_id] = product
            catalog['resolutions'][str(res)] = product
            catalog['features'].extend(features)
            source_path = f'delivery/governance-inventory-r{res}.parquet'
            gm = json.loads((governance / source_path).with_suffix('.manifest.json').read_text())
            source = {'path': source_path, 'sha256': gm['artifact']['sha256'], 'release': governance.name}
            entries = {n: {'source_column': n, 'family': n.split('__')[0].replace('_', ' ').title(), 'unit': {'1': 'fraction', 'count': 'count', 'm': 'm'}.get(e.get('units'), 'source units'),
                           'definition': e['definition'] + ' ' + e.get('interpretation', ''), 'modeling_eligibility': 'false; research-only recorded inventory',
                           'qualifiers': [e['missing_reason_field']] if e.get('missing_reason_field') else []} for n, e in gm['fields'].items()}
            product_id = f'governance-r{res}'
            product, features = exporter.table(pq.read_table(governance / source_path), res, 'h3_index', source, entries, 'governance', product_id, 'GOVERNANCE__')
            catalog['products'][product_id] = product
            catalog['features'].extend(features)
        for binding in sidecars:
            path = Path(binding['absolute_path'])
            annual = 'OBSERVATION_YEAR' in binding['grain']
            axis, dataset, prefix = ('OBSERVATION_YEAR', 'kelp', 'KELP_ANNUAL__') if annual else ('BEARING_INDEX', 'coastal-rays', 'COASTAL_RAY__')
            # Read one native slice at a time; never combine years or average bearings.
            axes = sorted(set(pq.read_table(path, columns=[axis])[axis].to_pylist()))
            for res in ((6, 8) if annual else (8,)):
                product_id = f'{dataset}-r{res}'
                slices, combined_features = {}, {}
                for value in axes:
                    filters = [(axis, '=', value), ('H3_RESOLUTION', '=', res)]
                    table = pq.read_table(path, filters=filters)
                    qualifiers = [n for n in table.column_names if n not in ('H3_INDEX', 'H3_RESOLUTION')]
                    entries = {n: {'source_column': n, 'family': 'Mapped annual kelp' if annual else 'Origin-defined coastal bounds', 'qualifiers': qualifiers,
                                   'definition': catalog['datasets'][dataset]['limitations']} for n in table.column_names}
                    source = {'path': str(path.relative_to(path.parents[1] if annual else path.parent)), 'sha256': binding['sha256'], 'release': catalog['datasets'][dataset]['release']}
                    product, features = exporter.table(table, res, 'H3_INDEX', source, entries, dataset, product_id, prefix, str(value))
                    label = str(value) if annual else f"{pc.unique(table['BEARING']).to_pylist()[0]} · {pc.unique(table['BEARING_DEG']).to_pylist()[0]}°"
                    product['label'] = label
                    slices[str(value)] = product
                    for feature in features:
                        prior = combined_features.get(feature['id'])
                        if prior:
                            feature['available'] += prior['available']
                            feature['categories'] = sorted(set((prior.get('categories') or []) + (feature.get('categories') or [])), key=str) if feature['kind'] == 'categorical' else None
                        combined_features[feature['id']] = feature
                catalog['products'][product_id] = {'axis': 'Survey year' if annual else 'Bearing', 'defaultSlice': str(axes[-1] if annual else axes[0]), 'slices': slices}
                catalog['features'].extend(combined_features.values())
        # Keep all metadata and native companions explicit; no crosswalk record-to-cell summation.
        catalog['datasets']['governance']['companions'] = ['Native geometries and source attributes', 'Fishing-area identity crosswalk (feature × cell; not an additive cell metric)']
        (staging / 'consumption-guide.txt').write_bytes((seascape / 'CONSUMPTION_GUIDE.txt').read_bytes())
        (staging / 'validation.json').write_text(json.dumps({'source_bindings': source_bindings, 'tables': exporter.report, 'status': 'every_exported_value_read_back_exactly'}, indent=2))
        (staging / 'catalog.json').write_text(json.dumps(catalog, allow_nan=False, separators=(',', ':')))
        # Repeat preparation verifies immutable output before reusing it.
        if snapshot.exists():
            for p in staging.rglob('*'):
                if p.is_file() and (not (snapshot / p.relative_to(staging)).is_file() or digest(p) != digest(snapshot / p.relative_to(staging))):
                    raise ValueError('Existing snapshot failed independent readback')
            shutil.rmtree(staging)
        else:
            staging.rename(snapshot)
        temporary = output / '.catalog.json.tmp'
        temporary.write_bytes((snapshot / 'catalog.json').read_bytes())
        temporary.replace(output / 'catalog.json')
        print(json.dumps({'snapshot': snapshot_id, 'features': len(catalog['features']), 'tables': len(exporter.report), 'status': 'exact source readback passed'}, indent=2))
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seascape', type=Path, required=True)
    parser.add_argument('--governance', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/local-data/seascape')
    args = parser.parse_args()
    prepare(args.seascape, args.governance, args.output)
