"""Validate/export Governance membership v1 without changing scalar preparation.

No producer imports: the contract is duplicated deliberately at this consumer boundary.
Call extract_governance_memberships before handing its scalar table to Exporter.table.
"""
from __future__ import annotations

import json

import pyarrow as pa

RECORD_FIELDS = (
    'source_dataset_id', 'source_feature_id', 'feature_name', 'feature_type',
    'authority', 'jurisdiction', 'region', 'area_system_id', 'area_code',
    'area_title', 'area_hierarchy_level', 'parent_area_code',
)
RECORD_TYPE = pa.struct([
    pa.field(name, pa.string(), nullable=name not in ('source_dataset_id', 'source_feature_id'))
    for name in RECORD_FIELDS
] + [pa.field('geometry_part_ids', pa.list_(pa.field('item', pa.string(), nullable=False)), nullable=False)])
MEMBERSHIP_TYPE = pa.list_(pa.field('item', pa.struct([
    pa.field('feature_id', pa.string(), nullable=False),
    pa.field('records', pa.list_(pa.field('item', RECORD_TYPE, nullable=False)), nullable=False),
]), nullable=False))
SUFFIX = '__feature_memberships_v1'
STATES = frozenset(('observed', 'unknown', 'unavailable', 'not_applicable', 'partial'))


def _fail(message):
    raise ValueError(f'Invalid Governance memberships: {message}')


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _validate_entries(entries):
    ids = []
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {'feature_id', 'records'} or not _text(entry['feature_id']):
            _fail('feature identity')
        ids.append(entry['feature_id'])
        records = entry['records']
        if not isinstance(records, list) or not records:
            _fail('empty source records')
        keys = []
        for record in records:
            if not isinstance(record, dict) or set(record) != {*RECORD_FIELDS, 'geometry_part_ids'}:
                _fail('source record fields')
            if any(not _text(record[name]) for name in RECORD_FIELDS[:2]):
                _fail('source identity')
            if any(record[name] is not None and not isinstance(record[name], str) for name in RECORD_FIELDS[2:]):
                _fail('categorical values must be strings or null')
            parts = record['geometry_part_ids']
            if not isinstance(parts, list) or not parts or any(not _text(p) for p in parts) or parts != sorted(set(parts)):
                _fail('geometry part lineage/order')
            keys.append(json.dumps(tuple(record[k] for k in RECORD_FIELDS), ensure_ascii=True))
        if keys != sorted(set(keys)):
            _fail('duplicate/unordered paired source records')
    if ids != sorted(set(ids)):
        _fail('duplicate/unordered feature identity')


def extract_governance_memberships(table: pa.Table, metadata: dict):
    """Return scalar table and checked browser payloads keyed by producer column.

    Legacy scalar-only v1 tables return unchanged. Unknown nested fields or membership
    versions fail closed. Count/status columns remain in the scalar table unchanged.
    No files are written and no source geometry is processed.
    """
    if metadata.get('schema_version') != 1 or metadata.get('model_eligible') is not False:
        _fail('unsupported product envelope')
    fields = metadata.get('fields')
    if not isinstance(fields, dict) or set(fields) != set(table.column_names):
        _fail('field declarations differ from table')
    nested = []
    payloads = {}
    for field in table.schema:
        descriptor = fields[field.name]
        advertised = 'membership_schema_version' in descriptor
        is_nested = pa.types.is_list(field.type) or pa.types.is_large_list(field.type) or pa.types.is_struct(field.type) or pa.types.is_map(field.type)
        if not advertised:
            if is_nested or field.name.endswith(SUFFIX):
                _fail(f'undeclared/unsupported nested field {field.name}')
            continue
        group = descriptor.get('coverage_reference')
        if (type(descriptor['membership_schema_version']) is not int or descriptor['membership_schema_version'] != 1) or not _text(group) or field.name != group + SUFFIX or field.type != MEMBERSHIP_TYPE:
            _fail(f'unsupported membership contract {field.name}')
        count_name = group + '__recorded_feature_count'
        status_name = field.name + '_status'
        implicit = descriptor.get('implicit_support') == 'positive_partial_null_unknown_v1'
        uniform = descriptor.get('implicit_support') == 'uniform_count_membership_support_v1'
        support_state = descriptor.get('implicit_status')
        if uniform and (group != 'management_areas' or support_state not in STATES or 'missing_reason_field' in descriptor):
            _fail('compact Management Areas support')
        null_status = descriptor.get('implicit_null_status')
        if implicit and (group != 'county_regional_boundaries' or null_status not in ('unknown', 'unavailable') or 'missing_reason_field' in descriptor):
            _fail('compact regional support')
        if descriptor.get('count_field') != count_name or descriptor.get('missing_reason_field') != (None if implicit or uniform else status_name):
            _fail('count/status binding')
        if any(name not in fields for name in ([count_name] if implicit or uniform else (count_name, status_name, count_name + '_status'))):
            _fail('missing count/status columns')
        if not pa.types.is_integer(table[count_name].type) or (not (implicit or uniform) and (table[status_name].type != pa.string() or table[count_name + '_status'].type != pa.string())):
            _fail('count/status Arrow types')
        values = table[field.name].to_pylist()
        counts = table[count_name].to_pylist()
        if uniform:
            if (fields[count_name].get('implicit_support') != descriptor['implicit_support']
                    or fields[count_name].get('implicit_status') != support_state
                    or fields[count_name].get('units') != 'count'):
                _fail('compact Management Areas count support')
            statuses = count_statuses = [support_state] * len(counts)
            table = table.append_column(status_name, pa.array(statuses, pa.string()))
            table = table.append_column(count_name + '_status', pa.array(statuses, pa.string()))
        elif implicit:
            if (fields[count_name].get('implicit_support') != descriptor['implicit_support']
                    or fields[count_name].get('implicit_null_status') != null_status
                    or any(count is not None and count <= 0 for count in counts)):
                _fail('compact count support')
            statuses = count_statuses = ['partial' if count is not None else null_status for count in counts]
            # Browser compatibility support is derived from the explicit metadata
            # contract; these are not additional fields in the final Parquet.
            table = table.append_column(status_name, pa.array(statuses, pa.string()))
            table = table.append_column(count_name + '_status', pa.array(statuses, pa.string()))
        else:
            statuses = table[status_name].to_pylist()
            count_statuses = table[count_name + '_status'].to_pylist()
        dictionary, lookup, indices = [], {}, []
        for entries, count, status, count_status in zip(values, counts, statuses, count_statuses):
            if uniform and ((status == 'observed' and count is None) or
                            (status in ('unknown', 'unavailable', 'not_applicable') and count is not None)):
                _fail('compact Management Areas value/support')
            if status not in STATES or status != count_status or (entries is None) != (count is None):
                _fail('membership/count support mismatch')
            if entries is None:
                if status == 'observed':
                    _fail('observed membership cannot be null')
                indices.append(None)
                continue
            if type(count) is not int or count < 0 or len(entries) != count or (not entries and status != 'observed') or status not in ('observed', 'partial'):
                _fail('membership/count mismatch or unsupported empty list')
            _validate_entries(entries)
            row = []
            for entry in entries:
                key = json.dumps(entry, sort_keys=True, ensure_ascii=True, separators=(',', ':'))
                if key not in lookup:
                    lookup[key] = len(dictionary)
                    dictionary.append(entry)
                row.append(lookup[key])
            indices.append(row)
        payload = {
            'kind': 'governance-memberships', 'schemaVersion': 1, 'rows': table.num_rows,
            'group': group, 'column': field.name, 'countColumn': count_name, 'statusColumn': status_name,
            'dictionary': dictionary, 'indices': indices, 'counts': counts, 'statuses': statuses,
        }
        # JSON round-trip verifies every paired record and native cell position.
        restored = decode_membership_payload(json.loads(json.dumps(payload, allow_nan=False)))
        if restored != values:
            _fail('lossless browser readback')
        payloads[field.name] = payload
        nested.append(field.name)
    return table.drop(nested) if nested else table, payloads


def decode_membership_payload(payload):
    """Independent readback used by this exporter and cross-language fixtures."""
    return [None if row is None else [payload['dictionary'][i] for i in row] for row in payload['indices']]
