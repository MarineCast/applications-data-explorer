# Data atlas map redesign QA

> Historical evidence status — 2026-10-24: the 37 screenshots formerly under
> `docs/qa/coastal-world/` were removed in the approved deferred cleanup, after
> their associated Home renderers had been retired. References to that directory
> and its bare screenshot filenames below are historical names, not files still
> shipped or current validation evidence. Their tracked history remains available
> in Git. Current QA assets elsewhere are retained. See the
> [cleanup and test-migration record](docs/cleanup.md).

final result: passed

## Approved sources and final scope

The selected MarineCast mock is `/var/folders/fc/_btcrkc90g7b8dmcf1b_4_g80000gn/T/codex-clipboard-6a7f452e-fc64-42db-80b9-75984a8b16d0.png`. A durable exact copy is `reference.png` in the evidence folder below. The subsequent user instruction explicitly removes its bottom analysis section and moves palette, scale and opacity from Layers into a dropdown opened by the compact top-left colorbar. Collapsed legend content is limited to colors, numeric ticks and the unit. Existing removed finder, variable search, region and grid visibility controls stay removed.

Dropdown source: https://21st.dev/@kokonutd/components/profile-dropdown. Opened its actual interactive preview and expanded the profile trigger. Reused the separate rounded trigger/menu structure, thin borders, soft shadow, spaced list items and selected treatment for scientific settings, without account/profile content or a new dependency.

Preview: http://127.0.0.1:5173/#map. The local Vite server remains running. Temporary browser viewport overrides were reset and the preview tab retained.

## Captures and comparison evidence

Evidence folder: `/Users/tylerstevenson/.codex/visualizations/2026/10/08/01a11ade-ab6a-7ac0-b905-d26882f67cfc/atlas-redesign/`.

- `colorbar-desktop-final.jpg` and `final-preview.jpg`: 1536 × 1024, density 1, light Map route, R6 bathymetry, Ocean blue, quantiles, 80% opacity; legend settings and Layers open.
- `full-current-comparison.jpg`: supplied atlas source left and final implementation right, both 1536 × 1024. Opened and inspected together. The absent bottom sheet and relocated settings are explicit user overrides; live cartography/source numbers retain their actual semantics.
- `sidebar-current-comparison.jpg`: matching 80 × 1024 source/implementation crops. Opened and inspected together. The active Layers item reflects the actual open panel; Explore in the mock is illustrative state.
- `layers-current-comparison.jpg`: matching 262 × 518 crops; the final Layers panel is shorter because palette, scale and opacity moved out.
- `dropdown-reference.jpg`: expanded live reference captured at 390 × 844. `dropdown-comparison.jpg`: reference and actual mobile trigger/menu crops side by side at native pixel size, without stretching. Opened and inspected together; menu contents and height adapt to the requested controls.
- `colorbar-mobile-open.jpg`: 390 × 844, Viridis quantiles, settings open. `colorbar-mobile-cell.jpg`: Ocean blue quantiles and actual null-cell popup. `source-modal-mobile.jpg`: original source value/qualifier inspector on phone.
- `colorbar-mobile-comparison.jpg`: both full-height mobile comparison maps, separate colorbars and the lower settings menu scrolled to opacity; its bottom is 829.5 px within the 844 px viewport.
- `colorbar-tablet.jpg`: 1024 × 768, Ocean blue quantiles and both floating settings cards. No horizontal document overflow at phone, tablet or desktop widths.
- `source-modal-desktop.jpg`: exact-value/source dialog with two-column cell details and wrapping actions.

## Fidelity surfaces

No remaining actionable P0/P1/P2 findings for the final requested scope.

- Typography: Georgia serif MarineCast wordmark and restrained sans-serif controls match the supplied atlas language. Existing outline icon library matches the rail/reference. Technical identifiers and hashes wrap within the source dialog.
- Spacing/layout: 62 px header, 68 px desktop rail/54 px phone rail, 244 px desktop Layers card, standalone 292 px desktop colorbar with an 8 px gap to its menu. Full available map height replaces the removed sheet. Phone Layers controls avoid the zoom/reset column.
- Color/tokens: cream cards, thin pale borders, rounded corners, blue selected states and subtle shadows. Four ten-color palettes remain data-driven; native non-null full-area values set thresholds independently of viewport. Nulls are gray; constant values use the same single color as the rendered map, including min/max mode.
- Asset quality: actual MapTiler cartography and source-backed native H3 polygons are retained. No invented satellite artwork, geography, login identity or provider labels were copied from the mock. Colorbars and palette previews are functional quantitative controls, not decorative image substitutes.
- Copy/content: collapsed legends have no feature title. Units remain attached to numeric ticks. Original source definitions, exact values, qualifiers, publication state and modeling eligibility remain in the Source & quality dialog and JSON export. Other explorer pages remain demo-backed.

## Interactions and accessibility

Live browser checks covered opening/collapsing settings, changing palettes and equal/quantile/min-max scales, continuous gradient rendering, opacity by keyboard, Escape returning focus to the colorbar, outside clicks dismissing settings, layer-panel open/close, resolution switching, comparison menus, real null-cell selection, source-modal open/close, Export and Help. The legend controls are absent from Layers. R8 remains gated by zoom; this redesign does not aggregate cells.

The tool rail also supports local export, sidebar label collapse and comparison. Exact export values/nulls/qualifiers are covered by integration tests. Source details use a native modal dialog. Palette/scale lists use native radio inputs, with full-row hit targets, selected checkmarks and visible keyboard focus. Opening focuses the current palette. Moving focus outside, clicking outside or Escape dismisses the nonmodal settings dropdown. Reduced motion disables its short entrance animation. Phone checks use browser viewport overrides, not a physical phone.

Fresh reload and subsequent primary interactions produced zero new browser warnings/errors. No remote data API, account persistence or publishing was added.

## Iteration record

1. Corrected stylesheet import order so atlas rules take precedence over legacy styles.
2. Compared the original bottom-sheet draft with the supplied atlas at 1536 × 1024 and fixed tab placement, wrapping summaries and source-panel scrolling.
3. Applied the user's later scope change: removed the bottom sheet and its newly added histogram/statistics code; moved exact inspection into the existing popup/dialog flow.
4. Live browser testing caught a dropdown closing during radio selection. Replaced blur-based dismissal with explicit outside pointer/focus handling and enlarged native radio hit areas. Palette and scale changes now stay open.
5. Phone comparison exposed a lower dropdown extending offscreen and a Layers toggle overlapping reset. Constrained the lower dropdown to available height with scrolling and moved Layers left of the map controls. Reopened, scrolled to opacity and confirmed the card fits onscreen.
6. Final full/focused combined comparisons and responsive captures were inspected after fixes. No further P0/P1/P2 iteration remains.

## Validation and boundaries

`npm run typecheck`, `npm run lint`, all **36 tests across 10 files**, `npm run build` and `git diff --check` passed. After the last CSS-only adjustments, the production build and whitespace check passed again. The existing lazy MapLibre chunk size advisory remains.

Tests cover original source loading/checksum rejection, exact zero/null handling, native resolution compatibility, comparison-side provenance, legend controls outside Layers, current radio selection, Escape/outside dismissal, constant/all-null legend colors, local JSON export identity/units/source hashes/qualifiers, renderer lifecycle/readiness, native R8 gating and popup projection cleanup. Home and other-page regressions also pass.

This is local consumer/UI validation, not new source acquisition or ecological qualification. No toolkit repository or source release was changed. No commits, push, deployment or remote sharing were performed. Prior home motion QA is preserved at `docs/qa/home-grid-motion.md`.

P3 follow-up: live cartographic label density, provider terrain styling and geographic framing differ from the illustrated reference. These are outside the requested card/sidebar redesign and preserve the functioning map provider.

## Cell-save removal

Removed the Bookmarks rail item, saved-cell state/dialog, and Save cell actions from both the map popup and source inspector at the user's request. Updated export/inspection regression checks assert those controls are absent. Current preview evidence is `no-cell-bookmarks.jpg` in the evidence folder above; cell inspection and provenance remain available. All 36 tests, type checking, lint, build and whitespace checks pass.

## Standardize follow-up

Layers advanced-option items are removed and replaced by Standardize with the requested formula and a compact accessible switch. The legend dropdown still owns palette, scale and opacity. At desktop 1536 × 1024 and phone 390 × 844 the Layers card, switch and helper text fit without clipping or horizontal scrolling. Turning the switch on changes map/legend units to z-scores; turning it off restores source units. Source inspection keeps raw and standardized values together. All-null support reports unavailable. Comparison legends use separate layer statistics. No cell-saving controls or analysis sheet were reintroduced.

Evidence: `atlas-redesign/standardize.jpg` and `atlas-redesign/standardize-mobile.jpg` in the evidence folder above. Live MapTiler rendered successfully; fresh console checks recorded no warnings/errors. Final checks: typecheck, lint, 44 tests across 11 files, build and diff whitespace check pass (existing non-blocking MapLibre chunk-size build warning). The real-data calculation was independently compared with NumPy population mean/std; detailed numbers are in `docs/qa/seascape-map.md`.


## Insights panel — 2026-10-12

Final result: passed.

This section records the new requested Insights scope; the earlier historical sidebar/analysis-sheet findings above describe previous iterations.

Source: `/var/folders/fc/_btcrkc90g7b8dmcf1b_4_g80000gn/T/TemporaryItems/NSIRD_screencaptureui_svZJ3f/Screenshot 2026-10-12 at 8.28.47 PM.png` (2162×1204 design board).

Implementation/evidence root: `/Users/tylerstevenson/.codex/visualizations/2026/10/12/01a1325d-08fd-7f22-b187-e613f7b82fe4/`.

- Final desktop: `insights-desktop-final.png`, 1006×1020 CSS/pixels, density 1; R8 Bathymetry, Ocean blue, selected native cell, open panel.
- Full comparison: `insights-comparison-final.png`, 2012×1020. Reference app-frame crop (1102,129)–(2112,1151), normalized to 1006×1020, displayed beside the native screenshot. The design-board CSS density is unknown; this scale normalizes the visible app frame rather than claiming exact physical pixel fidelity.
- Focused comparison: `insights-panel-comparison-final.png`, 700×926. Reference panel crop (1732,150)–(2102,1137), normalized to 350×926; implementation crop (640,78)–(990,1004). Both full and focused comparisons were opened together and inspected after fixes.
- Responsive evidence: `insights-mobile-final.png` (390×844), plus live 320×844 check. Viewshed evidence: `insights-viewshed-final.png` and `insights-viewshed-mobile.png`. Collapsed evidence: `insights-collapsed.png`.

Typography follows existing sans-serif controls: heading 18 px, dataset 16 px, section headings 14 px, statistics values 13 px, rows/axes 12 px. Source-support notes are secondary text. The shared serif wordmark/header is retained. Layout uses a 350 px right panel, 16 px desktop inset, rounded 15 px border, scrollable body and persistent close header; mobile uses 10 px inset and clearance for bottom controls. Thin pale dividers, cream/white surfaces, restrained blue text and shadows follow the supplied reference and existing app tokens. Distribution swatches follow the active palette. Original identifiers wrap without colliding with values.

Native geographic map assets and the established wave/logo/icon library are reused. SVG plots are quantitative renderings of real source data. The reference's invented histogram, means, source year and date are not copied. Real native R8 cells are finer than the illustrated grid. The actual bathymetry distribution is strongly skewed and has a different mean; these are intentional data differences. Source metadata is placed below selected-cell details and can be scrolled into view. H3 resolution is read-only in Insights because Layers owns data selection. The user's upper-right tab placement overrides the reference's middle-right collapsed position.

Iteration findings and fixes:

1. P2: dense source qualifiers made the selected-cell section too long. Moved them into the expandable Source & quality disclosure while retaining exact values.
2. P2: panel text was too small. Increased heading, axes, numeric card and row sizes and rechecked the final focused comparison.
3. P2: long native count labels crowded the vertical axis title. Increased histogram left margin to 70 px and separated labels from the Cells title.
4. P2: mobile pinned panel covered Layers/palette/settings popups. Raised active map-control popup stacking, checked pointer hit targets, changed palettes and selected R8 with Insights still open. Added Features Layers Escape/focus handling; tests verify local popup then sidebar dismissal.
5. Final desktop/phone and Viewshed checks found no remaining actionable P0/P1/P2 issues in this scope. Local scientific meaning, missingness and source provenance are retained.

Owner checks: lint, typecheck, 103 tests across 20 files, production build and whitespace check passed. Build emits chunk-size advisories. Detailed source/interaction evidence and validation boundaries: `docs/qa/insights.md`. No publication or source producer changes.


## Comparison legend follow-up — 2026-10-12

Passed native visual/interaction QA for two named legends, Left and Right, each retaining its own dataset's native thresholds and units. Desktop puts them on opposite sides of the bottom dock, with the right bar immediately left of Layers. Phone and pinned-Insights layouts stack them at bottom left. Both cards remain 50 px tall; single-map presentation is unchanged. Native 1280×720, 390×844 and 320×844 checks confirmed dropdown access and no legend/document overflow. Evidence: `compare-legends-desktop.png`, `compare-legends-mobile.png` in the October 12 evidence root above. See `docs/qa/insights.md` for validation status.


## Paired Comparison Insights — 2026-10-12

Final result: passed. One 350 px panel now compares both active layers, retaining the established light surfaces, typography, native map, bottom controls and source disclosures. Paired histograms, min/max-whisker boxes, correlation cards/scatter, and recorded-time boxes use actual source values. Matching units share quantitative axes; different units stay separate. Blue/copper keys identify Left/Right. Selected H3 cells preserve both source values and missingness. The single-dataset and Viewshed panel flows remain intact.

Native desktop 1006×1020 and phone 390×844/320×844 checks covered plots, source selection, native R8, both units, keyboard scrolling and control reachability. Iteration fixes: normalized histogram frequencies to keep unequal-support distributions visible; separated long value labels from vertical axes; added fixed time-series value axes and a keyboard-focusable shared time scroller; kept small-screen comparison units in the legend captions and shortened tiny ticks without changing original values. No remaining actionable P0/P1/P2 issue in this scope. Source-qualified zeros and collapsed quartile boxes are retained even when visually sparse. No fabricated dates, bins, correlations or observations were added.

October 12 evidence root above contains `compare-insights-histograms.png`, `compare-insights-correlation.png`, `compare-insights-time-series-r8-final.png`, `compare-insights-paired-time-mobile.png`, and `compare-insights-mobile-final.png`. Detailed calculations and validation are recorded in `docs/qa/insights.md`. The supplied original reference continues to guide the panel surface; the paired plot content follows the subsequent user request.

Final evidence includes `compare-insights-final.png` for the paired boxes/correlation panel with current legend labels. Owner gates passed: lint, typecheck, 121-test full suite, final 22 affected tests after label fixes, production build and whitespace. The build retains bundle-size advisories. No browser console errors were observed in the final native check.

## San Juan map scene — October 13, 2026

Final result: passed.

Source visual truth: user style reference `/var/folders/fc/_btcrkc90g7b8dmcf1b_4_g80000gn/T/codex-clipboard-753cd09b-9798-4aff-8bd9-72c358e74d09.png`, with the later San Juan geographic correction taking precedence. The actual geometry guide is `/Users/tylerstevenson/Documents/Codex/2026-10-13/ple/work/assets/geography-guide.png` (1536×1024). Its coastline provenance, bounds and projection are in `public/assets/home/san-juan/geography.json`.

Browser implementation evidence: `/Users/tylerstevenson/Documents/Codex/2026-10-13/ple/outputs/san-juan-heat-visible.png`, `san-juan-desktop.png`, and `san-juan-mobile.png`. Desktop viewport and capture are 1536×1024; phone viewport and capture are 390×844, normalized at one output pixel per CSS pixel. Source guide and desktop have identical framing. The mobile camera intentionally crops to the western channel.

Full-view comparison: `/Users/tylerstevenson/Documents/Codex/2026-10-13/ple/outputs/design-comparison.png` places the style reference, geometric guide and browser implementation in one comparison image, each scaled to 768×512. No separate focused crop was required: original-sized desktop and phone captures make the small text, edges and object transparency readable.

Fidelity surfaces: existing Times/Georgia display typography and small uppercase labels are retained; desktop spacing remains consistent, mobile location copy now clears the buoy; text and navigation were made warm white with shadow to retain contrast over the blue map, with a translucent control backing. Raster imagery retains the supplied painterly language, with isolated transparent object silhouettes and no visible bounding rectangles. The geographic correction deliberately replaces the invented island composition and alpine snow peaks with source-aligned San Juan shapes and wooded hills. App copy and catalog content remain unchanged. Painted edge detail is approximate, while animation eligibility uses the source raster mask; water colors, terrain, flow and heat are decorative.

Comparison history: initial browser/source-mask inspection found the boat envelope touching shoreline and mobile location copy overlapping the buoy (P2). Moved the boat path farther west and the phone copy upward. The revised captures clear both issues. Increased current trail length after initial motion inspection. No actionable P0/P1/P2 issues remain. Minor P3: avoidance turns in individual streamlets can look angular near tiny islands.

Interactions: play/pause freezes/resumes scene time; catalog opens/closes and pauses the scene; shared navigation to Health and back destroys/recreates the renderer without console errors. Browser heat evidence records opacity 0.718 at scene time 0.183 and 0.000 at time 7.500. Tests cover reduced motion and lazy lifecycle cleanup. Context-loss recovery is implemented but not browser-forced.

Validation: typecheck and lint passed; all 127 tests across 28 files passed; production build passed (existing large-chunk advisory remains). `git diff --check` passed. An independent mask check sampled 384,128 subject-envelope boundary points over 600 seconds with zero land intersections; evidence is in `outputs/animation-verification.json` in this task. No scientific/provider validation is implied by these visual and software checks.

## Clearer current lines — October 13 follow-up

Final result: passed. Scope is current-line readability only; background art, geography, labels and independent subjects remain as previously implemented. Reference: `/var/folders/fc/_btcrkc90g7b8dmcf1b_4_g80000gn/T/codex-clipboard-1d7dda5a-c3ee-4e79-9f9d-9c5a20910e9f.png`. Browser evidence: `/Users/tylerstevenson/Documents/Codex/2026-10-13/ple/outputs/clearer-currents-desktop.png` (1536×1024) and `clearer-currents-mobile.png` (390×844), one captured pixel per CSS pixel. `clearer-currents-comparison.png` places reference and desktop at equal 768×512 panels for the same-input comparison. The full-sized views clearly expose line edges; no focused crop required.

Lines now have higher opacity, a wider screen-aware stroke, a subtle dark keyline, longer trails, sparse moving arrowheads, and lower overall density. Initial brighter strokes exposed angular shoreline steering (P2); a smoothly sampled blurred shoreline potential plus velocity damping replaces abrupt directional kicks. The second desktop and phone pass shows continuous readable bends without shoreline zigzags. Source-mask rejection is retained. Typography, copy, layout and backdrop colors are unchanged; existing raster asset quality and transparency remain intact. The new reference's extra buildings/clouds and darker paint are outside this targeted request.

Typecheck, lint, 12 focused tests and production build passed; the existing large-chunk advisory remains. Pause/play and desktop/phone resizing were checked. No browser errors; two Pixi bound-texture cleanup warnings appeared during viewport resizing, without a visible failure. No actionable P0/P1/P2 visual findings remain.

## Focused Orcas Island field atlas — October 13, 2026

Final result: passed for the focused prototype requested by the user. The subsequent pasted design brief takes precedence over the earlier vivid full-archipelago reference, and the user confirmed the existing island shape. Scope: one accurate island, quiet water, a small forest, and one functional lookout. The existing mask supplies the Orcas connected component with translation and uniform scale only; `public/assets/home/field-atlas/geometry.json` records lineage. Terrain and six transparent tree variations are independent generated assets. All 62 tree roots are on the source land mask. Decorative shallow-water bands are shore-distance shading, not bathymetry; currents and the viewing fan are illustrative.

Final desktop evidence: `/Users/tylerstevenson/Documents/Codex/2026-10-13/ple/outputs/field-atlas-desktop.png` (1536×1024). Phone evidence: `field-atlas-mobile.png` (390×844), same output root. `field-atlas-lookout.png` shows keyboard focus and the viewing fan. `field-atlas-comparison.png` compares the previous reference and this deliberately quieter, scoped implementation in equal 768×512 panels. Full-sized captures expose shorelines, cutout edges, labels, and typography; no crop was needed. The reference's full archipelago, bright mottling, clouds, multiple destinations, and slogans are intentionally absent per the newer brief and focused-island choice.

Visual checks: preserved island proportions; muted sage terrain and dusty teal sea; fine warm stone coast; six varied painted tree silhouettes; stronger cream lookout; ivory chart title; small Menu and Pause. Initial shoreline halo was softened and the phone composition enlarged without stretching the island. Desktop and phone menu/preview fit, stationary navigation targets, keyboard focus/Enter to Viewshed, return-home lifecycle, and Escape dismissal passed. Motion uses anchored crowns responding to shared travelling gusts with quiet intervals. Current particles use a separate clock-driven path. Paused samples retained scene time 11.361 and frame count 3952 across calls; menu-open samples retained 17.344 and 1038. Reduced-motion preference changes are tested. Context-loss behavior was not browser-forced; static fallback remains available when WebGL cannot start.

Validation: typecheck, lint, all 127 tests across 28 files, production build, and whitespace check passed. No browser console errors. Non-blocking warnings: React Three Fiber uses deprecated THREE.Clock with the installed Three version; build retains large-chunk advisories, including the lazy atlas renderer. `npm audit` reports existing Vite/Vitest dev-tool advisories; this pass did not force dependency upgrades. No P0/P1/P2 visual findings remain in the prototype scope. No scientific validation or publication is implied.


## 2026-10-15 — Layers domain drawer

final result: passed

Source: the three conceptual domain-icon/drawer images attached in the current conversation, with the user's explicit instruction to follow the existing app design and retain the bottom-left Layers trigger. Existing `panel`, legend, button and typography styles supply the visual tokens. The examples specify interaction and icon meanings; their dark theme and large typography are intentionally not copied.

Implementation evidence: `/tmp/domain-dock-qa/desktop.png` (1280 × 800), `/tmp/domain-dock-qa/mobile.png` (390 × 844), `/tmp/domain-dock-qa/small-phone.png` (320 × 568). Captures use CSS-pixel dimensions at browser density 1. Tested with the Codex in-app browser against the user's existing Vite server. Temporary viewport overrides were reset. No new server was started.

Compared the requested control structure and states to the rendered screenshots: Layers remains beside the legend; its icon rail opens upward; the domain panel opens on the right above the legend. Active icons use soft blue; inactive connected domains remain navy; domains without prepared app layers are muted. The panel reuses the app's light surface, 9px corners, compact native selects and existing source qualification text. No raster assets or new icon dependency were needed; all symbols come from the existing Lucide library.

Fidelity surfaces: typography uses the existing app Arial controls and compact headings; layout uses the existing 8px gaps and 50px bottom controls; colors reuse cream/navy/blue panel tokens; icons are library vectors with consistent stroke and 22px size; content uses real catalog domain names, features and native resolution availability. Source example layer counts, dates and fictitious data are not copied. Full-view and focused rail/panel comparisons show the intended structure in the app's established style.

Interactions verified in browser: Layers opens the rail alone; Seascape opens its panel; Governance replaces the panel and active highlight; closing the panel retains Governance; closing Layers hides the rail. Small-phone layout has no horizontal document overflow, the panel fits within the viewport, and the rail scrolls when constrained. Console error count: zero. Unit interaction checks also cover unsupported native resolutions, keyboard Escape focus restoration, outside dismissal, comparisons, dates, retry, and retained selections.

No actionable P0/P1/P2 findings remain. Existing native select labels may truncate long scientific field names at phone widths; source identities and full option names remain available in the controls and inspector.

## Data map hierarchy refinement — October 15, 2026

Completed in `applications-data-explorer`. The product dock, large geographic map and right Insights drawer are retained. Current behavior supersedes the previous bottom-mounted domain-dock arrangement described above.

The map uses subdued basemap water/terrain/landcover, labels above the scientific overlay and subtle zoom-dependent cell outlines. Source-bound positive-down mean depth is declared in metres by the flat Parquet's embedded source manifest. The consumer now carries that declaration into its catalog and uses fixed presentation breaks at 0, 50, 100, 200, 500 and 1,000 m, with an open final band. These are display choices. Undeclared units remain explicitly unavailable. Original values, native keys, nulls and qualifications are preserved.

The header contains the active metric, Compare, Export and Help. The upper-left dock stays available when its aligned 320 px feature drawer closes; Map only collapses the dock. Supported single resolutions are metadata, while actual alternatives remain selectable. Unavailable product names/statuses are available on hover and keyboard focus. Appearance contains palette/classification/opacity/outlines and Advanced display z-scores. The persistent legend shows identity, unit, support, coverage and missing-value context. Same-metric comparisons share class breaks; histogram/distribution bins are explicitly independent of map classes.

Insights prioritizes the histogram and short summary cards, with distribution/source details collapsed. Full dataset is the default; Visible map deliberately summarizes cell centres inside the map bounds without changing map classes or exports. Cell clicks open Selected cell in this drawer and retain exact stored values; source qualifiers and the detailed source dialog remain available. These layout changes are scoped to the data map; Viewshed retains its existing Insights presentation.

Live browser checks used 1280 × 800 and 390 × 844 viewports: R6 and native R8 rendering, labels, dock/drawer alignment, close controls, cell selection, full/visible summary scopes, and mobile comparison legends. Fixed mobile dock/panel overlap, close-button overlap, and the inherited tick rule hiding a break. Browser error/warning log was empty after these checks. Viewport overrides were reset and the R6/full-dataset preview was left open.

Evidence: `/Users/tylerstevenson/.codex/visualizations/2026/10/15/01a141ee-3856-7791-bdd6-6e78def98511/data-map-refinement.jpg` and `data-map-mobile.jpg` in that directory. The local browser cache was rebuilt with exact readback across 89 tables and 1,291 feature descriptors (snapshot `ab06595ec5f33831a3ba14a9027330574b4deba4c908e46321afb83c4bf6d40a`). Source products were read only.

Owner checks passed: 138 frontend tests across 28 files with one worker, five map-export tests, lint, typecheck through the production build, build and `git diff --check`. Concurrent runs intermittently exceeded the pre-existing five-second demo-interaction test deadline; the final serial suite passed. Existing bundle-size advisories remain. Validation covers application behavior and source readback; no regional scientific calculation, acquisition or publication was performed.

Changed surfaces: `src/pages/SeascapeMapPage.tsx`, `src/pages/MapPage.tsx`, `src/App.tsx`, `src/atlas.css`, the dock/legend/MapTiler/Insights components and their checks, `src/data/colorScale.ts`, `src/data/map.ts`, `src/data/seascape.ts`, the flat-cache exporter/preparer and exporter checks, and this README/QA documentation. Existing unrelated checkout edits were retained.

## Gaussian smooth surface — October 15 follow-up

Completed for the data map. Appearance now has **Smooth surface**, a **Smoothing** width control (0.25–3× native cell width; default 0.75×) and an independent **Contour lines** checkbox. The option defaults off. The preview is left on with contours for review. The continuous palette ramp and persistent “Smooth surface · visual interpolation” label identify the display state; ordinary grid outlines are suppressed while selection stays outlined. Categories and all-unavailable fields cannot enable a blend.

`src/data/smoothSurface.ts` rasterizes full native H3 support, applies availability-normalized separable Gaussian convolution to numeric measurements, and derives contours from the blended scalar. The module worker in `smoothSurface.worker.ts` colors and transfers a bounded raster to MapLibre without remote requests. This blends measurements rather than cell density or preclassified RGB. Missing source cells stay neutral and outside support transparent. It is a Web Mercator display interpolation that can blend nearby regions across gaps, not water-network connectivity or measured topography. Original values, native identity, units, qualifiers, Insights statistics and exported cell arrays remain intact; JSON may record the requested display settings separately.

`src/components/useSmoothSurface.ts` cancels superseded work, rejects late responses, releases workers and falls back visibly to native cells on worker/image failure. Panning, zooming, opacity and selection reuse the surface. `MapTilerCanvas.tsx` uses geographic native-H3 picking, independent of the display raster, and separates geometry updates from paint/selection changes. `MapLegend.tsx`, `SeascapeMapPage.tsx`, `src/data/map.ts` and `src/atlas.css` connect the controls and display state. No producer or browser-data-cache rebuild was needed for this follow-up.

Live browser checks covered R6 and R8 surfaces, contours on/off, rapid width changes, native-value inspection, panning and responsive Appearance layout at 1280×800 and 390×700. Recorded local worker generation was approximately 0.76 s for R6 and 0.97 s for R8, with about 1.0–1.4 s observed during other loaded checks; these are local display timings, not regional scientific benchmarks. Selected-cell inspection returned the original R8 value (162 m at native key `8828dea309fffff`). The dock no longer covers the taller Appearance popup. Desktop/mobile evidence is saved as `data-map-smooth-surface.jpg` and `data-map-smooth-mobile.jpg` in `/Users/tylerstevenson/.codex/visualizations/2026/10/15/01a141ee-3856-7791-bdd6-6e78def98511/`.

Validation passed: all 146 frontend tests across 30 files, lint, typecheck, production build and whitespace checks. Added checks cover Gaussian normalization, valid zero, missing/outside masks, constant fields, fixed scale colors, contour support, cancelled/late jobs, worker failure, categorical eligibility, controls and original-value export under display toggles. The existing build-size advisory remains. Temporary viewport overrides were reset. No source acquisition, scientific producer run, release promotion or publication was performed.

## Inset palette picker — October 15 follow-up

The data-map Appearance picker now places rounded swatches before their labels inside padded 48 px rows. The selected option has the app's pale blue fill and navy text, with a separate keyboard focus ring. Swatches and labels remain inset from both borders. Native radio semantics and arrow-key selection are retained; the Viewshed picker is unchanged. The sticky Appearance heading also masks scrolled content above it.

Mouse selection, keyboard navigation and spacing were checked at 1280×800 and 390×700. Evidence: `data-map-palette-picker.jpg` and `data-map-palette-mobile.jpg` in `/Users/tylerstevenson/.codex/visualizations/2026/10/15/01a141ee-3856-7791-bdd6-6e78def98511/`. Ocean blue was restored and viewport overrides reset. The 13 existing legend/data-map tests, lint, typecheck, production build and whitespace checks passed. The existing bundle-size advisory remains. Changes are limited to `src/components/MapLegend.tsx`, `src/atlas.css` and this QA note.

## Map-only control at dock top — October 15 follow-up

Moved Map only before the domain buttons in `DataDomainDock.tsx`, so visual and keyboard order agree. The divider now sits below that control. `src/atlas.css` also aligns the collapsed dock's replacement button with the same top position at desktop and phone widths. Collapse/reopen and icon order were checked live; existing map interaction tests (11), lint, typecheck, production build and whitespace checks passed. The existing build-size advisory remains. Evidence: `data-map-dock-top.jpg` and `data-map-dock-mobile.jpg` in the same visualization directory above, checked at 1280×800 and 390×700. The expanded dock was left visible and viewport overrides reset.

## Simpler Appearance opening view — October 15 follow-up

Appearance now opens with only the palette list and a collapsed Advanced section. Classification/category keys, smoothing and contours, cell outlines, opacity and display z-scores are inside Advanced. Removed the Appearance source-definition disclosure, general classification explanations (including the quantile text) and redundant missing-value footer. The persistent map legend retains units, coverage, missingness and smooth-display context; layer/source details remain available in their existing surfaces.

Updated `MapLegend.tsx`, its calling page, scoped styles, existing legend/page interaction tests and README. All 13 focused tests, lint, typecheck, production build and whitespace checks passed; the existing build-size advisory remains. Live checks covered the palettes-only default, Advanced expansion/collapse, classification and opacity adjustments at desktop/phone sizes. Depth bands and 80% opacity were restored; Advanced was left closed and viewport overrides reset. Evidence: `data-map-appearance-simple.jpg`, `data-map-appearance-simple-mobile.jpg` and `data-map-appearance-advanced.jpg` in the same visualization directory above. No data, calculations or zoom placement changed.

## Zoom beside Insights — October 15 follow-up

Features now places zoom immediately left of Insights in a horizontal pair of 44 px buttons. Shared inset/width/gap variables keep the row aligned at desktop and phone widths. The Features Insights trigger remains visible and keyboard-focusable while open, and the panel opens 8 px below the row. Controls no longer move when the panel opens. This is enabled through an optional `persistentTrigger` prop; other Insights consumers retain their current behavior.

Changed `src/atlas.css`, `src/components/DatasetInsights.tsx`, `src/pages/SeascapeMapPage.tsx` and README. The existing 19 renderer, Insights and data-map interaction tests, lint, typecheck, production build and whitespace checks passed. The existing build-size advisory remains. Browser checks at 1280×800 and 390×700 confirmed equal top alignment, an 8 px gap between zoom and Insights, an 8 px gap below the row, zoom in/out, and opening/closing the panel from the persistent trigger. The original zoom was restored, the panel left closed and viewport overrides reset. Evidence in the same visualization directory: `data-map-zoom-beside-insights.jpg`, `data-map-zoom-insights-open.jpg`, `data-map-zoom-mobile.jpg` and `data-map-zoom-mobile-open.jpg`.

## Searchable source pickers and quieter legend — October 15 follow-up

Removed the visible Appearance, partial-coverage and outside-domain labels from the Features legend. Metric identity, declared units, native support, color breaks, the unavailable-value key and the smooth-display indicator remain. Removed the layer-picker Data details section.

Feature and comparison data-product controls now use `SourcePicker.tsx` and `SourcePicker.css`: grouped searchable choices, selected-item highlighting, an information button on every row, and inline summaries that do not select the item. The selected item is placed first within its group. Search, Arrow Up/Down, Home/End outside the search input, Enter, stepped Escape, focus return, outside dismissal and empty results are supported. All-unavailable fields remain selectable; products unsupported at the current resolution retain information while selection is disabled.

`src/data/sourcePicker.ts` presents existing source definitions, declared depth semantics and exact availability counts. Generic preservation boilerplate is replaced by explicit field context and a notice when no detailed description is supplied. Undeclared units are not inferred from names. Source-specific research qualifications remain available. Information cards show units, native H3 resolution and available-value counts, and scroll into view on phones. A bounded layer panel and opaque sticky heading keep the card clear of the legend and prevent scrolled text bleeding above the heading.

Validation: all 152 frontend tests across 32 files passed with one worker, including three new picker checks for search/keyboard selection, information without selection, empty results, disabled-product information, all-unavailable fields, focus return and source-semantic preservation. Focused picker checks were rerun after the final information-card adjustment. Lint, typecheck, production build and whitespace checks passed; the existing large-chunk advisory remains. Browser checks covered the real 311-item R6 Seascape list, filtering to mean depth, source information without a layer change, desktop/phone scrolling, and comparison data-product information. The single-map R6 bathymetry view and original display settings were restored. The feature summary is left open for review; viewport overrides were reset.

Evidence: `data-map-source-picker.jpg` and `data-map-source-picker-mobile.jpg` in `/Users/tylerstevenson/.codex/visualizations/2026/10/15/01a141ee-3856-7791-bdd6-6e78def98511/`. Changed surfaces are the new picker/presentation helper and checks, `MapLegend.tsx`, `SeascapeMapPage.tsx` and its existing checks, scoped atlas styles, README and this QA note. Existing concurrent homepage and adapter edits were preserved. No source cache regeneration, acquisition, scientific recalculation or publication occurred.

## Coastal world — 2026-10-15

Scope: the supplied design brief's first milestone (one island, animated forest/water, steerable boat) using the attached regional image for palette, typography and atlas navigation. This review does not certify a reproduction of the complete regional image.

Source visual truth: `/var/folders/fc/_btcrkc90g7b8dmcf1b_4_g80000gn/T/codex-clipboard-eace7bc8-3bf0-4c74-9384-3b4c4bb93e6b.png` (1672 × 941).
Implementation: `docs/qa/coastal-world/desktop.jpg`, 1672 × 941 CSS/pixels; `mobile.jpg`, 390 × 844 CSS/pixels. No density scaling of the individual captures. Combined comparison: `docs/qa/coastal-world/comparison.jpg`, 3344 × 941, source left, implementation right. State: Home, expanded sidebar, passive scene, desktop zoom 1. Mobile uses icon rail. Browser screenshots were captured through the Codex in-app browser.

Comparison history:
- Initial P2: forest too sparse, exposed ground dominant; replaced sparse original placement with deterministic dense instances. Corrected Blender mask handling to non-color data. Rechecked desktop and phone renders.
- Initial P2: strong repetitive diagonal wave highlights; lowered contrast and added coastline-distance shelf shading and shoreline foam. Rechecked in final combined comparison.
- Final: the single-island composition intentionally has more open water than the regional reference. Full regional coverage, mountains and clouds are not implemented and are not claimed as matching. These remain a subsequent art milestone in the supplied brief.

Required surfaces:
- Typography: Georgia serif wordmark/navigation/italic island label, small tracked system captions; legible without wrapping at tested widths. Font is a local fallback, not an exact identification of the reference font.
- Layout: reference's 244px expanded ivory sidebar and 68px dark icon rail; working destinations replace nonexistent Models/Documentation routes. Phone uses a 60px rail; no document overflow at 390px. Boat/pause and zoom remain visible.
- Colors: navy water, teal shoreline, muted green forest and warm ivory controls follow the reference direction. Terrain is a simpler real-time material, not the reference's detailed painted texture.
- Assets: actual Blender-authored 3D meshes with shared instanced tree parts; no raster page stand-in. The tiny boat and whale are intentionally readable miniatures. Existing painted coastline is the explicit WebGL fallback.
- Copy: Orcas Island identified correctly for the retained mask; illustrative-world note avoids a navigation or scientific-data claim. No invented dataset statistics.

Focused evidence: sidebar/wordmark and lower control areas were inspected in the native 1672px capture and mobile capture; both are readable in those files. Full-view comparison was opened jointly. The scene differs in geographic scope intentionally per the brief's first milestone.

Interactions verified: click-to-steer changed world position from (-41.31,20.96) to (-28.74,36.54); persistent wake visible behind turns; Escape restores the drive-button focus; pause froze scene time at 77.508 across captures; zoom in/out; sidebar collapse/expand; Health navigation and Home return. Reduced motion and shoreline footprint behavior are covered by tests. Console: no application errors; Three.Clock deprecation from the current R3F/Three pairing remains. An earlier shadow-map deprecation was removed by explicitly selecting PCFShadowMap.

Not exercised: forced WebGL context loss, actual touch hardware, long-running thermal/frame-rate profiling. No full-region or scientific integration validation applies to this illustrative scene.

final result: passed

Final validation: all 148 tests passed with `--maxWorkers=2`; after the availability/description edits, all eight focused homepage/navigation tests passed. Typecheck and ESLint passed. An initial full production build passed; a repeat hit ENOTEMPTY in the concurrently used `dist/local-data`, so final bundle verification uses an isolated temporary output with public-data copying disabled. Native keyboard hold was also checked in the browser and moved the boat. Releasing a movement key now clears its destination so drag brings the vessel to rest.
The final isolated production bundle completed successfully (11.71s); existing large-chunk advisories remain. Public data copying was intentionally excluded from this final isolated check. Final `git diff --check` passed. Unrelated pre-existing map/data edits were preserved.

## Archipelago and evergreen refinement — 2026-10-15

User request: more islands and more natural evergreen trees. Existing homepage navigation and controls preserved. The full retained San Juan land mask now drives all island relief, shore shading and boat clearance. Three branch-built evergreen models replace the stacked-cone model; 4,689 placements vary in height, width and rotation.

Source visual truth remains the attached regional reference recorded above; the directly requested before-state is `docs/qa/coastal-world/desktop.jpg`. Combined before/after comparison: `docs/qa/coastal-world/archipelago-comparison.jpg`, 3344 × 941 pixels. Final desktop: `archipelago-desktop.jpg`, 1672 × 941 CSS/pixels, zoom 1, expanded sidebar, passive viewing; the boat has moved during interaction verification. Final phone: `archipelago-mobile.jpg`, 390 × 844 CSS/pixels. Both are native-density captures. Focused crown evidence: `evergreen-detail.jpg`, a native 410 × 300 crop from the same desktop capture area. These files were opened and visually inspected.

Iteration findings and fixes:
- P2: nearly black crowns obscured the new branch detail. Disabled crown self-shadow reception while retaining cast shadows; checked final focused crop for visible branching and evergreen colors.
- P2: clamped shoreline foam extended as lines beyond the source raster. Added an edge fade to the water shader and adjusted orthographic framing; absent in final desktop comparison.
- P2: longer island caption crowded phone zoom controls. Reserved a right-hand gutter and allowed two-line wrapping; verified in the final 390px capture.

Fidelity surfaces: typography and sidebar spacing retain the previous atlas style; caption now correctly names the wider San Juan region. Navy/teal water and ivory controls remain unchanged, with dark evergreen foliage replacing pale conical crowns. Asset quality improves through irregular tapered branch sprays, open bough gaps and three distinct proportions. These remain real-time illustrative trees, not photogrammetric foliage. Terrain/forest placement remains art-directed and is not an observed land-cover product. Mobile overview retains ocean margins and supports zoom.

Interaction evidence: click steering moved the boat from (-48.94,24.97) to (-44.71,16.40) in the new western channel; Escape returned focus to the drive control. The whale corridor is tested for 600 seconds of simulation samples. New land blocks navigation. No browser errors. Typecheck, lint, 149 tests (31 files, two workers), isolated Vite bundle and diff whitespace checks passed. Bundle check omits copying the unrelated multi-gigabyte public data cache. Existing bundle-size advisories remain. No sustained GPU/thermal profiling or touch-hardware validation was performed.

final result: passed


## Detailed coastal rebuild — 2026-10-15

Source: original 1672 × 941 regional reference recorded above. Final captures: `docs/qa/coastal-world/detailed-desktop.jpg` (1672 × 941), `detailed-mobile.jpg` (390 × 844), `detailed-evergreens.jpg` (native 580 × 420 crop), and `detailed-comparison.jpg` (3344 × 941, source left). The joint source/render comparison and focused forest crop were opened and inspected.

The rebuild adds 7,790 textured evergreen instances, three irregular bough silhouettes, 1,555 boulders, smooth ridged relief, triplanar rock, mottled meadow material, alpha-tested animated tree shadows, directional sunlight, layered shelf-water shading, four mist patches, geographic labels and a companion whale. Iteration fixed inverted terrain winding, excessive plateau cliffs, opaque foliage shadows and a GLSL reserved identifier (`patch`). The reference's ivory sidebar, dark icon rail, serif hierarchy, coastal palette and forest detail guide the result. Phone controls remain visible and the title wraps without overlap; the entire archipelago appears smaller in the portrait overview and zoom is available.

Fidelity assessment: substantial improvement over the earlier cone/spray forest and flat terrain. This is still a real-time San Juan scene, with simpler lighting/material detail and a smaller geographic scope than the supplied regional illustration. The reference's mainland snowy mountain range and its complete geographic composition are absent. Exact visual parity is not claimed.

Interaction checks: click steering moved the boat from (-49,25) to (-48.36,12.08); Escape exited driving. Pause held scene time at 109.865 across captures. Adult and companion whale footprint clearance passes 600 seconds of sampled simulation. Existing wave/wind/breach/wake animations remain linked to the shared pause clock. No additional browser errors appeared after the corrected GLSL material compiled; the console retains the historical compilation error at 01:03:18 UTC.

Validation: full suite 152 tests passed (32 files); modified adult/companion corridor test also passed independently. Final workspace typecheck was blocked by seven unsupported `exact` options in concurrent SourcePicker and SeascapeMapPage tests outside this change; those files were preserved. No sustained GPU/thermal profiling, physical touch testing or scientific/regional data validation was performed. See final build/check outcome below.

final result: functional and responsive checks passed; reference fidelity improved with the differences above explicitly retained.

Final ESLint and `git diff --check` passed. Isolated production bundle built in 8.63 seconds with public-data copying disabled; existing large-chunk advisories remain. Live preview restored to playing after phone QA.


## Mainland mountains, lighting and water — 2026-10-15

Added a connected eastern mainland with five overlapping primary massifs, smaller eroded ridges, evergreen foothills, textured rock and irregular altitude/slope snow coverage. Initial smooth isolated cones were rejected during screenshot review and replaced with connected rugged relief. The shared material cache explicitly distinguishes snow and island shaders. Warm sunlight, brighter sky fill, turquoise shelves and reduced repetitive wave contrast move the palette toward the original reference. Retained reference differences: illustrative local geography, procedural mountains and simpler real-time materials.

Desktop screenshot: `docs/qa/coastal-world/mountains-desktop.jpg`, 1672 × 941. Mobile screenshot: `mountains-mobile.jpg`, 390 × 844. Initial portrait review exposed the end of the mainland and water plane; closer portrait camera framing and extended mainland resolved the visible edge. Desktop reference composition was assessed against the original attachment and prior side-by-side record. No new browser errors.

Click steering moved the boat from (-49,25) to (-49.26,12.66). Pause froze the shared clock at 63.450 across captures. All existing boat/whale/tree animation paths remain intact. Added a test proving mainland collision blocks travel even over an otherwise open original raster. Typecheck, lint and nine focused navigation/home tests passed; isolated production build passed. No full scientific-data pipeline or sustained GPU profiling was run.


## Muted coastal palette — 2026-10-15

Applied the user-supplied hex palette: deep sea #123345, channel #266275, shallows #73A8A0, forest #56765B, paper #F1EDE2, vermilion #CD6044. Water shader blends use the supplied sea/channel/shallow colors; textured foliage receives a restrained forest tint while preserving needle detail and lighting. Paper/sidebar colors use the exact CSS values. Boat hull/equipment and the boat-control icon carry small vermilion accents. Terrain meadow colors shift away from yellow-green. Shared animation, navigation, snow and geometry are unchanged. Inspected live render with no browser errors; screenshot: `docs/qa/coastal-world/palette-desktop.jpg`. Typecheck, ESLint and diff whitespace validation passed.


## Editorial interface refinement — 2026-10-15

Followed the supplied editorial guidance: compact field-index navigation, 21px icons at a common 1.4 stroke, quieter inactive items, a fine selected-state rule, Georgia for the wordmark/place title and system sans for navigation and metadata. Sidebar labels now read Coastal layers, Field sightings, Relationships, Shore views and Data Health; accessible names retain visible labels and original destination names. Duplicate region text above the scene was removed, leaving a subdued coordinate line. Controls have reduced border rounding and visual weight; 44px minimum touch targets are retained. No scene rendering or animation code changed.

Inspected `docs/qa/coastal-world/editorial-desktop.jpg` at 1672 × 941 and `editorial-mobile.jpg` at 390 × 844. Title, controls and navigation remain readable without overlap. Collapse/expand verified in browser. Typecheck, ESLint, five homepage navigation/control tests and diff whitespace checks passed.

## Family and feature selectors with metric copy — October 15 follow-up

The Features layer drawer now presents Family before Feature. `FamilyFeaturePicker.tsx` uses the catalog's family names, a family-specific Lucide symbol, and only the active product's fields at the selected native resolution. The family follows the selected native metric. Changing family selects an available measurement when possible; selecting the current family preserves the feature. All-unavailable families remain selectable. Comparison has independent right-side Family and Feature selectors.

Feature rows retain the information button and add an adjacent copy button. This copies the exact catalog metric name (`field.name`), without display-only depth annotations or units appended by the picker. Clipboard success produces a check and live status message; rejection reports failure. Copying and information never change the selected layer. Both actions have 44 px mobile targets. Existing product selection, source summaries and native slice/resolution controls remain available.

Browser verification used the real local R6 catalog: switching Bathymetry to Shoreline narrowed Feature to 68 fields; copying Rocky shore length m returned that exact clipboard string while the active map remained Shoreline total mapped length m. Changing the right map's family to Shoreline left the left map on Bathymetry. At 390 × 844, both selectors, the wrapped feature name and the information/copy actions fit without horizontal overflow. Copying declared mean depth returned Bathymetry, without the presentation annotation. The R6 Bathymetry view, comparison selection and original display settings were restored; viewport overrides were reset. Browser error log was empty.

Evidence in `/Users/tylerstevenson/.codex/visualizations/2026/10/15/01a141ee-3856-7791-bdd6-6e78def98511/`: `data-map-family-picker.jpg` (1280 × 800), `data-map-family-feature.jpg` (1280 × 800), `data-map-feature-copy.jpg` (1280 × 900), and `data-map-family-mobile.jpg` (390 × 844). Changed surfaces: `FamilyFeaturePicker.tsx` and its checks, `SourcePicker.tsx`/CSS/checks, the source presentation helper, the two Features-page selector call sites, README and this note. Concurrent homepage and adapter work was preserved.

Validation: all 19 focused picker/map checks passed, including five new copy/cascade checks. The full suite passed 154 of 158 tests; four existing navigation/map tests exceeded the default 5-second limit. All 24 tests in those three files then passed with a 15-second limit. Typecheck and ESLint passed. An isolated production bundle built successfully with public-cache copying disabled; existing large-chunk advisories remain. No acquisition, cache regeneration, scientific recalculation or publication was performed.


## Island-first landscape refinement — 2026-10-15

Addressed all five supplied directions: retained-source silhouette simplification (97 tiny components removed, 98.48% land IoU), lower relief/more overhead framing and Shaw label; inky water with irregular channel shading and narrow subdued shallows instead of halos/rings; one softer northern mountain mass with low mainland ridges; alternating bluff/beach shore ramps and slope-based rocky ground; clustered forests with clearings, 6,777 varied tree instances and 571 selectively placed shore rocks. The source geographic mask was preserved. Major-island geometry remains source-derived; relief, mainland, forest and apparent water depth remain illustrative.

Visual iteration: first terrain pass exposed too much pale shoreline and sparse woodland. Reduced the sand-height band, darkened ground and adjusted grove density while preserving clearings. Final screenshots: `docs/qa/coastal-world/natural-desktop.jpg` (1672 × 941) and `natural-mobile.jpg` (390 × 844). Forest/land hierarchy and mainland prominence were checked in the live scene against the supplied direction.

Browser steering moved the vessel from (-49,25) to (-49.67,13.05). Pause held the shared clock at 26.105. Existing shared-clock wind/water/whale animation paths remain intact. No rendering errors. Typecheck and lint passed. One homepage navigation test exceeded its default 5-second timeout while Blender/build were running; rerunning the nine focused homepage/motion tests with one worker and a 15-second limit passed. Isolated Vite bundle passed with public-data copying disabled and the existing large-chunk advisory. Diff whitespace check passed. No scientific pipeline or sustained GPU profile was run.

Joint before/after review: `docs/qa/coastal-world/natural-comparison.jpg` (3344 × 941; prior left, current right), opened and inspected after final assets loaded. The new camera and lower relief improve recognition without replacing the retained geographic source.

## Dropdowns without search — October 15 follow-up

Removed search inputs, filtering state and unused search presentation metadata from the shared Family, Feature and comparison data-product dropdowns. Opening focuses the current choice, or its information button when selection is disabled. Arrow keys, Home/End, native Enter selection, stepped Escape and focus return remain. Family icons, source summaries, copy feedback and all-unavailable fields are preserved. Updated the existing picker checks and README.

All 19 focused picker/map checks, typecheck, ESLint and whitespace validation passed. An isolated production bundle passed with public-cache copying disabled; existing large-chunk advisories remain. The broader suite was not rerun for this scoped change. Live desktop and phone inspection confirmed no search inputs; metric copying still returned Bathymetry. Evidence in the visualization directory recorded above: `data-map-dropdown-no-search.jpg` and `data-map-family-no-search.jpg` (1280 × 900), `data-map-family-no-search-mobile.jpg` (390 × 844). Viewport overrides were reset; the native layer and display settings were retained.

## Quiet dropdown headings — October 15 follow-up

Removed item counts from the shared dropdowns and suppressed the group heading when there is only one group. The Family menu now goes directly from Choose family to the icon choices, without 7 items or Families. Feature menus also omit their redundant family heading. Multiple-group pickers retain meaningful group labels. Source information, copying, keyboard behavior and selection are unchanged.

All eight existing picker/cascade checks and whitespace validation passed. ESLint had no errors and one concurrent CoastalWorld effect-cleanup warning. Live inspection at 1280 × 900 confirmed the simplified menu; screenshot: `data-map-family-clean-dropdown.jpg` in the visualization directory above. The full typecheck encountered concurrent homepage errors in `coastalMotion.test.ts` and `CoastalScene.tsx` involving WaterGrid/CoastalInput changes; these files were preserved. Full suite and production build were not rerun for this small presentation edit.

## Daily meteorology and time playback — October 15 follow-up

Inspected and validated the retained daily/hourly Meteorology Parquets and integrated them as native R5 ERA5 reanalysis. Added daily playback at bottom center, hourly selected-day Insights, selected-cell hourly values and descriptive daily history. Kept UTC dates, source precision, native support and missing values. Readiness evidence, scope, commands, screenshots and limitations are recorded in [Meteorology QA](docs/qa/meteorology.md), with an inspectable [readiness notebook](notebooks/meteorology-readiness.ipynb).

All 169 frontend tests (37 files), two generated-Parquet reader tests, the full actual source profile, typecheck, ESLint, isolated production bundle and whitespace checks passed. The final date-input adjustment also passed focused playback checks. Verified the actual daily map, multi-day play/pause, matching cell/date/hourly details and 1280 × 900 / 390 × 844 layouts. Large-chunk build advisories remain. No source acquisition, producer edits, publication, ecological qualification or independent observational validation was performed.


## Continuous Puget Sound–Georgia Strait world — 2026-10-15

Expanded the scene from the San Juan crop to cached GSHHG regional coastline, with the retained local coastline inset. No source download or toolkit/product mutation occurred. Region and source hash are recorded in `public/assets/home/coastal-world/region.json`; source license texts are retained. Terrain is one continuous nonuniform grid, with denser sampling near the San Juans and coarser regional relief. The obsolete synthetic mainland overlay is no longer rendered. Coast shader, clearance raster and model placement share world bounds. All terrain, forest and water depth cues remain illustrative.

New interactions: eased wide-to-San-Juan opening camera (skipped for initial reduced motion), pointer drag and keyboard pan, wheel/button zoom, Return to San Juans, and smooth boat-follow. Manual pan temporarily releases follow; steering resumes it. Leaving the boat preserves the current camera view. Zoom-aware camera bounds keep the finite region edge outside the viewport. A phone review exposed a boundary at the widest aspect; additional horizontal/depth margins corrected it. Regional labels replace small island labels at wide zoom; labels scale for phone readability. A subtle lower scrim maintains control contrast over land.

Performance changes: spatial forest batches are frustum-culled, and wide views draw one fifth of tree instances. The terrain model is approximately 63 MiB and loaded only on Home. Sustained frame-rate/thermal profiling and physical touch hardware have not been measured.

Browser evidence: opening camera observed wide at (-89.43,-69.56), then settled at the San Juans. Drag panned beyond the former north boundary to (2,-139.42). Puget view reached (34.42,227.51), Georgia view (-99.76,-134.44). Click steering moved the vessel from (-49,25) to (-50.89,6.65), and the camera matched the vessel coordinates. An initial pointer-capture conflict intercepted steering clicks; capture now begins only after the drag threshold and retesting passed. Pause held time at 166.035 while zooming. Return control and phone zoom tested. No browser rendering errors.

Captures: `docs/qa/coastal-world/regional-puget.jpg`, `regional-georgia.jpg` and `regional-san-juans.jpg` (1672 × 941); `regional-mobile.jpg` (390 × 844). Regional screen captures were opened and inspected.

Tests include a raster connectivity traversal proving passable water from the San Juan boat corridor to Georgia Strait and northern Puget Sound, frame-independent movement, swept shoreline clearance, whale corridor, camera clamping and intro easing. Eleven focused navigation/home tests passed. Initial typecheck passed; the final shared-checkout typecheck was blocked by concurrent `src/data/meteorology.ts` errors (missing ids/values on never and implicit-any callbacks), outside this homepage change. Those edits were preserved. Final lint/bundle outcome follows.

Final validation: all 11 focused tests passed; the isolated production bundle passed with the existing chunk-size advisory. Repo-wide lint is blocked by a concurrent `WeatherInsights.tsx` immutability error. Scoped lint of all changed runtime/home files passed. These unrelated meteorology/weather changes were not modified. Regional screenshots and the live animated San Juan landing view are retained.

## Quiet loading, lower camera, moving clouds and cities — 2026-10-15

Removed the bright San Juan raster fallback from CoastalScene. Loading and graphics failure now retain the deep-sea background with a quiet status message. CoastalWorld's camera is approximately 47° above the ground (previously 55°); pan scaling, minimum zoom and camera bounds use the same projection constant.

Replaced four stationary mist planes with two regional cloud layers at different elevations. World-space, multi-scale noise advects continuously in a consistent wind direction, with denser shaded centers and open water between banks. Cloud time is shared with the water, trees and whales, so pause/reduced motion freezes everything. Cloud geometry does not intercept boat steering.

Added approximate illustrative city-center markers for Vancouver, Seattle, Victoria, Nanaimo, Tacoma, Bellingham, Everett, Olympia, Port Angeles, Sequim, Friday Harbor, Port Townsend and Anacortes. Victoria's anchor was checked against BC Geographical Names (https://apps.gov.bc.ca/pub/bcgnws/names/22474.html). These are label anchors, not navigation or municipal-boundary data. Major cities appear at wide zoom; towns appear closer in. Screen-space overlap suppression prioritizes city labels, and phone label sizes remain readable.

Validated the San Juan landing, regional city placement (Victoria, Port Angeles, Sequim and Port Townsend), and a 390 × 844 phone view. Scene time remained exactly 30.708 across paused observations; clouds continued after resuming. No browser errors. Screenshots: `docs/qa/coastal-world/clouds-tilt-cities.jpg` and `clouds-cities-mobile.jpg`. The live view was restored to the animated San Juan landing.

Checks: 13 focused home/loading/navigation tests passed, including pending/failed loading without a raster fallback. Final typecheck, scoped ESLint and isolated Vite production bundle passed; Vite retains the large-chunk advisory. The bundle omitted copying the shared public-data cache. No full repository test suite or physical-device/long-duration GPU profiling was run for this scene refinement. Changes are limited to homepage rendering, its focused tests and this QA record; concurrent application/data edits remain intact.

## Desktop landing off Lime Kiln — 2026-10-15

The regional opening now settles at (-45, 16), zoom 3.2, in navigable water off Lime Kiln Point, rather than the whole San Juan group. The boat starts at (-44, 16). The closer zoom reveals the western shoreline while retaining water to explore; maximum zoom is now 6. The return control restores this exact focus/zoom. The park label uses the approximate Washington State Parks anchor (https://parks.wa.gov/find-parks/state-parks/lime-kiln-point-state-park). This remains illustrative geography.

Boat scale changed from .65 to .3 with proportional bow/wake widths and stern origin. Whale sizes, breach heights and splash radius were reduced for a coherent closer composition. Existing navigation clearance remains conservative. Motion, clouds, pan, regional zoom-out and boat follow remain enabled. No mobile adaptation was undertaken; the user intends a separate mobile home screen.

Desktop browser verification at 1672 × 941: the introduction settled offshore, click steering moved the boat from (-44,16) to (-45.98,18.48), and Return to Lime Kiln restored (-45,16) at zoom 3.200. No browser errors. Capture: `docs/qa/coastal-world/lime-kiln-landing.jpg`. Fourteen focused tests passed, including navigable start/focus and boat containment in the landing frame. Typecheck, scoped ESLint, isolated production bundle and whitespace check passed. The bundle retains the existing large-chunk advisory; full repository suite and GPU profiling were not rerun.

## Modeled towns and cities — 2026-10-15

Corrected the earlier label-only interpretation: 13 settlements now have physical miniature buildings, pitched/flat roofs, façade windows/doors, terrain-following street ribbons and waterfront marinas with moored boats where a nearby coast is available. Seattle/Vancouver/Tacoma use taller central blocks; smaller towns have lower, more compact neighborhoods. Sequim is inland and has no marina. Lime Kiln has a small lighthouse/keeper's cottage, not an invented town. Labels remain secondary locators. These are illustrative settlement models, not surveyed building footprints, real street layouts or population data.

The sparse terrain sampler indexes triangles from the shipped GLB and uses barycentric interpolation in world coordinates. Building corners must be on land; steep sites are skipped. Foundations accommodate modest height differences. Street ribbons stop at water and steep slopes. Tree instances are omitted around developed plots and town cores. Four instanced geometry batches hold buildings, roofs, windows and docks; no per-building render loop or additional downloaded assets. Boat/water/whale/tree/cloud motion remains intact. Initial terrain indexing adds local scene setup work; sustained GPU profiling has not been performed.

Actual-terrain validation produced 733 buildings: Vancouver 127, Seattle 118, Victoria 90, Nanaimo 35, Tacoma 75, Bellingham 35, Everett 53, Olympia 55, Port Angeles 37, Sequim 48, Friday Harbor 22, Port Townsend 19 and Anacortes 19. Tests exercise transformed triangle interpolation, every explicitly requested settlement on the shipped GLB, and harbor presence/absence. All 16 focused home/loading/navigation/settlement tests, typecheck, scoped ESLint and isolated production bundle passed. The bundle retains its existing large-chunk advisory. No full repository suite or mobile work was performed.

Desktop review at 1672 × 941 verified Friday Harbor's compact waterfront, Victoria's wider grid, Seattle's taller center, and the regional Sequim/Port Angeles clusters. Browser error log was empty; Return to Lime Kiln restored the landing afterward. Captures: `docs/qa/coastal-world/friday-harbor-town.jpg`, `victoria-town.jpg`, `regional-towns.jpg`, and `seattle-city.jpg`. Changed source: `CoastalWorld.tsx`, new `coastalSettlements.ts`, and new `coastalSettlements.test.ts`; unrelated concurrent edits were preserved.

## Natural settlement layouts — 2026-10-15

Replaced the shared rectangular town grid with roads traced from distance inland from the actual rendered shoreline. Smoothed coastal lanes follow bays and headlands; short cross-lanes connect neighborhoods, while inland settlements use winding streets. Plots face their local road with varied setbacks, widths, depths and spacing. Placement rejects water, steep terrain and overlapping plots. These remain illustrative towns, not real street or building inventories.

Buildings now mix cottages, L-shaped houses, hip/gable roofs, shops with awnings, low workshops and stepped city towers. Heights, muted materials, windows, porches and chimneys vary. Removed broad circular town-core tree clearing; only developed plots and roads exclude trees, leaving wooded gaps and irregular neighborhood edges. Five instanced geometry batches retain efficient rendering. Existing boat, whale, water, tree and cloud animation is unchanged.

Desktop review at 1672 × 941 checked Friday Harbor and Victoria. Victoria's waterfront visibly curves around the shore and its buildings have different orientations, footprints and rooflines. Captures: `docs/qa/coastal-world/natural-friday-harbor.jpg` and `natural-victoria.jpg`. Clouds continued moving during inspection; browser error log was empty. Returned the live view to Lime Kiln. No mobile adaptation was performed.

All 17 focused settlement, navigation, scene and home tests passed, including actual shipped terrain generation and synthetic curved-shore checks for varied headings, land placement and nonoverlapping plots. Typecheck, scoped ESLint, isolated Vite production bundle (public-data copying disabled) and whitespace checks passed. Existing bundle-size advisories remain. Full repository tests and sustained GPU profiling were not rerun. This pass changes `coastalTownLayout.ts`, `coastalSettlements.ts`, `coastalSettlements.test.ts` and this QA record; concurrent unrelated work is preserved.

## Dense regional forests and Olympic/Canadian relief — 2026-10-15

Applied the San Juan candidate density across the existing region, retaining grove variation, clearings, size/tone variants and slope rejection. The regenerated forest contains 707,981 trees; roots are interpolated from the exact exported terrain triangles. Forest thins toward alpine elevations and town plots/streets remain clear. `forest.bin` replaces the large JSON placement array with validated six-float records (16.2 MiB). Nearby trees retain detailed boughs, wind and shadows. Spatial culling and inexpensive evergreen crowns at zooms below 1.8 keep regional forest cover dense without drawing all branch cards.

Added geographic-anchor-based illustrative relief for the Olympics, Baker, the Cascades, the North Shore/Howe Sound/Garibaldi/Tantalus/Sunshine Coast areas and Vancouver Island ranges. The Olympics form a connected massif behind Port Angeles and Sequim with separate western/eastern peaks and lower southern ridges. Mountain shoulders taper toward the coast; the snowline is irregular and higher than before. The current geographic bounds are unchanged at 125.5° W–121.8° W and 46.8° N–50.3° N. Baker and eastern Cascade summits near/outside that footprint contribute visible in-bounds slopes and foothills. No coastline or clearance regeneration, external data acquisition or scientific-layer changes occurred. Relief is artistic, not a DEM; source context and approximate anchors are in `coastal_relief.py` and the asset README.

Desktop browser review at 1672 × 941 verified dense detailed trees near Victoria, wide Olympic and Canadian ranges, and Baker's western foothills. Captures: `regional-forest-victoria.jpg`, `olympic-range.jpg`, `canadian-ranges.jpg`, and `baker-foothills.jpg` under `docs/qa/coastal-world`. A fresh load retained the quiet loading background. Boat steering moved from (-44,16) to (-45.94,18.85); moving clouds remained visible and the browser error log was empty. Returned to Lime Kiln and removed the temporary viewport override. No mobile adaptation was performed.

All 19 focused forest, terrain, settlement, navigation, scene and home tests passed against the final generated assets. Checks include regional forest presence, Olympic/Baker/Canadian elevations, 100 sampled tree roots against rendered triangles, unchanged bounds, town placement, boat clearance and connected regional navigation. Typecheck, scoped ESLint, Python compilation, isolated production bundle (without copying the public-data cache) and whitespace checks passed. Existing large-chunk advisories remain. No full repository suite, cross-device memory/GPU benchmark or sustained thermal profiling was run.

Changed owning sources: `scripts/blender/coastal_relief.py`, `scripts/blender/build_coastal_home.py`, `CoastalScene.tsx`, `CoastalWorld.tsx`, `coastalMaterials.ts`, `coastalForest.ts`, `coastalForest.test.ts`, generated coastal assets and this record. Unrelated concurrent work was preserved. Blender initially failed during sandboxed Metal initialization; the installed Blender completed the rebuild outside the sandbox.


## Relationships — 2026-10-20

Approved Astra desktop/mobile/night appearance implemented against current local
data. Final joint screenshot comparisons, focused crops, scientific/API checks and
limitations are in [Relationships QA](docs/qa/relationships.md). Existing QA above
is preserved. Desktop 1440×1150 and mobile 390×1100 were compared at density 1;
390×844 drawer bounds and 44 px controls also passed. Source-native Map rendering
remains available through the original reader.

final result: passed

Relationships final catalog check: survey availability is slice-dependent; inherited aggregate availability totals are not displayed. The selected-slice coverage calculation is unchanged. Backend regression suite now has 20 passing tests.
