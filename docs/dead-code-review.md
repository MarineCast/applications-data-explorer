# Dead code investigation — 2026-11-01

**Completed after user approval.** The investigation below is the pre-cleanup
snapshot. See [completed cleanup](#completed-cleanup--2026-11-01) for implementation,
test migration and current validation; its proposal hashes intentionally describe
the earlier files.

The remaining cleanup is concentrated inside reachable modules: **16 obsolete
declarations**, **184 candidate CSS rules**, and **two rendering paths bypassed
by the current app**. There is no confirmed unused package dependency or whole
Python adapter to remove. No implementation, test, asset or cache was removed
during this review.

The [review manifest](qa/dead-code-review-2026-11-01.json) lists exact declarations,
CSS selectors, conditional file removals, logical byte counts and source hashes.
It is a proposal, not an executed cleanup or authorization to delete files.

## Scope and method

Reviewed the current working tree at base commit
`b570ace8b05068482ed81868245c634fc1574278`, including its existing uncommitted
changes. The initial checkout had 52 modified, 199 deleted and 41 untracked paths.
Those earlier deletions are excluded from the new candidates.

Traced `index.html` → `src/main.tsx` → `App.tsx`, every current hash route,
dynamic imports, the surface worker, CSS imports, public asset URLs, Vite
configuration and npm scripts. TypeScript compiler symbol references separated
external consumers from functions called inside their own module. Python AST
imports, including imports inside functions, were followed from `data_api.py`.
Tests, documented optional commands, prior cleanup retention decisions and
source-backed fallback caches were checked separately. This was a local code
review; no new package or remote code-analysis service was used.

An import-level graph alone finds no orphan production TypeScript module to
delete. It misses unreachable component branches and unused declarations inside
otherwise active modules. Conversely, an export with no external consumers can
still be required internally; the raw export scan is not a deletion list.

## 1. Remove obsolete declarations from active modules

These 16 declarations total **5,758 bytes** before import/test adjustments.
They have no current app consumer outside the obsolete groups described here.

| File | Declarations | Required companion work |
| --- | --- | --- |
| `src/components/Controls.tsx:3` | `FeatureSelect`, `RegionSelect`, `SeasonSelect` | Remove their demo imports. Keep `Stat` and `Empty`, which Health uses. |
| `src/data/demo.ts:69` | `seasonMonths`, `formatValue`, `filterCells`, `summarize`, `pairedValues`, `correlation`, `histogram`, `sightings` | Update `demo.test.ts`; replace `map.test.ts`'s `filterCells` assertion with the fixture's explicit region selection. Preserve native geometry/missingness assertions. `seasonMonths` and `filterCells` also serve the obsolete `pairedValues` chain. |
| `src/data/northernSky.ts:5` | `skyStars`, `skyGroups`, `northernSky`, `sunAltitude` | Remove the two tests exclusively for the retired Dipper/daylight display. Keep coordinate/precession tests and the active transforms. |
| `src/data/governancePatterns.ts:82` | `stripeBackground` | No caller or test. Keep `stripeImage` and the current membership-pattern machinery. |

Do not remove `demo.ts` or `northernSky.ts` wholesale. Health still uses
`products`/`months`; the map adapters and tests still use synthetic H3 support.
Home's current night animation uses `createScenicStars` → `scenicStarPositions`
→ `precess`/`horizontal`, along with the HYG JSON catalog and its license.
`julianDate`, `siderealDegrees` and `skyLocation` support those live transforms.

The production bundle still contains the unused `DEMO-` sighting generator.
Source cleanup can therefore remove some shipped work as well as maintenance
surface. The declaration-byte count is not a prediction of bundle savings.

## 2. Remove CSS for retired interfaces after visual verification

The manifest identifies **184 whole candidate rules / 15,035 bytes**:
164 rules in `src/styles.css` and 20 in `src/atlas.css`. Each selector alternative
in these rules requires a reviewed obsolete class absent from production TS/TSX.
Examples include `.explorer-sheet`, `.sheet-content`, `.cell-metrics`,
`.detail-tabs`, `.spark-chart`, `.nearby-list`, `.sheet-timeline`, `.month-ticks`,
`.monthly-chip`, `.menu-button`, `.demo-status` and `.nav-backdrop`.

This set includes responsive and theme overrides for the removed interfaces.
It does not include mixed rules with an active selector alternative. It is a
conservative subset of the initial textual scan; library-generated
`maplibregl-*` classes and dynamically assembled Home classes were excluded.

Before removal, check Home in both themes, Health, Features, comparison,
Viewshed, Relationships and narrow layouts. No browser or visual regression
check was performed in this investigation, so the CSS remains a candidate set.

## 3. Retire the standalone Viewshed renderer and migrate its tests

The only production `<ViewshedLayer>` call is in
`src/pages/SeascapeMapPage.tsx:781`. It always supplies
`integration.onMapChange: setViewshedOverlay`. `PilotLayer` therefore always has
`hosted === true`; its `!hosted && <ViewshedMap>` branch cannot render through
the app. Legacy `#viewshed` also redirects to this same integrated Features path.

The following files become removable after narrowing that interface and removing
the standalone branches in `ViewshedLayer.tsx`:

| Exact path | Logical bytes |
| --- | ---: |
| `src/components/ViewshedMap.tsx` | 1,018 |
| `src/components/ViewshedBasemap.tsx` | 7,915 |
| `src/components/ViewshedLocalMap.tsx` | 7,652 |
| `src/components/ViewshedZoomControls.tsx` | 668 |
| `src/components/ViewshedBasemap.test.tsx` | 11,913 |
| **Total** | **29,166** |

Most `ViewshedLayer.test.tsx` cases currently mount the standalone form and mock
`ViewshedMap` with `ViewshedLocalMap`. Migrate still-relevant cell selection,
score, reverse-source, legend, missingness, coordinate and Insights assertions
to the hosted callback/production map before removing these helpers or tests.
Keep the current overlay code, shared Features basemap, MapLibre worker setup,
native clipped geometry and `MapTilerCanvas` regression coverage.

The build currently emits a **4.56 kB minified standalone ViewshedBasemap
chunk**, and the main bundle retains the old local-coastline fallback message.
The branch is shipped even though the current app cannot reach it.

## 4. Larger follow-up: retire the synthetic local map implementation

Both production `<MapCanvas>` calls (`SeascapeMapPage.tsx:656` and `:695`) supply
`nativeData` and `basemap="maptiler"`. The wrapper either mounts MapTiler or
shows its loading/configuration/retry state. It never reaches `LocalMapCanvas`.

`src/components/MapCanvas.tsx` still contains the illustrative SVG coastline,
local camera/geometry implementation, synthetic values and a synthetic `markers`
loop. No caller supplies `MapCanvasProps.markers`. This is an additional
app-unreachable implementation, beyond the standalone Viewshed renderer.

It was deliberately retained for component/test use during the October cleanup.
Its removal now requires migrating useful local-renderer tests to native layer
fixtures and the current renderer, then simplifying the map props and synthetic
fallbacks in `map.ts`/`MapTilerCanvas.tsx`. Keep the production wrapper and its
loading, missing-key and retry behavior. This larger change is **not included**
in the 16-declaration or five-file removal totals.

## Retain or decide separately

- **Dependencies:** all six runtime dependencies have current consumers.
  `three` powers Home's current background; its typings remain needed. Development
  dependencies support the configured compiler, lint or test toolchain.
- **Python:** all 26 non-test modules other than
  `check_relationships_local.py` are reachable from the current API. The latter
  is an explicit manual integration/evidence tool. `prepare_map.py`,
  `prepare_seascape.py` and `prepare_viewshed.py` supply runtime helpers even
  where their historical export CLIs are optional. Do not delete whole files.
- **Old stdin bridge:** `local_data.py:393` still exposes a JSON-lines CLI that
  the current launcher no longer invokes. Its `Reader`/`Sources` are active.
  Removing only this superseded entry point is a compatibility decision outside
  the confirmed batch; `sys` must remain for reader diagnostic redirection.
- **Prepared caches:** the current tree contains 1,628 Seascape files /
  559,094,314 bytes, 165 Viewshed files / 30,820,016 bytes, and one Meteorology
  file / 1,711,955 bytes. These are ignored local inputs/startup encodings, not
  tracked dead source. Viewshed can still depend on its retained pilot fallback.
  No cache-reference/checksum or empty-cache validation was rerun here; these
  directories are not approved removal candidates.
- **Artwork:** both current PNGs are used. The 218,622-byte
  `salish-sea-static.webp` is explicitly retained as the rollback original in
  `public/assets/home/ARTWORK.md`; removing it needs a retention decision.
- **QA/provenance:** historical screenshots, notes, attribution, manifests and
  integration recipes are not app-runtime dependencies, but that alone does not
  make them disposable. Preserve them unless a specific evidence-retention
  cleanup is approved. `node_modules`, `.git`, environments and secrets are also
  outside this proposal.
- **Documentation conflicts:** README's Structure section still says there is
  no FastAPI service, and its older offline-export section says builds include
  the cache. Current `data_api.py`, Vite config and `localAssets()` establish the
  opposite. Correct these obsolete statements with the cleanup; they must not
  justify deleting the backend or cache-exclusion plugin.

## Current validation and implementation gate

Baseline checks on **2026-11-01** passed:

- `npm run typecheck` and `npm run lint`.
- `npm test -- --reporter=dot`: **92 files / 534 tests**.
- Configured scientific Python:
  `python -m unittest discover -s scripts -p 'test_*.py'`: **172 tests**.
- `npm run build`; `dist/local-data` is absent. Vite still reports chunks above
  500 kB. The build reused the existing ignored `dist` directory.

Additional pytest discovery includes function-style tests that unittest does
not collect: **184 passed, 60 subtests passed, one failed**. It exposes an existing failure in
`scripts/test_biogenic_input.py:8`: the family-normalization test constructs one
field for every entry in the current seven-entry `NAMES` mapping, then asserts
there are four. Treat this as a baseline test/contract reconciliation item,
not a reason to remove the test or current named fields. The investigation made
no implementation/test changes.

Node was 25.6.1, TypeScript 5.9.3, Vite 7.2.2 and Vitest 4.0.14. Python tests used
the app-configured `orcacast314` environment; the shell's default Python lacks
the required geospatial/API dependencies. Tests use temporary fixture outputs;
no provider acquisition, source-product mutation or regional processing was run.

These are **pre-cleanup** results. They do not validate a future removal patch,
live current-data rendering, scientific completeness, browser behavior or
provider freshness. No dedicated docs build is configured. Before implementation,
recheck manifest hashes against concurrent work, migrate relevant coverage,
obtain specific approval for permanent file deletion, and rerun owner checks
plus the affected browser paths. The existing [cleanup record](cleanup.md)
remains historical and is not new validation.

## Completed cleanup — 2026-11-01

Implemented after the user's explicit approval to migrate relevant tests, remove
the unused renderers and preserve existing work/data. All reviewed source hashes
matched before edits. The [completion manifest](qa/dead-code-cleanup-2026-11-01.json)
records task-specific changes against the saved working tree, checksums, checks,
retained inputs and staging locations. Existing unrelated edits/deletions remain.

### Implemented scope

- Removed the 16 reviewed declarations and **199 CSS rules**: the original 184
  plus 15 exclusively belonging to the tool drawer whose final caller was removed.
- Removed the five listed standalone Viewshed files, plus the now-unreferenced
  `src/components/MapToolDrawer.tsx`: **six files / 32,130 logical bytes**.
- Removed the embedded illustrative `LocalMapCanvas`. `MapCanvas` retains the
  geographic loader, missing-key warning and retry behavior. Removed synthetic
  `feature`/`month`/`region`, renderer-selection and marker props from its interface.
  An absent layer yields an empty GeoJSON collection, never generated values.
- Narrowed Viewshed to the current hosted interface with a required overlay
  callback. Its roles, original weights, support, uncertainty and shared geographic
  camera remain in the active adapters/renderer. Removed the standalone style
  setting and its example environment entry.
- Moved deterministic synthetic H3/value samples into `src/test/demoFixture.ts`;
  Health's synthetic metadata remains in `src/data/demo.ts`. Shared native-cell
  types now belong to `src/data/map.ts`.
- Corrected the stale Biogenic Habitats test to assert that normalization preserves
  every supplied field. The seven current names and their scientific contracts
  were unchanged. Updated README's obsolete backend/cache/renderer statements and
  marked the old standalone Viewshed QA as historical.

Source, CSS and test files are **96,680 bytes smaller net**, including the new
test fixtures. This is a logical working-tree comparison, not Git-history size or
physical disk recovery. No package dependency, artwork, source product, browser
cache, source CLI or scientific adapter was removed. The old stdin bridge remains
outside this compatibility-preserving cleanup.

### Test migration

Migration checks passed before removing either renderer: 78 page/host/production
renderer tests; 19 production-renderer/Viewshed geometry tests; and 28 map,
adapter and retained fixture tests. Intermediate failures were corrected before
the final runs below.

| Coverage | Current home |
| --- | --- |
| Page selection, comparison, warnings and loading state | `SeascapeMapPage.test.tsx`, using a small `MapInteractionDriver` that invokes native-layer callbacks without drawing geography |
| Shared camera persistence, native picking, exact zero/null values, overlay lifetime and keyboard crosshair | Real `MapTilerCanvas` tests with the MapLibre boundary mocked |
| Viewshed role changes, stale reads, retries, Insights, legend settings, coordinates and overlay teardown | 21 tests using the required production host callback in `ViewshedLayer.test.tsx` |
| Clipped source/target identity, nulls and observer samples | `viewshedMap.test.ts`, plus production renderer tests |
| Geographic loader, empty pending layer, missing key and retry | `MapCanvas.test.tsx` |

The frontend count changes from 534 to **521**: the retired basemap's nine tests,
four consolidated Viewshed cases, one obsolete demo-statistics case and two
retired sky-display cases are replaced by three additional active renderer/geometry
tests. The map-wrapper tests retain their count. Synthetic H3 missingness and the
three live astronomy-transform checks remain. No geographic renderer was copied
into test fixtures.

### Final validation

- TypeScript/build, ESLint and `git diff --check` passed.
- **91 frontend files / 521 tests** passed.
- Configured scientific Python pytest: **185 tests and 60 subtests passed**.
  The existing Starlette/httpx deprecation warning remains.
- Production build passed. No `ViewshedBasemap` chunk, `DEMO-` generator or
  illustrative-coastline fallback signature remains in emitted JavaScript.
  `dist/local-data` is absent. The existing Vite large-chunk advisory remains.
- Browser: the built app renders native R6 bathymetry and Insights, linked
  comparison with an operable divider, and the integrated Viewshed weight map.
  Home themes, narrow Home/Health/Viewshed layouts, and Health error/retry were
  inspected. Relationships calculated a native R6 density plot with **2,365
  complete pairs**. No new browser errors were recorded after a fresh reload;
  transient development HMR messages during file retirement are not final-build
  failures. Viewport overrides were reset.
- Preserved **1,795 prepared files / 591,632,433 logical bytes** with matching
  paths, sizes, modification times and inodes. Scientific adapter and artwork
  hashes match the saved baseline. No full delivery-data scan was run.
- Changed documentation links/properties and JSON evidence were checked. There
  is no dedicated docs build configured. Task-started API/frontend/preview
  processes were stopped; API shutdown completed its owned reader cleanup.

Retained small screenshots: [Features](qa/dead-code-cleanup/features.png),
[Viewshed](qa/dead-code-cleanup/viewshed.png),
[Relationships](qa/dead-code-cleanup/relationships.png).

The live app still reports the pre-existing missing Human dependency
`Toolkits/toolkit-human/data/delivery/presence-20261025/catalog.json`. It was
observed before CSS removal and remains unavailable; no source contract was
relaxed and no missing values were replaced. Browser checks are scoped software
acceptance, not exhaustive native mouse-picking, regional processing, scientific
accuracy, provider freshness or complete data coverage. Nothing was committed,
published or deployed. Small task-owned rollback backups/logs remain under the
staging path listed in the completion manifest; no bulk dataset was copied there.
