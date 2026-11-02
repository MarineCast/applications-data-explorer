# Seascape review-note reader fix — 2026-10-24

## Cause and implementation

The only extra top-level delivery file was `SEASCAPE_REVIEW_FINDINGS.txt`.
The read-only exporter compared every top-level filename with the scientific
catalog roster, so this human review note caused **Unexpected files in flat
Seascape output** in both Features and Relationships.

`prepare_flat_map.py` now excludes `.txt` and `.md` notes (case-insensitive), as
well as the existing `.DS_Store` exception, from its product-roster check.
Notes are neither consumed nor interpreted, and do not enter scientific source
bindings. Catalog paths, required Parquets, native H3 identity, source hashes,
lossless values and missingness remain validated. Other extra files still fail,
now listing the unexpected filenames. The read-only consumer's note tolerance
does not change toolkit-seascape's stricter producer publication contract.
No producer code, Data files, review-note contents or scientific values changed.

## Regression and software checks

The new live-reader regression failed before the fix and passes afterward:
review notes coexist with exact zero/null values, do not change the source
snapshot, and do not prevent changed Parquets from refreshing. Additional cases
confirm unlisted Parquet, JSON and CSV files fail with their names in the error.
Existing corrupted-source and stale-asset rejection tests still pass.

- Python: 118 tests and 33 subtests passed using the temporary Python 3.14
  validation environment with FastAPI 0.150.0.
- Frontend: 86 files / 492 tests passed.
- Typecheck, ESLint, production build and whitespace checks passed.
- No dedicated docs build exists; changed local links and Knowledge properties
  were checked separately. Existing Node localstorage, Vite chunk-size and
  FastAPI TestClient deprecation warnings remain non-failing.

## Current retained-data validation

Both API routes return HTTP 200 through the running Vite app; the Features
catalog's Seascape fingerprint equals the SHA-256 of the current source catalog.
The combined Features catalog has 548 features and 32 products. Relationships
lists 131 R6 and 227 R8 scientific fields under its default filtering.

| Exact map readback | Native rows | Preserved nulls |
| --- | ---: | ---: |
| R6 bathymetry | 2,445 | 80 |
| R8 bathymetry | 81,380 | 4,346 |
| Latest annual R6 kelp, 2024 survey slice | 2,628 | 2,560 |

Every H3 key and value in these selected arrays matched its current source
Parquet exactly, with the Parquet checksum independently matched. Kelp's
`2024-01-01` key remains a survey-year label, not a daily observation.

Relationships plan/analyze also returned HTTP 200. Independently joining the
retained native keys, excluding source nulls and calculating Spearman coefficients
matched the service's complete-pair counts and coefficients to 1e-12:

| Selected pair | Complete / eligible | Spearman rho |
| --- | ---: | ---: |
| R6 sand fraction / mud fraction | 2,305 / 2,621 | -0.5714182907344354 |
| R8 bathymetric elevation standard deviation / maximum | 77,034 / 81,380 | 0.4817881815897068 |

Desktop browser inspection confirmed native bathymetry, the legend and Insights
(2,365 available, 80 unavailable), plus the Relationships variable catalog and
an applied four-variable matrix/density chart showing 2,305 complete sand/mud
pairs and 87.9% pair coverage. This validates loading/transport and the selected
descriptive calculations; it does not establish provider freshness, complete
scientific coverage, causal effects or predictive skill. Other domain analysis
combinations were not exhaustively retested.

Small replay/checksum evidence is retained in the workspace
[validation directory](../../../../Reports/data-explorer-reader-fix-2026-10-24/manifest.json),
including the API proof, standalone verification script and two screenshots.
All 31 recorded Seascape catalog/product/note checksums remained unchanged.


## Reviewed compact static delivery — 2026-10-25

The approved producer change now also preserves adjacent user review notes.
Seagrass, Bivalve and Kelp static have H3, all-time area and int64 0/1 mapped
presence. Public area zero includes original unknowns filled by user policy;
it is not surveyed absence. Bathymetry/Freshwater omit redundant resolution.
`seascape_support.py` independently verifies required native-audit SHA-256 and
public arrays, restores native resolution and QC/source arrays for Details, and
keeps the delivered filled areas and flags as values. Audit bindings enter
encoding fingerprints and live dependencies; altered or missing support fails.
Annual Kelp and unreviewed-family bytes remain unchanged.

Current validation: 118 Python reader tests passed. Independent full Seascape
encoding produced 494 selectable features and 97 slice tables. Every H3 key and
all 73 public arrays across the nine changed static files matched current
Parquets exactly. All six added native-resolution presence fields are int64;
nine required audits are bound. The reader imported no producer toolkit.
These counts are Seascape-only and are not a combined app catalog count.

Producer checks passed: 632 tests, three existing regional-data skips; 13 copied
installed-wheel tests and all nine real compact files; 198 installed module
imports; offline notebook with 15 production/22 notebook checks; lint, format,
type checks and strict docs build. A stale installed-smoke count was replaced
with required-ID and uniqueness checks (source and wheel both have 103 entries).
The selected dependency closure audit is clean after refreshing four packages
in an isolated validation environment; the summary records inherited unrelated
whole-environment dependency constraints. Application environments were untouched.
No fresh source acquisition, native regional geometry build, interactive browser
QA, hosted CI or model-eligibility assessment was performed in this task.

[Current evidence and limitations](../../../../Reports/seascape-review-2026-10-25/summary.json)
and [exact source/readback checks](../../../../Reports/seascape-review-2026-10-25/consumer-validation.json)
are retained in the workspace.

## Approved remaining static cores — 2026-10-25

The twelve approved remaining families now deliver `h3_index` and their selected
lower_snake_case metrics. Eighteen native-resolution files contain 117 public
columns in total, down from 572. All 99 retained metric arrays and H3 row keys
were checked against their native audits; integer 0/1 flags preserve the declared
missingness policy. Nearshore constants remain in metadata. The independent
reader exposes only retained metrics while restoring source/QC details from
required checksum-bound audits. Its contract copy matches the producer resource.

Full independent Seascape encoding passed with 173 selectable features, 97 slice
tables and 27 required audit bindings. All 99 new core arrays matched delivered
values exactly. The original five reviewed static areas, annual Kelp and research
files stayed byte-identical. The study-selection reader now accepts `h3_index`;
tests retain its pinned H3 membership and exclusions. Restore a parent area before
selecting original native fields; a filtered study view retains parent lineage.

Current checks passed: 657 toolkit tests (three existing regional-data skips),
128 application Python reader/API tests, 510 frontend tests, 37 copied
installed-wheel tests and all eighteen real core files. Installed smoke checks
imported 198 modules and checked 103 unique registry entries with sibling imports
blocked. Lint, format, types, production build, owner docs checks and strict MkDocs
passed. The guarded offline notebook passed 15 production and 22 notebook checks
without source acquisition or network attempts. A selected dependency closure
audit was clean; inherited whole-environment constraints are recorded separately.
One frontend run under concurrent load timed out; the complete retry with two
workers passed all 510 tests.

Browser checks used an isolated Seascape-only API/preview on task-owned ports
8017/5187, referencing canonical data by symlink. Anthropogenic R6 rendered and
its picker contained exactly five choices; Terrain R8 contained exactly eight
choices, but its completed map render was not confirmed. Other domains were
deliberately excluded from this preview. Concurrent API/proxy and metadata-cache
changes were preserved; these checks do not establish cross-domain runtime
coverage. Task-owned services were stopped after QA.

No new source acquisition, native regional geometry build, hosted CI or model
eligibility assessment was performed. Annual Kelp simplification remains pending.
See the [approved names and scientific qualifications](../../../../Toolkits/toolkit-seascape/docs/simplification-assessment.md),
[current evidence](../../../../Reports/seascape-core-2026-10-25/summary.json),
[exact consumer readback](../../../../Reports/seascape-core-2026-10-25/consumer-validation.json)
and [browser scope](../../../../Reports/seascape-core-2026-10-25/browser-validation.json).
