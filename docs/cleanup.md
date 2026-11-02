# Deferred cleanup and demo-test migration — 2026-10-24

Implemented the approved unreferenced-only proposal. The exact paths, sizes,
pre-deletion checks, retained tree fingerprints and outcomes are in the workspace
[completion manifest](../../../Reports/deferred-cleanup-review-2026-10-24/completion.json).

## Removal scope

Removed 12 unreferenced Seascape cache generations (1,972,693,817 bytes), three
old Hydrology payloads (19,310,884 bytes), two old river-influence payloads
(11,024,348 bytes), one old Viewshed generation (19,659,199 bytes), and 37
historical coastal-scene screenshots (6,929,641 bytes). After test migration,
removed `src/pages/DemoMapPage.tsx` (20,551 bytes). Total removed logical file
size: **2,029,638,440 bytes**. This is not a claim about physical disk allocation
or Git-history size.

The four current root catalog hashes and all asset references were checked
immediately before deletion. No local Vite or reader process was active. The
approved paths still had their reviewed file counts and sizes; none contained
symlinks. Referenced assets were excluded from every deletion target.

All three catalog-referenced Seascape generations remain, even though only one
is named by the main fingerprint. The active Viewshed generation and catalog
remain the retained research-pilot fallback. Meteorology, Orca, the current
Hydrology/influence payloads, and all other surviving prepared files remain.
No conditional whole-cache cleanup was performed. Delivered Data products were
not changed. Retained cache and current QA tree checksums matched before and
after deletion. Historical screenshot references in `design-qa.md` are explicitly
marked retired; current QA notes, screenshots, recipes and manifests were left
byte-identical.

## Test migration

Three tests were migrated from the retired synthetic page in `App.test.tsx` to
`SeascapeMapPage.test.tsx`, using the actual production Features page with small,
deterministic native-H3 fixtures:

| Retired demo behavior | Current-page coverage |
| --- | --- |
| Inspect and leave a selected cell | Exact zero versus unavailable values, source qualifiers, and return to the Overview summary |
| Change month, compare and hide time for static data | Select an explicit survey year, open comparison and remove time selection for a static feature |
| Keep comparison inspection tied to its map | Exact source variable/year/value on each selected side, independent left/right date edits and comparison exit |

The replacements passed before removing the old tests/page. App navigation,
keyboard/touch dismissal, Health, placeholder routes and legacy redirects remain
in `App.test.tsx`. `MapCanvas`'s explicit local renderer, its test, shared controls
and `data/demo.ts` remain required and are retained. The focused App/Features/
MapCanvas suite still has 52 passing tests; the migration does not reduce test
count. Test fixtures are software evidence, not scientific observations.

## Validation

Final full-suite, production-build and current-data browser/API outcomes are
recorded in the completion manifest after execution. Current-data replay uses
the retained Data roots directly and writes only small diagnostic evidence;
no bulk input archive or preview-data copy is created.

## Production-preview worker fix

The first built-preview smoke check exposed a pre-existing renderer setup gap:
MapLibre resolves its default worker beside its own module as an unhashed
`maplibre-gl-worker.mjs`, while Vite emits a hashed worker asset. The standalone
Viewshed basemap already set the emitted URL explicitly; the shared Features
renderer did not. Features and its integrated Viewshed view therefore reported
worker/basemap loading failures in production preview.

`MapTilerCanvas` now sets the Vite-emitted worker URL using the same existing
worker import as `ViewshedBasemap`. A renderer regression test verifies that
configuration. This adds no dependency or copied data, and changes no scientific
values, map styles or camera behavior. Production-preview rendering is checked
again after rebuilding; final outcomes are recorded below and in the completion
manifest. The retained Viewshed fallback independently served HTTP 200 with its
expected snapshot and a checksum-matching common asset (163 sources, 1,279 targets,
47,295 retained pairs).

## Final outcomes

- Typecheck, ESLint and production build passed; all 86 frontend files / 497
  tests passed. Concurrent Human tests in the checkout were preserved. This
  cleanup migrated three tests without reducing the focused-suite count and
  added one bundled-worker regression.
- Python: 118 tests and 33 subtests passed.
- `dist/local-data` is absent; the map worker resolves to the emitted hashed asset.
- Production browser: Features bathymetry/legend/Insights, the retained Viewshed
  weight map, applied Relationships matrix/density plot, Home and synthetic Health
  load. The earlier worker failure is resolved.
- Post-cleanup readback matches every native key and value for R6/R8 bathymetry
  and the latest annual R6 kelp slice. Independent Relationships joins/statistics
  match 2,305 R6 and 77,034 R8 complete pairs.
- All 2,057 retained cache files (696,975,517 bytes), the four root cache catalogs
  remain byte-identical through the final check. Current QA matched immediately
  before/after deletion; subsequent concurrent Human QA edits are preserved.
  This task did not edit current QA.
- Changed local documentation links, Knowledge properties and whitespace checks
  passed. No dedicated docs build is configured.

This is scoped software, cache transport and selected source-value/statistic
validation. No provider acquisition, regional processing, scientific completeness
or predictive validation is implied.

## Remaining three prepared caches — 2026-10-24

The formerly conditional removal is now validated: Hydrology, river-influence
and Orca load through separate empty-cache readers and the actual frontend
adapters without reading their existing prepared files. Their remaining
105,343,084 bytes are removable for the current local app workflow. No removal
was performed in that validation. Other referenced startup/fallback caches remain
outside this finding. See the [empty-cache record](empty-cache-validation.md).


## Remaining prepared caches removed — 2026-10-24

With user approval, removed the Hydrology, river-influence and Orca prepared
cache directories: 262 files / 105,343,084 logical bytes. Original Data products,
provenance dependencies and other prepared caches stayed checksum-identical.
The production preview's actual frontend loaders passed without these directories;
all 497 frontend tests, 119 Python tests plus 33 subtests, typecheck, lint and
build passed. Current QA was not edited. See the
[completion and retained-input checks](empty-cache-validation.md#approved-removal--2026-10-24).
