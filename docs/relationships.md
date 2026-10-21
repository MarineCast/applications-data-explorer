# Relationships: local analysis

Implemented and checked 2026-10-20. The approved 2026-10-19 design is retained in
`../../Reports/relationships-design-2026-10-19/`. This page follows the existing
Map header, dock, family picker, type, color and theme controls.

## Start locally

From `Applications/applications-data-explorer`, keep the existing Vite data bridge
for Features and start the additional service in a second terminal. Use Python
3.11+ with the scientific dependencies in `requirements-relationships.txt`.

```sh
python3 -m venv .venv-relationships
.venv-relationships/bin/python -m pip install -r requirements-relationships.txt
.venv-relationships/bin/python scripts/relationships_api.py
```

Then, in the other terminal:

```sh
npm ci
npm run dev
```

Open Vite's printed URL with `/#relationships`. `npm run backend` also starts the
service when the desired Python environment is activated. Backend binds only
`127.0.0.1:8001`; Vite proxies only `/api/relationships`. Stop each process with
Ctrl+C. No daemon, credentials, database, persistent access or deployment is created.
The existing Features endpoints continue through `scripts/localDataPlugin.ts`;
Relationships does not replace that reader or change Data products.

`MARINECAST_DATA_ROOT` optionally sets the server's allowlisted final Data root
(default `../../Data`). Export it in the backend terminal; `.env.local` is loaded
by Vite only. Port 8001 is used by the supplied proxy. `MARINECAST_RELATIONSHIPS_PORT`
can change the Python listener, but the Vite proxy must then be changed to match.
The existing Map Python setting (`MARINECAST_DATA_PYTHON` / `METEOROLOGY_PYTHON`)
continues independently. No `VITE_` variable contains a local filesystem path.

First source validation can take about 45–60 seconds on this machine. The UI
reports validation and remains interactive. A process caches current source
validation and rechecks source generations. It never accepts changed files as an
old generation. Reader-owned temporary encodings retain only current/previous
generations and are cleaned at normal shutdown. There is no result database.

## Supported observations

| Selection | Observation unit and rule |
| --- | --- |
| Static Seascape / Governance R6 or R8 | One row per native cell, unique keys; different delivered supports use an outer key denominator. Never join by row order. |
| Human static R7 | Separate native cell support; no cross-grid join. Native geometry records are unavailable as cell variables. |
| Recorded Seascape survey slices | One recorded survey slice at its native R6/R8 support; static joins remain one row per cell. No synthetic daily or annual repetition. Catalog availability is marked slice-dependent; exact coverage is calculated from the chosen slice. Inherited cross-slice availability totals are not used. |
| Meteorology R5 | Same native cell × UTC day, 1–32 inclusive days. Retrospective ERA5; repeated cells and temporal dependence are explicit. Metric-specific partial days are excluded, including 23/24-hour precipitation. No averaging of unlike quantities or weather upscaling. |
| Orca response with static R6 predictors | Positive recorded daily/weekly/monthly/yearly bins summed once per reported cell across the explicit window. Weeks start Monday UTC. Entire source interval must fit its UTC bin; complete bins must fit the requested window. All time includes undated records and requires no date bounds. |

The response counts stable source-deduplicated records, not individuals, globally
unique encounters, abundance, occupancy or validated absence. SRKW, Transient and
Other can be combined; Other retains NRKW/offshore/mixed/unknown mappings. In response mode every matrix pair uses the positive-recorded-cell frame; study-wide
predictor rows outside it are reported separately. There is no background or absence generation. Unknown/unsurveyed cells remain unlabelled.

All current sighting locations have assignment-only precision statuses. The default
cell-confinement policy therefore returns zero eligible response rows. Explicit
**Reported assignment · accuracy qualified** allows descriptive comparisons while
retaining that limitation, record exclusions, source coverage and deduplication.
No point is snapped to water. Different species and the two-year census series
have no comparable spatial response adapter.

## Statistics, plots and safeguards

Select up to 12 variables across toolkits/families at one native resolution.
Search readable and original field names. Separate information controls preserve
original identity, definition, unit, source hash, availability and model eligibility.
Quality/context fields require opt-in. Unknown units stay unknown.

Numeric pairs use Spearman by default or Pearson, with pair-specific complete-row
counts. A common complete-case cohort is explicit. Matrix coefficients may otherwise
use different rows. The diagonal is the same-variable association. Family summaries
report eligible/tested pairs, strongest signed pairs and the chosen threshold;
they do not establish multivariate rank, VIF, ecological importance or a reason to
automatically remove predictors. Sand/mud/gravel share a composition constraint.

Auto chooses scatter through 2,000 complete pairs, then a 40×40 density grid using
all complete pairs. Manual scatter samples at most 2,000 points with seed 19;
statistics always use all eligible complete pairs. Numeric/category pairs use box
or strip summaries, medians, IQR, 1.5×IQR whiskers and group n. Strip marks are capped
at 100 per group and labelled. Category/category pairs return counts and proportions
of complete pairs. IDs are category labels, never ordered magnitudes.

Overlapping Governance memberships require explicit **Exact observed membership
sets** encoding. Every identity remains in the set, including source-qualified IDs;
partial/unknown support is excluded. An empty observed set is labelled as recorded
membership support, not ecological absence. Category sets are never silently pooled.

Each result retains union-row denominators, matched keys, nulls, distinct complete
cells/periods, exclusions, source status counts and sampling. Exclusion reasons can
overlap; the distinct excluded-row count is separate. Source QC is preserved using
the existing validated adapters; no universal meaning is invented for arbitrary QC
codes. Exploratory results make no causal/predictive claim and show no p-values.

Requests are validated with unknown fields forbidden; only catalog keys/enums are
accepted. Limits: 64 KiB request body, 100 catalog fields/page, 12 variables,
100,000 aligned observations, 24 category groups, 400 contingency combinations,
two active requests, 30-second computation budget and a 256 MiB estimated/value
working-set guard. Initial source validation has a separate 90-second request
ceiling. These are application guards, not a hard bound on Python RSS. Source
validation/encoding overhead is additional. Cancellation signals stop iterative
work between bounded reads; a file read/hash already in progress finishes first.
The existing reader's initial validation/build is not interruptible inside that call; cancellation
stops subsequent analysis work and suppresses late browser results. A cancelled
initial validation may finish in its bounded worker before the slot is released.
The browser has a 95-second timeout.

## Deferred combinations

- Cross-resolution joins, coarsening fine predictors to weather, weather/sightings
  joins and river-to-cell support need reviewed aggregation/support adapters.
- Circular bearings/directions need circular statistics.
- Viewshed needs a completed regional directional pair contract; physical
  viewability is not detection probability.
- Other species responses, effort/background designs, lagged availability-aware
  predictors, inference, block resampling and model validation remain deferred.
- Species-informed critical habitat and target-derived predictors are blocked in
  response mode to prevent leakage. Reference governance geometry is not proof
  of legal effect, compliance or habitat preference.
- Unsupported selections explain their reason; no values are fabricated.

## Local recipes and API

Export stores normalized product/field keys, source generations, support, time,
cohort/QC/encoding policy, method, sampling seed, adapter hash and analysis version.
It includes no individual sightings. Import validates version and generation before
applying. Changed context leaves the previous result visibly stale until Apply;
export is disabled while stale. Recipes create no hosted link.

Read-only endpoints: `GET /api/relationships/health`, `GET .../catalog`,
`POST .../plan`, `POST .../analyze`. OpenAPI is available locally at `/docs`.
422 rejects incompatible plans; 409 rejects changed generations; 413 rejects
budgets; 429 rejects excess concurrency; 503 reports unavailable validation.
Untrusted browser origins/hosts are rejected and no arbitrary file-serving route
is exposed. Diagnostics return summaries, not whole source tables or filesystem
paths. The Python service layer is `scripts/relationships.py`.

```sh
npm run typecheck
npm run lint
npm test
npm run build
.venv-relationships/bin/python -m unittest discover -s scripts -p 'test_relationships*.py'
```

See [QA, actual calculations and screenshots](qa/relationships.md).
