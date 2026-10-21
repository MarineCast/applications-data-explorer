"""Read-only adapter for the documented Human static population and native infrastructure products."""
import json
from pathlib import Path

import pyarrow.parquet as pq

from prepare_seascape import digest

COLLECTED = 'population_within_100km_collected'
REMOVED_DISTANCE_COVERAGE_FIELDS = {f'population_within_{radius}km_collected__coverage_status' for radius in (25, 50, 100)}
REMOVED_POPULATION_COVERAGE_FIELDS = REMOVED_DISTANCE_COVERAGE_FIELDS | {'population_density_per_km2_collected__coverage_status'}
HIDDEN_COVERAGE_METRICS = {name.removesuffix('__coverage_status') for name in REMOVED_POPULATION_COVERAGE_FIELDS}
RETIRED_POPULATION_METRICS = {'population_count', 'population_density_per_km2', *[f'population_within_{radius}km' for radius in (25, 50, 100)]}
POPULATION_LABELS = {'population_count_collected': 'Population Count',
    'population_density_per_km2_collected': 'Population Density (people/km²)',
    **{f'population_within_{radius}km_collected': f'Population Within {radius}km' for radius in (25, 50, 100)}}

LIMITS = ('Static resident baseline: US 2020 / Canada 2021. Area-allocated estimates, not visits or observer effort. '
          'Partial coverage; null is not zero. The collected cell and 25/50/100 km estimates assume unavailable contributions are zero; it is not a fully observed census total. '
          'Overlapping neighborhoods must not be summed. Research only; model-ineligible.')


def source_products(root):
    """Read the producer's final-only receipt or the retained historical layout."""
    root = Path(root)
    if (root/'static.parquet').exists():
        path = root/'static.parquet'
        embedded = pq.read_schema(path).metadata
        delivery = json.loads(embedded[b'human_delivery'])
        if delivery['schema'] != 'human.delivery.final_only.v1':
            raise ValueError('Unsupported Human final-only delivery')
        receipt = Path(delivery['receipt_path'])
        catalog = json.loads(receipt.read_text())
        metadata = next(p for p in catalog['products'] if p['schema']=='human.study.static.v1')
        if json.loads(embedded[b'human_study']) != {k:v for k,v in metadata.items() if k!='artifact'}:
            raise ValueError('Human embedded static metadata mismatch')
        native = next((p for p in catalog['products'] if p['schema']=='human.native_features.v1'),None)
        # The receipt also verifies the distinct civil-calendar product, which is not a map layer.
        for product in catalog['products']:
            if digest(root/product['artifact']['path']) != product['artifact']['sha256']:
                raise ValueError('Human final product binding mismatch')
    else:
        receipt=root/'catalog.json'
        catalog=json.loads(receipt.read_text())
        metadata=json.loads((root/'human-r7-static.metadata.json').read_text())
        path=root/'human-r7-static.parquet'
        native=json.loads((root/metadata['native_features']['path']).with_suffix('.metadata.json').read_text()) if metadata.get('native_features') else None
    return path,metadata,catalog,native,receipt


def native_payload(path):
    if path.suffix=='.geojson': return json.loads(path.read_text())
    table=pq.read_table(path,columns=['feature_id','geometry_json','properties_json'])
    return {'type':'FeatureCollection','schema':'human.native_features.v1','features':[
        {'type':'Feature','id':row['feature_id'],'geometry':json.loads(row['geometry_json']),
            'properties':json.loads(row['properties_json'])} for row in table.to_pylist()]}


def bindings(root):
    path,metadata,catalog,native,receipt=source_products(root)
    result={'catalog':{'path':str(receipt),'sha256':digest(receipt)},
        'static':{'path':str(path),'sha256':digest(path)}}
    artifact=metadata['artifact']
    if (metadata['schema']!='human.study.static.v1' or metadata['h3_resolution']!=7
            or metadata['primary_key']!=['h3_index'] or artifact['path']!=path.name
            or artifact['sha256']!=result['static']['sha256']
            or not any(p.get('artifact')==artifact for p in catalog['products'])):
        raise ValueError('Human static product binding mismatch')
    if metadata.get('native_features'):
        binding=metadata['native_features'];native_path=root/binding['path']
        if (digest(native_path)!=binding['sha256'] or native['artifact']!=binding or native not in catalog['products']
                or native['schema']!='human.native_features.v1' or native['crs']!='EPSG:4326'):
            raise ValueError('Human native geometry binding mismatch')
        if native_path.suffix=='.parquet' and json.loads(pq.read_schema(native_path).metadata[b'human_study']) != {k:v for k,v in native.items() if k!='artifact'}:
            raise ValueError('Human embedded native metadata mismatch')
        result['native']={'path':str(native_path),'sha256':binding['sha256']}
    return result


def native_source_release(native, group):
    if group != 'ports':
        return 'Retained source snapshot; source vintages retained per record (includes legacy BC circa 2004)'
    receipt = next((r for r in native.get('source_receipts', []) if r.get('source_id') == 'nga_world_port_index'), {})
    source = receipt.get('original_provenance', {}).get('source', {})
    retrieved = source.get('retrieved_at_utc') or receipt.get('original_provenance', {}).get('receipt', {}).get('retrieved_at_utc') or 'unknown'
    return 'NGA World Port Index; provider edition unknown; snapshot retrieved ' + retrieved


def append_human(exporter, catalog, root):
    verified = bindings(root)
    static_path,metadata,source_catalog,native,_=source_products(root)
    fields = metadata['population']['fields']
    infrastructure = metadata.get('infrastructure_fields', {})
    table = pq.read_table(static_path)
    if table.num_rows != metadata['artifact']['rows']:
        raise ValueError('Human row count mismatch')
    # Never revive retired duplicate population quantities from an older source/cache.
    metrics = [name for name in fields if '250km' not in name and name not in RETIRED_POPULATION_METRICS and name not in REMOVED_POPULATION_COVERAGE_FIELDS]
    if COLLECTED in fields:
        contract = source_catalog.get('default_population', {})
        if contract.get('field') != COLLECTED:
            raise ValueError('Human default population contract mismatch')
    # Use the producer dictionary, never expose legacy modeling or provenance as metrics.
    columns = ['h3_index', 'h3_resolution', 'cell_area_km2']
    for metric in metrics:
        columns += [metric] + [n for n in table.column_names if n.startswith(metric + '__')]
        base = fields[metric].get('base_metric', 'population_count' if 'density_per_km2' in metric else metric.removesuffix('_collected'))
        columns += [n for n in table.column_names if n.startswith(base + '__')]
    for name, info in infrastructure.items():
        columns += [name, *info['qualifiers']]
    table = table.select([name for name in dict.fromkeys(columns) if name not in REMOVED_POPULATION_COVERAGE_FIELDS])
    entries = {}
    for name in table.column_names:
        metric = 'population_count' if name == 'population_density_per_km2' else name.split('__')[0]
        qualifiers = [n for n in table.column_names if n.startswith(metric + '__')]
        base = fields.get(metric, {}).get('base_metric', 'population_count' if 'density_per_km2' in metric else metric.removesuffix('_collected'))
        qualifiers += [n for n in table.column_names if n.startswith(base + '__')]
        entries[name] = {'family': 'Population',
                         'unit': fields.get(name, {}).get('units', 'Units unavailable'),
                         'qualifiers': ['cell_area_km2', *qualifiers], 'definition': LIMITS,
                         'modeling_eligibility': 'research_only; model_ineligible'}
    for name, info in infrastructure.items():
        entries[name] = {'family': info['family'], 'unit': info['units'], 'qualifiers': info['qualifiers'],
            'definition': info['limitation'], 'source_release': native_source_release(native or {}, 'ports') if name.startswith('ports__') else 'Retained static infrastructure snapshot; mixed source vintages',
            'modeling_eligibility': 'research_only; model_ineligible'}
    source = {'path': str(static_path),
              'sha256': verified['static']['sha256'], 'release': 'US 2020 / Canada 2021'}
    product, features = exporter.table(table, 7, 'h3_index', source, entries, 'human', 'human-population-r7', 'HUMAN__')
    selectable = set(infrastructure) | set(metrics) | {fields[name]['coverage_status'] for name in metrics if name not in HIDDEN_COVERAGE_METRICS and fields[name].get('coverage_status') in table.column_names}
    features = [f for f in features if f['column'] in selectable]
    features.sort(key=lambda f: (f['column'] != COLLECTED, not f['column'].endswith('_collected'), f['column']))
    for feature in features:
        name = feature['column']
        quantity = name.removesuffix('__coverage_status')
        feature['name'] = (POPULATION_LABELS[quantity] + (' Coverage' if name.endswith('__coverage_status') else '')) if quantity in POPULATION_LABELS else fields.get(name, {}).get('label') or name.replace('_', ' ').capitalize()
        info = fields.get(name, {})
        if name in infrastructure:
            feature['name'] = infrastructure[name]['label'] + ' · H3 summary'
            continue
        if name.endswith('__coverage_status'):
            if name == 'population_count_collected__coverage_status':
                feature['name'] = 'Coverage'
            feature['definition'] = ('Strict source and geographic completeness for the entire native cell or radius circle. '
                'Complete requires full verified geographic support and known counts for all intersecting census sources. '
                'Partial can result from small census/water boundary gaps or unknown census counts. It is not a population amount, '
                'coverage percentage, or evidence of a failed download. The collected estimate remains available. US 2020 / Canada 2021.')
            feature['qualifiers'] = list(dict.fromkeys([quantity, *feature['qualifiers']]))
            continue
        feature['definition'] = LIMITS + (' ' + info['limitation'] if info.get('limitation') else '')
        if name in metrics and not name.endswith('_collected'):
            feature['definition'] += ' Complete coverage is required: gray means incomplete support, not observed zero. Collected estimates retain available-source allocations with an explicit missing-as-zero assumption.'
    catalog['products']['human-population-r7'] = product
    if metadata.get('native_features'):
        payload = native_payload(root/native['artifact']['path'])
        if len(payload['features']) != native['artifact']['features']:
            raise ValueError('Native feature count mismatch')
        for feature in payload['features']:
            feature['properties'].pop('access_state', None)
        product['nativeFeatures'] = exporter.write(payload)
        product['nativeGroups'] = {group: {key: value for key, value in info.items() if key != 'access_states'} for group, info in native['groups'].items()}
        for group, info in native['groups'].items():
            records = [f for f in payload['features'] if f['properties']['group']==group and f['properties']['role']=='record']
            from collections import Counter
            if (len(records)!=info['records'] or dict(Counter(f['properties']['category'] for f in records))!=info['categories']):
                raise ValueError('Native category parity mismatch')
            features.append({'id':'HUMAN_NATIVE__'+group, 'column': group, 'geometryGroup':group,
                'productId':'human-population-r7', 'dataset':'human', 'kind':'categorical', 'categories':list(info['categories']),
                'resolution':7, 'name':info['name'], 'family':info['family'], 'unit':'source records',
                'range':[0,max(1,len(info['categories'])-1)], 'available':info['records'], 'rows':info['records'],
                'role':'native_source_geometry', 'qualifiers':[], 'sourceRelease':native_source_release(native, group),
                'sourcePath':str(root/native['artifact']['path']), 'sourceSha256':native['artifact']['sha256'],
                'definition':info['limitations'], 'modelingEligibility':'research_only; model_ineligible', 'arrowType':'GeoParquet' if Path(native['artifact']['path']).suffix=='.parquet' else 'GeoJSON'})
        exporter.report.append({'product':'human-native-features','records':native['artifact'].get('records',native['artifact']['rows']),
            'features':len(payload['features']),'category_parity':'exact','source_sha256':native['artifact']['sha256']})
    catalog['features'].extend(features)
    catalog['datasets']['human'] = {'name': 'Human', 'release': source['release'], 'status': 'partial static research product',
                                    'manifestSha256': verified['catalog']['sha256'], 'limitations': LIMITS + ' Infrastructure: retained partial source inventory; mapped does not establish current public access or use. Source dates and restrictions remain per record.'}
    if bindings(root) != verified:
        raise ValueError('Human inputs changed during preparation')


def prepare_existing(root, output):
    """Extend a verified existing browser catalog without rebuilding unrelated producers."""
    import hashlib
    import shutil
    import tempfile
    from prepare_map import Exporter

    base_path = output / 'catalog.json'
    base_bytes = base_path.read_bytes()
    catalog = json.loads(base_bytes)
    if catalog.get('version') != 2:
        raise ValueError('Human requires a prepared version-2 map catalog')
    # Verify every referenced local asset before reusing the previous snapshot.
    for product in catalog['products'].values():
        for part in product.get('slices', {'static': product}).values():
            for binding in [part['cells'], *part['columns'].values(), *(item['asset'] for item in part.get('memberships', {}).values()), *([part['nativeFeatures']] if part.get('nativeFeatures') else [])]:
                prefix = '/local-data/seascape/'
                if not binding['url'].startswith(prefix):
                    raise ValueError('Unexpected existing asset URL')
                path = (output / binding['url'][len(prefix):]).resolve()
                if not path.is_relative_to(output.resolve()) or digest(path) != binding['sha256']:
                    raise ValueError('Existing map asset checksum mismatch')
    inputs = bindings(root)
    identity = {'base': hashlib.sha256(base_bytes).hexdigest(), 'human': inputs, 'adapter': digest(Path(__file__))}
    snapshot_id = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    staging = Path(tempfile.mkdtemp(prefix='.prepare-human-', dir=output))
    try:
        exporter = Exporter(staging, snapshot_id)
        catalog['features'] = [f for f in catalog['features'] if f.get('dataset') != 'human']
        append_human(exporter, catalog, root.resolve())
        (staging / 'catalog.json').write_text(json.dumps(catalog, allow_nan=False, separators=(',', ':')))
        (staging / 'validation.json').write_text(json.dumps({'source_bindings': identity, 'tables': exporter.report,
            'status': 'every_exported_value_read_back_exactly'}, indent=2))
        snapshot = output / snapshot_id
        if snapshot.exists():
            raise ValueError('Snapshot already exists')
        if base_path.read_bytes() != base_bytes or bindings(root) != inputs:
            raise ValueError('Inputs changed during preparation')
        staging.rename(snapshot)
        temporary = output / '.human-catalog.json.tmp'
        temporary.write_bytes((snapshot / 'catalog.json').read_bytes())
        temporary.replace(base_path)
        print(json.dumps({'snapshot': snapshot_id, 'human_features': len([f for f in catalog['features'] if f.get('dataset') == 'human']),
                          'validation': exporter.report}, indent=2))
    finally:
        shutil.rmtree(staging, ignore_errors=True)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--human', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/local-data/seascape')
    args = parser.parse_args()
    prepare_existing(args.human, args.output)
