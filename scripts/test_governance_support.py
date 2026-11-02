"""Independent readback of the external Governance support format."""
import base64
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zlib

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from governance_input import append_governance, bindings
from governance_support import COLUMN_ALIASES, restore_support, display_table, SUPPORT_KEY, SUPPORT_SCHEMA
from governance_names import NAME_POLICY
from prepare_map import Exporter
from prepare_seascape import digest
from test_governance_memberships import fixture, COLUMN, COUNT


class GovernanceSupport(unittest.TestCase):
    def test_self_contained_support_readback_and_bindings_without_external_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original, metadata, _, _, _ = self.compact_fixture(root)
            public, view = display_table(original, metadata, naming_version=5)
            header = {'schema':'governance.app.audit.v1','original_columns':original.column_names,
                      'original_schema':base64.b64encode(original.schema.serialize().to_pybytes()).decode(),
                      'original_metadata':metadata}
            buffer = pa.BufferOutputStream()
            pq.write_table(original.replace_schema_metadata({b'governance_app_audit':json.dumps(header).encode()}),buffer)
            payload = zlib.compress(buffer.getvalue().to_pybytes())
            context = copy.deepcopy(metadata)
            context['fields'] = {name:view['fields'][name] for name in public.column_names}
            context['embedded_support'] = {'schema':SUPPORT_SCHEMA,'encoding':'zlib_parquet_v1',
                'sha256':hashlib.sha256(payload).hexdigest(),'rows':original.num_rows,'columns':original.column_names}
            context['application_contract'] = {'version':5,'columns':public.column_names,
                'column_aliases':COLUMN_ALIASES,'membership_representation':NAME_POLICY}
            public = public.replace_schema_metadata({SUPPORT_KEY:payload,b'governance':json.dumps(context).encode()})
            source = root/'Governance';source.mkdir()
            path = source/'governance-r6-static.parquet'
            pq.write_table(public,path)
            on_disk = pq.read_table(path)
            self.assertTrue(restore_support(on_disk,context)[0].equals(original,check_metadata=False))
            catalog = {'schema_version':1,'domain':'governance','last_updated_utc':'2026-10-20T00:00:00Z',
                'tables':{'6':{'static':{'path':path.name,'sha256':digest(path),'rows':original.num_rows}}},
                'support_data':{'6':{'static':context['embedded_support']}}}
            (source/'catalog.json').write_text(json.dumps(catalog))
            self.assertNotIn('audit_bindings',bindings(source)['catalog.json'])
            from local_data import Sources
            dependencies = Sources(root,root/'public',root/'study.json').dependencies('governance')
            self.assertNotIn(root/'audit.parquet',dependencies)
            cache = root/'cache';cache.mkdir()
            result = {'datasets':{},'products':{},'features':[]}
            append_governance(Exporter(cache,'fixture'),result,source)
            self.assertEqual({f['column'] for f in result['features']},{COUNT,COLUMN})
            for broken in ({}, {SUPPORT_KEY:payload+b'changed'}):
                with self.assertRaisesRegex(ValueError,'support checksum'):
                    restore_support(public.replace_schema_metadata(broken),context)
            missing = {key:value for key,value in context.items() if key != 'embedded_support'}
            with self.assertRaisesRegex(ValueError,'requires scientific support'):
                restore_support(public,missing)
            changed = copy.deepcopy(catalog)
            changed['support_data']['6']['static']['sha256'] = '0'*64
            (source/'catalog.json').write_text(json.dumps(changed))
            with self.assertRaisesRegex(ValueError,'binding mismatch'):
                bindings(source)

    def compact_fixture(self, root):
        table, metadata, values = fixture()
        table = table.set_column(0, 'h3_index', pa.array([h3.latlng_to_cell(lat, -123.5, 6) for lat in (48,48.5,49,49.5)]))
        metadata.update(spatial={'h3_resolution':6}, temporal={'type':'static'})
        for field in metadata['fields'].values():
            field['definition'] = 'Exact retained field'
        public = table.select(['h3_index', COUNT, COLUMN])
        audit = table.select(['h3_index', COUNT+'_status', COLUMN+'_status'])
        path = root/'audit.parquet'
        header = {'schema':'governance.app.audit.v1', 'original_columns':table.column_names,
                  'original_schema':base64.b64encode(table.schema.serialize().to_pybytes()).decode(),
                  'original_metadata':metadata}
        pq.write_table(audit.replace_schema_metadata({b'governance_app_audit':json.dumps(header).encode()}),path)
        binding = {'schema':header['schema'],'path':str(path),'sha256':digest(path),
                   'rows':audit.num_rows,'columns':audit.column_names}
        context = copy.deepcopy(metadata)
        context['fields'] = {name:metadata['fields'][name] for name in public.column_names}
        context['app_only_audit'] = binding
        context['application_contract'] = {'version':2,'columns':public.column_names}
        return table, metadata, public, context, values

    def test_exact_reconstruction_and_source_watch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original, metadata, public, context, values = self.compact_fixture(root)
            restored, original_metadata = restore_support(public,context)
            self.assertTrue(restored.equals(original,check_metadata=False))
            self.assertEqual(original_metadata,metadata)
            source = root/'Governance';source.mkdir()
            path = source/'governance-r6-static.parquet'
            pq.write_table(public.replace_schema_metadata({b'governance':json.dumps(context).encode()}),path)
            catalog = {'schema_version':1,'domain':'governance','last_updated_utc':'2026-10-20T00:00:00Z',
                'tables':{'6':{'static':{'path':path.name,'sha256':digest(path),'rows':4}}},
                'audit_data':{'6':{'static':context['app_only_audit']}}}
            (source/'catalog.json').write_text(json.dumps(catalog))
            self.assertEqual(bindings(source)['catalog.json']['audit_bindings'],[context['app_only_audit']])
            cache = root/'cache';cache.mkdir()
            result = {'datasets':{},'products':{},'features':[]}
            append_governance(Exporter(cache,'fixture'),result,source)
            self.assertEqual({f['column'] for f in result['features']},{COUNT,COLUMN})
            self.assertIn(COUNT+'_status',result['products']['governance-r6']['columns'])
            from local_data import Sources
            sources = Sources(root, root/'public', root/'study.json')
            audit = Path(context['app_only_audit']['path'])
            self.assertIn(audit, sources.dependencies('governance'))
            before = sources.version('governance')
            audit.write_bytes(audit.read_bytes()+b'changed')
            self.assertNotEqual(before, sources.version('governance'))
            with self.assertRaisesRegex(ValueError,'audit checksum'):
                bindings(source)

    def test_missing_audit_and_changed_public_definitions_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, _, public, context, _ = self.compact_fixture(root)
            changed = copy.deepcopy(context)
            changed['fields'][COUNT]['definition'] = 'Different quantity'
            with self.assertRaisesRegex(ValueError,'definitions'):
                restore_support(public,changed)
            context['app_only_audit']['path'] = str(root/'missing.parquet')
            with self.assertRaises(FileNotFoundError):
                restore_support(public,context)

    def test_friendly_names_restore_original_memberships_and_support(self):
        with tempfile.TemporaryDirectory() as directory:
            original, _, public, context, _ = self.compact_fixture(Path(directory))
            renamed = public.rename_columns([COLUMN_ALIASES[name] for name in public.column_names])
            context['fields'] = {COLUMN_ALIASES[name]: value for name, value in context['fields'].items()}
            context['application_contract'].update(version=3, columns=renamed.column_names,
                                                    column_aliases=COLUMN_ALIASES)
            restored, _ = restore_support(renamed, context)
            self.assertTrue(restored.equals(original, check_metadata=False))
            self.assertEqual(renamed['fisheries_management_area_count'].to_pylist(), [2, None, 0, 1])

    def test_plain_names_reconstruct_typed_identity_and_reject_changed_labels(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original, metadata, _, _, _ = self.compact_fixture(root)
            public, context = display_table(original, metadata, naming_version=4)
            context['fields'] = {name:context['fields'][name] for name in public.column_names}
            self.assertEqual(public['fisheries_management_area_membership'].to_pylist(),
                             [['21-0', 'San Juan Islands'], None, [], ['San Juan Islands']])
            self.assertEqual(public['fisheries_management_area_membership'].type, pa.list_(pa.string()))
            # Construct the on-disk audit format independently of the producer.
            header = {'schema':'governance.app.audit.v1','original_columns':original.column_names,
                      'original_schema':base64.b64encode(original.schema.serialize().to_pybytes()).decode(),
                      'original_metadata':metadata}
            path = root/'typed-support.parquet'
            pq.write_table(original.replace_schema_metadata({b'governance_app_audit':json.dumps(header).encode()}),path)
            context['app_only_audit'] = {'schema':header['schema'],'path':str(path),'sha256':digest(path),
                                         'rows':original.num_rows,'columns':original.column_names}
            context['application_contract'] = {'version':4,'columns':public.column_names,
                'column_aliases':COLUMN_ALIASES,'membership_representation':NAME_POLICY}
            restored, _ = restore_support(public, context)
            self.assertTrue(restored.equals(original,check_metadata=False))
            name = 'fisheries_management_area_membership'
            values = public[name].to_pylist();values[0][0] = 'Invented area'
            changed = public.set_column(public.column_names.index(name),name,pa.array(values,pa.list_(pa.string())))
            with self.assertRaisesRegex(ValueError,'public view'):
                restore_support(changed,context)
