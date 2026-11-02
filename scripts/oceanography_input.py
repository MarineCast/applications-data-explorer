"""Ocean Conditions contracts and explicit offline export compatibility helper."""
CONTRACT = {'sst': ('sst_c', 6, 'degree_C', 'Sea Surface Temperature', '°C'),
            'chlorophyll': ('chlorophyll_mg_m3', 5, 'mg m-3', 'Chlorophyll', 'mg/m³')}
PRODUCTS = {key: {'resolution':res,'units':unit,'metrics':[(metric,label,display,False)]}
            for key,(metric,res,unit,label,display) in CONTRACT.items()}
for source,res,depth in [('hycom',5,'0 m'),('salishsea',6,'~0.5 m')]:
    name='HYCOM' if source=='hycom' else 'SalishSeaCast'
    metric='salinity_psu' if source=='hycom' else 'reference_salinity_g_kg'
    label='Practical salinity' if source=='hycom' else 'Reference salinity'
    PRODUCTS[source+'-salinity']={'resolution':res,'units':'psu' if source=='hycom' else 'g kg-1','metrics':[(metric,f'{label} · {name} ({depth})','psu' if source=='hycom' else 'g/kg',False)]}
    PRODUCTS[source+'-currents']={'resolution':res,'units':'m/s','metrics':[(m,f'{label} · {name} ({depth})','m/s',signed) for m,label,signed in [('current_east_m_s','Eastward current',True),('current_north_m_s','Northward current',True),('current_speed_m_s','Current speed',False)]]}

PRODUCTS['glorys12-salinity']={'resolution':5,'units':'psu','metrics':[('salinity_psu','Practical salinity · GLORYS12 (~0.49 m)','psu',False)]}
PRODUCTS['glorys12-currents']={'resolution':5,'units':'m/s','metrics':[
    ('current_east_m_s','Daily-mean eastward current · GLORYS12 (~0.49 m)','m/s',True),
    ('current_north_m_s','Daily-mean northward current · GLORYS12 (~0.49 m)','m/s',True),
    ('current_daily_mean_vector_speed_m_s','Daily-vector current speed · GLORYS12 (~0.49 m)','m/s',False)]}

PRODUCTS['enso-roni']={'resolution':5,'units':'degree_C','metrics':[('roni_c','ENSO · seasonal regional context','°C',True)]}
PRODUCTS['tide-events']={'resolution':6,'units':'event timestamps (UTC and offset-bearing local ISO8601)','metrics':[(m,'Tide event times','',False) for m in ['high_tide_times_utc','low_tide_times_utc','high_tide_local_times','low_tide_local_times']]}


def append_oceanography(exporter,catalog,root):
    # The live API uses Store directly. This helper explicitly exports selected
    # bounded fixtures/offline snapshots, sharing the same validation contract.
    from oceanography_store import Store
    import copy
    store=Store(root);component=copy.deepcopy(store.catalog)
    for product in component['products'].values():
        for part in product['slices'].values():
            part['cells']=exporter.write(store.request(part['cells']['url'])['json'])
            part['columns']={key:exporter.write(store.request(a['url'])['json']) for key,a in part['columns'].items()}
    for key in ('features','products','datasets'):
        if key=='features':catalog[key].extend(component[key])
        else:catalog[key].update(component[key])
