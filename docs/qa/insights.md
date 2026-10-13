# Dataset Insights QA — 2026-10-12

Result: passed.

## Contract

Features and Viewshed use `DatasetInsights`, with pure statistics in `src/data/insights.ts`. Numeric summaries retain original units and finite values; null/invalid values are separate. Cells are equally weighted, without geographic resampling or viewport filtering of the summary. Categories retain source identity, including Boolean false. Histograms use 24 equal-width bins; the five distribution rows count the same available support. These analytical ranges are independent of the map coloring method. Selected cells retain exact native identity and provenance. Viewshed source and target scientific meanings remain unchanged.

Layer loading clears old summaries. Errors render an alert rather than old values. All-null/empty support renders no numeric statistics or fabricated bars. Constant support uses one bin. Comparison selection and clicked-cell side select the appropriate original layer; source slices and metadata follow their own product. Publication timestamps are displayed only when provided for that dataset, not borrowed from another product.

## Independent cache checks

Python standard-library `statistics` calculations over the installed source column cache independently matched the UI summaries:

| Bathymetry | Native R6 | Native R8 |
| --- | ---: | ---: |
| Total cells | 2,621 | 88,243 |
| Available | 2,494 | 80,392 |
| Unavailable | 127 | 7,851 |
| Minimum (m) | 1 | 1 |
| Maximum (m) | 1808.6435643564357 | 1764.6 |
| Mean (m) | 112.83185261279216 | 117.66040526420541 |
| Median (m) | 73.35395754484121 | 75.5 |
| Five range counts | 2401, 56, 19, 13, 5 | 76556, 2649, 680, 407, 100 |

Native R8 generalized-fallback categories showed false 82,194 and true 6,049, with no numeric means. R8 bathymetry anomaly retained signed source meters after Standardize: available 79,528; unavailable 8,715; minimum -449.7; maximum 327.8. Comparison switched summaries independently. Native cell `8828d1b13bfffff` showed 120.6 m and centroid 48.275157, -123.382459 with its raw source qualifiers.

Viewshed all-source lower estimate showed 1,279 available targets and no missing values, mean 0.913% and maximum 5.71%. Complete-score inspection retained Unknown, lower/upper range, conditional source support and denominator 163. Source `8728c2481ffffff` complete scores showed 163 available zeros and 63 unavailable values; the constant histogram and single distribution range retained that distinction. These checks validate the consumer display, not empirical calibration.

## Browser and responsive evidence

In-app browser native MapTiler and OpenFreeMap renders were checked. Viewports: desktop 1006×1020, phones 390×844 and 320×844, tablet 800×768, density 1. No horizontal document overflow. Desktop sidebar is 350 px wide at right 16 px, with Layers/zoom left of it. At phone widths the scrollable sidebar ends 176 px above the map bottom, leaving zoom and the dock reachable. Palette and Layers popups, Viewshed Settings and Help stack above the pinned sidebar. Escape closes the local popup first and restores its trigger; the next Escape closes Insights. Active palette changes, native R8 selection without zoom, source-mode switching, selected-cell inspection and comparison were verified.

Evidence directory: `/Users/tylerstevenson/.codex/visualizations/2026/10/12/01a1325d-08fd-7f22-b187-e613f7b82fe4/`.

- `insights-desktop-final.png`: native R8 Bathymetry with selected cell and compact source-quality disclosure.
- `insights-collapsed.png`: upper-right tab with panel collapsed.
- `insights-mobile-final.png`: phone panel with accessible dock/zoom.
- `insights-viewshed-final.png`: native target-view complete-score panel and scientific inspector.
- `insights-viewshed-mobile.png`: source-view complete scores and explicit missing support.
- `insights-comparison-final.png`, `insights-panel-comparison-final.png`: final reference/implementation full and focused comparisons.

No new Features or Viewshed browser console errors were observed. Phone checks used viewport emulation, not physical devices. Features/Viewshed data and source releases were not changed. The existing other pages remain explicitly demo-backed; no invented insights were added there.

## Owner validation

Passed: `npm run lint`, `npm run typecheck`, `npm test -- --maxWorkers=2` (103 tests across 20 files), `npm run build`, `git diff --check`.

The production build retains >500 kB chunk-size advisories. Tests cover signed/end-point bins, null/zero support, constant/all-null/empty support, finite extreme values, strict category identity, open/close/focus, comparison/native-resolution updates and Viewshed metric/source/selected-cell integration. No new acquisition, empirical qualification, physical-device validation or publication was performed.


## Comparison legends follow-up

Compare mode now labels both collapsed colorbars with side and active dataset. Each retains its native range, units, missing-value handling and separate color-options dropdown. Desktop legends occupy opposite sides of the bottom dock; phone/Insights layouts stack them at bottom left. Both triggers remain 50 px tall, matching Tools and Layers. Names truncate visually in narrow cards, with full names retained in the trigger title. Single-map legends remain compact.

Native browser checks at 1280×720, 390×844 and 320×844 verified distinct bathymetry/anomaly ranges, right-dropdown access while Insights is pinned, no document or trigger overflow and no overlap with Layers/zoom. Evidence: `compare-legends-desktop.png` and `compare-legends-mobile.png` in the evidence directory above. Integration assertions verify both visible names and distinct source ranges, including zero.

Current follow-up checks: lint and whitespace passed; all 110 tests across 22 files passed with `npm test -- --maxWorkers=1`. The initial two-worker run timed out in an existing App integration test under concurrent load; the serial run passed without increasing its timeout. Type checking/build are currently blocked by unrelated `src/components/ocean/OceanScene.test.tsx` mock-function typing errors (lines 11 and 25); ocean files appeared during this work and were left untouched. The successful 103-test/build results above describe the preceding Insights implementation.


## Paired Comparison Insights — 2026-10-12

Compare mode now has one shared panel and no side-switching selector. Blue identifies Left; copper identifies Right. Paired histograms use relative frequency over each full available native layer, with shared frequencies and common value bins when units match. Differing units use separate value axes. Box plots use linear empirical quartiles and observed minimum/maximum whiskers. Source zeros, original units and nulls are retained.

Scatter/correlations join exact H3 keys with finite numeric values on both active slices. Pearson r and Spearman rho (average ranks for ties) use every complete pair, independently of viewport or point cap. Counts report complete pairs and union cells excluded for missing/unsupported values. A deterministic scatter subset of approximately 1,200 points is labeled when used; selected complete cells are included. Constant or insufficient paired variation reports unavailable correlation. Category comparisons retain raw frequencies and explain that numeric plots require numeric layers. Selected cells show both values and side-specific qualifiers; both source releases/slices remain accessible.

Temporal plots load only when the panel is open and both fields declare parseable calendar axes. Recorded instants align at matching time grain without resampling, include the union of available periods, preserve gaps, and mark unavailable boxes rather than filling zero. Directional bearings and static year-valued fields do not create time axes. Each period's tooltip retains quartiles, available count and unavailable count. Matching units share a value axis; differing units use separate plots. The same horizontal scroller drives both plots while fixed value axes stay visible. Failed periods remain unavailable with listed errors. Cancelled/older field reads cannot replace the current timeline. Only original value columns and checked native support are loaded; qualifiers are retained on the current selected-cell paths.

Independent Python statistics checks over the actual ignored column cache matched the UI:

| Native comparison | Pairs | Pearson r | Spearman rho |
| --- | ---: | ---: | ---: |
| R6 Bathymetry / local anomaly | 2,277 | 0.3476660420549712 | 0.40442543462020336 |
| R6 2024 annual mapped extent / positive water fraction | 68 | 0.5360229880926042 | 0.8120777188227659 |
| R8 2024 annual mapped extent / positive water fraction | 588 | 0.8658545421231427 | 0.9014462021956028 |

R6 bathymetry quartiles independently matched 32.064611203078165, 73.35395754484121, 134.9858958183129 m. R6 1989 annual fraction had 44 available/2,577 unavailable cells and quartiles 0.005203664891813828, 0.01890899460257258, 0.04989190115513607. In 2024 it had 68 available/2,553 unavailable and quartiles 0.006631885534255106, 0.03500951828747606, 0.07591912581963933. All 35 recorded survey years loaded at R6 and R8; missing 1993 was never manufactured. Native cell `8628dc91fffffff` showed original mapped extent 0 m² beside unavailable fraction, with source qualifiers retained.

Browser checks covered common/different units, single paired time plot and separate-unit time plots, native R6/R8, both selected values, histogram/box/scatter scrolling, keyboard timeline scrolling through 2024 with fixed axes, and 1006×1020, 390×844, 320×844 viewports. No horizontal document overflow. Long/tiny-value comparison legends now keep units visible in their captions; phone legends show endpoints with scientific formatting where needed rather than wrapping over adjacent controls.

Evidence in the directory above: `compare-insights-histograms.png`, `compare-insights-correlation.png`, `compare-insights-time-series-r8-final.png`, `compare-insights-paired-time-mobile.png`, `compare-insights-mobile-final.png`. Final visual/interaction QA passed. These are consumer checks, not new ecological inference or empirical source qualification.

Final gates: lint, typecheck, full 121-test suite across 26 files, production build and whitespace check passed. After the last compact-legend label adjustment, all 22 affected App/Insights/legend/timeline/page tests across six files, lint, typecheck, build and whitespace checks passed again. The production build still reports >500 kB chunk advisories. Native final interaction checks recorded no browser console errors. Final paired-box/correlation evidence: `compare-insights-final.png`. No acquisition, producer/release changes, physical-device testing, publication or commits were performed.
