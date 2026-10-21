"""Read flat governance Parquets without importing the producer or release helpers."""
from __future__ import annotations

import json
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq

from prepare_seascape import digest
from governance_memberships import extract_governance_memberships
from coast_guard_input import combine_coast_guard, coast_guard_features
from conservation_input import combine_conservation, ASSIGNMENT as CONSERVATION_ASSIGNMENT, GROUP as CONSERVATION_VIEW, CORE_ASSIGNMENT


# Compatibility for retained products/encodings predating producer presentation metadata.
WILDLIFE_FEATURES = {
    'wildlife_refuges__recorded_feature_count': 'Wildlife Refuge Count',
    'wildlife_refuges__feature_memberships_v1': 'Wildlife Refuge Assignment',
    'wildlife_refuges__recorded_polygon_union_area_fraction': 'Wildlife Refuge Coverage',
}


def wildlife_refuge_features(features):
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith('wildlife_refuges__'):
            if column not in WILDLIFE_FEATURES:
                continue
            feature['name'] = WILDLIFE_FEATURES[column]
            feature['role'] = 'recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric'
        result.append(feature)
    return result


CONSERVATION_GROUP = 'marine_conservation_areas'
CONSERVATION_REFERENCE = 'proposed_interim_conservation_references'
CONSERVATION_FEATURES = {
    CONSERVATION_GROUP+'__feature_memberships_v1': 'Marine Conservation Area Assignment',
    CONSERVATION_GROUP+'__recorded_feature_count': 'Marine Conservation Area Count',
    CONSERVATION_GROUP+'__recorded_polygon_union_area_fraction': 'Marine Conservation Area Coverage',
}


def conservation_features(features):
    ready = any(f.get('column') == CONSERVATION_GROUP+'__feature_memberships_v1' for f in features)
    combined = any(f.get('column') == CONSERVATION_ASSIGNMENT for f in features)
    result = []
    for feature in features:
        column = feature.get('column', '')
        if combined and (column == CORE_ASSIGNMENT or column.startswith(CONSERVATION_REFERENCE+'__')):
            continue
        if column.startswith(CONSERVATION_VIEW+'__'):
            if column != CONSERVATION_ASSIGNMENT: continue
            if 'id' in feature: feature['id'] = feature['id'][:-len(column)] + CORE_ASSIGNMENT
            feature.update(name=CONSERVATION_FEATURES[CORE_ASSIGNMENT], family='Marine Conservation Areas',
                           role='recorded_feature_identity', assignmentSemantics='conservation_status')
        if ready and column.startswith(('marine_protected_areas__', 'conservation_designations__', 'wildlife_refuges__', 'national_marine_sanctuaries__')):
            continue
        if column.startswith(CONSERVATION_GROUP+'__'):
            if column not in CONSERVATION_FEATURES: continue
            feature.update(name=CONSERVATION_FEATURES[column], family='Marine Conservation Areas',
                           role='recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric')
        elif column.startswith(CONSERVATION_REFERENCE+'__'):
            if column != CONSERVATION_REFERENCE+'__feature_memberships_v1': continue
            feature.update(name='Proposed / Interim Conservation Reference Assignment', family='Proposed / Interim Conservation References', role='recorded_feature_identity')
        result.append(feature)
    return result


EXCLUSION_FEATURES = {
    'exclusion_zones__recorded_feature_count': 'Exclusion Zone Count',
    'exclusion_zones__feature_memberships_v1': 'Exclusion Zone Assignment',
}


def exclusion_zone_features(features):
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith('exclusion_zones__'):
            if column not in EXCLUSION_FEATURES: continue
            feature.update(name=EXCLUSION_FEATURES[column], family='Exclusion Zones',
                           role='recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric')
        result.append(feature)
    return result


HABITAT_FEATURES = {
    'critical_habitat__recorded_feature_count': 'Critical Habitat Count',
    'critical_habitat__feature_memberships_v1': 'Critical Habitat Assignment',
}


def critical_habitat_features(features):
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith('critical_habitat__'):
            if column not in HABITAT_FEATURES: continue
            feature.update(name=HABITAT_FEATURES[column], family='Critical Habitat',
                           role='recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric')
        result.append(feature)
    return result


VESSEL_ROUTING_FAMILY = 'Vessel Routing & Regulations'
VESSEL_ROUTING_RECORDED = 'vessel_routing_regulations__recorded_reference'
VESSEL_ROUTING_PREFIXES = ('shipping_lanes__', 'traffic_separation_schemes__', 'speed_restriction_zones__', 'vessel_routing_regulations__')


VESSEL_IDENTITY_NAMES = {
    'vessel_routing_regulations__shipping_lanes__feature_memberships_v1': 'Shipping Lanes',
    'vessel_routing_regulations__traffic_separation_zones__feature_memberships_v1': 'Shipping Lanes & Traffic Separation Zones',
    'speed_restriction_zones__feature_memberships_v1': 'Speed Restriction Zones',
}


def vessel_routing_features(features):
    available = {(f.get('column'), f.get('resolution'), f.get('productId')) for f in features}
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith(VESSEL_ROUTING_PREFIXES):
            if column != VESSEL_ROUTING_RECORDED and not feature.get('membershipColumn'): continue
            grouped = 'vessel_routing_regulations__traffic_separation_zones__feature_memberships_v1' if feature.get('membershipColumn') and (column.startswith(('shipping_lanes__', 'traffic_separation_schemes__')) or column == 'vessel_routing_regulations__shipping_lanes__feature_memberships_v1') else None
            if grouped and (grouped, feature.get('resolution'), feature.get('productId')) in available: continue
            feature.update(family=VESSEL_ROUTING_FAMILY, role='recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric')
            if column in VESSEL_IDENTITY_NAMES: feature['name'] = VESSEL_IDENTITY_NAMES[column]
            if column == VESSEL_ROUTING_RECORDED:
                feature.update(name='Routing / regulation recorded', kind='categorical', categories=[False, True], unit='boolean')
        result.append(feature)
    return result


TRIBAL_PREFIX = 'tribal_first_nations_areas__'
TRIBAL_FEATURES = {
    TRIBAL_PREFIX + 'mapped_area': 'Tribal / First Nations Area',
    TRIBAL_PREFIX + 'feature_memberships_v1': 'Tribal / First Nations Assignment',
}


def tribal_features(features):
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith(TRIBAL_PREFIX):
            if column not in TRIBAL_FEATURES:
                continue
            feature['name'] = TRIBAL_FEATURES[column]
            feature['role'] = 'recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric'
        result.append(feature)
    return result


WATER_FEATURES = {
    'state_provincial_waters__assignment__feature_memberships_v1': 'State / Province Assignment',
    'federal_waters__assignment__feature_memberships_v1': 'Country Assignment',
    'federal_waters__international_boundary': 'International Boundary',
}

REGIONAL_FEATURES = {
    'county_regional_boundaries__recorded_feature_count': 'County / District Count',
    'county_regional_boundaries__feature_memberships_v1': 'County / District Assignment',
}

MANAGEMENT_FEATURES = {
    'management_areas__recorded_feature_count': 'Management Area Count',
    'management_areas__feature_memberships_v1': 'Management Area',
}


def management_features(features):
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith('management_areas__'):
            if column not in MANAGEMENT_FEATURES:
                continue
            feature.update(name=MANAGEMENT_FEATURES[column], family='Fisheries Management Areas',
                           role='recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric')
        result.append(feature)
    return result


def regional_features(features):
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith('county_regional_boundaries__'):
            if column not in REGIONAL_FEATURES:
                continue
            feature.update(name=REGIONAL_FEATURES[column], family='Regional Boundaries',
                           role='recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric')
        result.append(feature)
    return result


def administrative_features(features):
    """Presentation-only grouping; original columns, values and source bindings survive."""
    for feature in features:
        if feature.get('column', '').startswith(('county_regional_boundaries__', 'federal_waters__', 'state_provincial_waters__', 'tribal_first_nations_areas__')):
            feature['family'] = 'Administrative Boundaries'
    return features


def water_features(features):
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith('international_boundaries__'):
            continue
        if column.startswith(('state_provincial_waters__', 'federal_waters__')):
            if column not in WATER_FEATURES:
                continue
            feature['name'] = WATER_FEATURES[column]
            feature['role'] = 'recorded_feature_identity' if feature.get('membershipColumn') else 'scientific_metric'
        result.append(feature)
    return result


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
                selected = table.filter(pc.equal(table['date'], value)) if kind == 'dynamic' else table
                selected, slice_context = combine_coast_guard(selected, context)
                selected, slice_context = combine_conservation(selected, slice_context)
                selected, memberships = extract_governance_memberships(selected, slice_context)
                for name in selected.column_names:
                    if name not in entries:
                        entries[name] = {'source_column': name, 'family': name.split('__')[0].replace('_', ' ').title(),
                                         'definition': 'Browser support derived from declared compact Governance support metadata',
                                         'role': 'quality', 'unit': 'category'}
                if kind == 'dynamic':
                    selected = selected.drop(['date'])
                source = {'path': binding['path'], 'sha256': binding['sha256'], 'release': 'current'}
                product, features = exporter.table(selected, int(res), 'h3_index', source, entries, 'governance', product_id,
                                                    'GOVERNANCE__' + ('dynamic__' if kind == 'dynamic' else ''), str(value) if value is not None else None)
                if memberships:
                    product['memberships'] = {}
                    for column, payload in memberships.items():
                        membership_binding = {key: payload[key] for key in ('rows', 'group', 'column', 'countColumn', 'statusColumn')}
                        product['memberships'][column] = {**membership_binding, 'asset': exporter.write(payload)}
                        group = payload['group']
                        features.append({
                            'id': 'GOVERNANCE__' + ('dynamic__' if kind == 'dynamic' else '') + column,
                            'column': column, 'membershipColumn': column, 'productId': product_id,
                            'dataset': 'governance', 'kind': 'categorical', 'resolution': int(res),
                            'name': group.replace('_', ' ').title() + ' · Recorded features',
                            'family': group.split('__')[0].replace('_', ' ').title(),
                            'unit': 'recorded membership', 'range': [0, 1], 'rows': selected.num_rows,
                            'available': sum(row is not None for row in payload['indices']),
                            'role': 'recorded_feature_identity', 'qualifiers': [payload['countColumn'], payload['statusColumn']],
                            'sourceRelease': 'current', 'sourcePath': source['path'],
                            'sourceSha256': source['sha256'], 'arrowType': 'governance_memberships_v1',
                            'definition': 'All recorded feature identities intersecting each native cell. Stripes indicate membership, not area shares or boundary direction. Recorded geometry does not establish current legal applicability.',
                            'modelingEligibility': 'false; research-only recorded inventory',
                        })
                features = exclusion_zone_features(critical_habitat_features(vessel_routing_features(conservation_features(coast_guard_features(management_features(administrative_features(regional_features(water_features(tribal_features(wildlife_refuge_features(features)))))))))))
                for feature in features:
                    descriptor = slice_context['fields'].get(feature.get('column'), {})
                    if feature.get('column', '').startswith((CONSERVATION_GROUP+'__', CONSERVATION_REFERENCE+'__', CONSERVATION_VIEW+'__')):
                        feature['definition'] = descriptor.get('definition', feature['definition'])
                        feature['supportLimitation'] = descriptor.get('definition')
                        feature['sourceRecordContext'] = descriptor.get('source_record_context', {})
                    if feature.get('column') == 'coast_guard_sectors__feature_memberships_v1':
                        feature['definition'] = descriptor.get('definition', feature['definition'])
                        feature['sourceContext'] = descriptor.get('source_context', feature.get('sourceContext', {}))
                    if feature.get('column') in {**REGIONAL_FEATURES, **MANAGEMENT_FEATURES, **HABITAT_FEATURES, **EXCLUSION_FEATURES}:
                        feature['definition'] = descriptor.get('definition', feature['definition'])
                        feature['supportLimitation'] = descriptor.get('support_limitation') or descriptor.get('interpretation')
                        if feature.get('column') in {**HABITAT_FEATURES, **EXCLUSION_FEATURES}:
                            feature['sourceContext'] = descriptor.get('source_context', {})
                            feature['sourceRecordContext'] = descriptor.get('source_record_context', {})
                        if not feature.get('membershipColumn'):
                            feature['qualifiers'] = [feature['column'] + '_status']
                    if feature.get('column', '').startswith(VESSEL_ROUTING_PREFIXES):
                        feature['definition'] = descriptor.get('definition', feature['definition'])
                        feature['supportLimitation'] = descriptor.get('support_limitation')
                        feature['sourceContext'] = descriptor.get('source_context', {})
                        feature['sourceRecordContext'] = descriptor.get('source_record_context', {})
                    if feature.get('column') in WATER_FEATURES:
                        feature['definition'] = descriptor['definition']
                        feature['supportLimitation'] = descriptor.get('support_limitation')
                        feature['assignmentSemantics'] = descriptor.get('assignment_semantics')
                        if feature['column'] == 'federal_waters__international_boundary':
                            feature.update(kind='categorical', categories=[False, True], unit='boolean',
                                           supportMembershipColumn=descriptor['support_membership_column'],
                                           sourceContext=descriptor.get('source_context', {}))
                    if feature.get('column', '').startswith(TRIBAL_PREFIX):
                        feature['definition'] = descriptor.get('definition', feature['definition'])
                        if feature.get('membershipColumn'):
                            feature['sourceContext'] = descriptor.get('source_context', {})
                        else:
                            feature['kind'] = 'categorical'
                            feature['categories'] = [False, True]
                            feature['unit'] = 'boolean'
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


def prepare_existing(root, output):
    """Extend a verified map catalog; reuse existing Human/Seascape assets unchanged."""
    import hashlib
    import shutil
    import tempfile
    from prepare_map import Exporter, verify_files

    root, output = root.resolve(), output.resolve()
    base_path = output / 'catalog.json'
    base_bytes = base_path.read_bytes()
    catalog = json.loads(base_bytes)
    if catalog.get('version') != 2:
        raise ValueError('Governance requires a prepared version-2 map catalog')
    for product in catalog['products'].values():
        for part in product.get('slices', {'static': product}).values():
            for asset in [part['cells'], *part['columns'].values(), *(item['asset'] for item in part.get('memberships', {}).values())]:
                prefix = '/local-data/seascape/'
                if not asset['url'].startswith(prefix):
                    raise ValueError('Unexpected existing map asset URL')
                path = (output / asset['url'][len(prefix):]).resolve()
                if not path.is_relative_to(output) or digest(path) != asset['sha256']:
                    raise ValueError('Existing map asset checksum mismatch')
    inputs = bindings(root)
    identity = {'base': hashlib.sha256(base_bytes).hexdigest(), 'governance': inputs,
                'coast_guard': digest(Path(__file__).with_name('coast_guard_input.py')),
                'adapter': digest(Path(__file__)), 'memberships': digest(Path(__file__).with_name('governance_memberships.py')),
                'exporter': digest(Path(__file__).with_name('prepare_map.py'))}
    snapshot_id = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    staging = Path(tempfile.mkdtemp(prefix='.prepare-governance-', dir=output))
    try:
        exporter = Exporter(staging, snapshot_id)
        old_products = {field['productId'] for field in catalog['features'] if field.get('dataset') == 'governance'}
        catalog['features'] = [field for field in catalog['features'] if field.get('dataset') != 'governance']
        catalog['products'] = {key: value for key, value in catalog['products'].items() if key not in old_products}
        append_governance(exporter, catalog, root)
        (staging / 'catalog.json').write_text(json.dumps(catalog, allow_nan=False, separators=(',', ':')))
        (staging / 'validation.json').write_text(json.dumps({'source_bindings': identity, 'tables': exporter.report,
            'status': 'every_exported_value_read_back_exactly'}, indent=2))
        verify_files(root, inputs)
        if base_path.read_bytes() != base_bytes:
            raise ValueError('Existing browser catalog changed during Governance preparation')
        snapshot = output / snapshot_id
        if snapshot.exists():
            raise ValueError('Governance snapshot already exists; inspect the existing result')
        staging.rename(snapshot)
        temporary = output / '.governance-catalog.json.tmp'
        temporary.write_bytes((snapshot / 'catalog.json').read_bytes())
        temporary.replace(base_path)
        print(json.dumps({'snapshot': snapshot_id, 'governance_features': sum(field.get('dataset') == 'governance' for field in catalog['features']),
                          'identity_features': sum(bool(field.get('membershipColumn')) for field in catalog['features']),
                          'validation': exporter.report}, indent=2))
    finally:
        shutil.rmtree(staging, ignore_errors=True)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Update Governance only in an existing local browser catalog')
    parser.add_argument('--governance', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('public/local-data/seascape'))
    args = parser.parse_args()
    prepare_existing(args.governance, args.output)
