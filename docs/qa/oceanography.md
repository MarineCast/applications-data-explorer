# Ocean Conditions — 2026-10-26

Choose Oceanography, then Ocean Conditions → Sea Surface Temperature or Chlorophyll. The selector
switches to each product's native grid (R6 / R5). The date dropdown and timeline
cover 2009-01-01 through 2026-10-25 (6,507 dates). Click a cell and open Insights for its exact
value or Unavailable. Source & quality retains source/method qualifications.
Comparisons remain restricted to the same native grid. No upsampling or smoothing
is applied; the default legend uses the complete delivered range across dates.

The public source tables remain exactly date, h3_index and one metric. The app
adds no coverage or metadata feature choices. MUR SST is provider gap-filled
foundation analysis. MODIS chlorophyll is an optical biomass proxy, not a HAB
label. Source masks, clouds and coastal gaps remain null, including narrow inlets.
The toolkit uses cosine-latitude-weighted valid pixel centres, not exact water-area
integration. Native daily source labels are not local-day averages. Historical
forecast availability is unknown.

The adapter verifies catalog/file hashes, exact Arrow schema, units, native H3
resolution, study/registry hashes, complete date/cell keys, counts and range.
Every encoded value and null is read back losslessly. Missing or invalid deliveries
produce a source warning; no old data is substituted.

Validation: four reader tests (actual complete data readback, tamper, duplicate
keys and missing product), ten local-data tests and 47 frontend tests passed.
Lint, TypeScript and production build passed; the existing chunk-size warning
remains. Exact running-API readback matched all 8,670 rows. SST has 2,427 cells/day,
2,296 nonnull each day; chlorophyll has 463 cells/day with 79/183/107 nonnull.
Rendered QA checked all dates, metric/native-grid switching, northern/outer
Vancouver Island, Salish and Columbia extent, selected values changing by date,
and a missing Columbia-area cell displaying Unavailable. The timeline pointer
layout issue found in this pass was corrected and rechecked in the browser.

Evidence: /Users/tylerstevenson/Documents/Codex/2026-10-26/task-3/
`oceanography-app-validation.json`, `oceanography-sst.jpg`, and
`oceanography-chlorophyll.jpg`. No producer/Data modifications, acquisition,
commit or deployment. Human and causal Hydrology implementation is retained.
A concurrent Hydrology publication briefly held its writer lock during this pass;
the app correctly surfaced that domain's unavailable-source notice independently.

Naming update: Ocean Conditions is the display family; product/metric IDs and saved
selections are unchanged. Timeline dates come from published catalog slices, and
the browser fetches only the selected daily cell/value assets (plus catalog metadata).
Expanded-range selector regression uses dates from 2009 through 2026. The live server adapter now uses bounded validation and lazy daily reads, as
described below.

## Full-history capacity validation

The live API uses `oceanography_store.Store`. A generation is SHA-256 validated
once, with exact Arrow schema, registry membership, date support, duplicate and
summary checks. Batches are limited to 8,192 rows and one decoding thread. A
one-byte-per-key seen array detects duplicates globally, including unordered
rows; a temporary disk-backed float grid permits daily hash calculation without
Python copies of every row. The grid is released before serving requests.

Only catalog metadata, cells and asset routes remain in memory. Daily requests
use a date-filtered Arrow scanner and verify the selected payload hash. Source
inode, device, size, mtime, ctime and resolved path are checked around validation
and requests. Changes invalidate the HTTP catalog too and require revalidation;
in-progress publication never falls back to an old source generation. The
browser retains at most 12 Oceanography value/cell assets during playback.

Measured synthetic shape: 6,500 dates × 2,427 SST cells plus 463 chlorophyll
cells = 18,785,000 rows, unique daily values and explicit nulls. On this Mac,
validation took 33.45 seconds, complete-process peak RSS was 327,008,256 bytes,
and six first/middle/last daily reads took 0.056–0.061 seconds. Catalog metadata
was 9.76 MB; temporary compressed fixture was 226 MB and was cleaned up. This
fixture used daily Parquet row groups. Unclustered producer row groups may scan
more data and take longer; final producer layout and real-history acceptance
remain pending. The existing complete date×registry contract is preserved.

Actual pilot values and payload hashes match the earlier adapter exactly.
Tests cover arbitrary ordering, cross-batch duplicates, timestamp-preserving
tampering, missing products, publication-change retry, HTTP hash encoding,
catalog invalidation and bounded browser caching. No producer data is modified.

## Published history acceptance

The final 15,792,489 SST rows and 3,012,741 chlorophyll rows passed bounded
streaming validation in 25.20 seconds at 290,029,568 bytes peak RSS. Twelve
selected-day probes matched source values and nulls exactly (first day, leap day,
missing source day, pilot date, October 17 and October 25); reads took 3–7 ms.
Both delivered files use 214 monthly date-clustered row groups.

Source labels now include both MODIS SQ and NRT datasets. SQ takes precedence
where its native date exists; NRT can fill earlier gaps as well as recent dates.
The app does not add a public metadata layer or infer a simple transition date.
October 25 chlorophyll is entirely null; October 17 has two qualified cells.
An all-null selected date explicitly says no qualified values, unavailable not
zero, with no date substitution. MUR's two absent native dates remain null too.

Final HTTP acceptance compared eight selected product/dates and their SHA-256
payloads to the Parquets. Browser checks covered both first/last dates, both native
grids, the full study area, source qualifications and selected-cell changes:
8528dc93fffffff is 0.9043498844970246 mg/m³ on 2012-02-29 and unavailable on
2026-10-25. Current checks: 16 adapter tests, 64 affected frontend tests, 36
Human/calendar/Hydrology/Qualark reader regressions, lint/types/build and diff
check passed. Browser value retention is bounded by the tested 12-asset cap;
process-wide browser heap was not separately instrumented. Owned preview stopped.

## Surface salinity and currents pilots

Oceanography → Ocean Conditions now includes eight source-separated choices:
HYCOM practical salinity (psu, 0 m, R5), SalishSeaCast reference salinity
(g/kg, approximately 0.5 m, R6), and eastward/northward components plus speed
(m/s) for each source. These pilots cover July 1–3, 2024. Switching from a date
outside a pilot range explicitly switches to its first date and displays a notice.
Signed components use a symmetric scale and a diverging default palette;
speed and salinity retain scalar scales. Nulls remain unavailable.

Select a cell, open Insights → Time history for native daily values. Pilot
histories contain all three dates; longer products request at most the preceding
31 dates through the selected day. Missing values break lines; date dots select
the native date. Existing browser asset caching remains bounded to 12 assets.

HYCOM uses eight 3-hourly surface model samples per UTC day. SalishSeaCast uses
24 complete hourly-mean intervals, collocated and rotated into geographic
components. Speed is an average of source vector magnitudes, not the magnitude
of the daily mean components; SalishSeaCast speed is not instantaneous mean
speed. No mosaicking, salinity conversion, spatial filling, or temporal filling
is performed. Regional/coarse model support differs; these are three-day pilots,
not an extended salinity/current history or measured observations.

The generalized reader validates ordered metric/schema contracts, source hashes,
complete native date/cell support, duplicates, metric summaries, finite values,
nonnegative speed/salinity, and aligned current-component null support. It keeps
bounded streaming validation and filtered daily reads. Actual six-product
validation took 35.17 seconds with 254,066,688 bytes process peak RSS. Thirty
metric/date comparisons matched published Parquets exactly, including every new
pilot metric/date and full-history SST/chlorophyll first/pilot/latest dates.

## Seasonal ENSO context and tide event lists — 2026-10-28

Ocean Conditions includes **ENSO · seasonal regional context**: NOAA CPC RONI
ERSSTv6, 1991–2020 baseline, 213 overlapping three-month periods ending January
2009 through September 2026. The same regional context is published across all
463 R5 cells; it is not a local or daily measurement. Select a native season end,
not an interpolated day. Period starts/ends and season names are retained.
CPC updates by the fifth of the month and recent values may revise. Historical
issue dates are unknown: the app labels this retrospective context, not forecast
eligible, and performs no daily/as-of join or inferred availability conversion.

**High & low tide times** displays a categorical station-prediction support map,
not scalar colors for timestamps, height, or phase. Select a cell and open
Insights → Selected cell to see every high/low event in paired UTC and station
local ISO8601 form, including offsets and previous-local-day timestamps. The
July 1–3, 2024 pilot uses UTC event-day selection. Each day has all 2,427 R6 cells,
but only 153 have a water-connected station timing proxy within 20 km. Unsupported
cells remain null; a supported empty event list is distinct from unavailable.
Station identity, timezone, route distance, prediction semantics and unknown
historical issue date are disclosed. No local tide interpolation or navigation
claim is made. No source events are recomputed or reduced to one daily tide.

The adapter validates native seasonal dates and uniform regional values, exact
Arrow list schemas, complete H3 membership/date support, unique keys, source
checksums, station mappings, UTC/local pairing, timezone/DST offsets, event order,
and all list/count summaries. Daily reads remain lazy and browser assets bounded.
Full eight-product validation took 35.55 seconds at 259,850,240 bytes peak RSS;
225 native metric/period comparisons matched source values and lists exactly.

## Copernicus GLORYS12 pilot — 2026-10-29

Ocean Conditions adds four separate GLORYS12 choices: practical salinity (psu),
daily-mean eastward and northward current (m/s, signed), and daily-vector current
speed (m/s, nonnegative). Labels identify GLORYS12 and approximately 0.49 m depth.
The existing HYCOM and SalishSeaCast choices remain separate; no source replacement,
mosaic, salinity conversion or new feature columns are introduced.

The published pilot spans July 1–3, 2024 at native reporting R5: 463 cells per day,
245 supported and 218 null for each metric. Seattle waterfront, Tacoma and
Vancouver Harbour probes are unsupported; Fraser mouth and Juan de Fuca probes
have estimates. Only three of 41 approved cell centres in the producer's Puget
diagnostic rectangle are supported. This rectangle is not a waterbody boundary,
and a supported coarse cell does not establish resolution of a narrow passage.

GLORYS12 excludes tides. Components are geographic daily means; the speed product
spatially averages native daily-vector magnitudes. It is neither mean hourly speed
nor magnitude of the spatially averaged vector. Provider midnight day labels are
retained, with the official daily mean centred at noon documented in the definition.
The source-specific wet-centre weighting, null support, reanalysis and unknown
historical forecast availability remain explicit. See the producer's
[GLORYS contract](../../../../Toolkits/toolkit-oceanography/docs/GLORYS.md).

The bounded reader retains checksum, exact schema, membership, duplicate, paired
null and summary checks; it adds GLORYS depth/tide/availability qualifications and
nonnegative daily-vector speed validation. Daily values remain lazy filtered reads.

## GLORYS12 full history — 2026-10-29

The existing four GLORYS12 choices now consume 6,474 native daily dates,
2009-01-01 through 2026-09-22. Each product contains 2,997,462 rows, with
245 supported and 218 unavailable R5 cells per date. The source IDs, units,
null semantics and daily-vector speed definition remain unchanged. The app
uses filtered daily reads; it does not send historical value arrays to the browser.
Methods & limitations now disclose the catalog's documented reanalysis through
2021-06-30, interim near-real-time assimilation from 2021-07-01, and the separate
2019-01-01 forcing change. These are source provenance changes, not measured
physical discontinuities or evidence of historical forecast availability.

Acceptance: 20 exact HTTP/Parquet comparisons across first, 2019 forcing-change,
2021 regime-boundary and latest dates; 33 backend and 46 selected frontend tests,
lint, TypeScript and production build passed. Rendered first/middle/latest dates,
all four selectors, supported/null cells and provenance disclosure passed.
Warm selected-day requests measured 51–67 ms; sampled combined API RSS was
approximately 1.5–1.7 GB. Initial combined catalog validation still takes several
minutes; this is not a cold-start performance claim. Existing Human source
unavailability remains unrelated. See [exact acceptance evidence](glorys-history-acceptance.json)
and [latest-date screenshot](glorys-history-supported.jpg).
