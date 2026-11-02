"""Read independent measured station temperatures without spatial/time expansion."""
import json
import math
import re
import pyarrow as pa
import pyarrow.parquet as pq
from hydrology_causal import checksum


def read_station_temperature(root, entry):
    if not isinstance(entry,dict) or entry.get('path')!='station_temperature.parquet' or entry.get('format')!='hydrology-station-temperature-1' or entry.get('source_status')!='independent_observations' or entry.get('model_eligible') is not False:
        raise ValueError('Invalid station-temperature catalog binding/status')
    path=root/entry['path']
    if path.is_symlink() or path.stat().st_size!=entry['bytes'] or checksum(path)!=entry['sha256']:
        raise ValueError('Station-temperature checksum mismatch')
    table=pq.read_table(path)
    names=['station_id','river_id','date','statistic','value','unit','status','temporal_basis','quality_flags','source_url','source_sha256','retrieved_at','report_date','source_title']
    expected=pa.schema([(n,pa.date32() if n in ('date','report_date') else pa.float64() if n=='value' else pa.string()) for n in names])
    meta=json.loads(table.schema.metadata[b'hydrology_station_temperature'])
    if table.schema.remove_metadata()!=expected or table.num_rows!=entry['rows'] or meta['format']!=entry['format'] or meta['stations']!=entry['stations'] or meta['model_eligible'] is not False:
        raise ValueError('Station-temperature schema/metadata mismatch')
    stations=entry['stations'];rows=table.to_pylist();keys=set()
    for key,s in stations.items():
        if s['station_id']!=key or s['coordinate_crs'] not in ('EPSG:4326','not explicitly stated by station page') or not -90<=s['latitude']<=90 or not -180<=s['longitude']<=180 or s['unit']!='degC' or s['model_eligible'] is not False or not s['statistics'] or 'daily_mean' not in s['statistics'] or len(set(s['statistics']))!=len(s['statistics']) or not set(s['statistics'])<={'daily_mean','daily_min','daily_max'}:
            raise ValueError('Station-temperature station identity mismatch')
    for r in rows:
        key=(r['station_id'],r['date'],r['statistic'],r['temporal_basis'])
        s=stations.get(r['station_id'])
        if key in keys or not s or r['river_id']!=s['river_id'] or r['statistic'] not in s['statistics'] or r['temporal_basis']!='provider_daily' or r['unit']!='degC' or r['status']!='valid' or r['value'] is None or not math.isfinite(r['value']) or not isinstance(json.loads(r['quality_flags']),dict) or not re.fullmatch('[a-f0-9]{64}',r['source_sha256']) or not r['source_url'].startswith('https://') or r['date']>r['report_date']:
            raise ValueError('Station-temperature row identity/value mismatch')
        keys.add(key)
        r['date']=r['date'].isoformat();r['report_date']=r['report_date'].isoformat()
    if not rows or min(r['date'] for r in rows)!=entry['start'] or max(r['date'] for r in rows)!=entry['end'] or {r['station_id'] for r in rows}!=set(stations) or checksum(path)!=entry['sha256']:
        raise ValueError('Station-temperature support mismatch')
    return {'sha256':entry['sha256'],'stations':stations,'rows':sorted(rows,key=lambda r:(r['station_id'],r['date'])),'missingness':meta['missingness']}
