# Hydrology reference-mouth layer

Hydrology displays colored bubbles at the **exact retained approximate mouth-reference coordinates**. A color identifies one river across map nodes, the bottom history chart and the legend. Bubbles are navigation selectors for upstream gauges, not mouth flux measurements, water connectivity, routing, plumes or spatial influence estimates. Gazetteer references are approximate and distributary allocations remain unknown. Gauge coordinates remain separate and are never substituted for mouths.

The six rivers are Fraser, Cowichan, Skagit, Snohomish, Nooksack and Columbia. Seven retained references all fall within the approved 2,427-cell study registry without snapping. Skagit has two bubbles associated with the same gauge series and color; its history appears once. Co-located references retain exact positions and separate river identities, with concentric marker sizes for hit testing. Repeated clicks cycle river selection; the legend popup also provides direct, keyboard-accessible river inspection. The app never averages, allocates or sums their flows. H3 keys remain in the inspection/export contract but no hex grid is drawn for Hydrology.

## Included data and controls

The Hydrology layer panel and comparison settings contain Family and Feature (variable) selection only. The separate River dropdown and Inspect river button were removed on 2026-10-18. Individual river inspection remains available through map bubbles, the legend popup and Insights.

Validation on 2026-10-18: all 37 tests in `SeascapeMapPage`, `HydrologyInsights`, `HydrologyLegend` and `HydrologyHistory` passed, along with TypeScript, ESLint, the production build, Markdown link checks and `git diff --check`. The page interaction test confirms Family/Feature remain, the separate picker is absent and keyboard inspection of a river bubble still opens its gauge details. Native-browser QA and source-data validation were not rerun for this control removal.

- Native provider-date calendar: 2009-01-01 through 2026-10-15, 6,497 daily labels. These are not reconstructed UTC averages. The producer's day definition and original flags remain inspectable.
- `discharge_mean`, `discharge_mean_7d`, `discharge_mean_30d`, `discharge_change_7d` in m³/s.
- `low_flow_duration` in days uses each river's full-history 10th percentile as of 2026-10-18; `days_since_flow_pulse` uses an upward crossing of each river's full-history 90th percentile. Both disclose interpolation and retrospective qualification in Insights. Neither is an ecological or whale-effect threshold.
- `temperature_mean`, `temperature_max`, `temperature_7dadm` in °C where collected. The other rivers' `not_requested` placeholders are presented as acquisition gaps, not scientific inapplicability.
- Seasonal percentile/anomaly fields are not advertised because no training climatology was supplied and they are uncomputed.

Hydrology uses a collapsible **River history** panel instead of the playback timeline. It shows one line per river for the active metric on a shared linear value axis, with 90-day, one-year and all-history windows. Click the chart or use Left/Right and Home/End while it is focused to choose an exact native provider date. The selected day updates bubble missingness, legend values and river Insights. Collapsing retains the metric and date. Unavailable displayed values remain gaps and isolated observations remain points. The chart does not interpolate; low-flow duration now consumes a producer-derived series with qualified interior interpolation. Other metrics and original measurements retain their gaps. Uncollected series do not become zero lines. Source calendars remain provider daily, not reconstructed UTC averages.

The bottom-right legend lists the river identities, colors and selected-day values. Its information icon explains location support and missingness on hover, focus or tap. Hollow bubbles mean unavailable/not collected for the selected metric/day; numeric zero remains filled. Bubble size does not encode magnitude. Clicking a bubble opens the matching gauge without zooming; the legend opens a shared appearance popup, where Inspect also centers the map on the retained reference. Metric selection keeps the Family/Feature pattern. River Insights preserve source flags, day definitions, thresholds, native values and detailed history. Smoothing, standardization and numeric map-color classification are omitted for river identity colors. Other datasets retain their own timelines and legends.

## Local cache preparation

From this repository, with Python `pyarrow` and `h3` available:

```sh
python scripts/hydrology_input.py --source ../../Data/Hydrology --study ../../config/study.v1.json --output public/local-data/hydrology
npm run dev
```

The adapter reads the resolved current source snapshot and validates every per-river manifest/file hash, river/station identity, native temporal basis, complete calendar keys, finite values/statuses/units and the approved study registry hash. It indexes the original mouth coordinates directly with H3. Signed zeros, nulls, flags and source identities survive lossless packing. A checksum-bound asset is written before the atomic current catalog. No provider acquisition, source modification, influence product or duplicate source release is created. The ignored app cache is independent of Orca/Governance/Seascape/Human.

## Verification

- Source: 584,730 condition/feature rows checked; 350,838 selected metric-day values, statuses and reasons independently matched between decoded TypeScript data and original Parquets.
- Discharge: 38,971 of 38,982 river-days present. Missing days remain null: Fraser September 24–30, Nooksack July 24–25, Columbia September 30–October 1, all in 2026.
- Seven new Python tests cover source preservation, exact calendars, cross-river rejection, checksum drift, absent mouths, unsnapped off-grid references and signed-zero packing.
- Synthetic UI/model tests cover shared cells and multiple references without duplicate river values, native dates, missing/zero/background support, chart gaps, temperature acquisition placeholders, threshold disclosures and domain switching.
- Full frontend suite: 272 tests passed. Final 29 targeted tests passed after selection cleanup changes. TypeScript, lint, production build and diff checks passed. The normal app server at port 5173 passed a post-activation smoke check.
- Real native-browser QA checks mouth clicks, a rose missing day, a numeric zero on map and in Insights, two path segments around the Fraser gap, collected/uncollected temperature, both Skagit references, a six-river overview and persistent canvas through existing domains. Compact drawer/timeline/legend bounds do not overlap; no horizontal overflow or runtime errors.

Hydrology source catalog SHA-256: `8abdbbf33e937f16aa34ceb19898fce53b1cb90d547778cfab113511b3bc3c45`. Source geometry qualification: `Toolkits/toolkit-hydrology/docs/SOURCES.md` and `docs/CONTRACTS.md`; current metadata retain the same seven reference IDs and unknown allocation.

## Exact integration files

New files:

- `scripts/hydrology_input.py`
- `scripts/test_hydrology_input.py`
- `src/data/hydrology.ts`
- `src/data/hydrology.test.ts`
- `src/test/hydrologyFixture.ts`
- `src/components/HydrologyControls.tsx`
- `src/components/HydrologyInsights.tsx`
- `src/components/HydrologyInsights.test.tsx`
- `src/components/Hydrology.css`
- `docs/qa/hydrology.md`

Existing files edited, preserving prior work:

- `README.md`
- `src/data/map.ts`
- `src/data/seascape.ts`
- `src/components/MapCanvas.tsx`
- `src/components/MapTilerCanvas.tsx`
- `src/components/TimelineControls.tsx`
- `src/components/FamilyFeaturePicker.tsx`
- `src/components/DatasetInsights.tsx`
- `src/components/CompareInsights.tsx`
- `src/components/CompareInsights.test.tsx`
- `src/pages/SeascapeMapPage.tsx`
- `src/pages/SeascapeMapPage.test.tsx`

Activated app snapshot: `053d16da265b206352745f6a4c2ed089b9fd8cb78384aa826a81347434b6baa0`. All 50 Hydrology source files and existing app-domain catalog hashes were preserved. The ignored `public/local-data/hydrology/` contains only the current catalog and its bound data asset. Validation reports and screenshots are local temporary QA evidence, not source products.

## River bubble and history update (2026-10-17)

The presentation update changes display and interaction only. Cache products, checksums, upstream measurements, H3 indexing, provider-date support, missingness and original JSON exports remain unchanged. Targeted tests cover exact bubble coordinates, zero/missing distinction, river color stability, co-located selection, overlay removal, chart gaps, date keys, collapse/expand, and domain switching. Earlier verification totals above describe the original integration rather than the scope of this UI update.

### Editable river legend

The entire river key is a `LegendDropdown` appearance trigger, with the same close, Escape and outside-click behavior as numeric color bars. Palette choices and individual river-color edits update the map, bottom history, selected-river history and preview together. Advanced offers bubble opacity, size and Restore defaults. River colors continue to encode identity; these display settings do not change source values or missingness. Numeric feature legends retain their original coloring-method, smoothing and opacity controls.

## Relative low-flow revision — 2026-10-18

User-approved definition: consecutive provider days strictly below each river's historical 10th percentile, after linear interpolation of interior missing daily mean discharge for this calculation only. The producer uses a linear quantile over 2009-01-01–2026-10-15, including the 11 interpolated days (Fraser 7, Columbia 2, Nooksack 2). No extrapolation; unknown streak starts remain unavailable. Insights disclose the threshold, reference dates, interpolation count and retrospective qualification, and flag estimated inputs/dependent streaks. Definitions and endpoint provenance are included in JSON exports. The app adapter preserves these producer values without recalculating them and rejects mixed methods/provenance drift. Full-history fitting and two-sided interpolation use future observations: this metric is model-ineligible, not an operational backtest feature. See the [canonical producer contract](../../../../Toolkits/toolkit-hydrology/docs/CONTRACTS.md#feature-definitions).

Independent readback matched all 38,982 river-days. Raw companions remain byte-identical; every non-low-flow feature row and its floating-point bytes matched the retained previous snapshot. The original 11 missing discharge observations remain missing. Every river now has positive durations somewhere in its retained history. The running local app endpoint served all six relative definitions bound to source catalog SHA-256 `26f349bd7ef7bddb66d0bf4e414765ca68a111747466b2769be613e859ae6179`. Historical integration receipts above describe earlier source snapshots.

Current validation: 48 targeted frontend tests and 8 adapter tests passed; TypeScript, ESLint and production build passed. The producer's offline suite and current-product checks are recorded in its [validation notes](../../../../Toolkits/toolkit-hydrology/docs/VALIDATION.md). No provider acquisition, source refresh, ecological calibration or native-browser visual pass was run for this method change.

## Relative flow-pulse revision — 2026-10-18

Days since flow pulse now consumes each river's producer-computed historical P90
upward-crossing series, using interior linear interpolation only for this calculation.
Zero marks the crossing from below to at or above the threshold; consecutive high
days do not reset it. Initial/unfilled-gap event history remains unavailable until
a known crossing. Insights disclose the threshold, reference dates, interpolation
count and retrospective/model-ineligible qualification; support labels identify
estimated inputs/dependent pulse history. The bottom chart note and JSON exports
carry the revised meaning and complete producer definitions.

The adapter rejects mixed pulse methods and inconsistent method/reference identities.
Independent producer readback matched 38,982 river-days and preserved raw companions
and every non-pulse metric, including low-flow duration. All 11 original flow gaps
remain missing. The local app endpoint served six P90 definitions bound to source
catalog SHA-256 `f0b25f204786784f0ec7930b1e0773f75ddd36c3ff416d9818d29ca7798ce02a`.
Current checks: **50 targeted frontend tests and 9 adapter tests passed**, along with
TypeScript and ESLint. The production build passed. Canonical method, thresholds and
producer/settings checks are in the [owner validation record](../../../../Toolkits/toolkit-hydrology/docs/VALIDATION.md#relative-flow-pulses-and-local-run-settings--2026-10-18).
No native-browser visual pass, live acquisition or ecological calibration was run.


## Relative high-flow duration — 2026-10-18

Flow indicators now includes High-flow duration: consecutive provider days strictly
above each river's historical P90, with zero at/below P90 and unavailable values for
unknown starts. The producer uses interior-only linear interpolation for this derived
calculation, leaving measured discharge gaps intact. Insights show the threshold,
reference dates and interpolation count, and disclose estimated/dependent streaks.
The history note and JSON export include the P90 method and complete definition.
The read-only adapter checks method/reference identities, thresholds and source
checksums; absent high-flow definitions or mixed methods fail closed.

All six rivers have high-flow spells in their retained 2009-01-01–2026-10-15 history.
Independent producer verification and browser-cache readback matched all 38,982 new
values; cache statuses and reasons also matched. All earlier metrics, including low
flow and pulse timing, were preserved exactly; all 11 original flow gaps remain
missing. The running local endpoint served the new variable and six definitions
bound to catalog SHA-256
`caf259097523e72774799e4c8ff7055999527d6f96a9431713f40684e277cc0e`.
Current validation: **56 targeted frontend tests, 10 adapter tests**, TypeScript,
ESLint and production build passed (existing large-chunk warning). See the
[producer validation record](../../../../Toolkits/toolkit-hydrology/docs/VALIDATION.md#relative-high-flow-duration--2026-10-18)
for thresholds, checks and retained-source evidence. No native-browser visual pass,
live acquisition or ecological calibration was run. Full-history fitting and two-sided
interpolation remain retrospective/model-ineligible; future history may revise values.


## Four additional US rivers — 2026-10-20

The native reader now accepts exactly the original six-river roster or the approved
ten-river roster adding Puyallup, Elwha, Skokomish and Queets. Partial/unknown roster
changes still fail closed. Source checksums, station/river identity, provider dates,
calendar completeness, nulls, flags, qualifications and relative-feature provenance
remain checked. Four stable river colors were added; the six existing colors are
unchanged. No shared map/page/routing or Governance code changed in this scope.

Validation: 12 Python reader tests passed, 35 focused frontend tests passed, and
TypeScript no-emit checking passed. The current retained product read back as ten
rivers, eleven unsnapped mouth references, 6,497 provider dates and ten available
display metrics; source values and nulls were preserved. Final acquisition is
execution-complete for 2009-01-01–2026-10-15: Puyallup, Elwha and Queets each
have 6,497/6,497 discharge observations; Skokomish has 6,152 with 345 source gaps.
All four temperature calendars remain null/unavailable/unsupported. The current
process-owned reader and running localhost endpoints passed checksum-bound native
and influence readback. Source catalog SHA-256:
`611057e00110c339009dd3e524a70e9fa1b3459be2e360253d6bc3dfca48998e`.
All 48 original river files remain byte-identical. The rebuilt influence product
preserves all six original logical factor arrays and its retrospective/model-ineligible
flags. Native-browser visual QA was not rerun for the roster/color additions.
