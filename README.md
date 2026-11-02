# MarineCast Data Explorer

React + TypeScript data explorer. The Features page opens the latest prepared local Data catalog: native seascape, governance, annual kelp and directional coastal bounds. Its default layer is seascape bathymetry. A persistent localhost FastAPI service serves exact source values, nulls, native H3 keys and linked qualifiers through validated, process-owned browser encodings. No scientific variables are recomputed and no data acquisition or release promotion occurs.

The Viewshed layer in Features reads the completed regional land-to-water research pilot through a separate, ignored local cache. Relationships calculates source-backed local exploratory associations through the same localhost FastAPI service; Models and Forecasts show Coming soon pages; Data Health retains deterministic synthetic fixtures. The Features page uses source-backed local Data products. MapTiler supplies Features-page basemap cartography only; source values stay in the local app. Features mounts its map, product dock, Insights and actions immediately while source catalogs and selected layer assets load independently. The renderer is warmed in the background before navigation; geographic cartography retains its neutral loading state until it is ready and never substitutes an illustrative coastline for native data. Catalog and layer failures remain retryable over the same mounted map. Features uses one compact red warning style for source, basemap, layer, smoothing, comparison and Viewshed notices. Floating warnings share a bottom-left stack that moves above overlapping legends and timelines, retaining each retry/dismiss action and source Details. Notices inside dialogs and detail panels use the same card within their current focus context. Loading indicators remain separate. See [Features QA](docs/qa/features-review.md). Seascape overlays are full native H3 cells. Viewshed attaches its saved land/water geometry and weights to that same Features basemap instance. Switching domains preserves the map style and camera. The clipped land/water shapes retain their original roles; Viewshed does not create another map or substitute a coastline when geographic cartography is unavailable.

## Local development

Use Node 22.12+ (verified here with Node 25.6.1) and npm. From this repository:

```sh
npm ci
# Activate a Python 3.11+ environment with these dependencies, or set
# MARINECAST_DATA_PYTHON in .env.local to its interpreter.
python -m pip install -r requirements-relationships.txt
npm run dev
```

`npm run dev` starts FastAPI on `127.0.0.1:8001` and Vite together. It reuses an
already-running matching API and stops only the processes it started. FastAPI
serves Features layers, bounded weather queries, source-change events and
Relationships; Vite proxies their existing same-origin URLs. Both launchers load
server-only settings from `.env.local`. `MARINECAST_API_PORT` changes the listener
and proxy together; `MARINECAST_RELATIONSHIPS_PORT` remains a fallback.

To keep validated layers warm across frontend restarts, run `npm run backend` in
one terminal and `npm run dev:frontend` in another. For a built app, keep that API
running and use `npx vite preview --host 127.0.0.1`. Restart the backend after
editing Python adapters or their JSON contracts. API startup itself does not scan
all products: each domain validates on its first request. Independent domains
have separate serial readers; catalogs cache their serialized response while
source versions match, and large JSON responses use gzip. Source updates still
invalidate the affected cache. A first or changed-source load can remain slow
because checksum validation and exact-value encoding are preserved. See
[FastAPI layer service and measured QA](docs/qa/fastapi-layers.md).

Features reads the current final products in `../../Data` automatically. Replacing a valid product or updating its catalog refreshes variables, periods and map values in the open app without a manual preparation command, restart or page reload. Delivery files are checked every two seconds; new values appear after their source validation finishes. Existing selection, camera and display settings stay in place. Invalid replacements are reported instead of silently using old values. Publish related files and their integrity receipts together; partial writes remain unavailable until valid.

The Seascape consumer tolerates adjacent `.txt` and `.md` review notes; notes are
not data products, source bindings or instructions. Catalog-listed Parquets remain
checksum-bound and must exist. Other unlisted files still fail validation with
their names in the error. This is consumer-only tolerance; the producer's flat
publication now also preserves these user notes. See [current-data validation](docs/qa/seascape-reader.md).

Reviewed static Seagrass, Bivalve and Kelp contain H3, all-time area and int64
0/1 mapped-presence flags. Area zero includes source unknowns filled by approved
delivery policy; it does not establish surveyed absence. Bathymetry and Freshwater
omit the redundant resolution column. The independent `scripts/seascape_support.py`
verifies required external audit checksums and the public projection, restores
native resolution/QC/source qualifiers for Details, and keeps delivered areas and
flags as map values. Audit changes or loss invalidate cached reads. Annual Kelp
is unchanged. `seascape_review` metadata records audit paths; no sibling toolkit
import is needed.

The twelve additional Seascape cores use lower_snake_case metric names and
`h3_index`. Only their retained measures are selectable; original arrays/QC stay
in the bound audit and Details. Nullable boolean core fields use int64 0/1,
without new zero filling. The independent `seascape_core.json` contract validates
units, source mappings and nearshore parameters. Retired field IDs may reset an
existing selection. The five earlier static schemas and annual Kelp retain their
names and values. See the producer's adopted compact-core column reference.

Artificial Reef now presents `has_mapped_artificial_reef` as False/True categories,
with source/export values retained as exact 0/1. The producer combines ARSBC,
WDFW and NOAA reef locations with same-site reconciliation. False means no mapped
positive evidence in partial inventories, not surveyed absence. Source dates and
the explicit NOAA/WDFW coordinate conflict remain in retained producer evidence;
points outside native cell support do not become invented map cells. See
`toolkit-seascape/docs/artificial-reefs.md` for the owning contract.

Set server-only `MARINECAST_DATA_PYTHON` in `.env.local` to a Python environment with `pyarrow`, `numpy`, `h3`, `shapely` and `pyproj`. The existing `METEOROLOGY_PYTHON` setting remains supported. `MARINECAST_DATA_ROOT` optionally selects another Data directory. The reader uses existing source contracts and never acquires inputs, changes Data files or reruns their scientific calculations. Browser encodings are automatic, process-owned and bounded to the current and one previous generation per domain. Existing prepared assets are optional startup accelerators only when their source bindings still match. Weather values are queried directly from the current Parquets. `vite preview` proxies the same FastAPI service; builds do not duplicate `public/local-data` into `dist`.

Viewshed is currently a specific exception: `Data/viewshed/READINESS.json` declares no completed pair product. The qualified retained pilot remains available. A pilot delivered into `Data/viewshed` with `runtime.json`, its source/model metadata and land/water/pair Parquets is detected automatically. Matching `components/manifest.json` and weights are used when present. `VIEWSHED_PILOT` and `VIEWSHED_COMPONENTS` optionally select another completed producer output; land-source geometry alone cannot supply pair weights.

Vite prints the local URL, normally http://127.0.0.1:5173. All Features layers, including Viewshed, request MapTiler cartography when configured; a missing key shows an explicit configuration message. Scientific values remain local. Relationships reads verified retained Orca records locally; no acquisition service is connected.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The wave icon at the top left of the shared header on each data page opens the page-navigation dropdown
on hover. Click/tap or Enter/Space also opens it; Arrow Down focuses the first destination.
Escape, leaving the menu, moving focus outside, clicking outside, or choosing a destination closes
it. Escape restores focus to the wave button. The header's page links and hamburger are removed.
The MarineCast wordmark remains a Home link. Every page uses the order **Home, Features, Relationships, Health**. Viewshed is selected from the Features product dock; saved `#viewshed` links open `#map?layer=viewshed`. Features retains the existing `#map` route so saved links continue to work. The standalone Sightings page is removed; legacy `#sightings` links redirect to Features, which is the destination for future sightings integration. The dropdown has no data-status footer. Home additionally exposes the existing analytical destinations in its coastal sidebar.

Every data page uses the shared `LegendDropdown` surface: a bottom-left legend and an upward popup with close, Escape, trigger-toggle and outside-click dismissal. Features layers retain their own units and scale calculations. Viewshed's product sidebar contains only Family (Land → water or Water → land) and Score display. Cells are selected directly on the map. Its legend uses the shared palette cards and Advanced controls for coloring, smoothing, contours, cell outlines and opacity. Smoothing blends original weights within their clipped land/water support; missing scores stay missing and Insights retain the original scores. Grid outlines live under Legend → Advanced. The shared header opens methods, credits and provenance. Relationships and Health use the same popup for chart keys. Home's decorative artwork has no quantitative legend. See [shared navigation QA](docs/qa/shared-navigation.md). Legend settings render in the browser top layer so Safari cannot clip them inside the scrollable legend; positioning stays anchored to the clicked card.

## Pages

- **Home:** the original generated Pacific Northwest coastal image with gently animated water, clouds and fog beside the ivory atlas sidebar. Navigation starts with a compact icon rail on every visit. In light mode, the icon rail has a subtle sage gradient beside the warmer ivory gradient of the expanded area. The waves sit in the upper-left 62 px brand row, matching the data-page header position and size. Sidebar navigation has no Explore section heading. Sidebar destinations start higher; the card group is centered horizontally and vertically in the available space beside the sidebar. Short screens keep the first card reachable by scrolling. Hovering anywhere on the sidebar—including empty space, waves and Help—temporarily expands it; leaving the sidebar restores the rail. Moving between its items keeps it open, and mouse clicks do not pin it. Touch and keyboard users can expand/collapse with the waves button; Escape, outside focus and the phone scrim dismiss it. Above 700 px, the photograph and cards resize together beside the current sidebar width. Cards stack at 1000 px and below; at 700 px and below, the touch drawer overlays the cards and artwork. The compact cards use translucent ivory/sea-green surfaces (62–66% opacity) in light mode and navy/mint surfaces (59–64%) in dark mode, with matching decorative motifs, icon tiles, status pills and visible action rows. See [Home layout QA](docs/qa/home-sidebar-layout.md). The current Home item and all destination icons remain usable in either mode; the upper-right Menu button and From the shore shortcut are removed. The active images are local day/night PNGs with responsive cropping; A lazy-loaded WebGL effect moves pixels within masked water, sky and fog regions with subtle canopy sway while keeping rocks and mountains fixed; the original image remains the fallback. Water uses flowing texture motion with smaller traveling ripples, and cloud/fog drift fades continuously between phases. Rendering supports device pixel ratios up to 2, capped at approximately 4K framebuffer size; the source artwork itself remains 1672 × 941. Motion runs at up to 30 fps, pauses in hidden tabs, respects reduced-motion preferences, and has a small play/pause control. No React Three Fiber scene or GLB assets are loaded. The former boat, pan/zoom and reset controls remain removed. The image is evocative artwork, not source cartography. See [artwork and exact prompt](public/assets/home/ARTWORK.md#static-coastal-background-2026-10-16).
- **Features (`#map`):** seascape and governance variables, annual kelp with survey-year selection, directional coastal bounds with bearing selection, categorical class/status maps, native R6/R8 selection, full-area colorbars, exact cell values and source/quality dialog, local JSON export, opacity, zoom controls beside Insights, and geographically linked swipe comparison. Drag the center divider to reveal either layer; both full-size maps share pan, zoom, bearing and pitch, and one zoom control operates both. Each variable retains its own scale, original cell values and export. The full-width map has a persistent upper-left product dock and a top-aligned contextual drawer. The drawer fits its controls and grows when a Family or Feature picker opens, up to the available map height. Long choice lists scroll within the capped drawer. On compact screens, the timeline is hidden while the data selector is open and returns when it closes; the legend remains available. Open appearance controls sit above the timeline so palettes and Advanced options stay clickable. Closing the drawer retains the selected layer and dock; Map only collapses the dock. Unavailable products have an explicit status and hover/focus names. Family and Feature come first, resolution becomes metadata when only one is supported, and grouped pickers include an information button on every feature and comparison data-product row. Information opens without changing the selected layer; the separate Data details section is removed. The shared header shows the active product/metric, Compare, Export and Help. The bottom-left legend identifies the metric, units, native resolution and missing-value key; Appearance opens with palette choices and a collapsed Advanced section for classification, smoothing, opacity, outlines and display z-scores. Insights opens at the upper right with its own default height. The legend stays anchored to the bottom-right map edge, independently of Insights; comparison legends retain the same bottom stack whether Insights is open or closed. Drag its left edge, bottom edge, or lower-left corner to resize; focused edge handles support arrow keys, Shift for larger steps, and Home/End for size limits. Reset size restores the default. Panel size is retained for the session. Legend height and viewport bounds constrain resizing so the legend stays visible. Charts, statistics, and comparison sections reflow as the panel widens. Layer selection remains on the left, and zoom sits beside the Insights trigger. Static products have no monthly axis; recorded survey years and bearings are separate source slices. R8 overlays load at the current map zoom; viewport filtering preserves native cells and never averages them.
- **Relationships (`#relationships`):** source-backed native feature matrices, pair plots, family pair screening, quality/join details and qualified recorded-Orca response comparisons. See [Relationships guide](docs/relationships.md) and [current QA](docs/qa/relationships.md).
- **Models (`#models`), Forecasts (`#forecasts`):** consistent Coming soon pages.

- **Health:** synthetic coverage calendar, quality flags, join loss, provenance, release comparison, and explicitly simulated empty/error states with retry.

Governance's **Administrative Boundaries** family combines the former Regional
Boundaries, Federal Waters and State Provincial Waters families. Its Feature list
keeps **County / District Count**, **County / District Assignment**, **Country Assignment**, **International Boundary** and **State / Province Assignment** together.
Feature IDs, saved selections, independent comparison choices, native R6/R8
resolutions and scientific meanings remain unchanged. County / District Assignment
labels display only county/district names in the legend, Insights and inspector
headings. County / District Assignment, State / Province Assignment and Country
Assignment legends are alphabetized by name without changing their colors or
category keys. Explanatory source/method notes are omitted from the legends;
feature and cell details retain those qualifications. Source IDs and records remain
in the detailed inspector. Equal names
retain distinct category identities. The county/district features
read source-backed U.S. county and BC regional district memberships. A cell touching
multiple polygons retains every name and source-qualified identity, including
edge/corner contacts. Only provider-mapped water extents apply. Unknown coverage
stays null. The producer removes eight old diagnostic/status columns; its explicit
compact-support metadata supplies browser-only partial/unknown support, without
recomputing geometry. Removed saved regional choices restore to Count at the same
resolution. See [Regional Boundaries QA](docs/qa/regional-boundaries.md).

Coast Guard Sectors now offers one **Coast Guard Assignment** feature combining
CCG Administrative Region and USCG Sector recorded memberships. The reader joins
the two existing membership arrays at each unchanged native H3 cell/date, retaining
all source-qualified identities, names and overlapping records. CCG regions and
USCG sectors remain distinct administrative unit types in source details. The
other Coast Guard diagnostics are removed from the final Data files and Feature
list. The final product retains only the combined membership and its required
count/status support; original source records and geometry remain retained. Saved component selections open the combined feature
at the same resolution. The producer supplies this combined view in new final products; the reader
combines legacy component arrays when needed. Current producer products supplement
Western over explicit BC model-water support, with water-source lineage and a
derived-assignment qualification in feature/cell details. The reader preserves that
producer definition and source context. Original polygons, all existing units and
overlaps remain intact; no source acquisition or browser spatial calculation occurs. See
[Coast Guard QA](docs/qa/coast-guard.md).

## Source pickers

Layer selection uses **Family**, with a symbol beside each source family, followed by **Feature**, filtered to that family's native fields. Changing family selects an available measurement when possible; choosing the current family preserves the selected feature. Family choices follow the active product and native resolution, and comparison maps have independent selectors. The dropdowns open directly to their choices with keyboard navigation. Family, feature and data-product choices are alphabetized by display name within their groups, with numeric names in natural order; the current selection stays in its alphabetical position. Lists of twelve or more fields include a filter for names and original field IDs. Measurements are grouped separately from quality, coverage and processing fields. Governance labels omit the repeated family prefix while preserving source distinctions; original catalog names and columns remain in information cards and exports. Duplicate display names include their native field identity. Each feature row has an information button and an adjacent copy button that copies its original catalog metric name, with success or failure feedback, without selecting the item. Comparison data-product rows retain information buttons. Feature information uses supplied source definitions when available, verified mean-depth semantics where declared, and explicitly labeled field context where a detailed definition is absent. Units, native grid and exact available-value counts remain visible in the information card; unknown units are not inferred from a column name. All-unavailable fields remain selectable. Products unavailable at the current native resolution keep an accessible information button while their selection action is disabled. Escape closes information first, then the picker; closing restores focus to its trigger. Source qualifications remain in Source & quality. The old layer-picker Data details section is removed.

## Features comparison and display

Compare opens symmetric Left and Right product, family and variable selectors. Persistent map chips reopen setup; Swap layers and Exit comparison remain visible. Products must share their native grid. A grid change keeps compatible variables and explicitly reports a replacement when the right variable is unavailable. Identical variable/slice selections are labeled in the toolbar and Insights, with their tautological correlation omitted.

Appearance is linked by default, and both legends say that changes apply to both maps. Unlink appearance in setup or either legend to change palette, scale, opacity, outlines, smoothing and z-scores independently. Linking again uses the left map's appearance. Every legend shows its native grid, units and weather date where applicable. Category keys, constant values and empty slices are visible without opening Advanced.

The product rail has a bounded scroll area and an optional product-name view with unavailable-product explanations. Legends stay at the bottom-right map edge, independently of Insights. Timelines are centered in the map view on wide screens and stack above the legend on narrow screens; Insights reserves space above both. Hydrology support notes live behind the legend information icon, available on hover, keyboard focus or tap and dismissed with Escape or outside interaction. Native maps support arrow-key panning and Enter to inspect the center cell, with a visible crosshair and instructions on keyboard focus. In Viewshed, Enter on the same cell or Escape restores the overview. Viewshed's Compare and Export actions remain visible with explanations of unsupported pair operations; they do not regrid pair weights or invent an export contract. See [Features review QA](docs/qa/features-review.md).

## Shared map timeline

All time-enabled Features layers use the controlled React `TimelineControls` component. Supply `startDate`, `endDate` (inclusive calendar bounds), `increment={{ unit: "day", step: 1 }}`, `value`, and `onChange`. Supported increments are day, week, month and year; month/year steps retain the original day where possible and clamp to shorter months. `format`, `label`, `rangeLabel`, and `basisLabel` retain the domain's date labels and source time basis. Explicit `values` can preserve source-native period keys or a single All time frame instead of generating dates.

```tsx
<TimelineControls
  startDate="2009-01-01" endDate="2026-10-15"
  increment={{ unit: "day", step: 1 }}
  value={day} onChange={setDay}
  label="Hydrology timeline" rangeLabel="Hydrology day timeline"
  format={hydrologyDateLabel} basisLabel="Provider dates"
/>
```

The native range input has a date axis underneath it and a selected-date readout aligned below the speed control. The time basis is retained in the slider’s accessible value instead of beside the visible date. The top title and date-picker row are removed. Play/pause, previous/next, speed, keyboard range navigation, busy/error waiting, end-of-range restart and hidden-tab pausing are shared. Axis labels thin at narrow widths. The control is centered while reserving the bottom-right legend; narrow screens stack it above that legend. Hydrology keeps provider-date labels, Meteorology keeps UTC days, and sightings keep their supported UTC periods and All time/undated qualifications. Sighting interval selection lives in the layer settings. Calendar frames are navigation only; they do not resample or fill missing observations.

## Dataset Insights

Features, including its Viewshed layer, has an **Insights** tab in the upper right. It opens a light, scrollable panel with a histogram, min/max/mean/median, availability counts, a distribution, selected-cell details and source metadata. Layers remains the data selector; changing native resolution, feature, survey year, bearing, score or source updates the panel. Compare mode uses one shared Comparison Insights panel for both active layers, with paired histograms and box plots, a correlation scatter plot, Pearson r, Spearman rho, and native cell-pair counts. Selecting a map cell shows both original values at that H3 key.

Summaries default to the full active native layer and count each non-null cell equally, independent of map zoom or viewport. Features offers an explicit Full dataset / Visible map scope selector; visible-map summaries include cells whose centres fall within the reported map bounds. This changes the summary only, never the map classification, selected measurement or export. They use original source units, even when the map displays z-scores, logarithmic colors, custom limits or adjusted opacity. The histogram leads the Overview, followed by unit-free summary cards and availability. Distribution details (24 histogram bins and five independent equal-width summary ranges) and source metadata are collapsed by default; constant values have one range. Map cell and location selections update the selected item without opening Insights. The user opens Insights with its button; an already open panel follows the selection, with exact source measurements and an optional detailed source dialog. Categorical products show source-label frequencies, without numeric means. Zero and Boolean false remain available; nulls remain unavailable. Loading, errors and all-null layers show explicit states. No example statistics or source dates from the design reference are used.

Comparison histograms show each layer's share of available cells, with shared frequency axes. Matching units use common value bins and axes; different units remain on separate value axes. Boxes use linearly interpolated empirical Q1/median/Q3, with observed min/max whiskers. Correlations match exact native H3 keys with finite numeric values on both sides, using the currently selected slices and every complete pair. Scatter rendering caps visible points at approximately 1,200, while the coefficients retain all pairs. Constant or insufficient support reports unavailable correlation; categorical layers retain source frequencies instead of invented numeric statistics.

When both fields have declared, parseable calendar slices, the panel loads recorded periods and shows paired box plots over time. Source years/dates stay distinct, absent periods remain gaps, and unavailable side/period values show explicit markers. Different time grains are rejected without resampling. Bearing slices are directional, not temporal. Timeline axes remain visible while its shared time window scrolls horizontally by keyboard or touch. Time-series reads use the same checked column/native-support assets as the map, without loading every qualifier for every date.

Selected Features cells retain native H3 identity, coordinates, original values and expandable source qualifiers. Viewshed reuses its scientific inspector, preserving lower/upper estimates, nullable complete scores, conditional support and all-source denominators. This remains local research-pilot information, separate from detection or access. The panel stays open during cell inspection and layer/color changes; Escape closes a local popup first, then Insights, restoring focus. Features keeps zoom and Insights in a persistent upper-right row above the open panel. The Features dock stays upper left; phones keep Insights above the bottom legends and hide the dock while Insights is open. See [Insights QA](docs/qa/insights.md).

## Structure and future integration

The [2026-11-01 cleanup record](docs/dead-code-review.md#completed-cleanup--2026-11-01) records the approved removals, test migrations, retained dependencies and current validation.

`src/data/seascape.ts` and `src/data/viewshed.ts` are typed local product adapters. `src/data/demo.ts` supplies Health’s synthetic metadata; deterministic H3/value test samples live in `src/test/demoFixture.ts`. Pages maintain UI state; shared controls, charts and the geographic map live in `src/components`. `MapCanvas` mounts the geographic renderer or its loading/configuration/retry state. Viewshed supplies its clipped overlay to that existing map. Real viewshed scores are static.

Additional integrations should use typed read-only product adapters. Keep product identity/grain, units, spatial/temporal support, missingness, rights, provenance, and validation status explicit. Add backend filtering and response limits before loading real artifacts. Read only explicitly supplied producer products; do not mutate sibling products, assume the proposed shared manifest is already adopted, or equate this explorer with scientific validation.

The optional preparation CLIs accept explicit source paths. The running app uses the read-only FastAPI service described above and has no acquisition backend. Synthetic test fixtures contain no real sightings or vessel records. Do not commit private products or credentials.

## Optional offline map export (not required by the running app)

From this checkout, use a Python environment with `pyarrow` and `h3`:

```sh
python scripts/prepare_map.py --seascape ../../Data/Seascape --governance ../../Data/Governance
python -m unittest discover -s scripts -p 'test_prepare_map.py' -v
```

Paths are explicit source inputs, not sibling runtime imports. Preparation verifies the seascape
publication receipt and manifest members, the governance flat catalog, metric checksums and embedded grain/fields and
both sidecar checksums. It exports source values/nulls without rounding, independently reads
each encoded column back, and activates the ignored browser catalog only after every table
passes. Immutable assets use content hashes; identical repeats verify/reuse the same snapshot.
No acquisitions, scientific recomputations, source rewrites or producer promotions occur.
The preparer reads current per-area static/dynamic Parquets and embedded metadata from the flat Seascape catalog. Existing browser caches remain readable. The earlier release preparer is historical only.

The governance flat catalog retains: 2,621 native R6 cells and 88,243
native R8 cells. It includes all 94 governance measurements plus their status fields, the
modeled R6 substrate/seagrass products and categorical R8 terrain form. All-null fields stay
selectable and render gray. Provenance/identity strings and serialized inventories stay in
the source inspector rather than becoming numerical metrics. Seascape inspection preserves
all original fields in the selected namespace. Numeric source values have numeric scales;
category/boolean maps have a labeled category key and cannot be standardized. Exports retain
original values (including category strings and booleans), source hashes and selected slice.

Annual kelp offers the 35 recorded survey years, 1989–2024 excluding 1993. Directional coastal
bounds are native R8 with 16 bearings. Only the selected native slice is loaded; no temporal
interpolation, forward filling or cross-resolution aggregation occurs. Geometry remains full
native H3 support. Kelp represents mapped positive evidence; directional bounds are not
qualified physical fetch. Governance is a research inventory, model-ineligible by default,
and does not establish current law or exhaustive jurisdiction. Original dataset shapes and attributes are retained once per source under
`Data/Governance/OriginalData`. Governance has no release directories or public crosswalks. `Data/viewshed` is readiness-only; the Viewshed layer retains its existing,
explicitly sourced research pilot.

`npm run build` excludes `public/local-data`; development and production preview
read validated encodings through the local API. Cache publication still requires
separate source-rights scope. See [complete map QA](docs/qa/data-map.md).

## Optional retained Viewshed pilot export

The bottom-right **Layers → Map layer** dropdown switches saved quantities without recalculating them.
For the optional weight diagnostics, prepare the completed matched producer output with:

```sh
python scripts/prepare_viewshed.py --pilot /absolute/path/to/pilot/run --components /absolute/path/to/weight-diagnostics
```

This adds **Above-ground weight (lower)**, **Terrain weight** and **Distance weight** in both the map
dropdown and Settings. Terrain includes the developed observer-to-water distance decay. Distance
uses the existing normalized logistic centroid profile (9 km d50 parameter, 2.7 km slope, 30 km cutoff)
and is a separate diagnostic; it must not be multiplied into terrain again. Above-ground is
conditional roof/WorldCover/CHM transmission on terrain-clear sightlines, weighted by distance.
The main above-ground display uses the labeled lower bound. A complete-weight option is also
available. No terrain-clear support means not applicable; unresolved relevant inputs remain unknown with
lower/upper bounds. The complete-weight map shows both as gray; the lower-bound map retains uncertain bounds, and inspection distinguishes them. The inspector
retains every component, bounds, centroid distance and source-support counts.

Terrain/distance target views use the existing all-source denominator with outside-reach zeros.
Above-ground target view averages terrain-clear source pairs only, with its different denominator
displayed explicitly. A target mean of component products cannot be reconstructed by multiplying
component target means. Original pilot score layers remain unweighted transmission estimates.
These diagnostics reuse the pilot's direct-ray model and in-reach partial target support; they
are not the canonical GDAL production factors. The producer contract is
`retained_regional_weight_diagnostics_v1`; the consumer validates exact matched pair keys, parent
checksum, field bounds and missingness before installing a version-2 immutable browser cache.
Version-1 caches continue to offer the original layers only. Conditional-factor sampling accuracy
is not established by the parent pilot's original sampling checks.
See [weight-layer QA](docs/qa/viewshed-weights.md) for the real regional run, exact cache readback,
independent Dungeness/Sequim census comparisons and browser checks.

From this app checkout, use a Python environment containing `pyarrow`, `shapely`, `pyproj` and `h3`:

```sh
python scripts/prepare_viewshed.py --pilot /absolute/path/to/sequim-regional-pilot/run
python -m unittest discover -s scripts -p 'test_prepare_viewshed.py' -v
```

The input must be a completed `bounded_regional_classified_viewability_pilot_v1` run, including `runtime.json`, `source_cells.json`, `model_and_grid.json`, `average_viewability.parquet`, `land_area.parquet` and `water_area.parquet`. The script checks the producer's pair-file checksum, complete source universe, unique land-source/target identity, H3 R7, bounds/null semantics, radius, 15 observers, per-source target counts and water-point counts. It never acquires inputs or reruns scientific scoring.

Output defaults to ignored `public/local-data/viewshed/`; `--output` supports an independent cache. Source values/nulls and qualifiers are written without rounding, read back for equality and checksummed. Snapshots include input and exporter hashes and are immutable; identical existing output is verified and reused. The catalog is atomically replaced only after all assets pass. Browser reads verify every asset hash, row support and denominator. Failures show an error/retry; there is no demo-data fallback. Only shared geometry/averages and the selected source partition load initially; source requests are cached and late responses cannot change the current selection.

The installed October 11 pilot has **163 land sources, 1,279 water targets and 47,295 source–target pairs**, with 15-mile observer reach. Select **Viewshed** in the Features sidebar, or open `#map?layer=viewshed`. The original standalone page has been removed from navigation; `#viewshed` remains a compatible entry into Features.

Click a land cell to color water targets by that source's selected weight. Click a water cell to color land sources by their individual weights for that target. This reverses the existing pair lookup, without averaging or recomputing weights. The first reverse query reads all checksum-verified source partitions with six concurrent readers; subsequent target selections reuse that checked index. Failed or incomplete reads show an error and retry, with no partial reverse result. Terrain is the default weight when the retained components are available. Above-ground lower/complete, distance and original pilot scores remain selectable. Terrain already includes distance attenuation.

Land and water retain separate clipped geometries and roles, including coastal cells sharing an H3 ID. Every water cell remains clickable when exploring one land source. Faded gold land has no saved pair for the selected target; pale blue water has no saved pair for the selected source. Gray retains unknown/not-applicable weights. The reverse inspector lists exact source-pair weights, bounds, support and provenance. Source rows can open the water view from that land cell. Water targets are selected directly on the map. Clicking the active land or water cell again, or empty map space, restores the all-source water overview and its documented denominators. The selected weight, palette, opacity, outlines and camera are retained. Grid outlines are controlled under **Legend → Advanced**. Shared Insights follows the active water targets or land-source pairs. Legend controls change colors and opacity without changing source values. Help preserves methods, credits and source limitations. Physical viewability remains a research quantity separate from access or detection.

Right-click anywhere for a small coordinate popup; Copy coordinates writes latitude, longitude in decimal degrees to six places. The popup follows its location on the basemap and closes with Escape, X or normal map click. It is mutually exclusive with Settings and cell inspection; selectable text supports manual copying. Wheel/trackpad zoom, drag-to-pan, pinch zoom, double-click zoom, keyboard navigation and zoom in/out buttons operate the geographic map. Source, metric, display settings and selections preserve the camera. The distance scale and bottom attribution strip are removed; default-basemap credits are available in Help. This remains a local preview; public presentation needs appropriate visible attribution. The existing `VITE_MAPTILER_MAP_ID` selects the Features style for every domain. The Features basemap failure state offers Retry basemap. DEM, CHM and buildings are model inputs rather than separately implemented browser display layers.

Target view is `sum(per-source score) / all source cells`, equally weighted by source cell. A missing pair in this verified completed pilot means no target water lattice points within that source's observer reach, so it contributes zero; missing canopy/roof inputs within a modeled pair remain uncertainty bounds and nullable complete scores. Each pair's in-reach water portion may differ: the resulting mean is not a whole-target-water-area mean or a source-area/access-weighted mean. Original per-pair support counts and range-excluded fractions remain available in source inspection. Shading uses the target's water shape, including edge portions beyond a particular source's reach; the scores retain the actual partial support. Display geometry is simplified by 15 m only for rendering, with no change to scores, H3 identity or grid support.

Viewshed installs five scientific overlay layers on the existing Features MapTiler renderer. Selecting Viewshed, switching weights, clicking cells and returning to another domain do not create a map, change its style, fit bounds or replace the camera. The native cell overlay is cleared while the pair-based Viewshed overlay is active. Clicks use the saved clipped land/water geometries and remain keyed by role and H3 ID. The existing Features zoom controls, geographic loading/error states and basemap configuration apply.

This is an **exploratory research transmission scenario**, not an empirically calibrated or promoted viewshed release. It retains the producer's grid/model settings, sampling checks, missingness, input product hashes and limitations in Source & qualification. Score display includes lower estimate, upper estimate, complete score and uncertainty; zero, null and outside reach have distinct meanings. The legend color popup offers four palettes and Value range (min–max, default), Full range (0–100%), Log (value range), Custom range and Quantiles. Value range stretches colors across all active target scores; it changes with the selected source, mode and score field, independently of the map viewport. Log coloring applies `log(1 + score in %)` and stretches across the active values; zero is valid, unknowns stay gray and legend ticks remain in the original percentage units. Quantiles use ten classes across the same active targets; equal scores share a color and tied thresholds may leave classes empty. Fixed and custom ranges retain common color limits between sources/modes. Custom percentage limits clip only the colors: the color bar marks saturated endpoints and the popup counts targets beyond the limits, while inspection retains the original scores. Invalid/incomplete limits leave the last valid range in place. Unknown complete scores stay gray and are excluded from scale statistics; all-unknown and constant layers have explicit legend states. The color bar shows the actual percentage limits; The color popup retains the palette, scale mode, saturation count and class diagnostics. The default palette is Blue to red; the other palettes remain selectable. These controls do not modify the producer data or assumptions.

Like seascape, the local cache is copied into `dist/` by the build and is **for local preview only**. No publication or redistribution review was performed for the pilot inputs. Consumer checks and real-data readback evidence are recorded in [viewshed QA](docs/qa/viewshed-map.md).

## Legacy seascape-only cache

The automatic current-file reader above is the active workflow. For an independent legacy v1 cache, use Python 3.14 with `pyarrow` from the app checkout:

```sh
python scripts/prepare_seascape.py \
  --release ../../Data/seascape/releases/seascape_consolidated_static_native_r6_r8_20261007_v3 \
  --output /private/tmp/marinecast-seascape-only-cache
```

On this machine the verified interpreter is `/Users/tylerstevenson/miniforge3/envs/orcacast314/bin/python`. The CLI accepts `--output` for independent verification; its default output is `public/local-data/seascape/`, ignored by Git. It checks the matching published receipt, all manifest file checksums, native row identity, finite values and safe integer encoding. Each exported field is read back and compared against all Parquet values/nulls before the catalog is atomically installed. Existing snapshots are refused; use a fresh output directory to independently regenerate/validate. Source artifacts are read only.

The legacy example uses consolidated v3, published 2026-10-07, with 2,621 R6 and 88,243 R8 rows. Its immutable manifest retains prepublication status text; the matching publication receipt records the subsequent independent review/publication. The adapter preserves both original source bindings and per-field linked row qualifiers. The default is the exact `BATHYMETRY` alias in metres, positive down. Native terrain, freshwater and estuary fields are offered at R8 only. The legacy v1 cache offers numeric columns, including explicit all-null fields; categorical/boolean qualifiers remain in its inspector. The active complete v2 catalog also offers categorical/boolean maps with source labels. Unknown units display `source units` rather than an invented physical unit.

A missing cache or checksum failure produces a visible error/retry state. It does not switch to fixtures. Changing resolution drops an incompatible feature and selects the native bathymetry alias. Comparison is within one native resolution; selected values and provenance follow the selected side. Value availability and unweighted regional cell means are display summaries, not survey completeness, area weighting, habitat absence or ecological validation.

The on-map legend always identifies the active metric, verified units (or **Units unavailable**), native resolution, scale breaks and missing-value key. Appearance, partial-coverage and outside-domain labels are omitted from the collapsed card; source qualifications remain in item information and Source & quality. Click it for **Appearance**, whose popup has close, Escape, trigger-toggle and outside dismissal. Opening Appearance closes the feature drawer while retaining selected source values in Insights. The opening view contains only palette choices and a collapsed **Advanced** section. Classification, smoothing, opacity, ordinary cell outlines and display z-scores live inside Advanced. The mean-depth default uses fixed display bands when its source convention is verified; other numeric fields default to ten equal-width intervals. **Quantiles** uses interpolated empirical deciles; **Min/max** interpolates continuously through ten color stops. Classes use full native support, independent of viewport statistics. Ties share a color and may leave quantile classes empty. All-null layers show no numeric scale. Missing values remain neutral gray, distinct from the lowest valid color and the unpainted outside domain. Comparison legends retain Left/Right metric labels. Different metrics keep their own thresholds; the same metric on both sides shares pooled thresholds and colors. Phones and pinned-Insights comparisons stack legends with enough room for both metric headings.

The Appearance popup offers **Display z-scores** under **Advanced**. It applies `(value - mean) / std` using the full native layer's finite, non-null values and unweighted population standard deviation (`ddof=0`). Each comparison variable has its own mean/std. Map values and legend ticks become dimensionless z-scores; switching it off restores original units. Cell inspection retains original values alongside standardized values, and Source & quality reports the mean/std. JSON exports keep original source values/units and include display transformation metadata when enabled. Nulls remain null; all-null or zero-standard-deviation layers report standardization as unavailable. This is a display transformation; source artifacts are never rewritten.

Current kelp dynamic data retain a survey-year selector. Directional coastal values are separate columns for every native bearing in the coastal-bounds static file; bearings are never averaged. Historical browser caches retain their earlier year/bearing controls. Partial source inventories, historical observations, unknown dates, generalized fallback support and modeling eligibility remain source-qualified.

`npm run build` excludes prepared local browser caches from `dist/`; the local reader serves source-backed encodings during development and preview. The cache is not committed and there is no automatic hosting or upload. Source integration checks and browser evidence are in [seascape-map QA](docs/qa/seascape-map.md).

## Optional MapTiler basemap

Copy `.env.example` to `.env.local`, set `VITE_MAPTILER_KEY` to your own browser maps API key, and restart Vite. The default terrain style is `outdoor-v4`; override `VITE_MAPTILER_MAP_ID` with a MapTiler map ID if needed. Never put an account service token in a VITE variable: these values are included in browser requests and builds.

Use a dedicated origin-restricted key. For this preview, MapTiler documents the allowed origin as `127.0.0.1` (without scheme/port); use a separate production key restricted to the eventual hosted domain. See [MapTiler key setup](https://docs.maptiler.com/guides/credentials/api-key/). `.env.local` is ignored by Git.

MapLibre renders the MapTiler cartography plus the selected local H3 data layer. The local preview has two zoom controls immediately left of Insights and no recenter button or attribution strip; basemap credits are retained in Help. This UI change does not establish attribution-removal permission: [MapTiler attribution requirements](https://docs.maptiler.com/guides/map-design/attribution/remove-attribution/) apply to any publication. Feature, opacity, visibility, selected-cell styling, zoom/pan, and comparison use the same React state. Cells are inspected by selecting them on the map. Native Data maps show a plain loading state while the geographic renderer downloads. Missing keys show a configuration message; initialization, authorization or timeout failures show an error with Retry basemap. The Features page never substitutes the illustrative SVG coastline or synthetic geometry during loading or failure. A live MapTiler render was verified locally with the user-provided browser key. No remote feature-data API is connected.

## Map atlas design

The supplied MarineCast reference guides the light cards, serif wordmark, slim tool rail and compact Layers panel. The Features legend is a persistent metric card with an Appearance popup above it. Palette previews show the selected item; scale and opacity controls update both comparison maps. Escape, the close button, clicking the bar again and outside clicks close the popup. Escape and explicit close return focus to the bar; settings are retained.

The bottom analysis sheet has been removed. Click a native cell to open Selected cell in Insights, then open **Source & quality** for original row qualifiers and provenance. Export creates the full current native layer JSON locally. The rail actions are functional. No account, remote persistence or sharing service is connected.

Current design QA: [design-qa.md](design-qa.md). Data integration evidence: [complete Data map](docs/qa/data-map.md), with earlier [seascape-only QA](docs/qa/seascape-map.md). MapTiler supplies cartography only; local producer-backed caches supply values. Health retains synthetic metadata; Relationships reads validated local products, while Models and Forecasts remain placeholders.

## Home artwork

The default route opens Home with a local generated coastal image and animated
water, clouds and scenic stars. Light mode uses `salish-sea-preview.png`; dark
mode uses `salish-sea-night-soft.png`. The original `salish-sea-static.webp`
remains available for reverting. The wordmark and navigation are editable HTML.
Scientific layers remain on Features.

See [ARTWORK.md](public/assets/home/ARTWORK.md) for current assets, qualifications
and historical generation prompts. The approved 2026-10-24 cleanup removed retired
Blender/Pixi/React Three Fiber scenes, authoring tools and unused assets. Three.js
and the scenic-star catalog/license remain required by the current background.
Historical QA records and screenshots remain, including
[home-grid-motion.md](docs/qa/home-grid-motion.md) and
[home-reference.md](docs/qa/home-reference.md); they describe earlier versions.
See the [cleanup record](docs/qa/cleanup.md) for scope and current checks. The
[deferred cleanup record](docs/cleanup.md) covers obsolete cache generations,
retired coastal-scene screenshots and migration of the demo-page tests onto
current Features. Referenced startup caches and the Viewshed fallback remain.



## Data map presentation

Bathymetry mean-depth semantics are carried from the flat Parquet's embedded, source-bound
manifest: `scientific_methods.output_sign` declares positive-down metres and
`depth_summary_fields` identifies the source quantity. Units are never assigned from the
metric name alone. Other undeclared units appear as **Units unavailable**. The source values,
H3 identities, nulls and quality columns remain unchanged; only the ignored browser cache
is rebuilt. No source acquisition, producer rewrite or promotion is involved.

Verified mean depth defaults to fixed display bands at 0, 50, 100, 200, 500 and 1,000 metres
(the last band is open-ended). These are presentation choices, not ecological thresholds.
Equal-width, continuous and exploratory quantile options remain available. Same-metric swipe
comparisons share pooled class breaks and colors; each legend retains its own availability.
Panning never reclassifies the map. Z-scores are display-only; Insights and exports retain
original measurements. The basemap has subdued terrain/landcover and water, subtle zoom-dependent
cell outlines and labels above the data. A selected cell keeps a strong outline even when the
ordinary grid is disabled. Outside the dataset domain has no overlay; missing values use a
separate neutral fill.

### Smooth surface display

**Appearance → Advanced → Smooth surface** offers an optional browser-generated Gaussian blend with
contour lines. **Smoothing** controls the Gaussian width relative to the native cell width
(default 0.75×); **Contour lines** can be switched off independently. Numeric values are
blended before applying a continuous version of the current palette/scale. Contours follow
the scale's finite interior breaks. Categories and all-unavailable fields retain their native
cells. The collapsed legend identifies the smooth view as visual interpolation.

A module worker rasterizes the full native H3 footprint in Web Mercator, applies normalized
separable Gaussian convolution to the value and availability fields, and colors the resulting
scalar surface. The working raster has a bounded 1,280-pixel longest edge; the kernel uses
three Gaussian widths, capped at 128 raster pixels. Nulls never contribute zeros or kernel
weight, remain gray, and cannot acquire interpolated measurements. Outside support stays
transparent; contours require four available samples. Pixel-scale rendering is an approximate
visual surface. Nearby regions can influence each other across gaps: this is a geographic
display blend, not a water-network interpolation, surveyed bathymetry or a density estimate.

Pan, zoom, opacity and cell inspection reuse the generated surface. Changing the feature,
native resolution, source slice, palette, scale, smoothing width or contour setting regenerates
it; superseded workers are terminated and late results ignored. Worker/image failures retain
the original map with a visible retry message. Geographic clicks resolve the native H3 key,
so the inspector remains independent of raster resolution. Insights and JSON exports retain
original values/nulls; exports may record the requested display-smoothing settings separately.
No producer products, source cache or scientific statistics are rewritten.

## Daily meteorology and playback

The Meteorology dock entry is enabled only when a checked local ERA5 catalog is available.
The map uses the producer's **daily UTC** values at native **H3 R5**, including atmospheric
support over both land and water. Fourteen metrics are grouped into Temperature, Wind,
Humidity, Cloud cover, Pressure and Precipitation. These are ERA5 reanalysis samples from an
approximately 31 km source; H3 and optional display smoothing add no meteorological detail.

A shared bottom-center timeline offers a daily scrubber, date-axis ticks, previous/next day,
playback and speed controls. The selected date sits directly beneath the speed control so
the panel stays compact. Playback waits for each complete native day, pauses in a hidden tab,
and stops at the end. Playing from the final day restarts at the beginning. On narrow screens,
the timeline sits above the legend. It disappears on static products. The default scale uses
the metric's full-record range; explicit quantiles and display z-scores are per active day.
The old displayed day's legend remains until the next frame arrives, keeping the basemap mounted.

Insights includes the selected day's 24 UTC hours and daily history over one year, five years
or the full record through the selected day. Hourly curves use original measurements at a
selected H3 cell, or an explicitly labeled unweighted mean of available native cells for each
hour. Regional summaries are not area averages. Daily history uses the same descriptive
cell-mean scope. Null hours remain gaps, availability counts remain visible, and precipitation
points are following-hour totals. Direction values have no scalar regional mean; select a cell
for hourly directional points. Smoothing, z-scores and ordinary correlations are omitted for
circular directions. Daily extrema map to their original hourly variable, not hourly extrema.

For an optional standalone validation/export, with Python containing `pyarrow`, `numpy`, and `h3`:

```sh
python scripts/meteorology_data.py --prepare --source ../../Data/Meteorology
```

Preparation verifies both source checksums, embedded units/schema, every time/H3 key,
complete daily/hourly support, null counts, finite/domain values and three hourly-to-daily
reduction days. It writes only the ignored `public/local-data/meteorology/catalog.json`;
no producer data, downloads or private source cache is changed. See the inspectable
[readiness notebook](notebooks/meteorology-readiness.ipynb) and [integration QA](docs/qa/meteorology.md).

The running app validates changed weather products automatically; this export is optional. Set `MARINECAST_DATA_PYTHON` (or the supported `METEOROLOGY_PYTHON` fallback) in `.env.local` to that interpreter. `METEOROLOGY_SOURCE` optionally selects another source directory. Queries read only the selected day and metric from current Parquet row groups; whole multi-year Parquets are never transferred to the browser. Changed inputs invalidate the reader and browser frames automatically. Errors remain visible and retryable. A future hosting environment needs this local server capability; a static-only deployment cannot read local Parquets.

Validation is for local consumption and source consistency, not independent observational
accuracy. Source vintage remains distinct from the snapshot's run timestamp; ERA5/ERA5T
revision status is unknown. Source attribution is retained in metadata. Unsupported humidity
and calm-direction values remain null, and source humidity values slightly above 100% are
retained without clipping.

```sh
python -m unittest discover -s scripts -p test_meteorology_data.py -v
npm test -- --maxWorkers=1 --testTimeout=15000
```

## Human population layers

The Human dock opens native R7 **Population Within 100km** by default.
It sums available census allocations within a WGS84 100 km radius of each H3 center,
assuming unavailable contributions are zero. Insights show the value, radius, US 2020 /
Canada 2021 census vintages, original coverage, zero-imputation flag and geographic
support. These estimates are not complete observed population totals. Overlapping
neighborhoods must not be summed. Population does not measure visitation, reporting
or detection. Distance choices are only `population_within_25km_collected`,
`population_within_50km_collected` and `population_within_100km_collected`, retaining
coverage, missing-source, imputation and method qualifiers. Count and density retain
`population_count_collected` and `population_density_per_km2_collected` only. Display
names are Population Count, Population Density (people/km²), Population Within 25km,
Population Within 50km and Population Within 100km. All measurements and coverage
indicators share the Population family. Collected-source limitations remain in
metadata/help; duplicate strict scalar fields are excluded even from older cached
inputs. There is no 250 km choice. See [Human integration QA](docs/qa/human.md).

The running app reads Human updates automatically. For an optional offline export into an existing prepared catalog:

```sh
python scripts/human_input.py --human ../../Data/Human
python -m unittest discover -s scripts -p 'test_human_input.py' -v
```

Use a Python runtime with `pyarrow` and `h3`. The current `Data/Human` products are `static.parquet` and `dynamic-calendar.parquet`; the user review note may remain beside them. The adapter accepts final-only v1/v2/v3 receipts, reads embedded dictionaries and verifies each referenced product checksum, native H3 keys and existing browser asset checksums, then
performs exact column readback before activating the local catalog. Existing assets
are reused, so retain their snapshot directories. Full flat preparation also accepts
`--human <study-directory>`. Human source products are read only. The browser cache
remains local and ignored. Ferry playback remains unconnected. Current Human delivery has no native geometry overlays; source-qualified H3 infrastructure summaries and population layers remain. Historical receipts can still supply native overlays. The compact calendar is keyed by local date/country/reference timezone, with regional holiday names combined; it is not a map layer.

### Governance membership display

New Governance v5 products use the same twenty feature columns plus `h3_index`
and carry complete scientific support inside final Parquet metadata. The
independent reader verifies embedded support checksums, aliases and readable names
before reconstructing typed identity/details. Their source watch depends only on
final Data files. Existing v1–v4 products remain readable; unchanged v2–v4 products
still require their bound external audits. No delivered Data product is migrated
by this reader change. See the [current producer contract](../../Toolkits/toolkit-governance/docs/parquet-products.md#compact-delivery-and-external-audit).

As of 2026-10-25, Governance application-v4 Parquets use concise `_count` / `_membership` / `has_` column names and contain only the twenty selected features plus `h3_index`. The reader verifies catalog-bound external audits and reconstructs original scientific support in memory before using the existing feature/inspection pipeline. Status arrays, unselected support counts and legacy fields stay outside the source tables; all twenty selected feature IDs, names, values, units and paired membership details are preserved. The combined conservation assignment is materialized in the compact source and checked against its audited designated/proposed/interim components. Missing/corrupt audits fail closed and their checksums participate in prepared-source bindings. All eleven membership columns contain readable string lists; native-to-public aliases and label policy are verified before complete typed support reconstruction, preserving stable app feature IDs and existing inspection payloads. Legacy application-v1/v2/v3 products remain readable. See the [producer contract](../../Toolkits/toolkit-governance/docs/parquet-products.md#compact-delivery-and-external-audit).


Governance → **Fisheries Management Areas** offers exactly **Management Area Count**
(`management_areas__recorded_feature_count`) and **Management Area**
(`management_areas__feature_memberships_v1`) at native R6/R8. Management Area
retains all recorded memberships and overlapping names/IDs. Other Management
Areas derived columns have also been removed from the producer pipeline and
delivered Parquets. Source bindings, units and unknown/empty distinctions remain
intact; the adapter reads `uniform_count_membership_support_v1` field metadata
to derive browser-only status arrays. Previously selected removed fields fall
back to Management Area Count at the same resolution. See the
[producer contract](../../Toolkits/toolkit-governance/docs/parquet-products.md#management-areas-interface-2026-10-19).

Membership-capable Governance products add a **Recorded features** choice to each available family/source role. The legend selects categorical display automatically: single features have stable identity colors and overlaps have diagonal stripes. Stripes indicate recorded membership, not within-cell area shares or boundary orientation. The selected-cell inspector and JSON export preserve every paired feature/source record, including overlaps beyond the bounded display-pattern limit. Unknown support stays distinct from verified empty support. IDs cannot be standardized or smoothed; numeric counts and coverage keep their numeric controls. Existing scalar-only caches remain supported. See [membership integration and QA](docs/qa/governance-memberships.md).

### Orca sightings

Marine mammals → Orca supports category unions, shared UTC playback, native H3 report counts and clustered reported-coordinate points. Point inspection retains native pod/group assignments, dates and plain-text descriptions; cell inspection itemizes reported groups under the current filters. Verified annual SRKW census context remains separate from sightings.

The running local app generates Orca browser encodings automatically from retained products; no prepared Orca directory is required. For an independent offline export, use `python scripts/orca_input.py --source ../../Data/MarineMammals/Orca/Sightings --output /path/to/independent-cache`. This reads verified products without source acquisition. See [Orca contract and QA](docs/qa/orca.md) for precision, source-use restrictions and checks.

### Hydrology river gauges

The Hydrology layer panel and comparison settings use only Family and Feature (variable) selection. River inspection is available from map bubbles, the legend popup and Insights.

Low-flow duration now counts consecutive days strictly below each river's historical 10th-percentile daily mean discharge, calculated by the Hydrology producer over the full retained history. Interior flow gaps are linearly interpolated for this metric only. Insights show the river-specific threshold, reference dates and number of interpolated days; original flow observations keep their gaps. The metric uses future observations and is explicitly retrospective/model-ineligible. JSON exports include each river's complete low-flow definition and interpolation provenance. See the [producer method contract](../../Toolkits/toolkit-hydrology/docs/CONTRACTS.md#feature-definitions).

Days since flow pulse uses each river's historical 90th percentile with interior interpolation restricted to that calculation too. A pulse is an upward crossing from below to at or above P90; the count resets to zero on the crossing day and continues through later high days. Insights, the chart note and exports retain its threshold, full-history dates, interpolation provenance and retrospective/model-ineligible qualification. Unknown event history stays unavailable; measured-flow gaps remain intact.

High-flow duration is available under Flow indicators. It counts consecutive provider
days strictly above each river's historical P90 and resets to zero at or below it.
The producer interpolates only interior missing flows for this calculation, retains
unknown starts as unavailable and performs no edge extrapolation. Insights, history
notes and exports include the river-specific threshold, full-history dates,
interpolation provenance and retrospective/model-ineligible qualification. Measured
flow and the other indicators remain unchanged.

Hydrology shows colored bubbles at retained approximate river-mouth reference coordinates. River identity colors match its collapsible bottom history chart and clickable river legend. Click the legend to edit palettes and Advanced river colors, bubble opacity and size. Click a bubble, or Inspect inside the legend popup, for upstream gauge values and provenance; click the history chart (or use its arrow keys) to inspect a provider date. Hollow bubbles and chart gaps preserve unavailable values separately from zero. Two Skagit markers share one gauge series and color without allocation or summation. Hydrology does not draw a hex grid or use the playback slider; other time-enabled datasets retain the shared timeline.

The running local app generates Hydrology and river-influence browser encodings automatically; neither requires a prepared directory. For an independent Hydrology export, use `python scripts/hydrology_input.py --source ../../Data/Hydrology --study ../../config/study.v1.json --output /path/to/independent-cache`. This reads current products without downloading or changing sources. See [Hydrology semantics, source qualifications and QA](docs/qa/hydrology.md).

## Appearance

Home and Features share the persisted day/night preference. Features includes a
sun/moon toggle in its header. Night mode uses maritime navy surfaces, pale text,
dark provider/local basemaps, and themed source pickers, legends, Insights and
dialogs. Theme changes update provider paint properties in place without rebuilding
the map or altering scientific palettes, classifications, values, selection or camera.
The day/night preference synchronizes between tabs.


Human population review (2026-10-17): collected estimates are now available for
per-cell population, full-cell density, and 25/50/100 km neighborhoods. The
complete-coverage alternatives retain strict nulls and are labeled accordingly.
Every variant's inspector shows its own support, coverage, unknown-source IDs and
zero-imputation assumption; a strict null can display its incomplete subtotal.
Strict/collected variants of the same quantity use identical full collected-support
color breaks, starting at zero for equal/min-max classification. Comparison keeps
those breaks aligned with linked appearance. This is display classification only;
strict nulls and exact source values remain intact in the map and export.
The producer now retains distinct national census counts across recorded provider
boundary overlaps and uses 0.25 m neighborhood approximation tolerance. Genuine raw
census blanks and unverified geography remain explicit. The reporting H3 grid and
all other domain products are unchanged.


Meteorology now offers **Daily / Weekly / Monthly** summaries in the timeline. Weeks run Monday–Sunday UTC and months follow the UTC calendar; only complete calendar periods inside retained date coverage are listed. Each native cell requires all input days: means for mean fields, extrema for min/max fields, totals for precipitation, and direction derived from mean U/V wind components. Calm resultant vectors remain unavailable. Period metadata accompanies selected values and exports. Hourly inspection remains under Daily. Preloading is bounded to the next three frames, shares in-flight requests, and retains at most sixteen cached frames. Failed look-ahead never replaces the displayed frame. The timeline reserves date/status space so it does not move while loading.


### River influence

Choose **Hydrology → Family → River influence** on the Features page to view overlapping river
contributions on the shared H3 R6 reporting grid. Select **Relative flow influence** or
**Discharge influence**. The scenario panel chooses
water-distance and past-day lag profiles; a provider-date timeline supports playback.
Each comparison side has its own scenario/date, and Swap carries those settings.
Select a marine cell and open Insights for per-river distances, weights, contributions
and shares. Exports retain the full scenario recipe and contribution breakdown.

Relative pulse influence and Overlapping pulse rivers were removed from the active
producer data, app variables and exports on 2026-10-18. Native gauge flow indicators
remain available. Flow lag weights still apply to the two retained influence variables.

The read-only adapter consumes **`Data/Hydrology/influence.parquet`** automatically.
This single file holds typed spatial/temporal factors and its recipe/provenance in
Parquet metadata, with no influence release directory or recipe/catalog sidecars.
The existing Hydrology catalog points to the file at `products.influence`; the adapter
discovers and validates its path, checksum, size, identity and qualifications.
The adapter also checks row identity, embedded checksums and current native source bindings, and
invalidates the product when its bound Hydrology or study changes.
The browser sums producer spatial coefficients times producer lagged signals; it does
not route, fit P90, interpolate observations or fit weights. Unknown route coverage and
unavailable active lag support remain explicit. Color classes use the selected frame's
supported range; check the legend when comparing dates/scenarios. Further display
smoothing is disabled for this product. These are exploratory retrospective indices,
not physical plumes, conserved marine flow or predicted whale habitat. Columbia uses
a modeled estuarine source upstream of the ocean mouth. See [QA](docs/qa/river-influence.md)
and the [producer configuration/method](../../Toolkits/toolkit-hydrology/docs/RIVER_INFLUENCE.md).


Wildlife Refuges has exactly three feature choices: **Wildlife Refuge Count**,
**Wildlife Refuge Assignment**, and **Wildlife Refuge Coverage**. Assignment keeps
all overlapping names/IDs and paired source records. Coverage displays percent
(`fraction × 100`) of the full H3 cell area, using the producer's polygon union in
EPSG:6933. The exact stored value and JSON export retain the dimensionless fraction
and its source unit; export also declares the percent display conversion. Counts
are distinct recorded feature IDs, with no cross-source site deduplication.
Status, provenance, and line/point diagnostics stay retained support rather than
feature choices. Feature dropdowns retain a discreet text-copy button. Governance copy success uses
a check mark and accessible confirmation without adding a visible status banner. Legacy saved refuge choices fall back to Count.

See [Wildlife Refuges interface verification](docs/qa/wildlife-refuges.md) for scope, semantics, and checks.


Governance's Tribal First Nations Areas family exposes **Tribal / First Nations
Area** (nullable overlap boolean) and **Tribal / First Nations Assignment** (all
paired names and source-qualified IDs across BIA U.S. land-area references and the
qualified BC NRCan Indian Reserve subset). Positive polygon area qualifies; a
boundary touch does not. Partial no-hit support stays null. False requires verified
complete full-cell support for both sources, which current products do not have.
These administrative/reserve references do not establish sovereign/traditional
territories or broader legal jurisdiction. Country, agency, boundary type and
original source identities remain visible in Assignment inspection; overlaps have
categorical legends and counts. Source/coverage/quality columns remain available in
the data, with no additional selector choices. See [QA and exact mappings](docs/qa/tribal-first-nations.md).


Categorical H3 layers open a **Cell information** popup on click. It shows the
selected feature, native H3 ID/resolution, all available paired area names and IDs,
source provenance and support state. Overlapping assignments remain separate;
unknown support and verified empty support have different messages. The Tribal /
First Nations boolean also carries its existing Assignment memberships as popup
support without changing its boolean map. Cards stay bounded and scroll internally.
In shortened windows, family/feature dropdowns fit the drawer's actual body and
refit on resize; keyboard navigation and wheel scrolling reach the last option.
Compact drawers temporarily conceal the overlapping legend and map controls,
restoring them on close. See [interaction QA](docs/qa/governance-interactions.md).


Within **Administrative Boundaries**, **State / Province Assignment** covers
Washington, British Columbia and Oregon; **Country Assignment**
covers United States, Canada and International. **International Boundary** is a
nullable false/true feature. The assignment layers are
populated geographic modeling references. WA/OR use retained administrative
polygons clipped to U.S. water support; BC uses the water source's explicit
British Columbia region. Country assignment uses retained country-water polygon
memberships. This does not claim legal marine ownership or federal jurisdiction.
All border-crossing memberships and source/quality records remain retained.
Unmatched support stays unknown; it never becomes zero or International. Saved
old state/federal selections fall back to the assignment; old International
Boundaries selections restore the new boundary feature at the same resolution.
The separate International Boundaries family is hidden, with its scientific and
country-support records retained. Boundary cells intersect actual IBC/NOAA/NRCan
international lines, including edge/corner contact; current no-hit cells stay
unknown under partial geographic support. This is distinct from International
high-seas assignment. See [water QA](docs/qa/water-assignments.md).

### Unified Marine Conservation Areas

Governance now offers exactly **Marine Conservation Area Assignment**, **Marine
Conservation Area Count**, and **Marine Conservation Area Coverage**. The family
combines qualified marine conservation inventories using producer-reviewed site
IDs. Assignment retains all overlapping names and paired source IDs; stripes
represent membership. Coverage displays percent of full H3 cell area while values
and exports retain the exact fraction. PA, OECM, provider classifications and legal
designations remain visible in cell details and source records.

Assignment also includes explicitly labeled **Proposed** and **Interim** references
from the retained inventories: Race Rocks AOI and Gulf Islands' interim marine
zone. These references stay excluded from designated Count and Coverage. Race
Rocks AOI remains a point; no proposed boundary is inferred. A site may have both
designated and interim zones, kept as separate status-qualified assignment entries.
Their original site IDs, source records and geometry lineage remain inspectable.
The browser's assignment-entry support count is distinct from Marine Conservation
Area Count. Terrestrial-only CPCAD zones and unqualified FWS marine scope remain
excluded. Saved separate-reference/interim/AOI selections now restore the combined
Assignment at the same resolution. Producer components and old source-family arrays
remain retained support. See [QA](docs/qa/marine-conservation.md).

Physical ports moved to **Human → Ports → Port Locations**, with 84 original NGA
points and a separate R7 source-record summary. Saved Governance port selections
restore the Human native points. Ports have their own category/color and NGA source
receipt, preserving all original attributes in scrollable popups and Insights.
Marinas and nearby ferry/launch records remain separate without verified source-ID
links. No point-to-area or cross-resolution count conversion is inferred. See
[port migration QA](docs/qa/ports.md).

Governance’s **Vessel Routing & Regulations** family retains all 16 native
identity components and one boolean measurement, **Routing / regulation recorded**.
True means a source routing/regulation reference is recorded, including recommended
and conditional types; it does not mean an unconditional legal restriction.
False requires independently qualified complete coverage and observed empty
memberships across every expected component. Current no-hit cells remain unknown,
with explicit unknown-coverage legends on both comparison sides. Identity IDs,
source roles/details, dates and all original arrays remain retained. Old measurement
selections restore to the boolean at the same resolution. Assignment now offers
**Shipping Lanes & Traffic Separation Zones** (eight shipping roles plus all seven
scheme roles) and **Speed Restriction Zones**. Saved Shipping Lanes and scheme
components open the same combined view; all original source roles remain in details. See [vessel-family QA](docs/qa/vessel-routing.md).

The two **Tribal / First Nations** features now sit within **Administrative
Boundaries**, alongside the existing county/district, country, international-boundary
and state/province features. Their IDs, values, overlap memberships and partial/unknown
support remain unchanged. BIA land-area references and NRCan reserve administrative
geometry retain distinct meanings and source details. See the
[grouping QA](docs/qa/tribal-first-nations.md#administrative-boundaries-grouping-2026-10-19).


### Critical Habitat — Count and Assignment

The family offers **Critical Habitat Count** and **Critical Habitat Assignment**
for NOAA U.S., DFO Canadian aquatic and ECCC marine murrelet reference features together. Count is distinct
source-feature IDs per cell, not species or unique habitat units; multipart parts
never inflate it. Assignment keeps every overlapping species/entity/population name,
source/country ID and original part lineage. Provider status, taxonomy, waterbody,
listing status, source dates and qualifications are inspectable in cell details
and exports. DFO's `Final/Proposed` stays unresolved. Empty source coverage stays
unknown. ECCC's eleven marine references contain critical habitat only where
required biophysical attributes occur; polygon membership does not establish
confirmed habitat everywhere or current legal protection. Gray support in both
legends is labeled **Unknown habitat coverage**, with a partial-inventory note.
Saved older critical-habitat diagnostics now restore Count at the same
native resolution; assignment and count IDs stay unchanged. Other family selections
and the text-copy controls remain available. See [QA](docs/qa/critical-habitat.md).

Exclusion Zones exposes **Count** and **Assignment** across a deliberately partial
BC/Washington static rule reference. Vessel-entry and seabed-activity restrictions
retain distinct source, activity, exception and date context. Unknown support
does not become absence; fisheries and military/security coverage remain incomplete.
See [Exclusion Zones QA](docs/qa/exclusion-zones.md).

## Canonical Kelp extent

Seascape → **Kelp** has two scientific choices: **Annual Kelp Extent** and
**Kelp Extent (All Time)**. Annual uses the 35 recorded survey years, 1989–2024
excluding 1993. All Time geometrically unions compatible mapped positive bed
extents, including explicitly flagged undated B.C. CRIMS and Washington
persistence polygons. The Canadian compilation began in 1979, but individual
observation dates are unknown; it supplies no annual dates. Both quantities are
m² within full native H3 cells, independently calculated at R6/R8. They do not
measure pure canopy, current presence, water fraction, complete survey coverage
or kelp absence. Null means no mapped positive evidence, with explicit QC.

Source IDs, observation years, undated contributions, repair flags and source
record counts stay available in the inspector and export. They are not extra
scientific picker entries. The separate Annual Kelp Footprints and Mapped Kelp
Mosaic families are retired from current delivery. The producer contract is
[documented in toolkit-seascape](../../Toolkits/toolkit-seascape/docs/kelp.md).

## Seagrass choice

Seascape exposes only **Seagrass Extent (All Time)**, presented in **Biogenic Habitats**, from native R6/R8 products. It has no time axis. Original survey years, legacy map dates and multi-year modeled composite periods remain source qualifiers. The retired annual generated feature is removed from current and stale picker arrays without deleting its eligible geometry from All Time. See [Seagrass QA](docs/qa/seagrass.md).


Presentation grouping (2026-10-20): Features and Relationships share Biogenic
Habitats (four scientific features), Substrate (including Mapped Substrate
Classes), and Coastal Environment (Shoreline, Coast Complexity, Nearshore
Transitions). Current and verified startup catalogs normalize family labels
without changing IDs, units, support, provenance, qualifiers or selections.
Coastal Bounds remains separate; similar shoreline lengths retain their distinct
producer geometry and measurement contracts.

The Features family picker uses a faceted rock for Substrate, a sprout for Biogenic
Habitats, connected nodes for Spatial Support, and waves for Coastal Environment.
Bathymetry retains its mountain icon. The selected family and dropdown options
share these icons, including comparison settings.


Anthropogenic selector cleanup (2026-10-20): Aquaculture, Artificial Reef,
Disposal Site and Dredged Channel each expose one nullable boolean. True means
qualified mapped evidence; null remains unknown, not false. Existing point/reef
booleans are preserved; disposal and dredged-channel presence require positive
polygon area with qualifying QC. Original areas, distances and source/QC fields
remain internal/inspectable but are not extra selectable features for these four
groups. The mapped-presence legends explicitly count unknown coverage.


Superseding public policy for the four Anthropogenic presence layers: unknowns
are filled False at the user's explicit request. True cells and original nullable
evidence remain unchanged (hidden SOURCE_NULLABLE columns preserve the latter).
False means no mapped positive evidence, including unknown coverage; it does not
mean confirmed absence. Both True and False categories are exposed. This override
does not apply to missing values in any other feature.

Current Human static v4 has 18 public columns; earlier v2/v3 had 27. Its external `static-audit.parquet` is required checksum-bound receipt evidence, verified by H3 identity and watched for changes outside Data. Population diagnostic/method/source arrays are now attached as nonselectable browser qualifiers by H3 identity. Population classification uses the delivered values; inspection shows each cell’s coverage, missing-source IDs, geographic support and zero-imputation flag. Full-width historical products remain readable. See [Human QA](docs/qa/human.md).

Human static v4 uses 18 consistent `lower_snake_case` columns. The reader preserves original feature IDs and saved selections, reads per-quantity support references from metadata, and verifies the external audit receipt. Previous static versions remain readable. See [Human QA](docs/qa/human.md#static-column-names-2026-10-24).

The 18-column Human projection omits cell area and all eight population support columns. Density remains precomputed per full-cell km². Detailed support is read from the verified external audit into Insights; Coverage remains absent from the current feature list. See [current Human layout](docs/qa/human.md#quantities-only-static-2026-10-24).

Current Human static v5 has 11 columns: two H3 identifiers, five renamed population estimates, three dense integer infrastructure totals and Boolean `has_port`. The reader preserves population allocation qualifications, verifies original nullable counts in the external receipt without exporting them, and removes shoreline/access-category choices. The former `_collected` suffix is absent from source column names; model eligibility is unchanged. See [current Human QA](docs/qa/human.md#consolidated-static-2026-10-24).

Human static v6 has 14 columns. `has_boat_launch`, `has_shore_access_site`, `has_place` and `has_port` are int64 0/1 presence layers, alongside the three retained counts. The reader exports numeric zero/one values with unit `0/1`, preserving prior count/population feature IDs and historical Boolean-port reading. See [presence QA](docs/qa/human.md#integer-presence-indicators-2026-10-25).


### Human coverage and civil calendar (2026-10-26)

Choose **Human → Population**, then open **Insights**. The overview reports the
share of native-cell estimates with partial source support. Select a map cell for
its own coverage, geographic-support and zero-imputation flags; expand **Source
qualifiers** for missing census source IDs. Count, density and 25/50/100 km
neighborhoods retain delivered values, units, US 2020 / Canada 2021 vintages and
research/model-ineligible status. Partial is a completeness classification, not
percent people missing or count accuracy. Overlapping neighborhoods cannot be summed.

Within Human Insights, **Civil calendar** offers country and civil-date controls,
reference timezone, weekends and named holidays for 2009–2026. US uses the federal,
WA and OR union; Canada uses federal and BC. This view is independent of the map
cell and never joins dates to UTC observations or infers measured effort. Source
rule versions, as-of date, future-rule qualification and timezone limitations are
available under **Calendar source & limitations**. Older browser seeds are rebuilt
in the process-owned cache so they cannot hide these new views. See
[current Human QA](docs/qa/human.md#coverage-and-civil-calendar-2026-10-26).

Causal Hydrology metrics are under **Hydrology → Causal discharge**. Select a river
for native-date history, as-of discharge date and reference support. Warmup/gaps
remain unavailable; historical operational availability is unknown and these
research metrics are model-ineligible. See [Hydrology QA](docs/qa/hydrology.md).

**Oceanography** offers Sea surface temperature (native R6) and Chlorophyll
(native R5) for July 1–3, 2024. Select a date and click a cell for the delivered
value; missing estimates remain unavailable. See [Oceanography QA](docs/qa/oceanography.md).
