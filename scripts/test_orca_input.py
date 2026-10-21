"""Consumer qualification tests use synthetic temporary products only."""
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
import unittest
import h3
import pyarrow as pa
import pyarrow.parquet as pq
from orca_input import prepare, digest, period, TYPES

class OrcaInput(unittest.TestCase):
    def fixture(self, directory):
        root=Path(directory)/'Orca'/'Sightings'
        root.mkdir(parents=True)
        frozen=Path(__file__).with_name('orca_schema.json')
        source_schema=json.loads(frozen.read_text())
        (root/'schema.json').write_bytes(frozen.read_bytes())
        pod_type=pa.list_(pa.struct([pa.field('label',pa.string(),nullable=False),pa.field('group_type',pa.string(),nullable=False),pa.field('source_term',pa.string()),pa.field('evidence_field',pa.string(),nullable=False),pa.field('evidence_text',pa.string()),pa.field('confidence',pa.string(),nullable=False),pa.field('conflicting',pa.bool_(),nullable=False)]))
        schema=pa.schema([pa.field(f['name'],pod_type if f['name']=='pod_group_assignments' else TYPES[f['arrow_type']],nullable=f['nullable']) for f in source_schema['fields']])
        row={f.name:None if f.nullable else 'SYNTHETIC_TEST_ONLY' for f in schema}
        cell=h3.latlng_to_cell(48.5,-123.4,6)
        row.update(event_id='synthetic-record',source_record_id='synthetic-source',source_occurrence_count=1,category='other',ecotype_detail='UNKNOWN',classification_status='unknown',classification_evidence_json='[]',pod_group_assignments=[],pod_group_status='unknown',time_precision='unknown',latitude=48.5,longitude=-123.4,h3_r6=cell,qc_flags=[])
        pq.write_table(pa.Table.from_pylist([row],schema=schema),root/'sightings.parquet')
        count_schema=pa.schema([('grain',pa.string()),('period_start_utc_date',pa.date32()),('category',pa.string()),('h3_r6',pa.string()),('sighting_record_count',pa.int32())])
        pq.write_table(pa.Table.from_pylist([dict(grain='all_time',period_start_utc_date=None,category='other',h3_r6=cell,sighting_record_count=1)],schema=count_schema),root/'counts.parquet')
        mask=root/'test-mask';mask.write_bytes(b'synthetic test binding only')
        registry=root/'test-r6';registry.write_text(cell+'\n')
        source={'schema_version':'orca-study-sightings-v1','status':'local_verified_partial_source_coverage','rows':1,'generated_at_utc':'2026-10-16T00:00:00Z','coverage':'Synthetic test only','rights':'TEST_ONLY','files':{},'study':dict(mask_path=str(mask),mask_sha256=digest(mask),r6_registry_path=str(registry),r6_registry_sha256=digest(registry),r6_registry_cells=1)}
        for name in ['sightings.parquet','counts.parquet','schema.json']:
            source['files'][name]={'bytes':(root/name).stat().st_size,'sha256':digest(root/name)}
        (root/'catalog.json').write_text(json.dumps(source))
        return root,source

    def refresh(self,root,source,name):
        source['files'][name]={'bytes':(root/name).stat().st_size,'sha256':digest(root/name)}
        (root/'catalog.json').write_text(json.dumps(source))

    def test_qualifies_sparse_counts_exact_support_and_lazy_source_details(self):
        with tempfile.TemporaryDirectory() as directory:
            root,_=self.fixture(directory);output=Path(directory)/'browser'
            source_before={p.name:digest(p) for p in root.iterdir()}
            report=prepare(root,output)
            catalog=json.loads((output/'catalog.json').read_text())
            self.assertEqual(report['reductions'],dict(daily=0,weekly=0,monthly=0,yearly=0,all_time=1))
            self.assertEqual(report['rows'],1)
            payload=json.loads((output/Path(catalog['events']['url']).name).read_text())
            self.assertNotIn('source_description',payload['columns'])
            detail=json.loads((output/Path(next(iter(catalog['details'].values()))['url']).name).read_text())
            self.assertEqual(detail['synthetic-record'],{'classification_evidence_json':'[]','source_description':None})
            self.assertEqual(source_before,{p.name:digest(p) for p in root.iterdir()})

    def test_rejects_source_hash_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            root,_=self.fixture(directory);(root/'schema.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'binding mismatch'):
                prepare(root,Path(directory)/'browser')

    def test_rejects_independently_inconsistent_counts(self):
        with tempfile.TemporaryDirectory() as directory:
            root,source=self.fixture(directory)
            table=pq.read_table(root/'counts.parquet');table=table.set_column(4,'sighting_record_count',pa.array([2],type=pa.int32()))
            pq.write_table(table,root/'counts.parquet');self.refresh(root,source,'counts.parquet')
            with self.assertRaisesRegex(ValueError,'reductions differ'):
                prepare(root,Path(directory)/'browser')

    def test_rejects_changed_frozen_nullability(self):
        with tempfile.TemporaryDirectory() as directory:
            root,source=self.fixture(directory)
            schema=json.loads((root/'schema.json').read_text());schema['fields'][0]['nullable']=True
            (root/'schema.json').write_text(json.dumps(schema));self.refresh(root,source,'schema.json')
            with self.assertRaisesRegex(ValueError,'frozen app contract'):
                prepare(root,Path(directory)/'browser')

    def test_calendar_whole_interval_containment_and_monday_weeks(self):
        start=datetime(2024,2,28,8,tzinfo=timezone.utc);end=datetime(2024,2,29,8,tzinfo=timezone.utc)
        self.assertIsNone(period(start,end,'daily'))
        self.assertEqual(str(period(start,end,'monthly')),'2024-02-01')
        self.assertEqual(str(period(start,end,'weekly')),'2024-02-26')
        self.assertIsNone(period(None,None,'yearly'))

if __name__=='__main__':
    unittest.main()
