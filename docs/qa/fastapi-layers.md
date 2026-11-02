# FastAPI layer service — 2026-10-25

## Implementation

`scripts/data_api.py` serves Features layers and the existing Relationships API
from one read-only localhost FastAPI application. `npm run dev` starts that API
and Vite, or reuses a matching running API. `npm run backend` plus
`npm run dev:frontend` keeps validated layers warm across frontend restarts.
Both launchers load server-only `.env.local` settings. The default listener is
`127.0.0.1:8001`; `MARINECAST_API_PORT` sets both listener and Vite proxy, with
`MARINECAST_RELATIONSHIPS_PORT` as a fallback.

| Route | Behavior |
| --- | --- |
| `/local-data/{domain}/catalog.json` and catalog-bound assets | Existing exact-value readers and native support; GET/HEAD |
| `/api/meteorology` | Existing bounded daily/hourly Parquet queries; GET/HEAD |
| `/api/local-data/events` | Shared two-second source watch with SSE reconnect and keepalive |
| `/api/local-data/health` | Immediate service identity/readiness; no product validation implied |
| `/api/relationships/*` | Existing catalog, planning and exploratory analysis contracts |

Vite dev and built preview proxy those URLs. `localDataPlugin.ts` now only copies
public artwork during builds, excluding `public/local-data`; it launches no
Python readers. A built app still needs the local API running.

Each layer domain owns one persistent serial reader and executor. Different
domains run independently; up to 32 requests may wait for one domain. A response
holds its domain lock through file transmission, so current/previous generation
cleanup cannot remove a file being served. Shutdown waits for source reads before
closing their temporary encodings. Relationships retains its own query budget.

Complete catalogs cache serialized bytes while all contributing source versions
match. Partial catalogs are retried. Changed/invalid products invalidate the
cache; a failed read never returns the old catalog as current. JSON responses use
gzip where requested, while SSE remains unbuffered. File bytes and checksums stay
unchanged after browser decompression. Client URLs, schemas and scientific
quantities are unchanged.

`Sources` also caches up to 256 Parquet metadata inspections, keyed by resolved
path, inode, size, nanosecond mtime and ctime. Every source-version read still
checks delivered files and external audit/receipt paths. A replaced footer is
reinspected; changed/missing external evidence changes the source version even
when the footer is reused. Checksum validation and exact-value readback still run
when a domain changes. Python/JSON adapter edits require a backend restart.

## Software verification

- Typecheck and ESLint passed; all 510 frontend tests in 86 files passed.
- All 128 Python reader/adapter/analysis/HTTP tests passed in the isolated QA
  environment. All nine new HTTP/concurrency tests also passed in the app's
  configured scientific Python environment.
- New coverage includes byte-exact assets, zero/null values, HEAD, source
  replacement, invalid-source rejection/recovery, serialized catalog reuse,
  partial-catalog retries, concurrent requests sharing one validation, independent
  weather loading, file-generation lifetime, SSE updates, local origin/host rules,
  queue limits, footer replacement and external audit disappearance.
- Production build passed; `dist/local-data` is absent. Vite retains its existing
  advisory about JavaScript chunks larger than 500 kB.
- Launcher reuse passed: an already-running API remains alive when a second
  frontend fails because its requested port is occupied.

## Runtime evidence

The source-backed combined catalog contained 225 features with no unavailable
component products. Its 8.98 MB response loaded in a median **17.4 ms** through
FastAPI versus **233.1 ms** through the previous Vite bridge: **13.4 times faster**
for repeat catalog requests (seven requests per service, localhost, identity
encoding). Both used the current metadata-caching reader; this comparison isolates
the HTTP/catalog serialization path rather than including the footer-cache gain.
The baseline plugin came from the repository's base revision, ran in a separate
Vite root/cache, and read the same canonical Data products. The new service used
the configured scientific Python; the baseline used the isolated QA interpreter,
so this is a local observation, not a controlled cross-machine benchmark.

Feature IDs, columns, units and availability matched between the two catalogs.
The sampled native Seascape `depth_std_ring_2_m` asset was byte-identical:
`ff7ed264242ee11dc646115f1f1583878d5e8e554dc64ddc6cfea5ef7a649332`
(1,433,495 bytes). Sampled asset transfer itself was approximately 12–13 ms in
both paths; the measured improvement applies to repeated catalog loading.

The fresh API catalog request waited **166.9 seconds** for current validation and
encoding. Cold timings are affected by product generation and other work; no
universal cold-start speedup is claimed. The first load still validates/encodes
current products; keeping the backend running avoids repeating this work after
frontend restarts.

Built preview returned current Seascape, Hydrology, river-influence, Orca,
Meteorology and qualified retained Viewshed catalogs through FastAPI. SSE reported
all eight source domains. A daily weather query returned the exact 463 native
R5 cell identities and 463 values for its catalog snapshot. A sampled preview
asset matched its catalog checksum. Browser checks rendered a native R6 mapped
layer over the configured basemap in both production preview and a fresh Vite
development server. No new validation of the retained Viewshed research pilot or
regional producer/scientific workflows is implied.

The temporary baseline initially shared Vite's optimization directory with the
development server and disrupted its module cache. It was moved to a separate
root/cache before the final comparison; a fresh frontend and production preview
were verified afterward. This was limited to temporary QA server configuration. No source acquisition,
scientific recomputation, Data publication or deployment is part of this change.

QA runtime: Node 25.6.1, FastAPI 0.150.0, PyArrow 24.0.0 in the isolated test
runtime; the app's configured Python is the existing `orcacast314` environment.
The common requirements now require the tested FastAPI 0.150 series.
FastAPI 0.150.0, annotated-doc 0.0.5 and opentelemetry-api 1.45.1 were added there;
no previously installed packages were replaced. Source base revision is
`b570ace8b05068482ed81868245c634fc1574278`, with the user's existing local changes
preserved. Small test logs, staging manifest and benchmark scripts/results are
retained at `/tmp/marinecast-fastapi-layers/`; scientific encodings remain
process-owned temporary files and are closed by their owning services.
All task QA servers were stopped after verification; no reader encoding
directories remained in either task cache root. Retained small evidence totals
approximately 3.9 MiB. No repository documentation build is configured; affected
local links, vault properties, whitespace and `git diff --check` passed.

References: [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/)
and [file/stream responses](https://fastapi.tiangolo.com/advanced/custom-response/).
