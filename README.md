# MarineCast Data Explorer

React + TypeScript data explorer. The Features page opens the latest prepared local Data catalog: native seascape, governance, annual kelp and directional coastal bounds. Its default layer is seascape bathymetry. It reads an ignored browser cache containing exact source values, nulls, native H3 keys, and linked qualifiers. No scientific variables are recomputed and no data acquisition or release promotion occurs.

The Viewshed page reads the completed regional land-to-water research pilot through a separate, ignored local cache. Home's demo catalog, Relationships, Sightings, and Health still use deterministic synthetic fixtures. The Features page uses source-backed local Data products. MapTiler supplies Features-page basemap cartography only; source values stay in the local app. The Features page shows a neutral loading state before geographic cartography is ready; it never substitutes an illustrative coastline for native data. Seascape overlays are full native H3 cells. Viewshed uses MapLibre with the same OpenFreeMap Bright basemap as OrcaCast_Public; its scientific overlays retain separate clipped land/water shapes from the actual pilot. A labeled local coastline fallback is available if the basemap or WebGL is unavailable.

## Local development

Use Node 22.12+ (verified here with Node 25.6.1) and npm. From this repository:

```sh
npm ci
npm run dev
```

Vite prints the local URL, normally http://127.0.0.1:5173. Viewshed requests OpenFreeMap styles, fonts, sprites and vector tiles; no map key is needed. The Features page requests MapTiler cartography when configured; a missing key shows an explicit configuration message. Scientific values remain local. No sightings API or acquisition service is connected.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The wave icon at the top left of the shared header on every page, including Home, opens the page-navigation dropdown
on hover. Click/tap or Enter/Space also opens it; Arrow Down focuses the first destination.
Escape, leaving the menu, moving focus outside, clicking outside, or choosing a destination closes
it. Escape restores focus to the wave button. The header's page links and hamburger are removed.
The MarineCast wordmark remains a Home link; Viewshed retains its mode/metric context. Every page uses the order **Home, Features, Sightings, Relationships, Viewshed, Health**. Features retains the existing `#map` route so saved links continue to work. The dropdown has no data-status footer. Home's former page-navigation list is removed; its Data button still opens the fixture catalog.

Every data page uses the shared `LegendDropdown` surface: a compact bottom-left bar and an upward popup with close, Escape, trigger-toggle and outside-click dismissal. Features and Viewshed retain their own units and scale calculations. Viewshed's color controls appear only in its legend popup; The Viewshed tool drawer opens Settings for score/source selection, outlines and keyboard inspection, and Help for methods, credits and provenance. Relationships, Sightings and Health use the same popup for chart keys. Home's decorative artwork has no quantitative legend. See [shared navigation QA](docs/qa/shared-navigation.md).

## Pages

- **Home:** the selected coastal artwork blends into a hex-map illustration, with the shared wave navigation and a Data catalog button. The catalog describes four synthetic features; its cards open Features with the local Data catalog. Artwork is decorative, not a scientific layer. Home and explorer routes support hash links and browser history; the explorer brand returns home.
- **Features (`#map`):** seascape and governance variables, annual kelp with survey-year selection, directional coastal bounds with bearing selection, categorical class/status maps, native R6/R8 selection, full-area colorbars, exact cell values and source/quality dialog, local JSON export, opacity, bottom-right zoom controls, and geographically linked swipe comparison. Drag the center divider to reveal either layer; both full-size maps share pan, zoom, bearing and pitch, and one zoom control operates both. Each variable retains its own scale, original cell values and export. The full-width map has no sidebar: a legend-height tool icon beside the bottom-left colorbar opens Compare, Export and Help to the right; on narrow screens the actions open above that icon. Layers stays bottom right on the same baseline and opens upward, with zoom above it. Static products have no monthly axis; recorded survey years and bearings are separate source slices. R8 overlays load at the current map zoom; viewport filtering preserves native cells and never averages them.
- **Sightings:** synthetic species/encounter filters, locations, feature-pair scatter, background toggle, distributions, empty states, and observation-support placeholders. No ecological, detection, or occurrence inference is performed.
- **Relationships:** filtered Pearson correlations, scatterplots, histograms, a clickable correlation matrix, and a simple redundancy indicator. Advanced lags and scale analysis are future work.
- **Viewshed (`#viewshed`):** click a gold land source to see its saved water-target scores, or enable Target view for the equal mean across all pilot source cells. Source and target roles remain separate even when they share an H3 key. Native pickers offer keyboard selection. Lower/upper estimates, nullable complete scores and input uncertainty have adjustable display scales; the target inspector preserves bounds, support counts and the all-source denominator. Geographic basemap navigation with scroll/pinch zoom, drag, zoom buttons and source provenance are available. This is physical viewability in an exploratory scenario, separate from access, observation effort or detection.
- **Health:** synthetic coverage calendar, quality flags, join loss, provenance, release comparison, and explicitly simulated empty/error states with retry.

## Dataset Insights

Features and Viewshed have an **Insights** tab in the upper right. It opens a light, scrollable panel with a histogram, min/max/mean/median, availability counts, a distribution, selected-cell details and source metadata. Layers remains the data selector; changing native resolution, feature, survey year, bearing, score or source updates the panel. Compare mode uses one shared Comparison Insights panel for both active layers, with paired histograms and box plots, a correlation scatter plot, Pearson r, Spearman rho, and native cell-pair counts. Selecting a map cell shows both original values at that H3 key.

Summaries count each non-null cell equally across the full active native layer, independent of map zoom or viewport. They use original source units, even when the map displays z-scores, logarithmic colors, custom limits or adjusted opacity. Numeric distributions have 24 histogram bins and five equal-width ranges; constant values have one range. Categorical products show source-label frequencies, without numeric means. Zero and Boolean false remain available; nulls remain unavailable. Loading, errors and all-null layers show explicit states. No example statistics or source dates from the design reference are used.

Comparison histograms show each layer's share of available cells, with shared frequency axes. Matching units use common value bins and axes; different units remain on separate value axes. Boxes use linearly interpolated empirical Q1/median/Q3, with observed min/max whiskers. Correlations match exact native H3 keys with finite numeric values on both sides, using the currently selected slices and every complete pair. Scatter rendering caps visible points at approximately 1,200, while the coefficients retain all pairs. Constant or insufficient support reports unavailable correlation; categorical layers retain source frequencies instead of invented numeric statistics.

When both fields have declared, parseable calendar slices, the panel loads recorded periods and shows paired box plots over time. Source years/dates stay distinct, absent periods remain gaps, and unavailable side/period values show explicit markers. Different time grains are rejected without resampling. Bearing slices are directional, not temporal. Timeline axes remain visible while its shared time window scrolls horizontally by keyboard or touch. Time-series reads use the same checked column/native-support assets as the map, without loading every qualifier for every date.

Selected Features cells retain native H3 identity, coordinates, original values and expandable source qualifiers. Viewshed reuses its scientific inspector, preserving lower/upper estimates, nullable complete scores, conditional support and all-source denominators. This remains local research-pilot information, separate from detection or access. The panel stays open during cell inspection and layer/color changes; Escape closes a local popup first, then Insights, restoring focus. Desktop Layers and zoom shift left of the panel; phones keep the panel above the bottom controls. See [Insights QA](docs/qa/insights.md).

## Structure and future integration

`src/data/seascape.ts` and `src/data/viewshed.ts` are typed local product adapters; `src/data/demo.ts` supplies the synthetic pages and the retained demo component. Pages maintain UI state; shared controls, charts, and the local map live in `src/components`. Fixture statistics are calculated independently of chart display caps. Monthly viewability values exist only to illustrate chart/health UI; real viewshed scores are static.

Additional integrations should use typed read-only product adapters. Keep product identity/grain, units, spatial/temporal support, missingness, rights, provenance, and validation status explicit. Add backend filtering and response limits before loading real artifacts. Read only explicitly supplied producer products; do not mutate sibling products, assume the proposed shared manifest is already adopted, or equate this explorer with scientific validation.

The preparation CLI accepts an explicit release path. This repository contains no FastAPI service or acquisition backend. No data fixtures contain real sightings or vessel records. Do not commit private products or credentials.

## Prepare the complete local map catalog

From this checkout, use a Python environment with `pyarrow` and `h3`:

```sh
python scripts/prepare_map.py --seascape ../../Data/seascape/releases/seascape_consolidated_static_native_r6_r8_20261008_v5 --governance ../../Data/governance/releases/governance-shared-study-20261010-v2
python -m unittest discover -s scripts -p 'test_prepare_map.py' -v
```

Paths are explicit source inputs, not sibling runtime imports. Preparation verifies the seascape
publication receipt and manifest members, the governance generation members/validation and
both sidecar checksums. It exports source values/nulls without rounding, independently reads
each encoded column back, and activates the ignored browser catalog only after every table
passes. Immutable assets use content hashes; identical repeats verify/reuse the same snapshot.
No acquisitions, scientific recomputations, source rewrites or producer promotions occur.
Existing caches are retained. The earlier `prepare_seascape.py` remains supported for v1 caches.

The installed catalog uses seascape v5 and governance v2: 2,621 native R6 cells and 88,243
native R8 cells. It includes all 86 governance measurements plus their status fields, the
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
and does not establish current law or exhaustive jurisdiction. Native geometries and the
feature-by-cell fishing-area identity crosswalk remain companion products, not summed cell
metrics. `Data/viewshed` is readiness-only; the separate Viewshed page retains its existing,
explicitly sourced research pilot.

The local cache is included by `npm run build` when present and must not be published without
separate source-rights scope. See [complete map QA](docs/qa/data-map.md).

## Prepare local viewshed data

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

The installed October 11 pilot has **163 land sources, 1,279 water targets and 47,295 source–target pairs**, with 15-mile observer reach. Open `http://127.0.0.1:5173/#viewshed`, or choose Viewshed from Home. The map fills the page below the existing app header, whose subtitle identifies the active mode and metric. It starts in the all-source target view with no selected H3 or information panel. A compact, clickable color bar with percentage ticks sits at bottom left. Click it for palette swatches, coloring method and target opacity; Escape, the close button, clicking the bar again or clicking outside dismisses its popup. A 50 px tools icon sits immediately right of the legend and opens the shared tool drawer with Settings and Help. The 50 px Layers button sits bottom right on the same baseline, with zoom directly above it. Layers opens upward to select the score field. The drawer expands to the right on desktop and above its trigger on narrow screens. Legend, tools, Layers, Settings, Help and standalone inspection are mutually exclusive. Insights can stay pinned while changing layers/colors or inspecting a cell. The recenter button has been removed. **Settings** groups view/score, land-source selection, H3 outlines and keyboard cell inspection; single-source options appear in Source view. Settings closes via X, Escape or outside click and retains configuration. Clicking a water cell opens its score inspector; clicking a land source shows observer/coverage details and switches to that source's target scores. Sources do not have a single target score. Selection has a distinct outline even with H3 grid outlines disabled. Another cell replaces the inspector; empty-map click, X or Escape clears it. Hover only changes the cursor. Opening Settings clears selection; selecting a cell dismisses Settings. On phones the scrollable inspector and Settings become bottom sheets, with sticky close buttons. Help retains map-reading guidance, basemap credits, source qualification and input hashes. Panels use the same light surfaces as Features. The legend stays available throughout.

Right-click anywhere for a small coordinate popup; Copy coordinates writes latitude, longitude in decimal degrees to six places. The popup follows its location on the basemap and closes with Escape, X or normal map click. It is mutually exclusive with Settings and cell inspection; selectable text supports manual copying. The local coastline fallback supports coordinate lookup after zoom/pan. Wheel/trackpad zoom, drag-to-pan, pinch zoom, double-click zoom, keyboard navigation and zoom in/out buttons operate the geographic map. Source, metric, display settings and selections preserve the camera. The distance scale and bottom attribution strip are removed; default-basemap credits are available in Help. This remains a local preview; public presentation needs appropriate visible attribution. `VITE_BASEMAP_STYLE_URL` can override the compatible MapLibre style; the Vite-bundled worker avoids a blob-worker dependency. A labeled local coastline fallback offers Retry basemap. DEM, CHM and buildings are model inputs rather than separately implemented browser display layers.

Target view is `sum(per-source score) / all source cells`, equally weighted by source cell. A missing pair in this verified completed pilot means no target water lattice points within that source's observer reach, so it contributes zero; missing canopy/roof inputs within a modeled pair remain uncertainty bounds and nullable complete scores. Each pair's in-reach water portion may differ: the resulting mean is not a whole-target-water-area mean or a source-area/access-weighted mean. Original per-pair support counts and range-excluded fractions remain available in source inspection. Shading uses the target's water shape, including edge portions beyond a particular source's reach; the scores retain the actual partial support. Display geometry is simplified by 15 m only for rendering, with no change to scores, H3 identity or grid support.

The basemap configuration follows OrcaCast_Public `src/features/map/buildLayers.ts` (`VOYAGER_STYLE`) and `ForecastMap.tsx` (direct map gestures). No sibling runtime imports or changes to OrcaCast_Public were introduced. The browser fetches basemap resources independently of the scientific cache; H3 polygons and values are not sent to the tile provider. See the [OpenFreeMap integration guide](https://openfreemap.org/quick_start/).

This is an **exploratory research transmission scenario**, not an empirically calibrated or promoted viewshed release. It retains the producer's grid/model settings, sampling checks, missingness, input product hashes and limitations in Source & qualification. Score display includes lower estimate, upper estimate, complete score and uncertainty; zero, null and outside reach have distinct meanings. The legend color popup offers four palettes and Value range (min–max, default), Full range (0–100%), Log (value range), Custom range and Quantiles. Value range stretches colors across all active target scores; it changes with the selected source, mode and score field, independently of the map viewport. Log coloring applies `log(1 + score in %)` and stretches across the active values; zero is valid, unknowns stay gray and legend ticks remain in the original percentage units. Quantiles use ten classes across the same active targets; equal scores share a color and tied thresholds may leave classes empty. Fixed and custom ranges retain common color limits between sources/modes. Custom percentage limits clip only the colors: the color bar marks saturated endpoints and the popup counts targets beyond the limits, while inspection retains the original scores. Invalid/incomplete limits leave the last valid range in place. Unknown complete scores stay gray and are excluded from scale statistics; all-unknown and constant layers have explicit legend states. The color bar shows the actual percentage limits; The color popup retains the palette, scale mode, saturation count and class diagnostics. The default palette is Blue to red; the other palettes remain selectable. These controls do not modify the producer data or assumptions.

Like seascape, the local cache is copied into `dist/` by the build and is **for local preview only**. No publication or redistribution review was performed for the pilot inputs. Consumer checks and real-data readback evidence are recorded in [viewshed QA](docs/qa/viewshed-map.md).

## Legacy seascape-only cache

The complete Features catalog above is the active workflow. For an independent legacy v1 cache, use Python 3.14 with `pyarrow` from the app checkout:

```sh
python scripts/prepare_seascape.py \
  --release ../../Data/seascape/releases/seascape_consolidated_static_native_r6_r8_20261007_v3 \
  --output /private/tmp/marinecast-seascape-only-cache
```

On this machine the verified interpreter is `/Users/tylerstevenson/miniforge3/envs/orcacast314/bin/python`. The CLI accepts `--output` for independent verification; its default output is `public/local-data/seascape/`, ignored by Git. It checks the matching published receipt, all manifest file checksums, native row identity, finite values and safe integer encoding. Each exported field is read back and compared against all Parquet values/nulls before the catalog is atomically installed. Existing snapshots are refused; use a fresh output directory to independently regenerate/validate. Source artifacts are read only.

The legacy example uses consolidated v3, published 2026-10-07, with 2,621 R6 and 88,243 R8 rows. Its immutable manifest retains prepublication status text; the matching publication receipt records the subsequent independent review/publication. The adapter preserves both original source bindings and per-field linked row qualifiers. The default is the exact `BATHYMETRY` alias in metres, positive down. Native terrain, freshwater and estuary fields are offered at R8 only. The legacy v1 cache offers numeric columns, including explicit all-null fields; categorical/boolean qualifiers remain in its inspector. The active complete v2 catalog also offers categorical/boolean maps with source labels. Unknown units display `source units` rather than an invented physical unit.

A missing cache or checksum failure produces a visible error/retry state. It does not switch to fixtures. Changing resolution drops an incompatible feature and selects the native bathymetry alias. Comparison is within one native resolution; selected values and provenance follow the selected side. Value availability and unweighted regional cell means are display summaries, not survey completeness, area weighting, habitat absence or ecological validation.

The on-map legend stays visible outside the layers panel. Click the compact bottom-left colorbar to open its popup above the bar, matching Viewshed. Escape, the close button, clicking the bar again or clicking outside dismisses it. Opening color options closes Layers and cell inspection; opening another panel dismisses color options. Choose Ocean blue, Viridis, Warm glow or Blue to red from the palette preview list, then choose the **Coloring method** and layer opacity below. The collapsed card shows only colors and ticks; these controls are absent from Layers. Each palette has ten colors. **Equal bins** uses ten equal-width value intervals; **Quantiles** uses ten classes with linearly interpolated full-area empirical decile thresholds; **Min/max** interpolates continuously through ten color stops. All modes use the selected native layer's non-null values across the full release, independent of the viewport. Ties retain the same color and may leave quantile classes empty. Constant products use one color; all-null products show no numeric scale. Missing values remain gray. Comparison maps show two visibly labeled legends, Left and Right, with independent thresholds for their respective variables. On desktop the left legend stays bottom left beside Tools, and the right legend sits bottom right beside Layers. On phones, or with Insights pinned, the legends stack at bottom left to keep the controls accessible. Each retains the shared color-options dropdown behavior.

Layers offers **Standardize** in place of the former advanced options. It applies `(value - mean) / std` using the full native layer's finite, non-null values and unweighted population standard deviation (`ddof=0`). Each comparison variable has its own mean/std. Map values and legend ticks become dimensionless z-scores; switching it off restores original units. Cell inspection retains original values alongside standardized values, and Source & quality reports the mean/std. JSON exports keep original source values/units and include display transformation metadata when enabled. Nulls remain null; all-null or zero-standard-deviation layers report standardization as unavailable. This is a display transformation; source artifacts are never rewritten.

Annual kelp and directional coastal-ray sidecars retain their distinct year/bearing grain. Select Annual kelp or Directional coastal bounds under Data product, then choose one survey year or bearing; these are never averaged into static maps. Partial source inventories, historical observations, unknown dates, generalized fallback support and modeling eligibility remain source-qualified.

`npm run build` includes any prepared local browser cache in `dist/`; this request only prepares a local preview. The cache is not committed and there is no automatic hosting or upload. Source integration checks and browser evidence are in [seascape-map QA](docs/qa/seascape-map.md).

## Optional MapTiler basemap

Copy `.env.example` to `.env.local`, set `VITE_MAPTILER_KEY` to your own browser maps API key, and restart Vite. The default terrain style is `outdoor-v4`; override `VITE_MAPTILER_MAP_ID` with a MapTiler map ID if needed. Never put an account service token in a VITE variable: these values are included in browser requests and builds.

Use a dedicated origin-restricted key. For this preview, MapTiler documents the allowed origin as `127.0.0.1` (without scheme/port); use a separate production key restricted to the eventual hosted domain. See [MapTiler key setup](https://docs.maptiler.com/guides/credentials/api-key/). `.env.local` is ignored by Git.

MapLibre renders the MapTiler cartography plus the selected local H3 data layer. The local preview has two zoom controls at bottom right and no recenter button or attribution strip; basemap credits are retained in Help. This UI change does not establish attribution-removal permission: [MapTiler attribution requirements](https://docs.maptiler.com/guides/map-design/attribution/remove-attribution/) apply to any publication. Feature, opacity, visibility, selected-cell styling, zoom/pan, and comparison use the same React state. Cells are inspected by selecting them on the map. Sightings keeps its local illustrative map. Native Data maps show a plain loading state while the geographic renderer downloads. Missing keys show a configuration message; initialization, authorization or timeout failures show an error with Retry basemap. The Features page never substitutes the illustrative SVG coastline or synthetic geometry during loading or failure. Explicit demo pages retain their labeled local renderer. A live MapTiler render was verified locally with the user-provided browser key. No remote feature-data API is connected.

## Map atlas design

The supplied MarineCast reference guides the light cards, serif wordmark, slim tool rail and compact Layers panel. The colorbar follows the Viewshed page: a compact bottom-left bar with a rounded color-options popup above it. Palette previews show the selected item; scale and opacity controls update both comparison maps. Escape, the close button, clicking the bar again and outside clicks close the popup. Escape and explicit close return focus to the bar; settings are retained.

The bottom analysis sheet has been removed. Click a native cell for its compact map popup, then open **Source & quality** for exact stored values, original row qualifiers and provenance. Export creates the full current native layer JSON locally. The rail actions are functional. No account, remote persistence or sharing service is connected.

Current design QA: [design-qa.md](design-qa.md). Data integration evidence: [complete Data map](docs/qa/data-map.md), with earlier [seascape-only QA](docs/qa/seascape-map.md). MapTiler supplies cartography only; local producer-backed caches supply values. Other explorer pages remain synthetic demos.

## Home reference update

The default route opens the reference-based home page; `/#map`, `/#relationships`, `/#sightings`, and `/#health` open existing explorer pages directly. The home background and wave mark are generated raster assets derived from the user-selected reference. The wordmark, tagline, mission and navigation are editable HTML. Desktop and mobile layouts use the same artwork with responsive cropping and spacing. The artwork remains illustrative; local seascape integration belongs to the Features page.

Asset provenance and exact generation prompts: [ARTWORK.md](public/assets/home/ARTWORK.md). Home motion QA: [home-grid-motion.md](docs/qa/home-grid-motion.md). Previous Map QA: [map-reference.md](docs/qa/map-reference.md).

## Home grid motion

The home artwork has a slow 14-second breathing glow, sparse asynchronous twinkles, and a mouse-proximity shimmer with a gentle fade. A source-derived mask restricts light to the existing coarse blue grid band; terrain, forest, navigation and the original artwork remain intact. The effect is illustrative, not data.

Reduced-motion preferences disable the effect. Touch keeps ambient motion but ignores cursor shimmer. Hidden tabs and the open Data catalog pause animation. Rendering is capped at 30 frames/second and 1.5 display density, with cleanup when leaving Home. Exact independently animated cell boundaries would require an authored grid layer; current glow centers approximate the artwork spacing and are clipped to its blue paint.

Motion QA: [home-grid-motion.md](docs/qa/home-grid-motion.md). Prior home QA: [home-reference.md](docs/qa/home-reference.md).
