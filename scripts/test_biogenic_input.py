import pytest
from biogenic_input import biogenic_features, NAMES


def test_family_normalization_preserves_native_identity_units_and_dates():
    fields = [dict(id=c, column=c, name=c, family='Bivalve', dataset='seascape', unit='m2', productId=c, qualifiers=['SOURCE_MAP_DATES_JSON']) for c in NAMES]
    result = biogenic_features(fields)
    assert len(result) == 4
    assert {f['family'] for f in result} == {'Biogenic Habitats'}
    for old, new in zip(fields, result):
        assert all(new[k] == old[k] for k in ['id','column','unit','productId','qualifiers'])


def test_startup_does_not_revive_retired_products_or_touch_governance():
    old = [dict(id=c, column=c, family=f) for c,f in [('BIVALVE__OLD_AREA','Bivalve'),('OLD_AREA','Kelp'),('ANNUAL_SEAGRASS_EXTENT_M2','Seagrass')]]
    assert biogenic_features(old) == []
    other = [dict(id='BIVALVE__OLD_AREA', dataset='governance', family='Bivalve'),dict(id='COAST_LENGTH', family='Coastal Features')]
    assert biogenic_features(other) == other


@pytest.mark.parametrize("column,old_family,new_family", [
    ("BIVALVE_EXTENT_ALL_TIME_M2", "Bivalve", "Biogenic Habitats"),
    ("HARD_CLASS_AREA_M2", "Mapped Substrate Classes", "Substrate"),
    ("SHORELINE_LENGTH_M", "Coast Complexity", "Coastal Environment"),
    ("SHORELINE_TOTAL_MAPPED_LENGTH_M", "Shoreline", "Coastal Environment"),
    ("DEPTH_THRESHOLD_M", "Nearshore Transitions", "Coastal Environment"),
])
def test_verified_startup_cache_is_normalized_without_changing_assets(tmp_path, column, old_family, new_family):
    import json
    import h3
    import pyarrow as pa
    import pyarrow.parquet as pq
    from prepare_flat_map import prepare_flat
    from local_data import Reader, Sources
    source = tmp_path/'Data/Seascape'
    source.mkdir(parents=True)
    table = pa.table({'H3_INDEX':[h3.latlng_to_cell(49,-125,6)],'H3_RESOLUTION':[6],column:[12.5]}).replace_schema_metadata({b'seascape_domain':json.dumps({'fields':{column:{'unit':'m2','picker_visible':True,'family':new_family}}}).encode()})
    pq.write_table(table,source/'bivalve-r6-static.parquet')
    (source/'catalog.json').write_text(json.dumps({'bivalve':{'last_updated_utc':'2026-10-20T00:00:00Z','static':{'6':'bivalve-r6-static.parquet'}}}))
    public=tmp_path/'public'
    prepare_flat(source,None,public/'seascape')
    catalog=public/'seascape/catalog.json'
    seed=json.loads(catalog.read_text())
    seed['features'][0]['family']=old_family
    products=seed['products']
    catalog.write_text(json.dumps(seed))
    reader=Reader(Sources(tmp_path/'Data',public,tmp_path/'study.json'))
    try:
        normalized,_=reader.seed_base('seascape')
        assert normalized['features'][0]['family']==new_family
        assert normalized['products']==products
    finally:
        reader.close()


def test_physical_family_grouping_changes_only_family():
    families = {'Mapped Substrate Classes':'Substrate','Shoreline':'Coastal Environment','Coast Complexity':'Coastal Environment','Nearshore Transitions':'Coastal Environment'}
    for old, new in families.items():
        field = dict(id='coast_complexity_r6',column='LENGTH_M',family=old,unit='m',dataset='seascape',productId='native-product',qualifiers=['QC'],support='native')
        assert biogenic_features([field]) == [dict(field,family=new)]
        field['dataset']='governance'
        assert biogenic_features([field]) == [field]
    untouched = [dict(id='x',family='Coastal Bounds'),dict(id='y',family='Nearshore Other')]
    assert biogenic_features(untouched) == untouched


def test_spatial_cleanup_is_exact_and_domain_scoped():
    from biogenic_input import SPATIAL_INTERNAL_FIELDS
    fields = [dict(id='h3_marine_support__'+c,column='h3_marine_support__'+c,family='Spatial Support') for c in SPATIAL_INTERNAL_FIELDS]
    keep = [dict(id='GRAPH_DEGREE',family='Spatial Support'),dict(id='GRAPH_QC_REASON_DETAIL',family='Spatial Support'),dict(id='GRAPH_QC_REASON',family='Shoreline'),dict(id='GRAPH_QC_REASON',family='Spatial Support',dataset='governance')]
    assert biogenic_features(fields+keep) == [keep[0],keep[1],dict(keep[2],family='Coastal Environment'),keep[3]]


def test_anthropogenic_consolidation_preserves_boolean_identity():
    from biogenic_input import ANTHROPOGENIC_NAMES, ANTHROPOGENIC_RETIRED
    originals=[dict(id=c,column=c,family='Anthropogenic',kind='categorical',categories=[True,False],productId='source',qualifiers=['QC']) for c in ANTHROPOGENIC_NAMES]
    retired=[dict(id=c,column=c,family='Anthropogenic') for c in ANTHROPOGENIC_RETIRED if c not in ANTHROPOGENIC_NAMES]+[dict(id='DISTANCE_TO_'+g+'_M',family='Anthropogenic') for g in ['AQUACULTURE','ARTIFICIAL_REEF','DISPOSAL_SITE','DREDGED_CHANNEL']]
    actual=biogenic_features(originals+retired)
    assert len(actual)==4
    for old,new in zip(originals,actual):
        assert new['name']==ANTHROPOGENIC_NAMES[old['column']]
        assert all(new[k]==v for k,v in old.items() if k != 'categories')
        assert new['categories']==[False,True]
    outside=[dict(id='SOURCE_COVERAGE',family='Anthropogenic',dataset='governance'),dict(id='SOURCE_COVERAGE',family='Terrain')]
    assert biogenic_features(outside)==outside


def test_verified_anthropogenic_startup_retains_boolean_assets(tmp_path):
    import json
    import h3
    import pyarrow as pa
    import pyarrow.parquet as pq
    from prepare_flat_map import prepare_flat
    from local_data import Reader, Sources
    from biogenic_input import ANTHROPOGENIC_NAMES
    source=tmp_path/'Data/Seascape';source.mkdir(parents=True)
    values={'H3_INDEX':[h3.latlng_to_cell(49,-125,6)],'H3_RESOLUTION':[6]}
    values.update({c:pa.array([True if 'REEF' not in c else None],type=pa.bool_()) for c in ANTHROPOGENIC_NAMES})
    pq.write_table(pa.table(values),source/'anthropogenic-r6-static.parquet')
    (source/'catalog.json').write_text(json.dumps({'anthropogenic':{'last_updated_utc':'2026-10-20T00:00:00Z','static':{'6':'anthropogenic-r6-static.parquet'}}}))
    public=tmp_path/'public';prepare_flat(source,None,public/'seascape')
    catalog=public/'seascape/catalog.json';seed=json.loads(catalog.read_text());products=seed['products']
    for f in seed['features']:f['name']='old label'
    seed['features'].append(dict(seed['features'][0],id='OLD_DISTANCE',column='DISTANCE_TO_AQUACULTURE_M'))
    catalog.write_text(json.dumps(seed))
    reader=Reader(Sources(tmp_path/'Data',public,tmp_path/'study.json'))
    try:
        actual,_=reader.seed_base('seascape')
        assert {f['name'] for f in actual['features']}==set(ANTHROPOGENIC_NAMES.values())
        assert all(f['arrowType']=='bool' and f['kind']=='categorical' for f in actual['features'])
        assert actual['products']==products
    finally:reader.close()


def test_eight_anthropogenic_qc_removals_do_not_hide_same_names_elsewhere():
    columns = ['COMPREHENSIVE_SURVEY_COVERAGE_ESTABLISHED', 'FULL_H3_WITHIN_SOURCE_RECTANGLE', 'GENERALIZED_FALLBACK', 'GLOBAL_INVENTORY_COMPLETE', 'NATIVE_LAND_FOOTPRINT_UNKNOWN', 'NETWORK_DISTANCE_QC_REASON', 'OBSERVATION_PERIOD', 'OVERWATER_QC']
    hidden=[dict(id=c,column='ANTHROPOGENIC__'+c,family='Anthropogenic') for c in columns]
    other=[dict(id=c,column=c,family='Estuary') for c in columns]
    assert biogenic_features(hidden+other)==other


def test_public_false_fill_is_limited_to_four_presence_fields():
    from biogenic_input import anthropogenic_public_values, ANTHROPOGENIC_NAMES
    for c in ANTHROPOGENIC_NAMES:
        f=dict(column=c,family='Anthropogenic',dataset='seascape')
        assert anthropogenic_public_values(f,[True,False,None])==[True,False,False]
        assert anthropogenic_public_values(dict(f,family='Other'),[None])==[None]
        assert anthropogenic_public_values(dict(f,dataset='governance'),[None])==[None]
    assert anthropogenic_public_values(dict(column='SOURCE_COVERAGE',family='Anthropogenic'),[None])==[None]
