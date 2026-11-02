"""Read the compact Governance audit format without importing its producer."""
import base64
import hashlib
import json
from pathlib import Path
import zlib

import pyarrow as pa
import pyarrow.parquet as pq

from conservation_input import combine_conservation
from governance_names import project_names, NAME_POLICY
from prepare_seascape import digest as sha256_file

AUDIT_KEY = b'governance_app_audit'
AUDIT_SCHEMA = 'governance.app.audit.v1'
SUPPORT_KEY = b'governance_support'
SUPPORT_SCHEMA = 'governance.embedded_support.v1'
APP_COLUMNS = [
    'h3_index',
    'county_regional_boundaries__recorded_feature_count',
    'critical_habitat__recorded_feature_count',
    'exclusion_zones__recorded_feature_count',
    'management_areas__recorded_feature_count',
    'tribal_first_nations_areas__mapped_area',
    'federal_waters__international_boundary',
    'marine_conservation_areas__recorded_feature_count',
    'marine_conservation_areas__recorded_polygon_union_area_fraction',
    'vessel_routing_regulations__recorded_reference',
    'county_regional_boundaries__feature_memberships_v1',
    'critical_habitat__feature_memberships_v1',
    'exclusion_zones__feature_memberships_v1',
    'management_areas__feature_memberships_v1',
    'speed_restriction_zones__feature_memberships_v1',
    'tribal_first_nations_areas__feature_memberships_v1',
    'state_provincial_waters__assignment__feature_memberships_v1',
    'federal_waters__assignment__feature_memberships_v1',
    'coast_guard_sectors__feature_memberships_v1',
    'vessel_routing_regulations__traffic_separation_zones__feature_memberships_v1',
    'marine_conservation_assignment__feature_memberships_v1',
]

COLUMN_ALIASES = {
    'h3_index': 'h3_index',
    'county_regional_boundaries__recorded_feature_count': 'county_district_count',
    'critical_habitat__recorded_feature_count': 'critical_habitat_count',
    'exclusion_zones__recorded_feature_count': 'exclusion_zone_count',
    'management_areas__recorded_feature_count': 'fisheries_management_area_count',
    'tribal_first_nations_areas__mapped_area': 'has_mapped_tribal_area',
    'federal_waters__international_boundary': 'has_international_boundary',
    'marine_conservation_areas__recorded_feature_count': 'conservation_area_count',
    'marine_conservation_areas__recorded_polygon_union_area_fraction': 'conservation_area_coverage_fraction',
    'vessel_routing_regulations__recorded_reference': 'has_routing_reference',
    'county_regional_boundaries__feature_memberships_v1': 'county_district_membership',
    'critical_habitat__feature_memberships_v1': 'critical_habitat_membership',
    'exclusion_zones__feature_memberships_v1': 'exclusion_zone_membership',
    'management_areas__feature_memberships_v1': 'fisheries_management_area_membership',
    'speed_restriction_zones__feature_memberships_v1': 'speed_restriction_zone_membership',
    'tribal_first_nations_areas__feature_memberships_v1': 'mapped_tribal_area_membership',
    'state_provincial_waters__assignment__feature_memberships_v1': 'state_province_membership',
    'federal_waters__assignment__feature_memberships_v1': 'country_membership',
    'coast_guard_sectors__feature_memberships_v1': 'coast_guard_membership',
    'vessel_routing_regulations__traffic_separation_zones__feature_memberships_v1': 'vessel_routing_membership',
    'marine_conservation_assignment__feature_memberships_v1': 'conservation_area_membership',
}


def display_table(table, metadata, naming_version=2):
    view, context = combine_conservation(table, metadata)
    columns = [name for name in APP_COLUMNS if name in view.column_names]
    if metadata['temporal']['type'] == 'dynamic':
        columns.insert(1, 'date')
    selected = view.select(columns)
    if naming_version >= 3:
        selected = selected.rename_columns([COLUMN_ALIASES.get(name, name) for name in columns])
        context = {**context, 'fields': {COLUMN_ALIASES.get(name, name): value for name, value in context['fields'].items()}}
    if naming_version >= 4:
        selected, context = project_names(selected, context)
    if naming_version >= 5:
        context = {**context, 'fields': {name: {**field, 'definition': field['definition'].replace('external audit', 'embedded scientific support')}
                   if name.endswith('_membership') else field for name, field in context['fields'].items()}}
    return selected, context


def restore_support(table, metadata):
    """Verify and restore removed arrays, with exact H3/date row alignment."""
    embedded = 'embedded_support' in metadata
    legacy = 'app_only_audit' in metadata
    if not embedded and not legacy:
        if metadata.get('application_contract', {}).get('version') in (2, 3, 4, 5):
            raise ValueError('Projected governance requires scientific support')
        return table, metadata
    if embedded and legacy:
        raise ValueError('Multiple governance support bindings')
    binding = metadata['embedded_support' if embedded else 'app_only_audit']
    if not isinstance(binding, dict):
        raise ValueError('Unsupported governance support binding')
    application = metadata.get('application_contract', {})
    version = application.get('version', 2)
    if embedded:
        if version != 5 or binding.get('schema') != SUPPORT_SCHEMA or binding.get('encoding') != 'zlib_parquet_v1':
            raise ValueError('Unsupported embedded governance support binding')
    elif version not in (2, 3, 4) or binding.get('schema') != AUDIT_SCHEMA or not Path(binding['path']).is_absolute():
        raise ValueError('Unsupported governance audit binding')
    aliases = COLUMN_ALIASES if version >= 3 else {}
    if version >= 3 and application.get('column_aliases') != aliases:
        raise ValueError('Governance column alias mapping mismatch')
    if version >= 4 and application.get('membership_representation') != NAME_POLICY:
        raise ValueError('Governance membership name policy mismatch')
    inverse = {new: old for old, new in aliases.items()}
    native = table.rename_columns([inverse.get(name, name) for name in table.column_names])
    if embedded:
        payload = (table.schema.metadata or {}).get(SUPPORT_KEY)
        if payload is None or hashlib.sha256(payload).hexdigest() != binding['sha256']:
            raise ValueError('Governance embedded support checksum mismatch')
        audit = pq.read_table(pa.BufferReader(zlib.decompress(payload)))
    else:
        path = Path(binding['path'])
        if sha256_file(path) != binding['sha256']:
            raise ValueError('Governance audit checksum mismatch')
        audit = pq.read_table(path)
        if sha256_file(path) != binding['sha256']:
            raise ValueError('Governance audit changed during read')
    if audit.num_rows != binding['rows'] or audit.column_names != binding['columns'] or audit.num_rows != table.num_rows:
        raise ValueError('Governance audit shape mismatch')
    header = json.loads(audit.schema.metadata[AUDIT_KEY])
    if header['schema'] != AUDIT_SCHEMA:
        raise ValueError('Unsupported governance audit schema')
    keys = ['h3_index'] + (['date'] if 'date' in table.column_names else [])
    # Dynamic rows may repeat H3; join on both keys without serializing identities.
    source_keys = audit.select(keys).to_pandas()
    target_keys = table.select(keys).to_pandas()
    if source_keys.duplicated().any() or target_keys.duplicated().any():
        raise ValueError('Duplicate governance audit identity')
    source_keys['_audit_row'] = range(audit.num_rows)
    joined = target_keys.merge(source_keys, on=keys, how='left', validate='one_to_one', sort=False)
    if joined['_audit_row'].isna().any():
        raise ValueError('Governance audit identity mismatch')
    audit = audit.take(pa.array(joined['_audit_row'].tolist(), pa.int64()))
    schema = pa.ipc.read_schema(pa.BufferReader(base64.b64decode(header['original_schema'])))
    if schema.names != header['original_columns']:
        raise ValueError('Governance original schema mismatch')
    arrays = []
    for field in schema:
        source = audit if version >= 4 and field.name.endswith('__feature_memberships_v1') else native if field.name in native.column_names else audit
        if source[field.name].type != field.type:
            raise ValueError('Governance original field type mismatch')
        arrays.append(source[field.name])
    restored = pa.Table.from_arrays(arrays, schema=schema)
    expected, context = display_table(restored, header['original_metadata'], naming_version=version)
    if not expected.equals(table, check_metadata=False):
        raise ValueError('Governance public view differs from audited scientific values')
    expected_fields = {name: context['fields'][name] for name in expected.column_names}
    if expected_fields != metadata['fields']:
        raise ValueError('Governance public field definitions differ from audit')
    return restored, header['original_metadata']
