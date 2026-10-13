# Data atlas map redesign QA

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
