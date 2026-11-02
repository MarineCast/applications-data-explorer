"""Persistent localhost API for validated map layers and Relationships."""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import json
import logging
import os
from pathlib import Path

from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from starlette.middleware.gzip import GZipMiddleware

from local_data import Reader, Sources
from relationships import Relationships
from relationships_api import create_app as relationships_app

ROOT = Path(__file__).resolve().parent.parent
DOMAINS = {'seascape', 'meteorology', 'orca', 'hydrology', 'river-influence', 'viewshed'}
HEADERS = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
LOGGER = logging.getLogger('marinecast.layers')


class Worker:
    """One serial reader per domain; unrelated domains can load concurrently."""

    def __init__(self, sources, domain):
        self.sources, self.domain = sources, domain
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='layers-' + domain)
        self.lock = asyncio.Lock()
        self.pending = 0
        self.reader = None
        self.catalog = None

    async def run(self, function):
        # Browser cancellation must not cancel a running source validation.
        future = asyncio.get_running_loop().run_in_executor(self.executor, function)
        future.add_done_callback(lambda done: done.exception() if not done.cancelled() else None)
        return await asyncio.shield(future)

    def response(self, parameters, method):
        if self.reader is None:
            self.reader = Reader(self.sources)
        path = parameters.get('path', '')
        catalog = path == f'/local-data/{self.domain}/catalog.json'
        if catalog:
            domains = ('seascape', 'governance', 'human', 'oceanography') if self.domain == 'seascape' else (self.domain,)
            versions = tuple(self.sources.version(domain) for domain in domains)
            if self.catalog and self.catalog[0] == versions:
                body = self.catalog[1]
                return Response(body if method != 'HEAD' else b'', media_type='application/json',
                                headers=HEADERS | {'Content-Length': str(len(body))})
            self.catalog = None  # Changed sources must never revive cached bytes.
        result = self.reader.request(parameters)
        if 'file' in result:
            # LayerResponse holds the lock through transmission, so a new
            # generation cannot remove a file while it is being streamed.
            return FileResponse(result['file'], media_type='application/json', headers=HEADERS)
        value = result['json'] if 'json' in result else result
        body = json.dumps(value, allow_nan=False, separators=(',', ':')).encode()
        if catalog:
            if versions != tuple(self.sources.version(domain) for domain in domains):
                raise ValueError('Source changed during catalog read')
            # Retry partial catalogs even if a transient read failure left the
            # source stat tokens unchanged.
            if not value.get('unavailableProducts'):
                self.catalog = versions, body
        return Response(body if method != 'HEAD' else b'', media_type='application/json',
                        headers=HEADERS | {'Content-Length': str(len(body))})

    async def close(self):
        # Finish shielded jobs before removing reader-owned encodings.
        await asyncio.to_thread(self.executor.shutdown, wait=True, cancel_futures=True)
        if self.reader:
            self.reader.close()


class LayerResponse(Response):
    """Keep a generation alive until ASGI finishes sending its response."""

    def __init__(self, worker, parameters):
        super().__init__()
        self.worker, self.parameters = worker, parameters

    async def __call__(self, scope, receive, send):
        worker = self.worker
        if worker.pending >= 32:
            return await JSONResponse({'error': 'Local layer reader is busy. Retry shortly.'}, 429,
                                      headers=HEADERS)(scope, receive, send)
        worker.pending += 1
        try:
            async with worker.lock:
                try:
                    response = await worker.run(lambda: worker.response(self.parameters, scope['method']))
                except Exception:
                    LOGGER.exception('Current layer source could not be validated')
                    response = JSONResponse({'error': 'The current layer source could not be validated. '
                                             'Check the local API terminal and retry.'}, 503, headers=HEADERS)
                await response(scope, receive, send)
        finally:
            worker.pending -= 1


class Layers:
    def __init__(self, sources):
        self.sources = sources
        self.workers = {}
        self.watcher = Worker(sources, 'watch')
        self.condition = asyncio.Condition()
        self.latest = ''
        self.subscribers = 0
        self.task = None

    def worker(self, domain):
        if domain not in self.workers:
            self.workers[domain] = Worker(self.sources, domain)
        return self.workers[domain]

    async def poll(self):
        while True:
            if self.subscribers:
                try:
                    versions = await self.watcher.run(self.sources.versions)
                    current = json.dumps(versions, separators=(',', ':'))
                    async with self.condition:
                        if current != self.latest:
                            self.latest = current
                            self.condition.notify_all()
                except Exception:
                    LOGGER.exception('Layer source watch failed; retrying')
            await asyncio.sleep(2)

    async def events(self):
        self.subscribers += 1
        if self.task is None:
            self.task = asyncio.create_task(self.poll())
        previous = ''
        try:
            yield 'retry: 2000\n\n'
            while True:
                async with self.condition:
                    try:
                        await asyncio.wait_for(self.condition.wait_for(lambda: self.latest != previous), 15)
                    except TimeoutError:
                        pass
                    current = self.latest
                if current != previous:
                    previous = current
                    yield f'event: sources\ndata: {current}\n\n'
                else:
                    yield ': keepalive\n\n'
        finally:
            self.subscribers -= 1

    async def close(self):
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        await asyncio.gather(self.watcher.close(), *(worker.close() for worker in self.workers.values()))


def configured_sources():
    return Sources(os.environ.get('MARINECAST_DATA_ROOT', ROOT/'../../Data'), ROOT/'public/local-data',
                   ROOT/'../../config/study.v1.json', os.environ.get('METEOROLOGY_SOURCE'),
                   os.environ.get('VIEWSHED_PILOT'), os.environ.get('VIEWSHED_COMPONENTS'))


def create_app(sources=None, service=None):
    sources = sources or configured_sources()
    layers = Layers(sources)
    app = relationships_app(service if service is not None else
                            Relationships(sources.data, sources.public, sources.study))
    original_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app):
        async with original_lifespan(app):
            try:
                yield
            finally:
                await layers.close()

    app.router.lifespan_context = lifespan
    app.title = 'MarineCast local Data Explorer'
    app.state.layers = layers
    # Starlette excludes text/event-stream, so notifications stay immediate.
    app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=1)

    @app.get('/api/local-data/health')
    def health():
        return {'status': 'ready', 'service': 'marinecast-data-explorer', 'version': 1}

    @app.get('/api/local-data/events')
    async def events():
        return StreamingResponse(layers.events(), media_type='text/event-stream',
                                 headers=HEADERS | {'X-Accel-Buffering': 'no'})

    @app.api_route('/local-data/{domain}/{asset:path}', methods=['GET', 'HEAD'])
    async def asset(domain: str, asset: str):
        if domain not in DOMAINS or any(part in {'.', '..', ''} for part in asset.split('/')):
            return JSONResponse({'error': 'Unsupported read-only layer request.'}, 400)
        return LayerResponse(layers.worker(domain), {'path': f'/local-data/{domain}/{asset}'})

    @app.api_route('/api/meteorology', methods=['GET', 'HEAD'])
    async def meteorology(request: Request):
        parameters = dict(request.query_params)
        if parameters.get('operation') not in {'daily', 'hourly'} or set(parameters) - {
            'operation', 'snapshot', 'metric', 'date', 'cell', 'period'
        } or any(len(value) > 500 for value in parameters.values()):
            return JSONResponse({'error': 'Unsupported weather query.'}, 400)
        return LayerResponse(layers.worker('meteorology'), parameters)

    return app


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(create_app(), host='127.0.0.1',
                port=int(os.environ.get('MARINECAST_API_PORT', os.environ.get('MARINECAST_RELATIONSHIPS_PORT', '8001'))))
