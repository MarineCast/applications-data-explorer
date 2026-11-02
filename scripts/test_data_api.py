"""HTTP transport, freshness, concurrency and lifecycle for real layer readers."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import pyarrow as pa
import pyarrow.parquet as pq

from fastapi.testclient import TestClient
from fastapi.responses import FileResponse, JSONResponse

from data_api import create_app, Layers, LayerResponse, Worker
from prepare_seascape import unpack
import test_local_data as fixtures
import test_relationships as relationships_fixtures


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.LiveDataTests()
        self.fixture.setUp()
        from local_data import Reader
        original = Reader.get
        # This fixture supplies actual Seascape Parquets. Other domains have an
        # explicitly empty test component; their full adapters have their own suite.
        def component(reader, domain):
            if domain in {'governance', 'human', 'oceanography'}:
                return {'catalog': {'products': {}, 'features': [], 'datasets': {}}}
            return original(reader, domain)
        self.components = patch.object(Reader, 'get', component)
        self.components.start()
        self.service = relationships_fixtures.FixtureService()
        self.app = create_app(self.fixture.reader.sources, self.service)
        self.client = TestClient(self.app, headers={'accept-encoding': 'identity'})
        self.client.__enter__()

    def tearDown(self):
        workers = list(self.app.state.layers.workers.values())
        directories = [worker.reader.directory for worker in workers if worker.reader]
        self.client.__exit__(None, None, None)
        self.assertTrue(self.service.closed)
        self.assertTrue(all(not directory.exists() for directory in directories))
        self.components.stop()
        self.fixture.tearDown()

    def catalog(self):
        response = self.client.get('/local-data/seascape/catalog.json')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def values(self, catalog):
        binding = catalog['products']['seascape-population-static-r6']['columns']['POPULATION']
        response = self.client.get(binding['url'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(hashlib.sha256(response.content).hexdigest(), binding['sha256'])
        head = self.client.head(binding['url'])
        self.assertEqual(head.content, b'')
        self.assertEqual(head.headers['content-length'], str(len(response.content)))
        return unpack(response.json())

    def test_real_catalog_assets_head_cache_and_source_replacement(self):
        before = self.catalog()
        self.assertEqual(self.values(before), [0., None])
        worker = self.app.state.layers.worker('seascape')
        with patch.object(worker.reader, 'request', wraps=worker.reader.request) as read:
            self.assertEqual(self.catalog(), before)
            head = self.client.head('/local-data/seascape/catalog.json')
            self.assertEqual(head.status_code, 200)
            self.assertEqual(head.content, b'')
            self.assertEqual(read.call_count, 0)
        self.fixture.write([57.125, 0.], added=True)
        after = self.catalog()
        self.assertNotEqual(after['manifestSha256'], before['manifestSha256'])
        self.assertEqual(self.values(after), [57.125, 0.])
        self.assertIn('NEW_MEASUREMENT', after['products']['seascape-population-static-r6']['columns'])
        (self.fixture.source/'population-r6-static.parquet').write_bytes(b'incomplete')
        with self.assertLogs('marinecast.layers', level='ERROR'):
            broken = self.client.get('/local-data/seascape/catalog.json')
            old_asset = self.client.get(after['products']['seascape-population-static-r6']['columns']['POPULATION']['url'])
        self.assertEqual((broken.status_code, old_asset.status_code), (503, 503))
        self.assertNotIn(str(self.fixture.root), broken.text)
        self.fixture.write([None, 3.])
        self.assertEqual(self.values(self.catalog()), [None, 3.])

    def test_oceanography_version_invalidates_combined_catalog(self):
        worker=self.app.state.layers.worker('seascape')
        original=worker.sources.version
        token=['one']
        with patch.object(worker.sources,'version',side_effect=lambda domain:token[0] if domain=='oceanography' else original(domain)):
            self.catalog()
            token[0]='two'
            with patch.object(worker.reader,'request',wraps=worker.reader.request) as read:
                self.catalog()
                self.assertEqual(read.call_count,1)

    def test_parallel_requests_share_one_validated_catalog(self):
        worker = self.app.state.layers.worker('seascape')
        from local_data import Reader
        original = Reader.request
        calls = []
        def request(reader, parameters):
            calls.append(parameters)
            return original(reader, parameters)
        with patch.object(Reader, 'request', request), ThreadPoolExecutor(max_workers=8) as pool:
            responses = list(pool.map(lambda _: self.client.get('/local-data/seascape/catalog.json'), range(8)))
        self.assertTrue(all(response.status_code == 200 for response in responses))
        self.assertEqual(len(calls), 1)
        self.assertEqual(worker.pending, 0)

    def test_footer_cache_rechecks_file_identity_and_external_audits(self):
        from seascape_support import audit_binding
        sources = self.fixture.reader.sources
        with patch('seascape_support.audit_binding', wraps=audit_binding) as inspect:
            initial = sources.version('seascape')
            self.assertEqual(sources.version('seascape'), initial)
            self.assertEqual(inspect.call_count, 2)
            self.fixture.write([9., None])
            self.assertNotEqual(sources.version('seascape'), initial)
            self.assertEqual(inspect.call_count, 4)
        human = self.fixture.root/'Data/Human'
        human.mkdir()
        audit, receipt = self.fixture.root/'audit.parquet', self.fixture.root/'receipt.json'
        audit.write_bytes(b'audit'); receipt.write_text('{}')
        metadata = {b'human_delivery': json.dumps({'receipt_path': str(receipt)}).encode(),
                    b'human_study': json.dumps({'static_audit': {'artifact': {'path': str(audit)}}}).encode()}
        pq.write_table(pa.table({'h3_index': ['fixture']}).replace_schema_metadata(metadata), human/'static.parquet')
        with patch.object(pq, 'read_schema', wraps=pq.read_schema) as inspect:
            initial = sources.version('human')
            self.assertEqual(sources.version('human'), initial)
            self.assertEqual(inspect.call_count, 1)
            audit.write_bytes(b'changed audit')
            self.assertNotEqual(sources.version('human'), initial)
            self.assertEqual(inspect.call_count, 1)
            audit.unlink()
            self.assertTrue(sources.version('human').startswith('unavailable:'))

    def test_partial_catalog_is_retried_with_unchanged_source_tokens(self):
        self.catalog()
        worker = self.app.state.layers.worker('seascape')
        worker.catalog = None
        original = worker.reader.request
        calls = []
        def transient(parameters):
            result = original(parameters)
            calls.append(1)
            if len(calls) == 1:
                result['json']['unavailableProducts'] = [{'name': 'Human', 'reason': 'Temporary read failure'}]
            return result
        with patch.object(worker.reader, 'request', transient):
            self.assertTrue(self.catalog()['unavailableProducts'])
            self.assertFalse(self.catalog()['unavailableProducts'])
        self.assertEqual(len(calls), 2)

    def test_slow_weather_does_not_block_health_or_another_domain(self):
        entered, release = threading.Event(), threading.Event()
        weather = self.app.state.layers.worker('meteorology')
        def slow(*args):
            entered.set()
            if not release.wait(10):
                raise RuntimeError('Test did not release weather')
            return JSONResponse({'values': [0, None]})
        with patch.object(weather, 'response', slow), ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(self.client.get, '/api/meteorology?operation=daily')
            try:
                self.assertTrue(entered.wait(5))
                self.assertEqual(self.client.get('/api/local-data/health').status_code, 200)
                self.catalog()
                self.assertFalse(pending.done())
            finally:
                release.set()
            self.assertEqual(pending.result().json(), {'values': [0, None]})

    def test_weather_transport_preserves_query_and_head(self):
        worker = self.app.state.layers.worker('meteorology')
        with patch.object(worker, 'response', return_value=JSONResponse({'values': [0, None]})) as response:
            result = self.client.get('/api/meteorology?operation=daily&snapshot=abc&metric=wind&date=2026-01-01&period=day')
            self.assertEqual(result.json(), {'values': [0, None]})
            self.assertEqual(response.call_args.args[0]['snapshot'], 'abc')
            self.assertEqual(response.call_args.args[0]['date'], '2026-01-01')

    def test_read_only_routes_host_origin_and_queue_limits(self):
        for url in ['/local-data/other/catalog.json', '/api/meteorology?operation=write',
                    '/api/meteorology?operation=daily&path=/etc/passwd']:
            self.assertEqual(self.client.get(url).status_code, 400)
        self.assertEqual(self.client.post('/local-data/seascape/catalog.json', json={}).status_code, 405)
        self.assertEqual(self.client.get('/api/local-data/health', headers={'host': 'example.com'}).status_code, 400)
        self.assertEqual(self.client.get('/api/local-data/health', headers={'origin': 'https://example.com'}).status_code, 403)
        worker = self.app.state.layers.worker('seascape')
        worker.pending = 32
        self.assertEqual(self.client.get('/local-data/seascape/catalog.json').status_code, 429)
        worker.pending = 0
        self.assertEqual(self.client.get('/api/relationships/health').status_code, 200)
        self.assertEqual(self.client.get('/api/relationships/catalog').status_code, 200)


class AsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_source_events_share_polling_and_publish_changes(self):
        versions = {'seascape': 'first'}
        layers = Layers(SimpleNamespace(versions=lambda: dict(versions)))
        first, second = layers.events(), layers.events()
        try:
            self.assertIn('retry:', await anext(first))
            self.assertIn('retry:', await anext(second))
            self.assertIn('first', await asyncio.wait_for(anext(first), 5))
            self.assertIn('first', await asyncio.wait_for(anext(second), 5))
            self.assertEqual(layers.subscribers, 2)
            versions['seascape'] = 'second'
            self.assertIn('second', await asyncio.wait_for(anext(first), 5))
            self.assertIn('second', await asyncio.wait_for(anext(second), 5))
        finally:
            await first.aclose()
            await second.aclose()
            self.assertEqual(layers.subscribers, 0)
            await layers.close()

    async def test_file_transmission_holds_generation_lock(self):
        worker = Worker(None, 'seascape')
        entered, release = asyncio.Event(), asyncio.Event()
        calls = []
        path = Path(__file__)
        def response(*args):
            calls.append(1)
            return FileResponse(path)
        async def send(message):
            if message['type'] == 'http.response.body':
                entered.set()
                await release.wait()
        async def receive():
            return {'type': 'http.request', 'body': b''}
        scope = {'type': 'http', 'method': 'GET', 'headers': [], 'asgi': {'spec_version': '2.4'}}
        with patch.object(worker, 'response', response):
            first = asyncio.create_task(LayerResponse(worker, {})(scope, receive, send))
            second = None
            try:
                await asyncio.wait_for(entered.wait(), 5)
                second = asyncio.create_task(LayerResponse(worker, {})(scope, receive, send))
                await asyncio.sleep(.05)
                self.assertEqual(len(calls), 1)
            finally:
                release.set()
                await first
                if second:
                    await second
                await worker.close()
        self.assertEqual(len(calls), 2)


if __name__ == '__main__':
    unittest.main()
