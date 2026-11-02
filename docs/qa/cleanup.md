# Approved unused-file cleanup — 2026-10-24

Implemented the user-approved audit proposal: 160 files, 110,530,009 logical bytes.
The [manifest](cleanup-manifest.json) records exact paths, sizes, pre-removal
SHA-256 hashes, the starting revision, environment and retained-file checksums.
Git history remains the recovery source for removed tracked files.

Removed retired Blender authoring files/generators, Field Atlas and Ocean Home
renderers with their exclusive tests and public assets, unused sidebar/chart/grid/
live-sky implementations, duplicate Models/Forecasts components, the superseded
meteorology Vite plugin, and unused historical images/font/license. Removed 13 CSS
rules exclusive to the retired sidebar. npm removed React Three Fiber and Pixi,
pruning 22 packages without changing retained package versions.

Three.js, current day/night images, shared sky calculations, the HYG catalog and
its license remain required. The original static WebP, demo-map test coverage,
prepared local-data caches, historical QA/screenshots and design notes are retained.
The notebook deletion already present before this task remains untouched.
No producer code, scientific contracts or delivered Data products changed.

## Validation

- Type checking and ESLint passed.
- Frontend: 86 files, 492 tests passed. The 31 removed tests belonged to retired
  implementations; the demo map tests remain.
- Python: 115 tests and 30 subtests passed. The base scientific environment lacked
  FastAPI, so validation used a temporary environment inheriting its scientific
  packages, with FastAPI 0.150.0 inside the documented version range.
- Production build passed: 8,271,788 logical bytes. Removed public assets and
  `dist/local-data` are absent. Current artwork hashes match the audit originals.
- Compact browser smoke checks: Home day/night artwork renders; Features shell,
  basemap and error/retry presentation mount; Relationships and synthetic Health
  mount; Models/Forecasts still use ComingSoonPage; legacy sightings and viewshed
  URLs redirect to Features with the correct layer selection.
- `npm ls --depth=0`, lockfile version comparison, exact deletion-set verification
  and `git diff --check` passed.

Full live-data interaction remains unverified: the unchanged reader rejects the
current Seascape delivery with **Unexpected files in flat Seascape output**.
Features displays the source warning. This task does not alter that delivery or
claim source-backed analytical success. No regional processing or provider
acquisition was performed. Desktop visual QA was not repeated.

Non-failing warnings: existing large Vite chunks, Node's localstorage-file warning
in Vitest, and FastAPI/Starlette's TestClient httpx deprecation. No dedicated docs
build is configured; changed links and vault properties receive scoped checks.

The existing README link to `notebooks/meteorology-readiness.ipynb` remains missing
because that notebook was already deleted before this task; neither it nor its
reference was changed under the deferred scope. All new/changed local links and
the affected Knowledge note properties passed scoped validation. Task-started
preview/API servers were stopped after inspection.

Follow-up on 2026-10-24: the live Seascape blockage recorded above is resolved by
the [review-note reader fix](seascape-reader.md). Features and Relationships now
have current-data validation evidence; the cleanup checks above remain the
historical scope of that earlier run.
