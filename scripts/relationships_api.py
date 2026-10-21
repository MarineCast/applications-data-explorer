"""Local FastAPI boundary. Start from the app root: python scripts/relationships_api.py."""
from __future__ import annotations
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import date
import os
from pathlib import Path
import threading
import logging
import time
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator
from starlette.middleware.trustedhost import TrustedHostMiddleware

from relationships import AnalysisError, Budget, Relationships

ROOT=Path(__file__).resolve().parent.parent


class AnalysisQuery(BaseModel):
    model_config=ConfigDict(extra='forbid')
    variables:list[str]=Field(min_length=1,max_length=12)
    mode:Literal['features','response']='features'
    resolution:Literal[5,6,7,8]=6
    method:Literal['spearman','pearson']='spearman'
    cohort:Literal['pairwise','complete']='pairwise'
    plot:Literal['auto','scatter','density','box','strip','contingency']='auto'
    x:str|None=Field(default=None,max_length=500)
    y:str|None=Field(default=None,max_length=500)
    start:str|None=None
    end:str|None=None
    slice:str|None=Field(default=None,max_length=30)
    includeQuality:bool=False
    membershipEncoding:Literal['none','exact_set']='none'
    threshold:float=Field(default=.8,ge=0,le=1)
    categories:list[Literal['srkw','transient','other']]=Field(default=['srkw'],min_length=1,max_length=3)
    interval:Literal['daily','weekly','monthly','yearly','all_time']='monthly'
    precision:Literal['strict','reported']='strict'
    bindings:dict[str,str]|None=None

    @model_validator(mode='after')
    def validate_dates(self):
        if len(set(self.variables))!=len(self.variables) or any(len(k)>500 for k in self.variables):
            raise ValueError('Select unique catalog variable keys.')
        for value in [self.start,self.end]:
            if value:date.fromisoformat(value)
        if bool(self.start)!=bool(self.end):raise ValueError('Supply both start and end.')
        if self.start and self.start>self.end:raise ValueError('Start must be on or before end.')
        return self


def create_app(service=None):
    executor=ThreadPoolExecutor(max_workers=2,thread_name_prefix='relationships')
    slots=threading.BoundedSemaphore(2)
    @asynccontextmanager
    async def lifespan(app):
        yield
        executor.shutdown(wait=True,cancel_futures=True)
        app.state.service.close()
    app=FastAPI(title='MarineCast local relationships',version='1',lifespan=lifespan)
    app.state.service=service or Relationships(os.environ.get('MARINECAST_DATA_ROOT',ROOT/'../../Data'),ROOT/'public/local-data',ROOT/'../../config/study.v1.json')
    app.add_middleware(TrustedHostMiddleware,allowed_hosts=['127.0.0.1','localhost','testserver'])

    @app.middleware('http')
    async def local_only(request,call_next):
        origin=request.headers.get('origin','')
        if origin:
            from urllib.parse import urlparse
            if urlparse(origin).hostname not in {'127.0.0.1','localhost'}:
                return JSONResponse({'detail':'Only local browser origins are accepted.'},status_code=403)
        if request.method=='POST':
            try:length=int(request.headers.get('content-length','0'))
            except ValueError:length=999999
            if length>65536 or length<1:return JSONResponse({'detail':'Request body must be 1–65536 bytes.'},status_code=413)
        response=await call_next(request)
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        return response

    async def run(request, function, *args, analysis=False):
        if not slots.acquire(blocking=False):raise HTTPException(429,'Two local queries are already running. Retry shortly.')
        cancelled=threading.Event()
        def work():
            try:return function(*args,Budget(cancelled)) if analysis else function(*args)
            finally:slots.release()
        future=asyncio.get_running_loop().run_in_executor(executor,work)
        started=time.monotonic()
        def drain_cancelled(done):
            if cancelled.is_set() and not done.cancelled():done.exception()
        future.add_done_callback(drain_cancelled)
        try:
            while not future.done():
                if time.monotonic()-started>90:
                    cancelled.set();raise HTTPException(503,'Source validation exceeded 90 seconds. Narrow the selection or retry.')
                if await request.is_disconnected():
                    cancelled.set();raise HTTPException(499,'Request cancelled.')
                await asyncio.wait([future],timeout=.1)
            return future.result()
        except AnalysisError as e:raise HTTPException(e.status,str(e)) from e
        except (OSError,ValueError,KeyError,TypeError) as e:
            logging.getLogger('relationships').exception('Current source validation failed')
            # Do not expose local filesystem paths, raw records or stack traces.
            raise HTTPException(503,'The current source could not be validated. Check the local backend terminal, then refresh the catalog.') from e
        except asyncio.CancelledError:
            cancelled.set();raise

    @app.get('/api/relationships/health')
    def health():return {'status':'ready','service':'localhost read-only relationships','version':1}

    @app.get('/api/relationships/catalog')
    async def catalog(request:Request,domain:str=Query('seascape',max_length=40),resolution:int=Query(6,ge=5,le=8),search:str=Query('',max_length=120),family:str=Query('',max_length=120),quality:bool=False,cursor:int=Query(0,ge=0,le=10000),limit:int=Query(100,ge=1,le=100)):
        return await run(request,app.state.service.catalog,domain,resolution,search,family,quality,cursor,limit)

    @app.post('/api/relationships/plan')
    async def plan(request:Request,query:AnalysisQuery):
        return await run(request,app.state.service.plan,query.model_dump())

    @app.post('/api/relationships/analyze')
    async def analyze(request:Request,query:AnalysisQuery):
        return await run(request,app.state.service.analyze,query.model_dump(),analysis=True)
    return app


if __name__=='__main__':
    import uvicorn
    uvicorn.run(create_app(),host='127.0.0.1',port=int(os.environ.get('MARINECAST_RELATIONSHIPS_PORT','8001')),log_level='info')
