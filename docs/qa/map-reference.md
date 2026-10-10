# Map page design QA

Publication note: screenshots and user reference captures are retained privately and are not distributed in this source-only branch. Capture names below identify historical review evidence, not repository download links. Machine-specific paths and private Library identifiers are omitted.

final result: passed

## Source and evidence

Source visual truth: the user-attached MarineCast Explorer image in the request “You can use this as an example for this page?”. Source pixels: 1448 × 1086. It is an example to adapt, rather than an instruction to invent its scientific products or reproduce its values.

Implementation: http://127.0.0.1:5173/, inspected with Codex in-app Browser. Full-view evidence: private QA capture map-reference-desktop.jpg. CSS viewport and screenshot: 1448 × 1086, density 1, no device frame or density scaling. State: Map, temperature, July 2026, selected synthetic H3 cell 8528d1a3fffffff, layers open, time-series tab. Source and browser capture were both viewed in the comparison context. The source has a different cell and species metric; content differences are intentional.

Focused evidence: private QA capture map-reference-details.jpg (1404 × 289 bottom-sheet crop). Compared the source's cell heading, metrics, detail tabs and timeline against this capture. Mobile evidence: map-reference-mobile.jpg (390 × 844); comparison evidence: map-reference-compare-desktop.jpg (1280 × 720), in the same QA directory. No horizontal overflow at the inspected desktop or mobile widths.

## Findings and fidelity surfaces

No remaining actionable P0/P1/P2 findings within the requested reference-inspired adaptation.

- Fonts and typography: retained the existing Inter/system sans-serif stack and library icons. Navy headings, compact metric text, restrained weights and blue selected states match the example's hierarchy. Exact source font identity is unknown; no pixel-perfect font claim.
- Spacing and layout rhythm: full-screen map, floating upper-left brand and menu, upper-right rounded layer panel, bottom rounded sheet with a 290px desktop height. Desktop layer panel is 324px wide. Mobile stacks the details and keeps navigation and timeline visible; comparison maps occupy the area above the sheet.
- Colors and tokens: navy text, white panels, pale borders and six blue H3 bins. Missing values remain gray. MapTiler Outdoor terrain supplies real cartography and attribution. Its denser relief differs from the source's softer terrain, accepted as provider styling.
- Image quality and asset fidelity: the map is a live cartographic renderer, H3 cells are real geographic polygons, scientific chart geometry is computed from fixtures, and UI symbols are library icons. No screenshot is used as a fake interactive map. Existing Waves icon is retained as the app mark; no fabricated brand raster assets.
- Copy and content: explicit “Synthetic demo · No data connected”, synthetic/unvalidated values, accurate resolution 5 and monthly labels. Existing temperature, chlorophyll, vessel activity and physical viewability retain their units. No species activity index, bathymetry, currents or other missing products were invented. Collection/share actions from the example are omitted because they have no backing behavior in this demo.

## Comparison history

1. Initial rendered layout: the right panel and bottom sheet were correctly positioned, but text was undersized relative to the reference and the grayscale basemap differed materially. Refined desktop sizes, increased the detail sheet height, and selected official MapTiler Outdoor terrain. Post-fix evidence: map-reference-desktop.jpg.
2. Responsive review: stacked comparison could place the lower map behind the detail sheet. Restricted the comparison map area to the space above the sheet and placed controls within each map. Post-fix mobile comparison was visually inspected; both maps and selected right-map context were visible.
3. Detail-state review: the previous inspector derived values from the left map after right-map selection. Selection now carries its source map, the detail sheet follows its feature/date, and the bottom timeline edits that source map. Exiting comparison clears selection. A regression test covers both sides, repeated selection, feature/date changes, static mode, timeline changes and exiting comparison.
4. Loading/scroll review: removed the inherited bottom positioning from the loading notice, constrained source labels, and made the layer heading/close control sticky. Fully loaded final desktop and mobile captures were inspected after these fixes.

## Interactions and verification

Browser checks: select H3 cell, previous/next cell, time-series/nearby/environmental tabs, month selection, playback/pause, open/close layer panel, comparison, right-map date, right-map selection and active-side timeline. Playback advanced the displayed date. Unit interactions also cover the existing Relationships, Sightings and Data health pages.

Console checked: two historical development messages occurred while source was edited (Vite hot reload and React effect dependency-size change). A fresh reload resolved them; no new browser errors appeared during the final loaded inspection. Credentials are excluded from the report and screenshots.

TypeScript, ESLint, all 13 tests and production build passed. MapLibre's lazy production chunk still exceeds Vite's 500kB advisory; it is loaded only for the configured basemap.

## Implementation checklist

- [x] Adapt the selected reference to the existing synthetic demo.
- [x] Keep all core map controls interactive.
- [x] Correct comparison feature/date context and test the regression.
- [x] Inspect loaded desktop and mobile layouts.
- [x] Capture and attach the completed map preview.
- [x] Preserve frontend-only scope; no real Data or product API connection.

## Follow-up polish

P3: the provider terrain is denser and the fixtures have fewer/smaller spatial coverage extents than the source example. A user-owned custom MapTiler style can soften relief later. The existing development font stack is retained. No deployment was performed.
