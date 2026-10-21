"""Read current flat Seascape Parquets into the explorer's local browser cache."""
from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq

from prepare_seascape import digest


def measurement_metadata(context, entry):
    """Read declared source semantics; never infer units from a field suffix."""
    manifest = context.get('source_context', {}).get(entry.get('source_release'), {}).get('manifest.json', {})
    methods = manifest.get('scientific_methods', {})
    column = entry.get('source_column')
    if (methods.get('output_sign', '').startswith('positive_down metres;') and
            column in methods.get('depth_summary_fields', []) and column != 'BATHYMETRY_PIXEL_COUNT'):
        return {'unit': 'm', **({'measurement': {'quantity': 'depth', 'statistic': 'mean', 'positiveDirection': 'down'}}
                              if column == 'BATHYMETRY' else {})}
    return {'unit': entry.get('unit') or 'Units unavailable'}


def prepare_flat(seascape, governance, output, human=None):
    from prepare_map import Exporter, verify_files

    seascape, output = seascape.resolve(), output.resolve()
    inputs = json.loads((seascape / 'catalog.json').read_text())
    files = {'catalog.json': {'sha256': digest(seascape / 'catalog.json')}}
    for area, record in inputs.items():
        for kind in ('static', 'dynamic'):
            for resolution, name in record.get(kind, {}).items():
                if name != f'{area}-r{resolution}-{kind}.parquet' or Path(name).name != name:
                    raise ValueError('Invalid flat catalog path')
                files[name] = {'sha256': digest(seascape / name)}
    if {path.name for path in seascape.iterdir() if path.is_file() and path.name != '.DS_Store'} != set(files):
        raise ValueError('Unexpected files in flat Seascape output')
    source_bindings = {'seascape': files, 'exporter': digest(Path(__file__)), 'helpers': digest(Path(__file__).with_name('prepare_map.py'))}
    source_bindings['biogenic_reader'] = digest(Path(__file__).with_name('biogenic_input.py'))
    if governance is not None:
        from governance_input import bindings
        governance = governance.resolve()
        source_bindings['governance'] = bindings(governance)
        source_bindings['governance_reader'] = digest(Path(__file__).with_name('governance_input.py'))
        source_bindings['governance_memberships'] = digest(Path(__file__).with_name('governance_memberships.py'))
    if human is not None:
        from human_input import bindings as human_bindings
        human = human.resolve()
        source_bindings['human'] = human_bindings(human)
        source_bindings['human_reader'] = digest(Path(__file__).with_name('human_input.py'))
    snapshot_id = hashlib.sha256(json.dumps(source_bindings, sort_keys=True).encode()).hexdigest()
    output.mkdir(parents=True, exist_ok=True)
    snapshot = output / snapshot_id
    staging = Path(tempfile.mkdtemp(prefix='.prepare-flat-', dir=output))
    updated = max(record['last_updated_utc'] for record in inputs.values())
    limits = 'Current source snapshots with partial coverage. Preserve native support, QC and nulls; source vintage is distinct from last update time.'
    catalog = {'version': 2, 'release': 'current', 'artifact': 'Seascape area Parquets', 'manifestSha256': snapshot_id,
               'receiptStatus': 'current flat data', 'publishedAt': updated, 'sourceCompleteness': 'partial',
               'resolutions': {}, 'products': {}, 'features': [], 'datasets': {
                   'seascape': {'name': 'Seascape', 'release': 'current', 'status': 'current area Parquets', 'publishedAt': updated,
                                'manifestSha256': files['catalog.json']['sha256'], 'limitations': limits}}, 'unavailableProducts': []}
    try:
        exporter = Exporter(staging, snapshot_id)
        for area, record in sorted(inputs.items()):
            for kind in ('static', 'dynamic'):
                for resolution, name in sorted(record.get(kind, {}).items(), key=lambda item: int(item[0])):
                    res = int(resolution)
                    path = seascape / name
                    context = json.loads((pq.read_schema(path).metadata or {}).get(b'seascape_domain', b'{}'))
                    actual = pc.unique(pq.read_table(path, columns=['H3_RESOLUTION'])['H3_RESOLUTION']).to_pylist()
                    if actual != [res]:
                        raise ValueError('Filename and native H3 resolution disagree')
                    dates = sorted(pc.unique(pq.read_table(path, columns=['date'])['date']).to_pylist()) if kind == 'dynamic' else [None]
                    product_id = f'seascape-{area}-{kind}-r{res}'
                    slices, combined_features = {}, {}
                    for value in dates:
                        filters = [('H3_RESOLUTION', '=', res)] + ([('date', '=', value)] if value is not None else [])
                        table = pq.read_table(path, filters=filters)
                        if not table.num_rows:
                            continue
                        if value is not None:
                            table = table.drop(['date'])
                        entries = {}
                        for column in table.column_names:
                            raw = context.get('fields', {}).get(column, {})
                            entry = dict(raw.get(str(res), raw))
                            definition = entry.get('definition') or entry.get('scientific_definition') or entry.get('units_and_support') or limits
                            entry.update({'family': entry.get('family') or area.replace('-', ' ').title(), 'definition': definition if isinstance(definition, str) else json.dumps(definition),
                                          'qualifiers': [n for n in table.column_names if n not in ('H3_INDEX', 'H3_RESOLUTION')], **measurement_metadata(context, entry)})
                            entries[column] = entry
                        source = {'path': name, 'sha256': files[name]['sha256'], 'release': 'current'}
                        product, features = exporter.table(table, res, 'H3_INDEX', source, entries, 'seascape', product_id, area + '_' + kind + '__', str(value) if value else None)
                        if value is None:
                            catalog['products'][product_id] = product
                            catalog['resolutions'].setdefault(str(res), product)
                            catalog['features'].extend(features)
                        else:
                            annual = context.get('temporal_support', {}).get('precision') == 'year'
                            product['label'] = str(value.year) if annual else str(value)
                            slices[str(value)] = product
                            for feature in features:
                                previous = combined_features.get(feature['id'])
                                if previous:
                                    feature['available'] += previous['available']
                                    if feature['kind'] == 'categorical':
                                        feature['categories'] = sorted(set((previous.get('categories') or []) + (feature.get('categories') or [])), key=str)
                                combined_features[feature['id']] = feature
                    if slices:
                        catalog['products'][product_id] = {'axis': 'Survey year' if annual else 'Date', 'defaultSlice': list(slices)[-1], 'slices': slices}
                        catalog['features'].extend(combined_features.values())
        from biogenic_input import biogenic_features
        catalog['features'] = biogenic_features(catalog['features'])
        if governance is not None:
            from governance_input import append_governance
            append_governance(exporter, catalog, governance)
        if human is not None:
            from human_input import append_human
            append_human(exporter, catalog, human)
        verify_files(seascape, files)
        (staging / 'catalog.json').write_text(json.dumps(catalog, allow_nan=False, separators=(',', ':')))
        (staging / 'validation.json').write_text(json.dumps({'source_bindings': source_bindings, 'tables': exporter.report, 'status': 'every_exported_value_read_back_exactly'}, indent=2))
        (staging / 'consumption-guide.txt').write_text(limits)
        if snapshot.exists():
            for path in staging.rglob('*'):
                if path.is_file() and (not (snapshot / path.relative_to(staging)).is_file() or digest(path) != digest(snapshot / path.relative_to(staging))):
                    raise ValueError('Existing snapshot failed readback')
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
