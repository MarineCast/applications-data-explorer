# Complete local Data map integration

Verified 2026-10-12 in `applications-data-explorer`. This is local consumer integration,
not new provider acquisition, scientific qualification, producer promotion or deployment.
Pre-existing application changes and the separate Viewshed research-pilot integration were retained.

## Source inputs and cache

- Seascape: `../../Data/seascape/releases/seascape_consolidated_static_native_r6_r8_20261008_v5`.
- Governance: `../../Data/governance/releases/governance-shared-study-20261010-v2`.
- Annual kelp and directional coastal rays: exact existing sidecars bound by seascape v5.
- Active ignored browser snapshot: `11ccf6c60644779affeb7a2596e6fc545f1fecbaf057546bd5643755e6706dbd`.

`scripts/prepare_map.py` verifies the supplied release/generation members and sidecar hashes,
preserves native row order and every original non-key field, and independently reads each encoded
column back before atomically replacing the browser catalog. No producer files were edited.
Asset hashes and explicit source checksums bind the browser data. Prior browser snapshots remain.
The adapter supports existing v1 seascape caches and the new v2 multi-product catalog.

| Product | Resolution | Native rows per slice | Slices | Preserved non-key fields per slice |
| --- | ---: | ---: | ---: | ---: |
| Seascape static | R6 | 2,621 | 1 | 340 |
| Seascape static | R8 | 88,243 | 1 | 487 |
| Governance inventory | R6 | 2,621 | 1 | 172 |
| Governance inventory | R8 | 88,243 | 1 | 172 |
| Annual mapped kelp | R6 | 2,621 | 35 | 15 |
| Annual mapped kelp | R8 | 88,243 | 35 | 15 |
| Directional coastal bounds | R8 | 88,243 | 16 | 28 |

The catalog contains 1,132 resolution-specific map entries, including measurements, nullable
placeholders and categorical/boolean qualification fields. This is not a count of independent
scientific variables. IDs, provenance strings, methods and serialized inventories remain in the
inspector. R6 parent IDs were explicitly excluded from map categories while retaining their values.
Every original field in a selected seascape namespace is inspectable.

Independent verification decoded and compared every exported field against source Parquet across
90 tables/slices: 4,773,856 native rows and 2,669 column readbacks. It also checked every asset hash
and exact native cell order. The final snapshot has byte-identical data asset hashes to this independently
verified snapshot; only catalog labels and exclusion of parent IDs from map selection changed.
Evidence: `/private/tmp/marinecast-map-cache-readback.json`, with the independent checker at
`/private/tmp/verify-marinecast-map-cache.py`. The active cache retains its own `validation.json`.

## Product behavior and scientific limits

- Data product selects Seascape, Governance, Annual kelp or Directional coastal bounds.
- Native R6/R8 identity is preserved. R8-only products are disabled at R6; switching resolution
  chooses a supported native feature. There is no spatial aggregation.
- Annual kelp selects one of the actual 35 recorded years, 1989–2024 excluding 1993. There is no
  daily/monthly interpolation or forward fill. Positive mapped evidence is not survey absence.
- Coastal rays select one of the actual 16 bearings. Origin-defined mapped-water bounds remain
  distinct from physical fetch; the unqualified physical-fetch field is null.
- Numeric scales use exact source numbers. Categorical and boolean maps use explicit source labels
  and a category key, with no numeric interpolation or standardization of category codes.
- All-null values remain gray and selectable. Coverage/status fields remain explicit. Numeric zero
  is never substituted for unknown data.
- Governance includes all 86 measurement fields and their 86 status fields. Its research/model-ineligible
  semantics remain visible; recorded geometry does not establish current law or exhaustive jurisdiction.
- Native governance geometries/attributes and the feature-by-cell fishing-area identity crosswalk
  remain companion products; no record counts are silently summed into H3 metrics.
- Comparison may use different products at one native resolution, with independent variables,
  legends and year/bearing selections. Changing a variable retains its chosen year/bearing. Inspection/export follow the selected comparison side.
- Local JSON export preserves original numbers, strings, booleans, nulls, qualifiers, native H3 IDs,
  source hashes and selected year/bearing. Category codes used for color lookup are not exported.
- `Data/viewshed` remains readiness-only. Its absent metrics are identified in Layers; the separate
  Viewshed page retains its explicitly sourced existing research pilot.

## Browser evidence

Verified in the actual app at `http://127.0.0.1:5173/#map` with MapTiler cartography:

- Governance R6 cell `8628d16c7ffffff`: ports recorded feature count **2**, status **partial**;
  inspector showed the governance v2 source path/hash and research-only limitation.
- Annual kelp R6 cell `8628dc947ffffff`, survey year **1989**: mapped bed extent in full H3
  **1307667.629882399 m²**. The inspector retained survey season, unknown survey absence,
  mapped-water support and spatial-processing qualifications.
- Terrain R8 cell `8828d1a049fffff`: original category **LOW_SLOPE_NEUTRAL_TERRAIN_PROXY**.
  Five terrain classes were listed in the legend, with exact source/qualification fields in inspection.
- Directional coastal bounds offered all 16 bearings; choosing **E / 90°** loaded its own source slice.
- Governance versus annual-kelp comparison had separate count/area scales; survey-year switching
  changed only the corresponding native slice. Mobile selectors remained operable at 390 × 844;
  the layer panel now stacks above the second comparison legend.
- Actual browser category export `governance-GOVERNANCE__ports__recorded_feature_count_status-R6.json`
  was downloaded and independently matched all 2,621 source IDs and original `partial` strings.
- No browser warnings/errors were recorded during the product interactions. At that checkpoint, R8
  overlays required the existing zoom threshold. The follow-up below removes that requirement.

Desktop QA used 1280 × 800; mobile QA used 390 × 844. Temporary viewport overrides were reset.
Mobile evidence: `/private/tmp/marinecast-data-map-mobile.png`. Final desktop preview:
`/Users/tylerstevenson/.codex/visualizations/2026/10/12/01a1325d-08fd-7f22-b187-e613f7b82fe4/data-map.png`.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: **86 passed across 16 files**.
- `python -m unittest discover -s scripts -p 'test_prepare_map.py' -v`: **3 passed**.
- `npm run build`: passed with the pre-existing MapLibre chunk-size warning.
- `git diff --check`: passed.

Checks cover native support, source checksum rejection, malformed values, separate product bindings,
exact zero/null handling, categorical labels, absent-year rejection, resolution fallback, category
standardization exclusion, existing comparisons/exports and unchanged Viewshed flows. Fixture tests
are consumer software evidence. No new regional/provider or empirical science run was performed.
The generated local cache is ignored by Git and included in local `dist/` when built. Nothing was
published, uploaded, pushed or merged.


## Legend alignment with Viewshed

The Map legend now uses the Viewshed page's compact bottom-left placement and upward color-options
popup. It has matching palette swatches/radios, a Map colors heading and close button, a coloring-method
select and opacity slider in 5% steps. Existing Equal bins, Quantiles and Min/max calculations and
source units remain unchanged; categories keep their category key. Closing, reopening or changing
panels retains display settings. No viewshed-specific percentage domain is imposed on other variables.

Color options dismiss through Escape, the close button, toggling the bar or an outside pointer click.
Escape and explicit close return focus to the trigger. Opening the popup clears cell inspection and
closes Layers; opening Layers, Help, Export or a cell closes color options. Comparison allows one
popup at a time, with each legend at the bottom left of its own map. On mobile the maps remain stacked,
popups scroll within their map's available height, and the close heading stays accessible. The mobile
cell preview sits above the legend.

Verified live at the normal desktop viewport and 390 × 844: palette/method/opacity changes, retained
settings, close/toggle/Escape/outside dismissal, Layers exclusion, cell-preview exclusion, and single
versus comparison placement. The Viewshed page was inspected as the visual reference and was not
modified. Browser warning/error logs were empty. Mobile screenshot: `/private/tmp/marinecast-legend-mobile.png`.

The full 86-test suite, lint, type checking/build and `git diff --check` passed. Interaction checks were
updated for the new method select, close/focus behavior and mutually exclusive comparison popups.
No source data, numeric scale calculations, release pointers or producer code changed.


## Remove the illustrative preload

The Map's lazy geographic-renderer fallback now contains only a plain neutral loading state.
Previously it rendered the local SVG coastline and native hexagons before MapTiler loaded, causing
an illustrative-map flash. Native Data maps also show an explicit missing-key message or a
basemap error with Retry rather than switching to that illustration. Source layers, controls and
exports retain their existing data. Explicit local demo widgets retain their labeled renderer.

Four regression checks cover a deliberately delayed module import with no SVG or illustrative
geometry, native missing-key handling, failure/retry and the explicitly selected demo renderer.
Page interaction fixtures now explicitly request the local test renderer; this does not qualify
provider rendering. The separate MapTiler lifecycle tests and live browser checks exercise that boundary.

A fresh live tab and reload showed zero illustrative map SVGs; the geographic renderer loaded
normally with the current native release. The initial reload reported Loading local Data catalog,
then the geographic map and source layers. Browser warning/error logs were empty. The actual
provider-error path was simulated in tests rather than by changing credentials or provider state.

Final checks: 90 tests across 17 files, type checking, lint, production build and `git diff --check`
passed. The pre-existing MapLibre chunk-size warning remains. Native values, providers, scientific calculations and release pointers are unchanged.


## R8 at overview zoom

R8 source polygons now load at the current camera zoom, including the starting overview. Both the
geographic renderer and explicitly selected local test renderer retain viewport filtering without
aggregation. Selecting an on-screen R8 cell opens its preview without changing the camera; an
off-screen selection recenters at the existing zoom. R8 outlines become thinner at overview scales
and grow with zoom so source-value colors remain visible. Selected outlines retain their width.

Regression checks verify initial R8 rendering at zoom 6.7, exclusion of an off-screen cell, exact
source values, cell selection without camera movement and validity of the MapLibre outline
expression. The page interaction check now inspects R8 categories without pressing Zoom in.

Live browser QA selected R8 immediately after a fresh reload, without camera gestures or zoom
controls. Native H3 8828d12cabfffff exposed mean depth 130.4 m at that overview. No zoom notice or
browser warning/error remained. Screenshot: `map-r8-overview.png` in this chat's visualization folder.

The 90-test suite passed using `npm test -- --maxWorkers=2`. An earlier full parallel run, alongside
the build and browser QA, timed out four interaction tests; the bounded-worker run passed without
increasing test timeouts. Lint, type checking/production build and `git diff --check` passed. The
existing MapLibre chunk-size build warning remains. No source values, native resolution, release
pointers or scientific calculations changed.


## Simplified map navigation

Removed the recenter button from both geographic and local renderers. The remaining Zoom in/out
buttons sit together at bottom right, 16 px from each desktop map edge; mobile uses a 12 px right
inset and a 16 px bottom inset respecting the safe area. Comparison places a separate pair in
each map, including stacked mobile maps. The former third-button gap is removed.

The local preview's attribution strip is removed; MapTiler and OpenStreetMap credit links are
retained in Help. Help also now correctly says R8 loads at the current zoom. This change does not
establish permission to omit attribution from a published app. MapTiler requires its linked credit
unless written permission is obtained, and OSM credit applies to the current OSM-derived basemap:
[provider requirements](https://docs.maptiler.com/guides/map-design/attribution/remove-attribution/).

Live desktop and 390 × 844 mobile checks confirmed two working zoom buttons per map, no recenter
control, no attribution strip, Help credit links, and bottom-right placement in single/comparison
layouts. Browser warning/error logs were empty. Mobile screenshot:
`/private/tmp/marinecast-map-controls-mobile.png`; desktop: `map-bottom-right-zoom.png` in this chat's
visualization folder. The viewport override was reset. All 90 tests, lint, type checking/build and
`git diff --check` passed. The existing MapLibre chunk-size warning remains.


## Map header text

Removed the Map header's Pacific Northwest / Local Data products block, including its icon and
container. The app brand and atlas navigation remain. Viewshed retains its active mode/metric
context. A live Map header readback contained only the brand and navigation labels; screenshot:
`map-clean-header.png` in this chat's visualization folder. Lint, type checking/build and
`git diff --check` passed. App, Home and Viewshed interaction checks were run for the shared header.


## Tool drawer and bottom Layers control

The native Data Map now occupies the full width beneath the header, with its sidebar removed.
A 50 px tool icon sits 8 px to the right of the bottom-left legend. The legend, tool trigger and
bottom-right Layers trigger have matching 50 px heights and baselines. The drawer reveals Compare
and Export horizontally to its right, plus a compact Help action retaining access to credits.
On narrow layouts, including narrower comparison panes, icon actions open above the trigger and
extend right within the viewport. Compare state, exact exports and selected-map identity are
preserved. Layers opens upward, stays right aligned, scrolls within available height and retains
its close header. Zoom remains at the right, above Layers.

Tool options close through a repeated trigger click, Escape, an outside pointer, choosing an action,
opening Layers/color options, or selecting a map cell. Escape restores focus to the tool trigger.
Tools and color options/Layers are mutually exclusive. Comparison retains a separate colorbar per
map; the drawer stays beside the left map's legend. On mobile, the legends remain in their stacked
map positions and Layers stays at the lower right.

Live browser checks covered desktop and 390/320 px phones plus a 720 px tablet comparison.
DOM measurements confirmed matching heights/baselines, full-width map placement, no sidebar,
right/left anchoring, no overlapping footer controls, upward Layers placement, and keyboard
dismissal/focus. Compare and Export routes worked; Help and credit links remain reachable.
Browser warning/error logs were empty. Screenshots: `map-tool-drawer.png` in this chat's visualization
folder and `/private/tmp/marinecast-tool-drawer-mobile.png`. Viewport overrides were reset.

The 91-test suite passed with two workers. New interaction coverage exercises drawer dismissal,
sidebar removal, mutual panel exclusion, Help access and exporting the selected right comparison
layer. Existing comparison/export fixtures use the new drawer. Lint, type checking/build and
`git diff --check` passed; the pre-existing MapLibre chunk-size warning remains. Source products,
values, resolutions and scientific calculations did not change.


## Wave navigation

Moved the existing six-destination dropdown beneath the top-left wave mark in shared explorer
headers. The top-bar page links and hamburger are removed from the DOM. The wave is now a
button with an expanded state and navigation association; the wordmark remains the Home link.
Mouse hover opens the menu. A 140 ms leave grace period lets the pointer reach it, and entering
the menu cancels closure. Focused menu options keep it open for keyboard use. Click/tap and
Enter/Space open it; Arrow Down focuses Home. Escape closes it and restores wave-button focus.
Leaving its region, moving focus out, an outside click and navigation also close it. Timers and
document listeners are cleaned up. Viewshed retains its active mode/metric header context.

New regression coverage exercises hover-to-option transitions, leaving the region, destination
selection, header control removal, touch opening, outside dismissal, Arrow Down, Space, Escape
and focus restoration/Tab exit. Existing page navigation fixtures use the wave trigger. Live
browser checks covered Map-to-Viewshed switching, keyboard focus/Escape, six retained destinations,
zero hamburger/top-link elements and dropdown placement on desktop and a 390 × 844 viewport.
Hover-only and touchscreen gestures were verified in the interaction suite; live browser actions
used click/keyboard controls. The mobile override was reset, and browser warning/error logs were
empty. Screenshots: `wave-navigation.png` in this chat's visualization folder and
`/private/tmp/marinecast-wave-navigation-mobile.png`.

Final checks: 93 tests across 17 files, lint, type checking/build and `git diff --check`. The existing
MapLibre chunk-size build warning remains. No data, source contracts or scientific calculations
changed.


## Geographic swipe comparison

Compare now overlays two full-viewport maps with a centered, draggable reveal divider. This
supersedes the separate-map/stacked-mobile layouts described in earlier checkpoints. The two
canvases retain identical dimensions and share center, zoom, bearing and pitch through a camera
link. Either map can lead a gesture; followers suppress rebroadcasts. A completed gesture refreshes
both native geometry sources, while in-progress camera following avoids rebuilding R8 geometry
every frame. The saved camera survives Compare toggles, resolution changes and renderer replacement.

Only the right map is clipped at the divider; all source values, native boundaries, missingness,
independent scales, qualifiers and exports remain unchanged. One zoom control operates both maps.
Controls and cell previews are rendered outside the clipped panes. The divider's handle stays
accessible over previews, while its track sits behind preview buttons so source details remain
clickable. Mobile uses the same full-height swipe surface with both legends at the lower left,
Tools beside the left legend, Layers at lower right, and previews above both legends.

Pointer capture supports dragging without starting a map pan. The boundary is clamped to 0–100%,
retains its position when source layers change, and does not jump when its handle is grabbed
off center. Arrow keys move it by 2%, Shift by 10%, and Home/End reveal a complete layer. It exposes
an accessible slider value and focus ring. Dragging dismisses transient controls/cell inspection.

Regression coverage checks captured movement/release, edge clamping, keyboard behavior, retained
divider position, bidirectional center/zoom/bearing/pitch following without loops, deferred geometry
updates, distinct original values on identical H3 geometry, late peers, cleanup and one zoom pair.
Page interaction checks retain comparison inspection and selected-map export through the swipe UI.

Live desktop QA dragged the divider and compared H3 8628d129fffffff at the same pixel: depth
148.5 m and anomaly 24.49 m. After panning, H3 8628de967ffffff again matched across the reveal, with
depth 200.5 m and anomaly 50.58 m. These are displayed rounded values, not recomputed source data.
Zoom, R8 resolution switching, mobile dragging/keyboard full reveals and source-details opening
were exercised. Both desktop canvases measured 1280 × 658 and both mobile canvases 390 × 782.
Native R8 rendered without a zoom gate. Browser warning/error logs and data alerts were empty.
The viewport override was reset. Screenshots: `map-swipe-compare.png` in this chat's visualization
folder and `/private/tmp/marinecast-swipe-mobile.png`. Touch hardware was not separately exercised;
the pointer-capture path is covered by regression tests and mobile browser dragging.

The complete 96-test suite across 18 files, lint, type checking/production build and `git diff --check`
passed. The existing MapLibre chunk-size warning remains. No producer code, source data, native
resolution or scientific calculations changed. This validates UI behavior, not scientific acceptance.
