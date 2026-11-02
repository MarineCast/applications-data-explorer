"""Source-backed readable Governance labels; independent consumer policy v1."""
import re

import pyarrow as pa

NAME_POLICY = 'unique_readable_membership_names_v1'


def readable_names(column, members):
    """Source-backed names, preserving unknown lists and unlabeled memberships."""
    if members is None:
        return None
    labels = set()
    unnamed = False
    for member in members:
        found = set()
        for record in member['records']:
            name = None
            if column == 'country_membership':
                name = {'CAN': 'Canada', 'USA': 'United States'}.get(record.get('jurisdiction'))
            elif column == 'state_province_membership':
                name = {'BC': 'British Columbia', 'WA': 'Washington', 'OR': 'Oregon'}.get(record.get('region'))
                if name is None and record.get('area_title'):
                    name = re.sub(r'\s+\([A-Z]{2}\)$', '', record['area_title'])
            elif column == 'fisheries_management_area_membership':
                name = record.get('area_title')
            if not name:
                name = record.get('feature_name') or record.get('area_title') or record.get('area_code')
            if name and name.strip():
                name = name.strip()
                if column == 'conservation_area_membership' and member['feature_id'].startswith('conservation_reference:'):
                    status = member['feature_id'].split(':', 2)[1]
                    if status not in ('proposed', 'interim'):
                        raise ValueError('Unsupported conservation reference name status')
                    name += ' [' + status.title() + ']'
                found.add(name)
        if found:
            labels.update(found)
        else:
            unnamed = True
    result = sorted(labels, key=lambda name: (name.casefold(), name))
    return result + ([None] if unnamed else [])


def project_names(table, context):
    """Replace public membership structs with deterministic Arrow string lists."""
    fields = dict(context['fields'])
    for name in table.column_names:
        if not name.endswith('_membership'):
            continue
        values = pa.array([readable_names(name, row) for row in table[name].to_pylist()], pa.list_(pa.string()))
        table = table.set_column(table.column_names.index(name), name, values)
        descriptor = dict(fields[name])
        for key in ('membership_schema_version', 'count_field', 'count_semantics', 'category_semantics', 'missingness'):
            descriptor.pop(key, None)
        descriptor.update(membership_names_version=1, name_policy=NAME_POLICY,
            definition='Sorted distinct readable source labels for recorded memberships. Names may be shared by multiple feature identities; counts retain original feature identity semantics. Full paired identities, labels and parts remain in the external audit.',
            missingness='Null list preserves unknown/unavailable support; empty list preserves observed no memberships; a null item preserves an unnamed recorded membership. Labels are never inferred from a missing name.',
            units=None)
        fields[name] = descriptor
    return table, {**context, 'fields': fields}
