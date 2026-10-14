"""Read flat governance Parquets without importing the producer or release helpers."""
from __future__ import annotations

import json
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq

from prepare_seascape import digest


def bindings(root):
    root = root.resolve()
    catalog = json.loads((root / 'catalog.json').read_text())
    if catalog.get('schema_version') != 1 or catalog.get('domain') != 'governance':
        raise ValueError('Unsupported governance catalog')
    files = {'catalog.json': {'sha256': digest(root / 'catalog.json')}}
    for res, variants in catalog['tables'].items():
        if not variants or set(variants).difference({'static', 'dynamic'}):
            raise ValueError('Invalid governance table variants')
        for kind, binding in variants.items():
            name = f'governance-r{int(res)}-{kind}.parquet'
            if binding['path'] != name:
                raise ValueError('Invalid governance catalog path')
            files[name] = binding
    from prepare_map import verify_files
    verify_files(root, files)
    return files


def append_governance(exporter, catalog, root):
    """Retain independent native resolution/date slices and linked missingness flags."""
    root = root.resolve()
    inputs = json.loads((root / 'catalog.json').read_text())
    files = bindings(root)
    catalog['datasets']['governance'] = {
        'name': 'Governance', 'release': 'current', 'status': 'current research inventory',
        'publishedAt': inputs['last_updated_utc'], 'manifestSha256': files['catalog.json']['sha256'],
        'limitations': 'Research only; model-ineligible. Recorded geometry does not establish current law or complete jurisdiction.',
        'companions': ['OriginalData: original dataset extents, source identities, attributes and receipt times'],
    }
    for res, variants in sorted(inputs['tables'].items()):
        for kind, binding in variants.items():
            path = root / binding['path']
            context = json.loads((pq.read_schema(path).metadata or {})[b'governance'])
            if context.get('model_eligible') is not False or context['spatial']['h3_resolution'] != int(res) or context['temporal']['type'] != kind:
                raise ValueError('Governance embedded grain/eligibility mismatch')
            table = pq.read_table(path)
            if table.num_rows != binding['rows'] or set(table.column_names) != set(context['fields']):
                raise ValueError('Governance fields/row count mismatch')
            if kind == 'static' and 'date' in table.column_names:
                raise ValueError('Static governance has a date column')
            if kind == 'dynamic' and table['date'].null_count:
                raise ValueError('Dynamic governance has null dates')
            entries = {n: {
                'source_column': n, 'family': n.split('__')[0].replace('_', ' ').title(),
                'unit': {'1': 'fraction', 'count': 'count', 'm': 'm'}.get(e.get('units'), 'source units'),
                'definition': e['definition'] + ' ' + e.get('interpretation', ''),
                'modeling_eligibility': 'false; research-only recorded inventory',
                'qualifiers': [e['missing_reason_field']] if e.get('missing_reason_field') else [],
            } for n, e in context['fields'].items() if n != 'date'}
            product_id = f'governance-r{res}' + ('-dynamic' if kind == 'dynamic' else '')
            dates = pc.unique(table['date']).to_pylist() if kind == 'dynamic' else [None]
            slices, combined_features = {}, {}
            for value in sorted(dates, key=str):
                selected = table.filter(pc.equal(table['date'], value)).drop(['date']) if kind == 'dynamic' else table
                source = {'path': binding['path'], 'sha256': binding['sha256'], 'release': 'current'}
                product, features = exporter.table(selected, int(res), 'h3_index', source, entries, 'governance', product_id,
                                                    'GOVERNANCE__' + ('dynamic__' if kind == 'dynamic' else ''), str(value) if value is not None else None)
                if value is None:
                    catalog['products'][product_id] = product
                    catalog['features'].extend(features)
                else:
                    product['label'] = str(value)
                    slices[str(value)] = product
                    for feature in features:
                        prior = combined_features.get(feature['id'])
                        if prior:
                            feature['available'] += prior['available']
                            if feature['kind'] == 'categorical':
                                feature['categories'] = sorted(set((prior.get('categories') or []) + (feature.get('categories') or [])), key=str)
                        combined_features[feature['id']] = feature
            if slices:
                catalog['products'][product_id] = {'axis': 'Date', 'defaultSlice': sorted(slices)[-1], 'slices': slices}
                catalog['features'].extend(combined_features.values())
    from prepare_map import verify_files
    verify_files(root, files)  # Refuse an update overlapping this read.
