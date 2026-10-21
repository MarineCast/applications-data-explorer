"""Read and bind a retained Orca product into an isolated local browser cache.
No provider calls or source writes. Catalog activation is the final atomic write.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import date, datetime, timedelta
import hashlib
import json
from pathlib import Path
import os
import h3
import pyarrow as pa
import pyarrow.parquet as pq

VERSION = 'orca-study-sightings-v1'
TYPES = {'string': pa.string(), 'int32': pa.int32(), 'double': pa.float64(), 'int16':pa.int16(), 'bool':pa.bool_(),
         'list<item: string>': pa.list_(pa.string()), 'date32[day]': pa.date32(),
         'timestamp[us, tz=UTC]': pa.timestamp('us', tz='UTC')}

def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def serialize(value):
    if isinstance(value, datetime):
        return value.isoformat(timespec='microseconds').replace('+00:00', 'Z')
    if isinstance(value, date):
        return value.isoformat()
    raise TypeError(type(value).__name__)

def period(start, end, grain):
    if start is None or end is None:
        return None
    day = start.date()
    if grain == 'weekly':
        day -= timedelta(days=day.weekday())
    elif grain == 'monthly':
        day = day.replace(day=1)
    elif grain == 'yearly':
        day = day.replace(month=1, day=1)
    until = (day + timedelta(days=7 if grain == 'weekly' else 1))
    if grain == 'monthly':
        until = date(day.year + (day.month == 12), day.month % 12 + 1, 1)
    elif grain == 'yearly':
        until = date(day.year + 1, 1, 1)
    return day if end <= datetime.combine(until, datetime.min.time(), tzinfo=start.tzinfo) else None

def verified_demography(root):
    catalog_path=root/'catalog.json'
    if not catalog_path.exists():
        return None
    catalog=json.loads(catalog_path.read_text())
    parquet=root/'annual-population.parquet'
    if catalog['schema_version']!='orca-demography-v1' or digest(parquet)!=catalog['sha256']:
        raise ValueError('Demography source binding mismatch')
    table=pq.read_table(parquet)
    expected=pa.schema([pa.field(f['name'],TYPES[f['arrow_type']],nullable=f['nullable']) for f in catalog['fields']])
    if not table.schema.equals(expected,check_metadata=False):
        raise ValueError('Demography Arrow schema mismatch')
    rows=table.to_pylist()
    if len(rows)!=catalog['rows'] or any(r['verification_status']!='primary_web_confirmed' or r['category']!='srkw' or r['census_year'] not in catalog['verified_years'] or not r['total_matches_pod_sum'] or r['all_pods']!=r['j_pod']+r['k_pod']+r['l_pod'] for r in rows):
        raise ValueError('Default demography must contain only primary-confirmed annual rows')
    return {'rows':rows,'sourceCatalogSha256':digest(catalog_path),'sourceParquetSha256':catalog['sha256'],
            'sourceUrl':catalog['source']['primary_url'],'limitations':catalog['limitations']+' '+catalog['rights']}

def prepare(root: Path, output: Path):
    source_path=root/'catalog.json'
    before=digest(source_path)
    root_catalog_path=root.parent/'catalog.json'
    root_hash=None
    providers=[]
    daily_coverage=None
    if root_catalog_path.exists():
        root_hash=digest(root_catalog_path)
        root_catalog=json.loads(root_catalog_path.read_text())
        if root_catalog['schema_version']!='orca-current-v1':
            raise ValueError('Unsupported Orca product family')
        for name,binding in root_catalog['files'].items():
            candidate=(root.parent/name).resolve()
            if not candidate.is_relative_to(root.parent) or candidate.stat().st_size!=binding['bytes'] or digest(candidate)!=binding['sha256']:
                raise ValueError('Orca family product binding mismatch')
        refresh=json.loads((root.parent/'api-refresh.json').read_text())
        providers=[{'source':name.upper(),**{key:entry.get(key) for key in ['status','retrieved_at_utc','actual_latest_study_sighting_native_date','scope','availability_caveat']}} for name,entry in refresh.items()]
        daily_coverage=json.loads((root/'daily-utc-coverage.json').read_text())
    source=json.loads(source_path.read_text())
    if source['schema_version'] != VERSION or source['status'] != 'local_verified_partial_source_coverage':
        raise ValueError('Unsupported verified Orca source')
    for name, record in source['files'].items():
        path=root/name
        if path.parent != root or path.stat().st_size != record['bytes'] or digest(path) != record['sha256']:
            raise ValueError(f'Source file binding mismatch: {name}')
    schema=json.loads((root/'schema.json').read_text())
    frozen=json.loads(Path(__file__).with_name('orca_schema.json').read_text())
    if schema != frozen:
        raise ValueError('Producer schema differs from frozen app contract')
    pod_type=pa.list_(pa.struct([pa.field('label',pa.string(),nullable=False),pa.field('group_type',pa.string(),nullable=False),pa.field('source_term',pa.string()),pa.field('evidence_field',pa.string(),nullable=False),pa.field('evidence_text',pa.string()),pa.field('confidence',pa.string(),nullable=False),pa.field('conflicting',pa.bool_(),nullable=False)]))
    expected=pa.schema([pa.field(f['name'],pod_type if f['name']=='pod_group_assignments' else TYPES[f['arrow_type']],nullable=f['nullable']) for f in schema['fields']])
    table=pq.read_table(root/'sightings.parquet')
    if schema['schema_version']!=VERSION or not table.schema.equals(expected,check_metadata=False):
        raise ValueError('Frozen Arrow schema mismatch')
    study=source['study']
    for key in ['mask','r6_registry']:
        if digest(study[f'{key}_path']) != study[f'{key}_sha256']:
            raise ValueError('Approved study binding mismatch')
    grid=Path(study['r6_registry_path']).read_text().splitlines()
    if len(grid)!=study['r6_registry_cells'] or len(set(grid))!=len(grid) or any(not h3.is_valid_cell(c) or h3.get_resolution(c)!=6 for c in grid):
        raise ValueError('Invalid native registry')
    support=set(grid)
    records=table.to_pylist()
    if len(records)!=source['rows'] or len({r['event_id'] for r in records})!=len(records):
        raise ValueError('Event identity/count mismatch')
    reductions={g:Counter() for g in ['daily','weekly','monthly','yearly','all_time']}
    for r in records:
        if r['category'] not in ['srkw','transient','other'] or (r['classification_status'] in ['mixed','unknown'] and r['category']!='other'):
            raise ValueError('Classification mismatch')
        if not isinstance(json.loads(r['classification_evidence_json']),list):
            raise ValueError('Invalid native evidence')
        if r['h3_r6'] is not None:
            if r['h3_r6'] not in support or r['latitude'] is None or h3.latlng_to_cell(r['latitude'],r['longitude'],6)!=r['h3_r6']:
                raise ValueError('Exact point/native support mismatch')
        start,end=r['time_start_utc'],r['time_end_utc']
        if (start is None)!=(end is None) or (start is not None and end<=start):
            raise ValueError('Invalid half-open source time interval')
        if r['observed_at_utc'] is not None and not (start<=r['observed_at_utc']<end):
            raise ValueError('Reported timestamp outside support')
        for grain,counts in reductions.items():
            day=None if grain=='all_time' else period(start,end,grain)
            if r['h3_r6'] is not None and (grain=='all_time' or day is not None):
                counts[(day,r['category'],r['h3_r6'])]+=1
    supplied={g:Counter() for g in reductions}
    for r in pq.read_table(root/'counts.parquet').to_pylist():
        k=(r['period_start_utc_date'],r['category'],r['h3_r6'])
        if k in supplied[r['grain']] or r['sighting_record_count']<=0:
            raise ValueError('Invalid sparse count keys')
        supplied[r['grain']][k]=r['sighting_record_count']
    if reductions!=supplied:
        raise ValueError('Independent temporal/category/native reductions differ')
    if digest(source_path)!=before:
        raise ValueError('Producer catalog changed while reading')
    demography=verified_demography(root.parent/'Demography')
    snapshot=hashlib.sha256(('orca-browser-v1:'+before+':'+digest(__file__)+':'+json.dumps(demography,default=serialize,sort_keys=True)+':'+str(root_hash)).encode()).hexdigest()
    output.mkdir(parents=True,exist_ok=True)
    details={}
    shards={}
    for record in records:
        key=record['event_id'].split(':')[-1][:2]
        shards.setdefault(key,{})[record['event_id']]={'classification_evidence_json':record.pop('classification_evidence_json'),'source_description':record.pop('source_description')}
    for key,entries in shards.items():
        path=output/f'{snapshot}.evidence-{key}.json'
        path.write_text(json.dumps(entries,ensure_ascii=True,separators=(',',':')))
        details[key]={'url':f'/local-data/orca/{path.name}','sha256':digest(path)}
    columns={}
    for field in records[0] if records else []:
        values=[r[field] for r in records]
        dictionary=[]
        positions={}
        indices=[]
        for value in values:
            key=json.dumps(value,default=serialize,ensure_ascii=True,separators=(',',':'))
            if key not in positions:
                positions[key]=len(dictionary)
                dictionary.append(value)
            indices.append(positions[key])
        encoded_column={'dictionary':dictionary,'indices':indices}
        columns[field]=encoded_column if len(json.dumps(encoded_column,default=serialize))<len(json.dumps(values,default=serialize)) else values
    payload={'kind':'orca-sightings','version':1,'snapshot':snapshot,'grid':grid,'columns':columns}
    asset=output/f'{snapshot}.json'
    encoded=json.dumps(payload,default=serialize,ensure_ascii=True,separators=(',',':'),allow_nan=False).encode()
    temporary=asset.with_suffix('.tmp')
    temporary.write_bytes(encoded)
    os.replace(temporary,asset)
    catalog={'version':1,'status':'validated_local_snapshot','snapshot':snapshot,'rows':len(records),
             'events':{'url':f'/local-data/orca/{asset.name}','sha256':digest(asset)},
             'details':details,'demography':demography,
             'source':{'catalogSha256':before,'parquetSha256':source['files']['sightings.parquet']['sha256'],
                       'schemaVersion':VERSION,'rootCatalogSha256':root_hash,'providers':providers,'dailyCoverage':daily_coverage,'limitations':source['coverage']+' '+source['rights'],
                       'publishedAt':source['generated_at_utc']}}
    temp=output/'catalog.pending.json'
    temp.write_text(json.dumps(catalog,indent=2,default=serialize)+'\n')
    if digest(source_path)!=before or (root_hash is not None and digest(root_catalog_path)!=root_hash):
        raise ValueError('Source changed before activation')
    os.replace(temp,output/'catalog.json')
    return {'rows':len(records),'snapshot':snapshot,'jsonBytes':len(encoded),'sourceCatalogSha256':before,
            'reductions':{g:sum(c.values()) for g,c in reductions.items()},'validatedArrowSchema':True}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    print(json.dumps(prepare(args.source.resolve(),args.output.resolve()),indent=2))
