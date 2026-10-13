# Viewshed app integration — 2026-10-11

The Viewshed page consumes the completed regional pilot, with a full-page map and a collapsed Settings toggle. Land source clicks load saved per-source target scores; Target view shows the equal mean of all source cells. A floating target inspector retains nullable complete scores, lower/upper bounds, uncertainty and spatial support. Settings contains mode, source, display metric, keyboard target selection and provenance; Escape closes the panel and returns focus to its toggle.

## Source and numerical evidence

- Producer contract: `bounded_regional_classified_viewability_pilot_v1`, research scenario, not an empirically calibrated or promoted release.
- Input pair parquet SHA-256: `0e24f3283fe0b46aa4fe59d7fa066bd553755b7e255bf5231124ea51ced82168`.
- Browser snapshot: `99f3ef988a0a3eb54854dd0d5b4328bf343c40fd089e835d4751bb42922a04fe`.
- Exact JSON readback against the input Parquet passed for **all 47,295 pairs in 163 source assets**; stored zero, null, bounds, sampling fields and support counts were preserved without rounding.
- Independently regrouped input rows and checked **all 1,279 target means** against `math.fsum(field) / 163` for lower, upper and unknown fractions, within `1e-15`; null complete scores remain null whenever any contributing modeled pair is unresolved.
- All browser asset checksums verified. Shared geometry/averages are 2,349,011 bytes; the default Dungeness source partition is 113,454 bytes. The browser does not load all pair partitions to select a source or display target means.
- Dungeness → `8728d1818ffffff`: lower 49.9%, upper 62.5%, complete score unknown, uncertainty 12.6%, 4,983 water lattice points, 15 observer samples. Target view for the same cell: lower 5.6%, upper 13.6%, denominator 163, 108 sources with modeled water in reach and 55 outside reach. Browser values matched the cached source values after display rounding.

The target average is a mean of per-source, in-reach-water-portion scores. Its denominator includes every source; no modeled target water points in reach contributes zero under this completed producer contract. Missing vegetation or roof inputs inside a modeled pair retain bounds/nulls. Each source can support a different portion of an edge target cell: this is not a whole-target-water-area mean. Display polygons are clipped separately to land/water and simplified by 15 m; scores and native H3 R7 identity are unchanged.

## Browser checks

Live Vite app checked at `http://127.0.0.1:5173/#viewshed`, with the real local cache. Desktop 1280 × 900 and phone viewport 390 × 844 were checked; the temporary viewport override was reset afterward.

- Full available page below the 62 px app header is map; Settings is collapsed on entry. MapLibre fills the viewport and supports wheel/trackpad zoom, dragging, pinch zoom, double-click zoom and keyboard navigation; scientific overlays occupy their true geographic positions.
- Source-cell map click changed to Sequim coast; water-cell map click opened its independent target inspector. Mixed coastal H3 source/target roles remain separate shapes.
- Target view rendered 1,279 targets, with all-source denominators and bounds visible in the floating inspector.
- Complete score displayed unknown and gray for unresolved pairs; changing to upper estimate retained the upper bound. Lower/upper/complete/uncertainty originally used a fixed 0–100% domain; the color-scale follow-up below adds explicit adjustable display limits without changing these stored quantities.
- Settings opening/closing, mode changes, source/target pickers, Escape focus return, zoom/reset and inspector dismissal were exercised. Phone settings and inspector scroll within the page without horizontal document overflow (390 px document width).
- Browser console recorded zero warnings/errors during the final flow. No MapTiler key is required: the viewshed map uses MapLibre with OpenFreeMap Bright, matching the inspected OrcaCast_Public map configuration. Geographic labels remain above source/target overlays; provider attribution and an imperial distance scale remain visible. A clearly labeled local SVG coastline fallback offers Retry basemap if WebGL or the style cannot load.

Screenshots are stored in the task's local `viewshed-app` evidence directory: `target-view-desktop.jpg`, `target-inspector-desktop.jpg`, `source-view-desktop.jpg`, `target-view-mobile.jpg`, `target-inspector-mobile.jpg` and `settings-mobile.jpg`. Earlier captures from the sidebar draft are superseded by these final captures.

## Checks and boundaries

`npm run typecheck`, `npm run lint`, `npm test` (**69 tests across 16 files**), `npm run build`, `git diff --check` and the exporter contract suite (**5 Python tests**) passed. Build retains the existing non-blocking MapLibre chunk-size advisory. Tests include byte corruption/retry, missing caches without fixture fallback, score/null constraints, all-source denominator integrity, late response rejection, source/target role separation, mode/display changes, routing and the Settings toggle.

No OrcaCast_Public files, toolkit code, source artifacts, scoring assumptions or acquisition state were modified for this integration. Existing app work was preserved. The cache is Git-ignored and copied into the local build; no commit, push, deployment or redistribution was performed. Field validation, Canadian vertical datum qualification, source acquisition and production promotion remain outside this consumer change.

## Geographic basemap follow-up

The user requested the full-page base map from OrcaCast_Public with scroll zoom. Read-only inspection of that checkout's `src/features/map/buildLayers.ts` and `ForecastMap.tsx` established OpenFreeMap Bright with MapLibre and direct gestures (`cooperativeGestures: false`). This app uses the same default style URL, permits `VITE_BASEMAP_STYLE_URL` to override it, and bundles the MapLibre 6 worker through Vite. No sibling code imports, data consumers or scoring changes were introduced.

A fresh real-cache preview loaded vector tiles, roads and geographic names with no console warnings/errors. Native wheel input at the map changed the visible distance scale from **10 mi to 5 mi**. A direct land-cell click selected `8728d194effffff` and cleared stale target values while its partition loaded. Selecting Dungeness then clicking water selected `8728d1819ffffff`: lower **44.9%**, upper **63.3%**, uncertainty **18.5%**, complete score unknown, and **4,977** supported water lattice points. Target mode preserves the camera and renders the all-source averages. Settings scroll is contained in the floating panel.

The added renderer suite checks direct gesture configuration, separate land/water sources for mixed H3 keys, placement below geographic labels, fresh click callbacks, selection/color updates without camera replacement, zoom/reset controls, timeout cleanup, and labeled WebGL failure/retry. The page suite uses the deterministic local renderer; the real basemap is checked separately with mocked MapLibre lifecycle and live browser evidence.

Current screenshots live in the task's `viewshed-basemap` evidence directory; prior `viewshed-app` screenshots document the superseded SVG presentation. The basemap makes browser requests for style, glyph, sprite and tile assets. Scientific values and H3 overlay polygons stay local; the tile provider receives ordinary map viewport requests. This remains local app/UI validation, without a deployment or publication.

## Adjustable color-scale follow-up

Settings now contains Color palette and Color scale, plus percentage minimum/maximum inputs for Custom range. Viridis and Auto range are the defaults to reveal small differences. Other choices are Ocean blue, Warm glow, Blue to red, full 0–100% range and ten quantile classes. Auto/quantile statistics use every modeled target in the current source/target mode, not only visible map cells. Their range can differ between source selections; the legend always displays the current numerical percentage limits. Fixed/custom limits persist across source/mode changes for visual comparisons.

Custom limits affect only color saturation. The legend labels saturated endpoints and counts targets beyond the limits; raw scores, uncertainty bounds and all-source denominators remain unchanged. An empty or invalid input leaves the last valid range applied with an explicit message. Unknown complete scores stay gray and never become zero or contribute to scale limits. Constant and all-unknown layers display explicit legend states. Both the MapLibre renderer and local fallback use the same scale. Color updates preserve the map camera.

The real pilot's target-mode lower scores span **0–5.71%** (legend rounded to three significant digits), rather than 0–100%. A manual 0–3% range reports **120 targets** above the upper color limit. Palette/range changes were checked against the live map and legend, including the original score in the floating inspector, invalid limits, quantiles and narrow-screen Settings. Evidence lives in the task's `viewshed-color-scales` directory. The added numerical and interaction checks bring the app suite to **65 tests in 15 files**; type checking, lint, build and whitespace checks pass. This is display-only work; no source data or viewshed calculations changed.

## Right-click coordinates

Right-clicking the geographic map now opens a compact nonmodal coordinate popup, without changing the selected source or target. It uses the actual clicked MapLibre longitude/latitude, formats latitude first to six decimal places, normalizes repeated world longitudes, and offers selectable text plus Copy coordinates. The popup follows the geographic anchor during map movement, stays inside the viewport near edges, and dismisses by Escape, Close coordinates or a normal map click. The local SVG fallback inverts its complete screen transform, including zoom, pan and viewBox scaling, to recover the clicked position.

A real right-click returned `48.253230, -123.102776`; Copy coordinates resolved through the browser Clipboard API and showed Copied. Native clipboard paste readback could not be confirmed through browser automation: its separate virtual clipboard had no data, so this is Clipboard API/UI confirmation rather than an independently observed OS paste. The temporary local clipboard test tab/file were removed. Reopening near the lower-right map edge and Escape dismissal were checked visually. Tests assert exact clipboard payload/order, six-decimal formatting, longitude wrapping, no negative zero, rejected-write handling, viewport clamping and right-click independence from viewshed selection. All **69 app tests**, type checking, lint, build and whitespace checks pass. Scientific values, source/target identity and basemap configuration are unchanged.


## Map-first UI refactor — 2026-10-12

The current UI supersedes the earlier layout descriptions above. It defaults to the all-source target mean with Blue to red / Auto range and no selected H3. The active context moves into the existing header; the title card and regional-statistics card are gone. A 240 px upper-right stack contains the active legend, Settings and real camera controls. Small presentational components own the legend, cell inspector and portaled zoom controls; `ViewshedPage` owns one mutually exclusive panel union (Settings, role-qualified cell selection, coordinates, or none). The analytical source selection is separate from cell highlighting.

Source inspectors show existing observer count, land fraction, source-pair coverage and H3 support. A source cell has no single stored target score, so no new score aggregation was introduced. Water inspectors retain the exact cached metrics, nulls, lower/upper bounds, source denominators and reach diagnostics; source-pair inspectors also expose the existing sampled-water-point count. Both provide qualification and hashes. Settings preserves all prior applicable options, plus working H3 outline visibility and target fill opacity; selection outlines stay visible with the grid off. Single-source options appear in Source view; source and water inspection are accessible through the keyboard controls. Model-input rasters have no invented display toggles.

Focused tests cover no initial selection/panels, quiet hover (including removal of SVG cell tooltips), role-qualified selection, one inspector, switching, background/X/Escape dismissal, Settings mutual exclusion and outside dismissal, retained configuration, real camera controls, dynamic legend limits, original null/score preservation, overlay opacity/outlines and coordinate exclusivity. The fallback retains selection when zooming and closes coordinates when panning. A lifecycle guard prevents painting a replacement MapLibre instance before its scientific layers exist, including during development hot reload.

Live real-cache QA used 1280 × 900, 390 × 844 and 320 × 568 viewports. Verified the default state, changing target cells, empty click, X/Escape/outside dismissal, retained metric, coordinate popup replacing inspection, successful Copy feedback, zoom buttons, wheel zoom and dragging. Mobile sheets scroll independently; close buttons stay visible after scrolling, attribution/scale remain accessible, and no document-width overflow occurred. At 390 px the control stack ends at y=406 and the inspector starts at y=450. At 320 px Settings starts below the stack, and the header subtitle stays within the 62 px header after the specificity fix. Actual touch hardware and independent OS paste were not re-tested; direct touch gesture configuration and clipboard/error behavior remain covered by the renderer/component suites.

Evidence directory: `/Users/tylerstevenson/.codex/visualizations/2026/10/11/01a12b5c-247b-7e63-a870-f6f568246fdc/viewshed-simplified/`: `desktop-default.jpg`, `desktop-inspector.jpg`, `desktop-settings.jpg`, `mobile-default.jpg`, `mobile-inspector.jpg`, `mobile-settings.jpg`, `small-mobile-settings.jpg`, `small-mobile-custom-scale.jpg`. Mobile sheet height follows the measured control stack, including extra legend annotation rows. The initial before-layout capture preceded tile loading. The default and inspection captures show loaded real basemap tiles and the existing pilot overlays.

Validation: `npm run typecheck`, `npm run lint`, `npm test` (74 tests / 16 files), `npm run build` and `git diff --check`. The build retains the existing non-blocking MapLibre chunk-size advisory. No toolkit, acquisition, exporter, numerical scale implementation, cached scientific data or seascape page changes were made in this refactor. No geospatial recomputation, empirical qualification, publishing, commit or deployment was performed. Earlier numerical readback and exporter evidence above is historical, not newly executed for this UI change.

## Minimal corner controls — 2026-10-12 follow-up

The user's follow-up supersedes the unified-stack layout above. Settings is now an icon-only, accessible 44 × 44 px button at top right. Zoom in/out sit at bottom right, at the same 44 px width, and the recenter button is removed in both renderers. The bottom-left color bar follows the Map page's light, compact gradient/ticks style. Land/unknown keys, averaging narrative, metric heading and palette/mode caption are removed from the visible legend. Dynamic percentage endpoints, midpoint, quantile colors and saturated endpoint signs remain; class/saturation diagnostics live in Settings. Underlying colors, score values, missingness, selection behavior and camera gestures are preserved.

The map-controls wrapper passes pointer events through its empty area. Desktop inspectors sit beside Settings; mobile sheets leave room below for the color bar, zoom buttons, scale and attribution. The old stack-height observer has been removed. Current evidence is `viewshed-simplified/minimal-desktop.jpg`, `minimal-mobile.jpg` and `minimal-mobile-settings.jpg`; earlier screenshots document the superseded layout.

Validation: typecheck, lint, all 74 tests in 16 files, production build and whitespace checks passed. Live desktop and mobile checks verified the simplified labels, equal Settings/zoom widths, icon toggle, zoom actions and panel containment. The existing MapLibre bundle-size advisory remains. Physical touch hardware, numerical recomputation and scientific qualification were not rerun for this display-only follow-up.


## Bottom overlays removed — 2026-10-12 follow-up

Removed the MapLibre distance scale and bottom attribution strip at the user's request. Default OpenFreeMap / OpenMapTiles / OpenStreetMap links remain in Settings → Basemap credits. The existing Map-page controls and scientific metadata are unchanged. This is a local preview; public presentation must restore appropriate attribution. The OSMF [attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) distinguish internal use from public presentation. No publication or redistribution is part of this change.

The renderer test checks that no native controls are added; the settings test checks the retained copyright link. Typecheck, lint, all 74 tests, build and whitespace checks passed. Live browser QA checked the clean bottom edge and credits accessibility. Evidence: `viewshed-simplified/no-bottom-overlays-desktop.jpg`.


## Clickable color bar and log coloring — 2026-10-12

The bottom-left bar opens a light popup above itself with four palette swatches, target opacity and coloring methods: Value range (min–max), Full range (0–100%), Log (value range), Custom range and Quantiles. `ViewshedColorControls` supplies both this popup and Settings from the same parent state. The parent panel union includes the legend popup; opening it dismisses cell inspection or Settings, and selecting a cell dismisses it. Trigger toggle, X, Escape (with focus return) and outside clicks dismiss the popup while retaining all display choices. Default entry remains just the closed color bar. Coloring changes preserve the camera.

Log is a display transform: for raw score fraction `s`, interpolate colors linearly in `ln(1 + 100s)` between the active minimum and maximum. This gives a fixed, explicit zero-safe offset of one percentage point. Raw legend edges are inverse-transformed (`expm1(x) / 100`), with exact raw endpoints retained. No epsilon floor, null filling, target-score modification or scientific kernel changes are introduced. Zero remains an endpoint color, unknown complete scores remain gray, and constant/all-unknown cases retain their established behavior. A reusable transformed scale is created once per display change; renderers perform one log transform per plotted value.

New tests cover popup palette/method/opacity changes and their synchronization with Settings, toggle/X/Escape/outside/cell dismissal, focus return, retained raw inspection, log endpoints and inverse midpoint, zero/unknown/constant handling and immutable input scores. All 77 tests in 16 files, typecheck, lint, production build and whitespace checks passed; the existing MapLibre size advisory remains.

Live real-cache QA checked 1280 × 900, 390 × 844 and 320 × 568. Viridis + Log showed unchanged endpoints of 0–5.71% and an inverse-transformed midpoint of 1.59%; keyboard opacity changes updated the map and Settings to 40%. The small-phone popup stays within x=10–250 and y=144.5–492.5, scrolls independently, leaves the trigger and zoom buttons accessible, and has no horizontal document overflow. Physical touch hardware and new empirical scientific validation were not run. Evidence in `viewshed-simplified/`: `color-popup-desktop.jpg`, `color-popup-log-desktop.jpg`, `color-popup-mobile.jpg`, `color-popup-small-mobile.jpg`.

## Features-aligned control layout

Viewshed now uses the shared tool drawer alongside its bottom-left legend. Legend, tools and Layers are 50 px high on one baseline; Layers opens upward at bottom right and zoom sits directly above it. Settings and Help are reachable through Tools. Settings preserves view/source, score field, outline and keyboard cell-inspection controls; Help preserves methods, credits, qualification and input hashes. The former top-left selector and top-right Settings button are removed. Popup and inspector surfaces match Features' light styling.

The drawer expands right on desktop and above its trigger on narrow screens. Popups are mutually exclusive and dismiss through Escape, outside click or explicit close, restoring trigger focus for keyboard dismissal. Scores, bounds, missingness, native geometry, source/target roles, all-source and conditional denominators and camera behavior retain their existing implementations.

Validation: all 96 tests across 18 files passed with two workers, including the updated Viewshed interactions and the existing Features drawer checks. Type checking, lint, production build and `git diff --check` passed. Native browser checks covered desktop, 390 × 844 and 320 × 700, including source/target mode, layer changes, tools, legend, Settings, Help and qualification access. The existing MapLibre bundle warning remains. This is consumer UI validation; no producer preparation, empirical/regional qualification or remote publication was run.
