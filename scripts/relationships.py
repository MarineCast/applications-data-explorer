"""Bounded, descriptive relationships over validated local products.

No acquisition, product writes, regridding, absence synthesis or inference.
The transport-independent service deliberately reuses local_data.Reader.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import threading
import time

import h3
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from scipy.stats import pearsonr, spearmanr

from local_data import Reader, Sources, digest, read
from meteorology_data import METRICS
from orca_input import period

VERSION = 'relationships-1'
MAX_FIELDS, MAX_ROWS, MAX_POINTS = 12, 100_000, 2_000
MAX_BYTES, MAX_SECONDS = 256 * 1024**2, 30
UNAVAILABLE = {
    'hydrology': 'River × provider-day support requires a reviewed river-to-cell and source-time adapter. Mouth locations and influence weights are not a continuous plume.',
    'viewshed': 'No completed regional pair product. Directional source/target pairs cannot be flattened to a native cell join.',
    'oceanography': 'No validated current final product adapter.',
    'salmon': 'No validated current final product adapter.',
    'ais': 'No validated current final product adapter.',
    'acoustics': 'No validated current final product adapter.',
    'other-marine-mammals': 'Only the verified Orca sightings contract is available. Other species and annual census replication are unsupported.',
}


class AnalysisError(ValueError):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


class Budget:
    def __init__(self, cancelled=None):
        self.deadline = time.monotonic() + MAX_SECONDS
        self.cancelled = cancelled or threading.Event()

    def check(self):
        if self.cancelled.is_set():
            raise AnalysisError('Analysis cancelled.', 499)
        if time.monotonic() > self.deadline:
            raise AnalysisError('Analysis exceeded the 30 second budget. Narrow the selection or retry after source validation.', 503)


def unique_series(keys, values):
    if len(keys) != len(values) or len(set(keys)) != len(keys) or any(k is None for k in keys):
        raise AnalysisError('Missing or duplicate observation keys; many-to-many joins are refused.')
    if len(keys) > MAX_ROWS:
        raise AnalysisError('Observation limit exceeded; choose a smaller supported slice.', 413)
    return pd.Series(values, index=pd.Index(keys), dtype=object)


def decode(payload):
    values = payload.get('values', payload)
    if isinstance(values, dict) and 'dictionary' in values:
        return [None if i is None else values['dictionary'][i] for i in values['indices']]
    if not isinstance(values, list):
        raise AnalysisError('Unsupported source value encoding.', 503)
    return values


def coefficient(x, y, method):
    if len(x) < 3:
        return None, 'At least three complete pairs are required.'
    if len(set(x)) < 2 or len(set(y)) < 2:
        return None, 'Constant input; association is undefined.'
    value = float((spearmanr if method == 'spearman' else pearsonr)(x, y).statistic)
    return (value, None) if np.isfinite(value) else (None, 'Association is undefined.')


def pair_diagnostics(a, b):
    union = a.index.union(b.index)
    left, right = a.reindex(union), b.reindex(union)
    present_a, present_b = union.isin(a.index), union.isin(b.index)
    complete = left.notna() & right.notna()
    return left[complete], right[complete], {
        'eligible': len(union), 'matchedKeys': int((present_a & present_b).sum()),
        'complete': int(complete.sum()), 'excluded': int((~complete).sum()),
        'missingLeftKey': int((~present_a).sum()), 'missingRightKey': int((~present_b).sum()),
        'leftNull': int((left.isna() & present_a).sum()), 'rightNull': int((right.isna() & present_b).sum()),
        'bothNull': int((left.isna() & right.isna() & present_a & present_b).sum()),
        'coverage': float(complete.mean()) if len(union) else 0,
        'distinctCompleteCells': len({str(k).split('|')[0] for k in left[complete].index}),
        'distinctCompletePeriods': len({str(k).split('|')[1] for k in left[complete].index if '|' in str(k)}),
        'exclusionNote': 'Key and null counts overlap; excluded is the distinct excluded-row count. Coverage denominator is the union of selected pair keys.',
    }


def numeric(series):
    return pd.to_numeric(series, errors='coerce').replace([np.inf, -np.inf], np.nan)


def distribution(values):
    v = np.asarray(values, dtype=float)
    return {'n': len(v), 'min': float(v.min()), 'q1': float(np.quantile(v, .25)),
            'median': float(np.median(v)), 'q3': float(np.quantile(v, .75)), 'max': float(v.max())}


class Relationships:
    def __init__(self, data, public, study):
        self.sources = Sources(data, public, study)
        self.reader = Reader(self.sources)
        self.lock = threading.RLock()
        self.weather = None
        self.orca = None

    def close(self):
        self.reader.close()

    def component(self, domain):
        if domain not in {'seascape', 'governance', 'human'}:
            raise AnalysisError(UNAVAILABLE.get(domain, 'Unsupported product.'), 422)
        with self.lock:
            return self.reader.get(domain)

    @staticmethod
    def feature_key(f):
        return f"{f.get('dataset', 'seascape')}:{f['resolution']}:{f['productId']}:{f['column']}"

    def fields(self, domain):
        if domain == 'meteorology':
            c, _ = self.weather_source()
            units = {f['name']: f['units'] for f in c['products']['daily']['columns']}
            return [dict(key=f'meteorology:5:{key}', id=key, column=key, productId='meteorology-daily',
                         dataset=domain, resolution=5, name=info[0], family=info[1], kind='numeric',
                         unit=units[key], definition=info[3], quality=False, temporal='UTC day', slices=[],
                         rows=c['reporting_cell_count'], available=None, sourceSha256=c['products']['daily']['sha256'],
                         modelingEligibility='Retrospective reanalysis; historical issue availability not established.',
                         unsupported='Circular directions need circular statistics.' if 'DIRECTION' in key else None)
                    for key, info in METRICS.items()]
        item = self.component(domain)
        fields = []
        for f in item['catalog']['features']:
            if not f.get('productId') or not f.get('column'):
                continue
            p = item['catalog']['products'].get(f['productId'])
            if p is None:
                continue
            kind = 'membership' if f.get('membershipColumn') else f.get('kind', 'numeric')
            identifier = bool(re.search(r'(?:^|__)(?:ID|CODE|H3_RESOLUTION|OBSERVATION_YEAR)$', f['column'].upper()))
            if identifier:
                kind = 'categorical'
            quality = f.get('role') == 'source_quality_or_context' or bool(re.search(
                r'QC|STATUS|VALID_NEIGHBOR|SOURCE_|GENERALIZED|LAND_FOOTPRINT|REPRESENTATIVE_POINT|H3_RESOLUTION|FRACTION_SUM|DIAGNOSTIC|RECORDS_EXCLUDED|PIXEL_COUNT|SPATIAL_SUPPORT', f['column'].upper()))
            unsupported = None
            if f.get('geometryGroup') or 'cells' not in p and 'slices' not in p:
                unsupported = 'Native geometry records require their own observation unit; a cell join is unavailable.'
            if f.get('circular') or re.search(r'(?:BEARING|DIRECTION|ORIENTATION).*DEG|BEARING_DEG|ORIENTATION_DEG', f['column'].upper()):
                unsupported = 'Circular variables require circular statistics; linear correlation is unsupported.'
            fields.append({k: f.get(k) for k in ['id','column','productId','dataset','resolution','name','family','unit','definition','sourceSha256','modelingEligibility','available','rows']} | {
                'key': self.feature_key(f), 'kind': kind, 'quality': quality,
                'temporal': p.get('axis', 'Static'), 'slices': list(p.get('slices', {})),
                'rows': sum(v['rows'] for v in p['slices'].values()) if 'slices' in p else f['rows'],
                'analysisRows': max(v['rows'] for v in p['slices'].values()) if 'slices' in p else f['rows'],
                # Inherited availability totals can combine slices; exact counts are computed for the chosen slice.
                'available': None if 'slices' in p else f.get('available'),
                'unsupported': unsupported, 'membershipColumn': f.get('membershipColumn'),
            })
        return fields

    def catalog(self, domain='seascape', resolution=6, search='', family='', quality=False, cursor=0, limit=100):
        if domain in UNAVAILABLE:
            return {'fields': [], 'families': [], 'total': 0, 'next': None, 'unavailable': UNAVAILABLE[domain]}
        fs = self.fields(domain)
        families = sorted({f['family'] for f in fs if f['resolution'] == resolution})
        fs = [f for f in fs if f['resolution'] == resolution and (quality or not f['quality'])
              and (not family or f['family'] == family)
              and search.casefold() in (f['name'] + ' ' + f['column']).casefold()]
        fs.sort(key=lambda f: (f['family'], f['name'], f['key']))
        defaults = []
        if domain == 'seascape' and resolution in [6, 8]:
            all_fields = {f['column']: f for f in self.fields(domain) if f['resolution'] == resolution}
            defaults = [all_fields[k] for k in ['SUBSTRATE_MODEL__MODELED_SEDIMENT_SAND_FRACTION', 'SUBSTRATE_MODEL__MODELED_SEDIMENT_MUD_FRACTION', 'SUBSTRATE_MODEL__MODELED_SEDIMENT_GRAVEL_FRACTION'] if k in all_fields]
            contour = next((f for f in all_fields.values() if f['column'].upper().endswith('DISTANCE_TO_ISOBATH_50_M')), None)
            if contour: defaults.append(contour)
        return {'fields': fs[cursor:cursor+limit], 'families': families, 'total': len(fs),
                'next': cursor+limit if cursor+limit < len(fs) else None, 'defaults': defaults,
                'limits': {'variables': MAX_FIELDS, 'rows': MAX_ROWS, 'points': MAX_POINTS, 'seconds': MAX_SECONDS},
                'unavailableProducts': UNAVAILABLE,
                'weatherRange': {k:self.weather_source()[0][k] for k in ['start_date','end_date','latest_complete_all_metric_day']} if domain=='meteorology' else None}

    def weather_source(self):
        root = self.sources.root('meteorology')
        paths = [root/'catalog.json', root/'meteorology-daily.parquet']
        stamp = tuple((p.stat().st_size, p.stat().st_mtime_ns, p.stat().st_ctime_ns) for p in paths)
        with self.lock:
            if self.weather and self.weather[0] == stamp:
                return self.weather[1:]
            c = read(paths[0]); f = pq.ParquetFile(paths[1]); expected = c['products']['daily']
            if (c['h3_resolution'] != 5 or c['timezone'] != 'UTC' or expected['file'] != paths[1].name
                    or digest(paths[1]) != expected['sha256'] or f.metadata.num_rows != expected['rows']
                    or f.schema_arrow.names != [x['name'] for x in expected['columns']]):
                raise AnalysisError('Weather contract/checksum mismatch.', 503)
            context = json.loads(f.schema_arrow.metadata[b'meteorology'])
            if context['timezone'] != 'UTC' or context['method'] != c['method']:
                raise AnalysisError('Weather source time/method mismatch.', 503)
            self.weather = (stamp, c, paths[1])
            return c, paths[1]

    def source_bindings(self, fields, response=False):
        domains = sorted({f['dataset'] for f in fields})
        bindings = {}
        for domain in domains:
            if domain == 'meteorology':
                c, _ = self.weather_source(); bindings[domain] = digest(self.sources.root(domain)/'catalog.json') + ':' + c['products']['daily']['sha256']
            else:
                item = self.component(domain)
                # Reader generation includes adapter and source identities; payload adds content hashes.
                bindings[domain] = hashlib.sha256(json.dumps([item['version'], item['catalog']['datasets'],
                    sorted({f['sourceSha256'] for f in fields if f['dataset']==domain})],sort_keys=True).encode()).hexdigest()
        if response:
            c = read(self.sources.root('orca')/'catalog.json')
            bindings['orca'] = digest(self.sources.root('orca')/'catalog.json') + ':' + c['files']['sightings.parquet']['sha256']
        return bindings

    def resolve(self, query):
        keys = query['variables']
        domains = {k.split(':')[0] for k in keys}
        known = {f['key']: f for d in domains for f in self.fields(d)}
        if any(k not in known for k in keys):
            raise AnalysisError('Unknown variable. Refresh the catalog and reselect; paths and SQL are not accepted.')
        fs = [known[k] for k in keys]
        for f in fs:
            if f['unsupported']:
                raise AnalysisError(f['name'] + ': ' + f['unsupported'])
            if f['quality'] and not query['includeQuality']:
                raise AnalysisError('Quality/context fields require explicit opt-in.')
            if f['kind'] == 'membership' and query['membershipEncoding'] != 'exact_set':
                raise AnalysisError('Overlapping memberships require explicit exact-set encoding. No membership is converted to a numeric ID or ecological absence.')
        if len({f['resolution'] for f in fs}) != 1 or fs[0]['resolution'] != query['resolution']:
            raise AnalysisError('Native resolutions differ. No weather upscaling or implicit H3 parent join is supported.')
        if query['mode'] == 'response':
            if query['resolution'] != 6 or any(f['temporal'] != 'Static' for f in fs):
                raise AnalysisError('Recorded Orca responses currently compare static native R6 predictors, reduced to one row per reported cell over the window. Weather and survey-year joins need separate reviewed adapters.')
            if any(re.search('CRITICAL_HABITAT|SIGHTING|ORCA|SRKW|CLASSIFICATION|IMPUT', f['column'].upper()) for f in fs):
                raise AnalysisError('Potential response leakage: species-informed designation or target-derived predictor is refused for this response.')
        temporal = {f['temporal'] for f in fs if f['temporal'] != 'Static'}
        if len(temporal) > 1:
            raise AnalysisError('Different temporal axes cannot be joined.')
        for f in fs:
            if f['slices'] and query['slice'] not in f['slices']:
                raise AnalysisError('Choose a recorded survey-year slice available in every selected time-varying product.')
        if 'UTC day' in temporal:
            if any(f['dataset'] != 'meteorology' for f in fs):
                raise AnalysisError('Weather only compares with native R5 weather on the same UTC days.')
            if not query['start'] or not query['end'] or (date.fromisoformat(query['end']) - date.fromisoformat(query['start'])).days not in range(32):
                raise AnalysisError('Choose an inclusive UTC window of 1–32 days for native weather comparisons.')
        estimated = max(f.get('analysisRows', f['rows']) or 0 for f in fs) * max(1, len(fs)) * 40
        if estimated > MAX_BYTES:
            raise AnalysisError('Estimated working set exceeds 256 MiB. Reduce variables.', 413)
        return fs

    def asset(self, item, binding):
        path = item['assets'].get(binding['url'])
        if path is None or path.stat().st_size > MAX_BYTES/2 or digest(path) != binding['sha256']:
            raise AnalysisError('Selected source asset is missing, oversized or changed.', 409)
        return read(path)

    def values(self, f, query, budget):
        budget.check()
        if f['dataset'] == 'meteorology':
            return self.weather_values(f, query, budget)
        item = self.component(f['dataset']); p = item['catalog']['products'][f['productId']]
        p = p['slices'][query['slice']] if 'slices' in p else p
        cells = self.asset(item, p['cells'])['ids']
        if any(not h3.is_valid_cell(k) or h3.get_resolution(k)!=f['resolution'] for k in cells):
            raise AnalysisError('Invalid/native H3 resolution mismatch.', 503)
        qualifiers = {}
        if f['kind'] == 'membership':
            b = p.get('memberships', {}).get(f['membershipColumn'])
            if not b:
                raise AnalysisError('Membership source encoding unavailable; scalar category summaries cannot preserve this assignment.', 422)
            v = self.asset(item, b['asset']); vals=[]
            for indices, status in zip(v['indices'], v['statuses'], strict=True):
                if indices is None or status != 'observed':
                    vals.append(None);continue
                names = []
                for i in indices:
                    member=v['dictionary'][i]
                    name=next((r['feature_name'] for r in member['records'] if r.get('feature_name')), member['feature_id'])
                    names.append(name+' ['+member['feature_id']+']')
                vals.append(' + '.join(sorted(names)) if names else 'No recorded memberships · observed support')
            qualifiers = dict(Counter(v['statuses']))
        else:
            if f['column'] not in p['columns']:
                raise AnalysisError('Field has no supported scalar encoding.', 422)
            from biogenic_input import anthropogenic_public_values
            vals = anthropogenic_public_values(f, decode(self.asset(item, p['columns'][f['column']])))
            if f['kind'] == 'categorical':
                vals = [None if x is None else str(x) for x in vals]
            # Preserve delivered QC as visible context. Null eligibility comes from the validated adapter.
            for col,b in p['columns'].items():
                if ('STATUS' in col.upper() or col.upper().endswith('QC')) and col in next((x.get('qualifiers',[]) for x in item['catalog']['features'] if x['column']==f['column'] and x['resolution']==f['resolution']),[]):
                    if len(qualifiers)>=8:break
                    qvals=decode(self.asset(item,b));counts=Counter(str(x) for x in qvals if x is not None)
                    if len(counts)<=20:qualifiers[col]=dict(counts)
        result = unique_series(cells, vals)
        if f['kind']=='numeric': result=numeric(result)
        return result, {'sourceRows':len(cells),'available':int(result.notna().sum()),'sourceNull':int(result.isna().sum()),'qualifiers':qualifiers,
                        'policy':('For the four Anthropogenic presence booleans, unknown is filled False in public values; False is not confirmed absence.' if f.get('family')=='Anthropogenic' and f.get('name') in {'Aquaculture','Artificial Reef','Disposal Site','Dredged Channel'} else 'Delivered source nulls remain null. Partial/source qualifications are retained; no generic QC code reinterpretation.')}

    def weather_values(self, f, query, budget):
        c,path=self.weather_source(); start=date.fromisoformat(query['start']);end=date.fromisoformat(query['end'])
        first=date.fromisoformat(c['start_date']);last=date.fromisoformat(c['end_date'])
        if start<first or end>last:raise AnalysisError('Window is outside the current weather product.')
        keys=[]; vals=[]; partial=0; expected=0
        pf=pq.ParquetFile(path)
        for offset in range((end-start).days+1):
            budget.check();day=start+timedelta(days=offset)
            t=pf.read_row_group((day-first).days, columns=['H3_INDEX','DATE',f['column']]).to_pydict()
            if any(d!=day for d in t['DATE']):raise AnalysisError('Weather row-group time support mismatch.',503)
            ids=t['H3_INDEX']
            if any(not h3.is_valid_cell(k) or h3.get_resolution(k)!=5 for k in ids):raise AnalysisError('Weather native keys invalid.',503)
            incomplete=any(p['date']==str(day) and p['metric']==f['column'] for p in c.get('partial_metric_coverage',[]))
            keys.extend(k+'|'+str(day) for k in ids)
            vals.extend([None]*len(ids) if incomplete else t[f['column']]);partial+=len(ids) if incomplete else 0
            expected+=len(ids)
        result=numeric(unique_series(keys, vals))
        return result, {'sourceRows':len(result),'available':int(result.notna().sum()),'sourceNull':int(result.isna().sum()),
                        'partialExcluded':partial,'expectedCellDays':expected,'distinctCells':len({k.split('|')[0] for k in keys}),'distinctPeriods':(end-start).days+1,
                        'policy':'Metric-specific partial days excluded (including 23/24 precipitation); no temporal reduction, imputation or upscaling.'}

    def validate_response_source(self, root, catalog, path):
        # Reuse the producer's frozen schema/identity contract without exporting full records.
        from orca_input import TYPES, VERSION as ORCA_VERSION
        if catalog['schema_version'] != ORCA_VERSION or catalog['status'] != 'local_verified_partial_source_coverage':
            raise AnalysisError('Unsupported verified Orca delivery.', 503)
        schema_path = root/'schema.json'
        if digest(schema_path) != catalog['files']['schema.json']['sha256'] or read(schema_path) != read(Path(__file__).with_name('orca_schema.json')):
            raise AnalysisError('Sightings frozen source schema changed.', 503)
        supplied = pq.read_schema(path)
        expected = read(schema_path)['fields']
        if supplied.names != [f['name'] for f in expected]:
            raise AnalysisError('Sightings field order/schema differs from frozen contract.', 503)
        for f in expected:
            if f['name'] != 'pod_group_assignments' and supplied.field(f['name']).type != TYPES[f['arrow_type']]:
                raise AnalysisError('Sightings source field type changed.', 503)
        study = catalog['study']
        for key in ['mask', 'r6_registry']:
            if digest(study[key+'_path']) != study[key+'_sha256']:
                raise AnalysisError('Sightings study identity changed.', 503)
        support = set(Path(study['r6_registry_path']).read_text().splitlines())
        assigned = pq.read_table(path, columns=['h3_r6'])['h3_r6'].to_pylist()
        if any(cell is not None and cell not in support for cell in assigned):
            raise AnalysisError('Sightings assignment lies outside its declared native support.', 503)

    def response_values(self, query, budget):
        root=self.sources.root('orca');c=read(root/'catalog.json')
        if c['schema_version']!='orca-study-sightings-v1':raise AnalysisError('Unsupported sightings contract.',503)
        path=root/'sightings.parquet'; stamp=(digest(root/'catalog.json'),path.stat().st_size,path.stat().st_mtime_ns,path.stat().st_ctime_ns)
        columns=['event_id','source','source_record_id','category','time_start_utc','time_end_utc','h3_r6','h3_precision_status','native_date']
        with self.lock:
            if self.orca is None or self.orca[0]!=stamp:
                if digest(path)!=c['files']['sightings.parquet']['sha256']:raise AnalysisError('Sightings checksum mismatch.',503)
                self.validate_response_source(root, c, path)
                rows=pq.read_table(path,columns=columns).to_pylist()
                if len(rows)!=c['rows'] or len({(r['source'],r['source_record_id']) for r in rows})!=len(rows):
                    raise AnalysisError('Sightings stable source-record keys are not unique.',503)
                self.orca=(stamp,rows)
            rows=self.orca[1]
        grain=query['interval'];start=date.fromisoformat(query['start']) if query['start'] else None;end=date.fromisoformat(query['end']) if query['end'] else None
        if grain!='all_time' and (start is None or end is None):raise AnalysisError('A dated response requires a UTC start and end.')
        if grain=='all_time' and (start or end):raise AnalysisError('All time includes undated records. Clear date bounds or choose a dated interval.')
        exclusions=Counter();bins=Counter();cells=Counter();precision=Counter();selected=0;eligible_records=0
        for i,r in enumerate(rows):
            if i%4096==0:budget.check()
            if r['category'] not in query['categories']:continue
            selected+=1
            cell=r['h3_r6'];precision[r['h3_precision_status']]+=1
            if cell is None:exclusions['missing_native_r6_assignment']+=1;continue
            if not h3.is_valid_cell(cell) or h3.get_resolution(cell)!=6:raise AnalysisError('Sightings native R6 key mismatch.',503)
            if query['precision']=='strict' and r['h3_precision_status']!='cell_confined':
                exclusions['cell_confinement_not_established']+=1;continue
            if grain=='all_time':key='All time (includes undated)'
            else:
                day=period(r['time_start_utc'],r['time_end_utc'],grain)
                if day is None:exclusions['unknown_or_cross_bin_utc_interval']+=1;continue
                # Whole source interval and whole aggregation bin must fit the requested window.
                until=datetime.combine(end+timedelta(days=1),datetime.min.time(),tzinfo=timezone.utc)
                since=datetime.combine(start,datetime.min.time(),tzinfo=timezone.utc)
                if r['time_start_utc']<since or r['time_end_utc']>until:
                    exclusions['outside_requested_window']+=1;continue
                bin_end=day+timedelta(days=1 if grain=='daily' else 7)
                if grain=='monthly':bin_end=date(day.year+(day.month==12),day.month%12+1,1)
                if grain=='yearly':bin_end=date(day.year+1,1,1)
                if day<start or bin_end>end+timedelta(days=1):exclusions['partial_requested_bin']+=1;continue
                key=str(day)
            bins[(cell,key)]+=1;cells[cell]+=1;eligible_records+=1
        return unique_series(sorted(cells),[cells[k] for k in sorted(cells)]).astype(float), {
            'sourceRecords':len(rows),'selectedCategoryRecords':selected,'eligibleRecords':eligible_records,'exclusions':dict(exclusions),
            'positiveBins':len(bins),'distinctCells':len(cells),'distinctPeriods':len({p for _,p in bins}),
            'precisionStatuses':dict(precision),'precisionPolicy':query['precision'],
            'policy':'Positive reported bins only, summed once per cell over the declared window. Unreported/unsurveyed cells are not zeros. Recorded source records, not abundance, occupancy or validated absence.',
            'deduplication':c['deduplication'],'coverage':c['coverage'],
            'rights':c['rights'],'temporalPolicy':c['temporal_policy'],
        }

    def plan(self, query):
        fs=self.resolve(query)
        bindings=self.source_bindings(fs,query['mode']=='response')
        if query.get('bindings') and bindings!=query['bindings']:raise AnalysisError('Recipe sources changed. Recreate selection from current sources.',409)
        return {'variables':fs,'bindings':bindings,'grain':self.grain(fs,query),
                'estimatedWorkingBytes':max(f.get('analysisRows', f['rows']) or 0 for f in fs)*len(fs)*40,
                'policy':'Unique native keys, one-to-one outer alignment; no regridding or repeated static daily joins.'}

    @staticmethod
    def grain(fs,query):
        if query['mode']=='response':return 'One row per native H3 R6 cell with positive reported bins in the selected window'
        if any(f['dataset']=='meteorology' for f in fs):return 'One row per native H3 R5 cell × UTC day (repeated cells; temporal dependence)'
        return f"One row per native H3 R{query['resolution']} cell" + (f" · recorded survey slice {query['slice']}" if any(f['slices'] for f in fs) else ' · static support')

    def analyze(self, query, budget=None):
        budget=budget or Budget();fs=self.resolve(query);bindings=self.source_bindings(fs,query['mode']=='response')
        if query.get('bindings') and bindings!=query['bindings']:raise AnalysisError('Sources changed since plan/recipe. Refresh catalog and apply a new plan.',409)
        series={};quality={}
        for f in fs:
            series[f['key']],quality[f['key']]=self.values(f,query,budget)
            if sum(s.memory_usage(deep=True) for s in series.values())>MAX_BYTES:
                raise AnalysisError('Selected values exceed the 256 MiB working-set guard.',413)
        response_info=None
        if query['mode']=='response':
            response,response_info=self.response_values(query,budget)
            # The response observation frame contains positive recorded cells only.
            # All predictor-predictor coefficients in this mode use that same frame;
            # study-wide cells without reports never become response observations.
            for key, values in series.items():
                quality[key]['outsidePositiveResponseFrame']=int((~values.index.isin(response.index)).sum())
                quality[key]['positiveResponseCellsMissingPredictorKey']=int((~response.index.isin(values.index)).sum())
                series[key]=values.loc[values.index.intersection(response.index)]
            response_info['analysisFrame']='Positive recorded native cells only; source-wide predictor rows outside this frame are reported separately, never absence labels.'
            f={'key':'response','column':'sighting_record_count','name':'Recorded Orca sighting count','kind':'numeric','unit':'source records','family':'Recorded response','dataset':'orca','resolution':6,'temporal':'Window sum','quality':False}
            fs.append(f);series['response']=response;quality['response']=response_info
        union=sorted(set().union(*(s.index for s in series.values())))
        if len(union)>MAX_ROWS or len(union)*len(fs)*40>MAX_BYTES:raise AnalysisError('Matched observation budget exceeded.',413)
        frame=pd.DataFrame({k:s.reindex(union) for k,s in series.items()})
        common=frame.notna().all(axis=1)
        if query['cohort']=='complete':
            series={k:s.loc[s.index.intersection(frame.index[common])] for k,s in series.items()}
        matrix=[]
        nums=[f for f in fs if f['kind']=='numeric']
        for a in nums:
            for b in nums:
                budget.check();x,y,d=pair_diagnostics(series[a['key']],series[b['key']]);v,reason=coefficient(x.astype(float),y.astype(float),query['method'])
                matrix.append({'x':a['key'],'y':b['key'],'value':v,'reason':reason,**d})
        xkey=query.get('x') or fs[0]['key'];ykey='response' if query['mode']=='response' else query.get('y') or fs[min(1,len(fs)-1)]['key']
        bykey={f['key']:f for f in fs}
        if xkey not in bykey or ykey not in bykey:raise AnalysisError('Pair variables must be selected.')
        x,y,d=pair_diagnostics(series[xkey],series[ykey]);a,b=bykey[xkey],bykey[ykey]
        pair={'x':xkey,'y':ykey,'diagnostics':d,'statistics':None,'points':[],'density':None,'groups':[],'contingency':None,'reason':None}
        kinds={a['kind'],b['kind']};auto='scatter' if kinds=={'numeric'} else 'box' if 'numeric' in kinds else 'contingency'
        if auto=='scatter' and len(x)>MAX_POINTS:auto='density'
        plot=auto if query['plot']=='auto' else query['plot']
        allowed=['scatter','density'] if kinds=={'numeric'} else ['box','strip'] if 'numeric' in kinds else ['contingency']
        if plot not in allowed:raise AnalysisError(f"{plot} is incompatible with this pair; choose {', '.join(allowed)}.")
        pair['plot']=plot;pair['allowedPlots']=allowed
        if not len(x):pair['reason']='No complete eligible pairs under these support, null and precision rules.'
        elif kinds=={'numeric'}:
            xx=x.astype(float).to_numpy();yy=y.astype(float).to_numpy();v,reason=coefficient(xx,yy,query['method'])
            pair['statistics']={'value':v,'method':query['method'],'reason':reason}
            indices=np.random.default_rng(19).choice(len(x),min(len(x),MAX_POINTS),replace=False);indices.sort()
            pair['points']=[{'x':float(xx[i]),'y':float(yy[i])} for i in indices] if plot=='scatter' else []
            if plot=='density':
                counts,xe,ye=np.histogram2d(xx,yy,bins=40)
                pair['density']={'counts':counts.astype(int).tolist(),'xEdges':xe.tolist(),'yEdges':ye.tolist()}
            pair['ranges']={'x':[float(xe[0]),float(xe[-1])],'y':[float(ye[0]),float(ye[-1])]} if plot=='density' else {'x':[float(xx.min()),float(xx.max())],'y':[float(yy.min()),float(yy.max())]}
        elif 'numeric' in kinds:
            categories=y if a['kind']=='numeric' else x;values=x if a['kind']=='numeric' else y
            if categories.nunique()>24:raise AnalysisError('More than 24 category sets. Narrow the variable/encoding; categories are never silently pooled.',413)
            for label in sorted(categories.unique()):
                v=values[categories==label].astype(float).to_numpy();summary=distribution(v);iqr=summary['q3']-summary['q1']
                summary.update(label=str(label),low=float(v[v>=summary['q1']-1.5*iqr].min()),high=float(v[v<=summary['q3']+1.5*iqr].max()))
                if plot=='strip':summary['points']=np.random.default_rng(19).choice(v,min(len(v),100),replace=False).tolist()
                pair['groups'].append(summary)
            pair['numericAxis']='x' if a['kind']=='numeric' else 'y'
        else:
            if x.nunique()*y.nunique()>400:raise AnalysisError('Contingency exceeds 400 combinations. Select less granular categories.',413)
            table=pd.crosstab(x.rename('x'),y.rename('y'),dropna=False)
            pair['contingency']={'x':list(map(str,table.index)),'y':list(map(str,table.columns)), 'counts':table.values.tolist(),'n':len(x)}
        families=defaultdict(list)
        for m in matrix:
            if m['x']>=m['y']:continue
            fa,fb=bykey[m['x']]['family'],bykey[m['y']]['family'];families[' × '.join(sorted([fa,fb]))].append(m)
        family_summary=[]
        for name,ms in sorted(families.items()):
            valid=[m for m in ms if m['value'] is not None]
            family_summary.append({'name':name,'eligiblePairs':len(ms),'testedPairs':len(valid),'aboveThreshold':sum(abs(m['value'])>=query['threshold'] for m in valid),
                                   'threshold':query['threshold'],'strongest':sorted(valid,key=lambda m:-abs(m['value']))[:3]})
        budget.check()
        if bindings!=self.source_bindings([f for f in fs if f['key']!='response'],query['mode']=='response'):raise AnalysisError('Source generation changed during computation. Reapply.',409)
        recipe={**query,'bindings':bindings,'analysisVersion':VERSION,'samplingSeed':19,'adapterSha256':digest(__file__)}
        return {'version':VERSION,'queryId':hashlib.sha256(json.dumps(recipe,sort_keys=True).encode()).hexdigest()[:16],
                'recipe':recipe,'bindings':bindings,'variables':fs,'grain':self.grain(fs,query),'quality':quality,
                'cohort':{'policy':query['cohort'],'unionRows':len(union),'commonCompleteRows':int(common.sum()),'commonExcluded':int((~common).sum())},
                'matrix':matrix,'pair':pair,'families':family_summary,'response':response_info,
                'sampling':{'seed':19,'plotLimit':MAX_POINTS,'plotted':len(pair['points']),'statistics':'All complete eligible pairs; statistics are not sampled. Density uses all complete pairs.'},
                'warnings':['Exploratory associations only. Spatial/temporal dependence and reporting bias remain; no causal, predictive or ecological significance claim.',
                            'Sand, mud and gravel share a compositional constraint; pairwise correlation does not establish multivariate collinearity.',
                            'Source/model eligibility and unknown units are retained. Quality fields are context, not independent measurement validation.']}
