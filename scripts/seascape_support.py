"""Independent reader for reviewed-static-v1; no producer imports or writes."""
import hashlib
import json
import copy
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

KEY = b'seascape_review'
CORE_POLICY = 'reviewed-core-static-v2'
CORE_SCHEMAS = json.loads(Path(__file__).with_name('seascape_core.json').read_text())


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def audit_binding(path):
    raw = (pq.read_schema(path).metadata or {}).get(KEY)
    if raw is None:
        return None
    binding = json.loads(raw)
    if binding.get('policy') not in {'reviewed-static-v1', CORE_POLICY}:
        raise ValueError('Unsupported reviewed Seascape policy')
    audit = Path(binding['audit_path'])
    if not audit.is_absolute():
        raise ValueError('Seascape audit path must be absolute')
    return binding


def audit_bindings(paths):
    result = {}
    for path in paths:
        binding = audit_binding(path)
        if binding:
            audit = Path(binding['audit_path'])
            if digest(audit) != binding['audit_sha256']:
                raise ValueError('Seascape audit checksum mismatch')
            result[str(audit)] = {'sha256': binding['audit_sha256']}
    return result


def read_table(path, *, area):
    """Validate compact values, then attach audited qualifiers for the inspector.

    Public filled areas/0-or-1 flags stay public values. Source-null areas remain
    recoverable in the bound audit and never substitute for the delivered values.
    """
    public = pq.read_table(path)
    binding = audit_binding(path)
    if binding is None:
        return public
    if binding['area'] != area or 'date' in public.column_names:
        raise ValueError('Reviewed Seascape area/grain mismatch')
    audit = Path(binding['audit_path'])
    if digest(audit) != binding['audit_sha256']:
        raise ValueError('Seascape audit checksum mismatch')
    native = pq.read_table(audit)
    if native.num_rows != binding['native_rows'] or native.num_columns != binding['native_columns']:
        raise ValueError('Seascape audit shape mismatch')
    field = f'{area.upper()}_EXTENT_ALL_TIME_M2'
    if binding['policy'] == CORE_POLICY:
        if area not in CORE_SCHEMAS:
            raise ValueError('Unapproved compact core area')
        resolution = pc.unique(native['H3_RESOLUTION']).to_pylist()
        if len(resolution) != 1:
            raise ValueError('Compact core requires one native resolution')
        columns = {'h3_index': native['H3_INDEX']}
        mapping = {'h3_index': 'H3_INDEX'}
        for metric in CORE_SCHEMAS[area]['metrics']:
            if resolution[0] not in metric['resolutions']:
                continue
            source = metric['source_column']
            if source not in native.column_names:
                candidates = [n for n in native.column_names if n.rsplit('__', 1)[-1] == source.rsplit('__', 1)[-1]]
                if len(candidates) != 1:
                    raise ValueError('Missing or ambiguous approved Seascape source field: '+source)
                source = candidates[0]
            value = native[source]
            if metric['units'] == '0/1':
                if not pa.types.is_boolean(value.type):
                    raise ValueError('Expected nullable native boolean: '+source)
                value = pc.cast(value, pa.int64())
            columns[metric['proposed_column']] = value
            mapping[metric['proposed_column']] = source
        expected = pa.table(columns)
        context = json.loads((public.schema.metadata or {}).get(b'seascape_domain', b'{}'))
        if context.get('core_schema', {}).get('source_columns') != mapping:
            raise ValueError('Compact Seascape source-column mapping mismatch')
        for metric in CORE_SCHEMAS[area]['metrics']:
            if metric['proposed_column'] not in columns:
                continue
            entry = context.get('fields', {}).get(metric['proposed_column'], {})
            unit = '1' if metric['units'] == '0/1' else metric['units']
            if entry.get('unit') != unit:
                raise ValueError('Compact Seascape unit mismatch')
        parameters = {}
        if area == 'nearshore-transitions':
            for name in ['DEPTH_THRESHOLD_M', 'NEARSHORE_BAND_WIDTH_M']:
                matches = [n for n in native.column_names if n.rsplit('__', 1)[-1] == name]
                if matches:
                    values = pc.unique(native[matches[0]]).to_pylist()
                    if len(matches) != 1 or len(values) != 1:
                        raise ValueError('Nonuniform compact nearshore parameter')
                    parameters[name.lower()] = values[0]
        if context.get('core_schema', {}).get('parameters', {}) != parameters:
            raise ValueError('Compact Seascape parameter mismatch')
        result = public.rename_columns(['H3_INDEX' if n == 'h3_index' else n for n in public.column_names])
        for name in native.column_names:
            if name not in result.column_names:
                result = result.append_column(name, native[name])
    elif area in {'seagrass', 'bivalve', 'kelp'}:
        values = pc.fill_null(native[field], 0)
        if pc.any(pc.less(values, 0)).as_py():
            raise ValueError('Negative mapped habitat area')
        flag = f'{area.upper()}_EXTENT_BOOL'
        expected = pa.table({'H3_INDEX': native['H3_INDEX'], field: values,
                             flag: pc.cast(pc.greater(values, 0), pa.int64())})
        result = native.set_column(native.schema.get_field_index(field), field, public[field])
        result = result.append_column(flag, public[flag])
    elif area in {'bathymetry', 'freshwater'}:
        expected = native.drop(['H3_RESOLUTION'])
        result = native
    else:
        raise ValueError('Unapproved Seascape compact area')
    if not expected.equals(public, check_metadata=False):
        raise ValueError('Reviewed Seascape table differs from audited projection')
    # Retain original row-level QC/source arrays in Details; only reviewed
    # public measurements and flags remain selectable.
    metadata = dict(public.schema.metadata or {})
    context = json.loads(metadata.get(b'seascape_domain', b'{}'))
    source = json.loads((native.schema.metadata or {}).get(b'seascape_domain', b'{}'))
    context['fields'] = {**source.get('fields', {}), **context.get('fields', {})}
    if binding['policy'] == CORE_POLICY:
        for name in set(native.column_names) - set(public.column_names):
            entry = copy.deepcopy(context['fields'].get(name, {}))
            entry['picker_visible'] = False
            for key, value in entry.items():
                if key.isdigit() and isinstance(value, dict):
                    value['picker_visible'] = False
            context['fields'][name] = entry
    metadata[b'seascape_domain'] = json.dumps(context, sort_keys=True).encode()
    return result.replace_schema_metadata(metadata)
