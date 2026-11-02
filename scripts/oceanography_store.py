"""Bounded validation and lazy, checksum-bound daily Oceanography assets."""
import hashlib
import json
import math
import tempfile
from datetime import date, timedelta
import calendar
from pathlib import Path
import h3
import numpy as np
import pyarrow as pa
import pyarrow.dataset as ds
import pyarrow.parquet as pq
from oceanography_input import PRODUCTS
from prepare_seascape import digest, packed


def identity(path):
    s=path.stat()
    return (str(path.resolve()),s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)


def body_hash(value):
    return hashlib.sha256(json.dumps(value,allow_nan=False,separators=(',',':')).encode()).hexdigest()


class Store:
    def __init__(self,root):
        self.root=Path(root);self.identities={};self.routes={};self.entries={}
        receipt=self.root/'catalog.json';stamp=self.bind(receipt)
        info=json.loads(receipt.read_text())
        if info['schema_version']!=1 or info['domain']!='oceanography' or len(info['products'])!=len({p['id'] for p in info['products']}) or not {'sst','chlorophyll'}<={p['id'] for p in info['products']}<=set(PRODUCTS):
            raise ValueError('Unsupported Oceanography catalog')
        study=info['study'];self.bind(Path(study['study_path']),study['study_sha256'])
        self.catalog={'features':[],'products':{},'datasets':{},'resolutions':{}}
        for entry in info['products']:
            self.validate(entry,study,info,stamp)
        self.catalog['datasets']['oceanography']={'name':'Oceanography','release':'Native ocean conditions','status':'Published native products','limitations':info['method']+' '+info['date_basis'],'manifestSha256':stamp}
        self.check()

    def bind(self,path,expected=None):
        if path.is_symlink():raise ValueError('Oceanography symlink rejected')
        before=identity(path);actual=digest(path)
        if identity(path)!=before or (expected is not None and expected!=actual):
            raise ValueError('Oceanography binding changed; retry after publication')
        self.identities[path]=before
        return actual

    def check(self):
        if any(identity(p)!=v for p,v in self.identities.items()):
            raise ValueError('Oceanography changed during read; retry after publication')

    def asset(self,payload,stamp,route):
        sha=body_hash(payload);url=f'/local-data/seascape/ocean-{stamp}/assets/{sha}.json'
        self.routes[url]=route
        return {'url':url,'sha256':sha}

    def validate(self,e,study,info,stamp):
        if e["id"]=="tide-events":
            from oceanography_tides import validate_tides
            return validate_tides(self,e,study,info,stamp)
        spec=PRODUCTS[e['id']];res=spec['resolution'];metrics=[m[0] for m in spec['metrics']];path=self.root/e['path']
        if path.parent!=self.root or e['metric']!=metrics[0] or e.get('metrics',[e['metric']])!=metrics or e['h3_resolution']!=res or e['units']!=spec['units']:
            raise ValueError('Oceanography product binding mismatch')
        if e['id'].startswith('glorys12-'):
            q=e.get('qualification',{})
            if q.get('tidal_constituents_included') is not False or q.get('forecast_eligible') is not False or q.get('issue_date') is not None or not math.isclose(q.get('source_surface_depth_m',-1),0.49402499198913574,abs_tol=1e-8) or not all(isinstance(q.get(k),str) and q[k] for k in ('spatial_method','date_basis','speed_definition','salinity_definition')):
                raise ValueError('GLORYS12 source qualification mismatch')
        self.bind(path,e['sha256'])
        expected=pa.schema([('date',pa.date32()),('h3_index',pa.string())]+[(m,pa.float64()) for m in metrics]);pf=pq.ParquetFile(path)
        if pf.schema_arrow.remove_metadata()!=expected or e['columns']!=expected.names or pf.metadata.num_rows!=e['row_count']:
            raise ValueError('Oceanography schema mismatch')
        stats=e.get('statistics',{metrics[0]:{k:e.get(k) for k in ['nonnull','null','minimum','maximum']}})
        if set(stats)!=set(metrics):raise ValueError('Oceanography metric summary mismatch')
        m=study['memberships'][str(res)];registry=Path(m['path']);self.bind(registry,m['sha256'])
        ids=sorted(registry.read_text().splitlines());index={c:i for i,c in enumerate(ids)}
        if len(ids)!=m['count'] or len(index)!=len(ids) or any(not h3.is_valid_cell(c) or h3.get_resolution(c)!=res for c in ids):
            raise ValueError('Oceanography registry identity mismatch')
        start=date.fromisoformat(e['date_start']);end=date.fromisoformat(e['date_end']);dates=[start+timedelta(days=i) for i in range((end-start).days+1)];periods=None
        if e['id']=='enso-roni':
            from oceanography_tides import seasonal_dates
            dates,periods=seasonal_dates(e)
        days=len(dates);date_index={d:i for i,d in enumerate(dates)};n=len(ids)
        if days<=0 or not n or days*n!=e['row_count']:raise ValueError('Oceanography support mismatch')
        seen=np.zeros(days*n,dtype=np.bool_);counts=[0]*len(metrics);lows=[math.inf]*len(metrics);highs=[-math.inf]*len(metrics)
        pid='oceanography-'+e['id'];slices={};cell_payload={'ids':ids,'resolution':res,'sourceSha256':e['sha256']}
        cells=self.asset(cell_payload,stamp,('cells',e['id'],None,None))
        self.entries[e['id']]={'entry':e,'ids':ids,'metrics':metrics,'resolution':res,'cells':cell_payload}
        with tempfile.TemporaryDirectory(prefix='marinecast-ocean-validation-') as scratch:
            values=np.memmap(Path(scratch)/'values',mode='w+',dtype='float64',shape=(days,n,len(metrics)))
            try:
                for batch in pf.iter_batches(batch_size=8192,use_threads=False):
                    columns=[batch.column(i).to_pylist() for i in range(len(metrics)+2)]
                    for row in zip(*columns,strict=True):
                        day,cell,*vs=row;offset=date_index.get(day,-1);column=index.get(cell)
                        if not 0<=offset<days or column is None:raise ValueError('Oceanography date/cell support mismatch')
                        key=offset*n+column
                        if seen[key]:raise ValueError('Oceanography duplicate date/cell support')
                        seen[key]=True
                        if len(metrics)==3 and any(v is None for v in vs) and not all(v is None for v in vs):
                            raise ValueError('Oceanography current components have inconsistent null support')
                        for j,(metric,value) in enumerate(zip(metrics,vs,strict=True)):
                            if value is not None:
                                if not math.isfinite(value) or (metric=='chlorophyll_mg_m3' and value<=0) or (metric in ('salinity_psu','reference_salinity_g_kg','current_speed_m_s','current_daily_mean_vector_speed_m_s') and value<0):raise ValueError('Invalid Oceanography value')
                                counts[j]+=1;lows[j]=min(lows[j],value);highs[j]=max(highs[j],value)
                            values[offset,column,j]=np.nan if value is None else value
                if not seen.all():raise ValueError('Oceanography support mismatch')
                for j,metric in enumerate(metrics):
                    st=stats[metric]
                    if counts[j]!=st['nonnull'] or days*n-counts[j]!=st['null'] or (lows[j] if counts[j] else None)!=st['minimum'] or (highs[j] if counts[j] else None)!=st['maximum']:raise ValueError('Oceanography summary/support mismatch')
                for offset in range(days):
                    day=dates[offset].isoformat();columns={}
                    if periods is not None and (np.isnan(values[offset,:,0]).any() or not np.all(values[offset,:,0]==values[offset,0,0])):raise ValueError('ENSO must be uniform regional context')
                    for j,metric in enumerate(metrics):
                        payload=packed([None if math.isnan(v) else float(v) for v in values[offset,:,j]])
                        columns[metric]=self.asset(payload,stamp,('values',e['id'],day,metric))
                    slices[day]={'rows':n,'cells':cells,'columns':columns,'sourceSha256':e['sha256'],'sourcePath':e['path'],'resolution':res,'label':day}
            finally:
                values._mmap.close()
        self.catalog['products'][pid]={'axis':'Season end' if periods is not None else 'Date','defaultSlice':start.isoformat(),'slices':slices}
        if periods is not None:
            for day,part in slices.items():
                period=periods[day];part['label']=f"{period['season']} · {period['period_start']}–{period['period_end']}"
        q=e.get('qualification',{});method=q.get('spatial_method',q.get('method',info['method']));basis=q.get('date_basis',info['date_basis'])
        for j,(metric,label,display,signed) in enumerate(spec['metrics']):
            meaning='Positive eastward, negative westward.' if metric=='current_east_m_s' else 'Positive northward, negative southward.' if metric=='current_north_m_s' else q.get('speed_definition','Mean of native sample magnitudes; not magnitude of the daily mean vector.') if metric in ('current_speed_m_s','current_daily_mean_vector_speed_m_s') else q.get('salinity_definition','')
            definition=e['description']+' '+method+' '+basis+' '+meaning+' '+(info.get('source_precedence','') if metric=='chlorophyll_mg_m3' else '')+' Null means no qualified estimate; never zero. Sources and depths remain distinct; no mosaic or salinity conversion. Historical forecast availability is unknown.'
            if e['id'].startswith('glorys12-'):
                definition+=' Copernicus GLORYS12 at about 0.49 m; tides are excluded. Speed averages native daily-vector magnitudes spatially; it is neither mean hourly speed nor the magnitude of the spatially averaged vector. Coarse support does not establish narrow-passage coverage; unsupported inland cells remain null. Attribution: '+q.get('attribution','E.U. Copernicus Marine Service Information')+'.'
            if e['id'].startswith('glorys12-') and q.get('production_regimes'):
                labels={'documented_reanalysis':'documented reanalysis','documented_interim_NRT_assimilation':'documented interim near-real-time assimilation'}
                for regime in q['production_regimes']:
                    definition+=f" {regime['start']}–{regime['end']}: {labels[regime['regime']]}."
                if q.get('forcing_change_date'):definition+=f" A separate forcing change starts {q['forcing_change_date']}."
                definition+=' '+q.get('regime_evidence','')+'.'
            if periods is not None:definition+=' '+q['publication_lag']+' Period end is not issue date. Historical issue dates are unknown; retrospective context only, not eligible for forecasting or as-of joins.'
            feature_id=metric if e['id'] in ('sst','chlorophyll') else e['id'].split('-')[0]+'__'+metric
            self.catalog['features'].append({'id':feature_id,'column':metric,'productId':pid,'dataset':'oceanography','kind':'numeric','categories':None,'resolution':res,'name':label,'family':'Ocean Conditions','unit':display,'range':[lows[j],highs[j]] if counts[j] else [0,1],'available':counts[j],'rows':days*n,'role':'source_field','qualifiers':[],'sourceRelease':', '.join(e.get('source_datasets',[e['source_dataset']])),'sourcePath':e['path'],'sourceSha256':e['sha256'],'definition':definition,'modelingEligibility':'not_assigned; preserve source semantics','aliasOf':None,'arrowType':'double',**({'seasonalContext':{'periods':periods,'publicationLag':q['publication_lag']},'modelingEligibility':'forecast_ineligible; issue dates unknown'} if periods is not None else {}),**({'signed':True} if signed else {})})
        self.check()

    def request(self,url):
        self.check();kind,key,day,metric=self.routes[url];item=self.entries[key]
        if kind=='cells':payload=item['cells']
        elif kind=='tide':
            from oceanography_tides import tide_payload
            payload=tide_payload(self.root/item['entry']['path'],date.fromisoformat(day),metric,item['ids'])
        else:
            found={};target=date.fromisoformat(day);path=self.root/item['entry']['path']
            scanner=ds.dataset(path,format='parquet').scanner(filter=ds.field('date')==pa.scalar(target,pa.date32()),columns=['h3_index',metric],batch_size=8192,use_threads=False,batch_readahead=1,fragment_readahead=1)
            allowed=set(item['ids'])
            for batch in scanner.to_batches():
                for cell,value in zip(batch.column(0).to_pylist(),batch.column(1).to_pylist(),strict=True):
                    if cell in found or cell not in allowed:raise ValueError('Oceanography selected slice duplicate/membership mismatch')
                    found[cell]=value
            if set(found)!=allowed:raise ValueError('Oceanography selected slice incomplete')
            payload=packed([found[c] for c in item['ids']])
        self.check()
        if body_hash(payload)!=url.rsplit('/',1)[-1].removesuffix('.json'):raise ValueError('Oceanography selected slice checksum mismatch')
        return {'json':payload}
