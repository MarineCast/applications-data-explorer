"""Read-only combined Coast Guard view over retained source membership arrays."""
import json

import pyarrow as pa

from governance_memberships import MEMBERSHIP_TYPE, RECORD_FIELDS

GROUP = 'coast_guard_sectors'
ASSIGNMENT = GROUP + '__feature_memberships_v1'
COUNT = GROUP + '__recorded_feature_count'
COMPONENTS = (GROUP + '__ccg_administrative_region', GROUP + '__uscg_sector')
SOURCE_CONTEXT = {
    'ccg_western_region': {'country': 'Canada', 'agency': 'Canadian Coast Guard',
                          'boundary_type': 'CCG administrative region reference'},
    'uscg_app_sectors': {'country': 'United States', 'agency': 'United States Coast Guard',
                         'boundary_type': 'USCG sector reference'},
}
DEFINITION = ('All recorded Canadian Coast Guard administrative regions and US Coast Guard sectors '
              'intersecting each native cell, shown together with every overlapping name and source-qualified ID. '
              'These are different organizational unit types, not equivalent sectors or operational/legal jurisdiction. '
              'Missing component support remains unknown; no dominant unit or new spatial coverage is inferred.')


def _merge(rows):
    features = {}
    for row in rows:
        for member in row or []:
            records = features.setdefault(member['feature_id'], {})
            for record in member['records']:
                key = tuple(record[name] for name in RECORD_FIELDS)
                records.setdefault(key, set()).update(record['geometry_part_ids'])
    return [{'feature_id': identity, 'records': [dict(zip(RECORD_FIELDS, key), geometry_part_ids=sorted(parts))
            for key, parts in sorted(records.items(), key=lambda item: json.dumps(item[0], ensure_ascii=True))]}
            for identity, records in sorted(features.items())]


def combine_coast_guard(table, metadata):
    """Append browser-only paired membership/count/support; never rewrite Data.

    The normal decoder subsequently validates both original and combined arrays.
    Existing row identity, cadence, source records and component columns survive.
    """
    if not any(group + '__feature_memberships_v1' in table.column_names for group in COMPONENTS):
        return table, metadata
    rows, statuses = [], []
    for group in COMPONENTS:
        column = group + '__feature_memberships_v1'
        rows.append(table[column].to_pylist() if column in table.column_names else [None] * table.num_rows)
        statuses.append(table[column + '_status'].to_pylist() if column in table.column_names else ['unavailable'] * table.num_rows)
    combined, states = [], []
    for i in range(table.num_rows):
        entries = _merge([row[i] for row in rows])
        observed = all(row[i] is not None for row in rows) and all(status[i] == 'observed' for status in statuses)
        if entries:
            combined.append(entries); states.append('observed' if observed else 'partial')
        elif observed and all(row[i] == [] for row in rows):
            combined.append([]); states.append('observed')
        else:
            combined.append(None)
            states.append('unavailable' if all(status[i] == 'unavailable' for status in statuses) else 'unknown')
    fields = dict(metadata['fields'])
    values = {ASSIGNMENT: pa.array(combined, MEMBERSHIP_TYPE), ASSIGNMENT + '_status': pa.array(states, pa.string()),
              COUNT: pa.array([len(row) if row is not None else None for row in combined], pa.int64()),
              COUNT + '_status': pa.array(states, pa.string())}
    for column, value in values.items():
        table = (table.set_column(table.column_names.index(column), column, value) if column in table.column_names
                 else table.append_column(column, value))
    fields[ASSIGNMENT] = {'definition': DEFINITION, 'units': None, 'membership_schema_version': 1,
        'coverage_reference': GROUP, 'count_field': COUNT, 'missing_reason_field': ASSIGNMENT + '_status',
        'source_context': SOURCE_CONTEXT, 'derivation': 'Browser-only union of the two retained typed membership arrays'}
    fields[COUNT] = {'definition': 'Count of distinct displayed administrative feature IDs, not unique jurisdiction or operational coverage',
                     'units': 'count', 'missing_reason_field': COUNT + '_status'}
    for column in (ASSIGNMENT, COUNT):
        fields[column + '_status'] = {'definition': 'Combined recorded support; unresolved component absence remains unknown', 'units': None}
    return table, {**metadata, 'fields': fields}


def coast_guard_features(features):
    result = []
    for feature in features:
        column = feature.get('column', '')
        if column.startswith(GROUP + '__'):
            if column != ASSIGNMENT:
                continue
            feature.update(name='Coast Guard Assignment', family='Coast Guard Sectors',
                           role='recorded_feature_identity')
            feature.setdefault('definition', DEFINITION)
            feature.setdefault('sourceContext', SOURCE_CONTEXT)
        result.append(feature)
    return result
