"""Read-only assignment view; designated scientific metrics remain producer-owned."""
import pyarrow as pa

from governance_memberships import MEMBERSHIP_TYPE

CORE = 'marine_conservation_areas'
REFERENCE = 'proposed_interim_conservation_references'
GROUP = 'marine_conservation_assignment'
ASSIGNMENT = GROUP + '__feature_memberships_v1'
COUNT = GROUP + '__recorded_feature_count'
CORE_ASSIGNMENT = CORE + '__feature_memberships_v1'
REFERENCE_ASSIGNMENT = REFERENCE + '__feature_memberships_v1'
DEFINITION = ('All designated marine conservation site memberships plus explicitly labeled Proposed and Interim '
              'references. Reference display IDs qualify the original site ID by status; original source records, '
              'site IDs and geometry part IDs remain retained. The same site may have designated and interim zones. '
              'Assignment entries are not the Marine Conservation Area Count. Proposed/interim references remain '
              'excluded from that designated Count and Coverage. Race Rocks AOI is a point; no boundary or area is '
              'inferred. Stripes show overlapping memberships, not area shares. Missing component support remains unknown.')


def reference_status(member):
    statuses = set()
    for record in member['records']:
        status = record['area_hierarchy_level']
        if status == 'Interim': statuses.add('interim')
        elif status and status.startswith('Proposed'): statuses.add('proposed')
        else: raise ValueError('Unrecognized conservation reference status; cannot display as designated')
    if len(statuses) != 1:
        raise ValueError('Mixed conservation reference statuses need an explicit display split')
    return statuses.pop()


def combine_conservation(table, metadata):
    """Append browser-only memberships/count/support; preserve every input array.

    Separate status-qualified reference keys avoid merging a site's interim zone
    into its designated footprint. The support count counts displayed entries,
    never unique sites or protected totals. The normal extractor validates both
    original components and the derived view before serving it.
    """
    if not all(column in table.column_names for column in (CORE_ASSIGNMENT, REFERENCE_ASSIGNMENT)):
        return table, metadata
    core, references = [table[column].to_pylist() for column in (CORE_ASSIGNMENT, REFERENCE_ASSIGNMENT)]
    core_states, ref_states = [table[column + '_status'].to_pylist() for column in (CORE_ASSIGNMENT, REFERENCE_ASSIGNMENT)]
    context = dict(metadata['fields'][CORE_ASSIGNMENT].get('source_record_context', {}))
    context.update(metadata['fields'][REFERENCE_ASSIGNMENT].get('source_record_context', {}))
    combined, states = [], []
    for designated, refs, core_state, ref_state in zip(core, references, core_states, ref_states):
        entries = list(designated or [])
        for member in refs or []:
            status = reference_status(member)
            entries.append({**member, 'feature_id': 'conservation_reference:' + status + ':' + member['feature_id']})
            for record in member['records']:
                key = record['source_feature_id']
                context[key] = {**context.get(key, {}), 'site_identity': member['feature_id'],
                                'assignment_status': status.title(), 'designated_count_and_coverage': 'Excluded'}
        observed = designated is not None and refs is not None and core_state == ref_state == 'observed'
        if entries:
            combined.append(sorted(entries, key=lambda member: member['feature_id']))
            states.append('observed' if observed else 'partial')
        elif observed:
            combined.append([]); states.append('observed')
        else:
            combined.append(None)
            states.append('unavailable' if core_state == ref_state == 'unavailable' else 'unknown')
    values = {ASSIGNMENT: pa.array(combined, MEMBERSHIP_TYPE), ASSIGNMENT + '_status': pa.array(states, pa.string()),
              COUNT: pa.array([len(row) if row is not None else None for row in combined], pa.int64()),
              COUNT + '_status': pa.array(states, pa.string())}
    fields = dict(metadata['fields'])
    for column, value in values.items():
        table = (table.set_column(table.column_names.index(column), column, value) if column in table.column_names
                 else table.append_column(column, value))
    fields[ASSIGNMENT] = {'definition': DEFINITION, 'units': None, 'membership_schema_version': 1,
        'coverage_reference': GROUP, 'count_field': COUNT, 'missing_reason_field': ASSIGNMENT + '_status',
        'source_record_context': context, 'derivation': 'Display union of designated and status-qualified reference memberships'}
    fields[COUNT] = {'definition': 'Display support count of displayed site/status entries; not designated site Count or unique physical sites',
                     'units': 'count', 'missing_reason_field': COUNT + '_status'}
    for column in (ASSIGNMENT, COUNT):
        fields[column + '_status'] = {'definition': 'Combined assignment support; unresolved component absence remains unknown', 'units': None}
    return table, {**metadata, 'fields': fields}
