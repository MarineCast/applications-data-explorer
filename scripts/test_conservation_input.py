"""Combined assignment preserves scientific totals and source/status identity."""
import copy
import datetime
import json
import tempfile
import unittest
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from conservation_input import (CORE, REFERENCE, GROUP, ASSIGNMENT, COUNT, CORE_ASSIGNMENT,
                                REFERENCE_ASSIGNMENT, combine_conservation)
from governance_memberships import MEMBERSHIP_TYPE, extract_governance_memberships, decode_membership_payload
from governance_input import append_governance
from prepare_map import Exporter
from prepare_seascape import digest
from test_governance_memberships import record


def fixture():
    designated={'feature_id':'cpcad_parent:714320000','records':[record('eccc','designated','Gulf Islands','zone-a')]}
    interim={'feature_id':designated['feature_id'],'records':[{**record('eccc','interim','Gulf Islands','zone-b'),'area_hierarchy_level':'Interim'}]}
    proposed={'feature_id':'dfo_aoi_record:3','records':[{**record('dfo','aoi','Race Rocks','3'),'area_hierarchy_level':'Proposed / under assessment; not designated'}]}
    columns={'h3_index':[h3.latlng_to_cell(lat,-123.5,6) for lat in (48,48.1,48.2,48.3,48.4,48.5)]}
    fields={'h3_index':{'definition':'Native cell'}}
    for group, rows in zip((CORE,REFERENCE), ([[designated],None,[],None,[designated],None],[[interim],[proposed],[],None,None,None])):
        column=group+'__feature_memberships_v1'; count=group+'__recorded_feature_count'
        states=['partial','partial' if group==REFERENCE else 'unknown','observed','unavailable','partial' if group==CORE else 'unknown','unknown']
        columns.update({column:pa.array(rows,MEMBERSHIP_TYPE),column+'_status':states,
                        count:pa.array([len(row) if row is not None else None for row in rows],pa.int64()),count+'_status':states})
        fields.update({name:{'definition':'Original support'} for name in (column,column+'_status',count,count+'_status')})
        fields[column].update(membership_schema_version=1,coverage_reference=group,count_field=count,missing_reason_field=column+'_status',source_record_context={'interim':{'site_identity':interim['feature_id']}} if group==REFERENCE else {})
    coverage=CORE+'__recorded_polygon_union_area_fraction'
    columns[coverage]=[0.25,None,0,None,0.75,None]; fields[coverage]={'definition':'Designated union / full H3 area','units':'1'}
    return pa.table(columns),{'schema_version':1,'model_eligible':False,'fields':fields,'spatial':{'h3_resolution':6},'temporal':{'type':'static'}}


class ConservationInput(unittest.TestCase):
    def test_preserves_arrays_and_same_site_different_status_without_count_inflation(self):
        table,metadata=fixture(); before=copy.deepcopy(metadata)
        combined,meta=combine_conservation(table,metadata)
        for column in table.column_names: self.assertTrue(table[column].equals(combined[column]),column)
        self.assertEqual(metadata,before)
        _,payloads=extract_governance_memberships(combined,meta)
        payload=payloads[ASSIGNMENT]; rows=decode_membership_payload(payload)
        self.assertEqual(payload['counts'],[2,1,0,None,1,None])
        self.assertEqual(payload['statuses'],['partial','partial','observed','unavailable','partial','unknown'])
        self.assertEqual([member['feature_id'] for member in rows[0]],['conservation_reference:interim:cpcad_parent:714320000','cpcad_parent:714320000'])
        self.assertEqual(rows[0][0]['records'],table[REFERENCE_ASSIGNMENT][0].as_py()[0]['records'])
        self.assertEqual(meta['fields'][ASSIGNMENT]['source_record_context']['interim']['site_identity'],'cpcad_parent:714320000')
        self.assertEqual(meta['fields'][ASSIGNMENT]['source_record_context']['interim']['designated_count_and_coverage'],'Excluded')
        replay,_=combine_conservation(combined,meta); self.assertTrue(replay.equals(combined))
        corrupt=table.set_column(table.column_names.index(CORE+'__recorded_feature_count'),CORE+'__recorded_feature_count',pa.array([9,None,0,None,1,None],pa.int64()))
        result,meta=combine_conservation(corrupt,metadata)
        with self.assertRaisesRegex(ValueError,'count'): extract_governance_memberships(result,meta)

    def test_missing_reference_is_not_silently_hidden_and_unknown_status_fails_closed(self):
        table,metadata=fixture()
        absent=[c for c in table.column_names if c.startswith(REFERENCE+'__')]
        partial=table.drop(absent); meta={**metadata,'fields':{k:v for k,v in metadata['fields'].items() if k not in absent}}
        result,_=combine_conservation(partial,meta); self.assertIs(result,partial)
        rows=table[REFERENCE_ASSIGNMENT].to_pylist(); rows[0][0]['records'][0]['area_hierarchy_level']='Unsupported status'
        corrupt=table.set_column(table.column_names.index(REFERENCE_ASSIGNMENT),REFERENCE_ASSIGNMENT,pa.array(rows,MEMBERSHIP_TYPE))
        with self.assertRaisesRegex(ValueError,'Unrecognized'): combine_conservation(corrupt,metadata)

    def test_export_static_dynamic_has_three_choices_and_preserves_original_bindings(self):
        for dynamic in (False,True):
            with self.subTest(dynamic=dynamic), tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp); source=root/'Governance'; source.mkdir(); output=root/'cache'; output.mkdir()
                table,context=fixture(); kind='dynamic' if dynamic else 'static'
                if dynamic:
                    table=table.append_column('date',pa.array([datetime.date(2026,10,19)]*table.num_rows))
                    context['fields']['date']={'definition':'Source date'}; context['temporal']['type']=kind
                path=source/f'governance-r6-{kind}.parquet'
                pq.write_table(table.replace_schema_metadata({b'governance':json.dumps(context).encode()}),path)
                before=path.read_bytes()
                (source/'catalog.json').write_text(json.dumps({'schema_version':1,'domain':'governance','last_updated_utc':'2026-10-19','tables':{'6':{kind:{'path':path.name,'rows':table.num_rows,'sha256':digest(path)}}}}))
                catalog={'datasets':{},'products':{},'features':[]}
                append_governance(Exporter(output,'fixture'),catalog,source)
                self.assertEqual(sorted(f['name'] for f in catalog['features']),['Marine Conservation Area Assignment','Marine Conservation Area Count','Marine Conservation Area Coverage'])
                field=next(f for f in catalog['features'] if f.get('membershipColumn')==ASSIGNMENT)
                self.assertEqual(field['id'],'GOVERNANCE__'+('dynamic__' if dynamic else '')+CORE_ASSIGNMENT)
                self.assertEqual(field['assignmentSemantics'],'conservation_status')
                self.assertIn('interim',field['sourceRecordContext'])
                product=catalog['products']['governance-r6'+('-dynamic' if dynamic else '')]
                if dynamic: product=product['slices']['2026-10-19']
                for col in (CORE_ASSIGNMENT,REFERENCE_ASSIGNMENT,ASSIGNMENT): self.assertIn(col,product['memberships'])
                binding=product['memberships'][ASSIGNMENT]['asset']
                payload=json.loads((output/'assets'/(binding['sha256']+'.json')).read_text())
                self.assertEqual(payload['counts'],[2,1,0,None,1,None])
                self.assertEqual(path.read_bytes(),before)
