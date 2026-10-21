# River influence QA — 2026-10-18

The Features Hydrology layer includes a **River influence** family. Its two active variables
use the producer's factorized R8-water-distance/R6-reporting research product across
six rivers. The current source is the single `Data/Hydrology/influence.parquet`;
its embedded recipe and factor checksum replace influence release directories and
JSON companions. Earlier receipts below retain their historical layout. Prepared distance profiles are local 20 km decay, broad 50 km decay and
an offshore Gaussian peaking at 20 km; lag profiles are same-day, 2–4 days with 1:2:1
weights, and 6–8 days with 1:2:1 weights. These are demonstration assumptions. Custom
profiles and nonnegative river gains are configured in the [producer JSON](../../../../Toolkits/toolkit-hydrology/config/river-influence.json)
and rebuilt offline. The browser selects prepared factors and sums their products;
no routing, interpolation, reference fitting or model fitting is performed in the app.

The shared grid contains 2,427 cells; 79 have no supported route and stay unavailable.
Default distance support overlaps at 1,086 cells. This describes spatial weights. Full history is 2009-01-01–2026-10-15 on provider dates;
it is not relabeled UTC. Missing positive-weight lag support gives a null combined
value. Known spatial subtotals carry route coverage; missing routes are not evidence
of zero influence. Exports contain settings, source recipe and each cell's river
contributions; shares refer to positive supported contributions.

Each comparison side has its own distance profile, lag profile and provider date.
Swapping sides carries scenario settings. The daily timeline can target either side
when both show influence; date fields remain available in comparison settings.
Further appearance smoothing is disabled; underlying water-connected weights already
supply the scenario surface. Equal-bin colors use the current supported frame range,
so consult the legend when changing scenarios or dates. Producer factor envelopes
remain available as numerical support bounds. The source/study/live-data watcher
invalidates outdated products and offers source retry instead of using stale output.

Initial v1 evidence (historical): 166 producer tests, 39 targeted frontend tests, two influence adapter
checks and seven live-reader checks passed. Independent readback matched all 43,686
spatial factors, 350,838 lagged signal values, and 262,116 frontend cell values over
108 frames. All encoded factors matched source Parquets exactly. TypeScript, ESLint
and production build passed (existing large-chunk warning). The full frontend suite passed: **387 tests in 73 files**.

Native browser validation rendered the real R6 overlap surface, changed from broad
to offshore-peaked weights and inspected a cell with multiple contributing rivers.
The screenshot is `/private/tmp/marinecast-influence-browser.png`. Narrow-screen
layout and provider-network acquisition were not rerun. Physical currents, plume
transport, gauge-to-mouth timing, cross-river UTC alignment and whale/prey effects
remain unqualified. Columbia's modeled origin is upstream in its estuary; no physical
mouth relocation is inferred. Source registration and outlet coordinates remain
inspectable under Method and outlet limits.

Initial v1 research product identity (historical):
`414ba582f939c3c84286c06a3b2564d9a44cc8ff7ed9bf70ceb7c1af26022a04`;
source catalog SHA-256:
`2866d93a9233ba41e9362c3dd48c47b46c705dc5abeccb69628186efbe518d4a`.
See the [producer method](../../../../Toolkits/toolkit-hydrology/docs/RIVER_INFLUENCE.md)
and [validation record](../../../../Toolkits/toolkit-hydrology/docs/VALIDATION.md#river-influence-scenarios--2026-10-18).


## Hydrology family placement — 2026-10-18

User correction implemented: River influence belongs under **Hydrology → Family**;
the separate product-dock entry is removed. The internal influence data endpoint and
producer product remain separate to preserve their source contract. Rendering uses
the feature role to distinguish marine influence grids from native gauge bubbles,
legends, histories and gauge statistics. Scenario controls, per-river contribution
inspection, date playback, exports and independent comparison scenarios remain.
Regression tests exercise native gauges and influence in the same Hydrology catalog,
family switching in both comparison panels, scenario swaps and return to gauge history.
Scientific data and producer calculations were not changed or regenerated.

Placement validation: **388 frontend tests in 73 files** passed, plus TypeScript,
ESLint and production build (existing chunk-size warning). Native browser checks
confirmed Hydrology's family picker includes River influence alongside Discharge,
Flow indicators and Water temperature, and that selection renders the influence
grid with its scenario controls. Screenshot: `/private/tmp/marinecast-influence-family.png`.
The earlier 387-test receipt describes the initial placement before this correction.

## Pulse activity discovery — 2026-10-18 (superseded)

This diagnostic UI was removed with the two pulse variables in the later user-requested
reduction below. The following receipt describes that earlier implementation.

The reported blank-looking pulse variables were valid zeros: on the latest retained
date, 2026-10-15, all six rivers have zero lagged positive P90 excess under every
prepared lag profile. Relative pulse influence and Overlapping pulse rivers now
show activity status in both scenario controls and Insights, with unavailable input
states distinguished from known zeros. An explicit **Go to previous pulse** button
selects the latest earlier supported pulse date under the selected distance and lag
profiles without changing those profiles. The search requires all spatially eligible
river signals to be known on the candidate date. It does not silently change dates.

The latest earlier pulse dates are June 21 for same-day, June 25 for the three-day
profile and June 29 for the seven-day profile (all 2026). Native browser QA verified
the October 15 zero notice, jumped to June 25 with offshore/three-day weights retained,
and rendered Relative pulse influence with range 0–0.0025 and Overlapping pulse rivers
with range 0–1. Screenshots: `/private/tmp/marinecast-pulse-zero.png` and
`/private/tmp/marinecast-pulse-activity.png`. Unknown-route cells remain unavailable;
no producer data, P90 definition, lag factors or interpolation changed.

Current software validation: **393 tests in 74 files** passed, including zero-color,
missing-input, pulse-search and page-level date/weight preservation checks. ESLint,
TypeScript and production build passed (existing chunk-size warning). No new data
generation, provider acquisition, physical validation or narrow-screen QA was run.


## Two-variable product — 2026-10-18

The user requested removal of Relative pulse influence and Overlapping pulse rivers.
Only **Relative flow influence** and **Discharge influence** remain under Hydrology
→ Family → River influence. The pulse notice and previous-pulse shortcut are removed;
scenario controls use Flow lag weights. Both retained variables still support
independent comparison settings, timeline playback, contribution inspection and exports.
Native gauge low/high-flow duration and days since flow pulse remain available.

The producer rebuilt method `river-influence-water-r8-min-child-lag-v2` into the same
configured delivery root. Active signal Parquet, recipe definitions/display bounds and
browser encoding omit the retired metrics; legacy v1 is rejected. Earlier immutable
releases remain historical. New identity:
`4d1558b6b2f455b693accba0d3b60dff1c27e6b3a5d653bbbf4184403103125e`;
source catalog SHA-256:
`e36d95755fec1ec9007f6cc4dd91f97c7ae07d8eef13e3d708cc26315d97a942`.
Independent comparison verified every retained spatial/signal/interpolation value and
all source bindings against the previous release. Independent frontend readback
matched 131,058 cell values across 54 scenario/metric/date frames. Source observations,
provider-date support, spatial unknowns and research qualifications are unchanged.

Current checks: **391 frontend tests in 74 files**, **166 producer tests**, two influence
adapter tests and seven live-reader tests passed. Ruff, TypeScript, ESLint and production
build passed (existing chunk-size warning), as did local documentation/diff checks.
Native browser QA confirmed exactly two choices and a rendered retained flow surface;
screenshot: `/private/tmp/marinecast-influence-two-variables.png`. No acquisition,
physical validation, installed-wheel run or narrow-screen QA was performed.


## Single Parquet source — 2026-10-18

The app now reads only **`Data/Hydrology/influence.parquet`** for river influence.
The file combines typed spatial/temporal factors and embeds configuration, units,
source bindings, scientific qualifications, recipe identity and logical checksum in
Parquet metadata. No influence release directory or JSON recipe/manifest is required.
Source attribution and export scope use the influence recipe rather than native
river-gauge bubble notes. Native gauge controls/data are unchanged.

The 1,557,830-byte file contains 160,632 rows. All factors and scientific recipe
fields matched the previous product exactly, after normalizing string/date storage
types. Independent frontend readback matched 131,058 cell values over 54 frames.
File SHA-256: `9bdb901708b4a99fb5caffe43185f3ef60154a6c0354663fab2e4f3d18ef7213`.
Native browser checks confirmed the map surface and `Hydrology/influence.parquet`
source with influence-specific method/coverage. Screenshot:
`/private/tmp/marinecast-flat-influence-browser.png`.

Current software evidence: 391 frontend tests in 74 files, 168 producer tests,
three influence-adapter tests, seven live-reader tests, Ruff, TypeScript, ESLint
and production build passed (existing chunk-size warning). Six data/metadata tests
were rerun after a source-info typing correction. Tests include live flat-file
replacement, embedded checksum/metadata corruption, malformed identities, missingness,
failed-write rollback, lock contention and file retention across native updates.
No provider acquisition, physical/model validation, wheel check or narrow-screen QA
was run. The old Data directory was moved intact to the toolkit's configured source
cache; see [producer validation](../../../../Toolkits/toolkit-hydrology/docs/VALIDATION.md#single-parquet-in-hydrology--2026-10-18)
for exact retained location and migration evidence.


## Hydrology catalog discovery — 2026-10-18

The existing Hydrology catalog now inventories the single influence Parquet at
`products.influence`. The reader discovers its relative path from that entry and
validates file checksum/size, row count, recipe identity, variables/units, provider-day
basis and research qualification. Missing/unsafe entries or stale source support fail
closed. Native-input fingerprints exclude the derived inventory to prevent circular
file/catalog hashes. The file bytes and native gauge catalog fields are unchanged.

Current checks: 168 producer tests, four influence-adapter tests, seven live-reader
tests, Ruff, diff and documentation checks passed. Actual current native-gauge and
influence reads passed against the updated catalog (six rivers, 6,497 dates, 2,427
influence cells). No frontend source changed; frontend tests/build and browser QA
were not repeated. No acquisition, Parquet regeneration, physical validation or wheel
check was run. Exact hashes and registration evidence are in the
[producer validation](../../../../Toolkits/toolkit-hydrology/docs/VALIDATION.md#hydrology-catalog-registration--2026-10-18).


## Ten-river expansion — 2026-10-20

The producer's approved Puyallup, Elwha, Skokomish and Queets additions now appear in
the rebuilt factorized product. Current app-reader and running localhost endpoints
passed checksum-bound readback for ten rivers, 6,497 provider dates and 2,427 cells.
The producer independently verified all pinned R8 distances/profile coefficients,
preserved the six original logical factor arrays, and retained 79 unknown-route cells
per river. The native Skokomish record has 345 discharge gaps; no source observations
were imputed. Research, retrospective and model-ineligible qualification remains.
Influence SHA-256: `1922301967fbe166dab55bce90ac48b24b5ca598765759c44807d1920fb95e66`.
Twelve native-reader tests, 35 focused frontend tests and TypeScript checking passed;
the existing influence adapter needed no behavior changes. No native-browser visual
pass or physical plume validation was run for this expansion.
