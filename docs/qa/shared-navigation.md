# Shared navigation and legends

Current navigation (2026-10-16): **Home, Features, Relationships, Health**. Home uses
only its left sidebar; its upper-right Menu button and From the shore shortcut
are removed. Data pages retain the shared header and wave navigation. The
standalone Sightings page and its shared-menu/Home-sidebar destinations are removed.
Legacy `#sightings` links, including query-bearing links, redirect to `#map` on
initial load, hash navigation and history events. Features is the destination for
future sightings integration; this removal does not add a sightings data adapter.
Removal validation: 41 focused navigation, Home and Viewshed tests passed.
Typecheck, lint, isolated production build and git diff --check passed. Live checks
confirmed the four-item shared menu, three Home destinations and the legacy
Sightings redirect. No producer data or acquisition paths were changed or run.
Earlier validation entries below retain their historical page counts and labels.

All six application routes use the same 62 px header and wave navigation, including Home. The requested data-status footer is removed. Home retains its decorative artwork, motion and fixture catalog, with page navigation provided by the shared header. Viewshed retains its active mode/metric context.

`LegendDropdown` owns the trigger, upward popup, focus, Escape, close, trigger-toggle and outside-pointer dismissal. Map and Viewshed retain their separate scientific scales, missingness, units and opacity. Viewshed no longer duplicates color controls in Settings. Relationships, Sightings and Data health use that same bottom-left surface for chart keys; Sightings updates its key with the background toggle. Home has no quantitative data legend.

Validation: 96 tests across 18 files passed with `npm test -- --maxWorkers=2`. Type checking, lint, production build and `git diff --check` passed. Live browser checks covered all six routes at desktop and 390 × 844, including native Map/Viewshed, chart keys, popup dismissal and the Home catalog. All headers measured 62 px; mobile legends were 50 px high and remained within the viewport, without horizontal page overflow. Browser warning/error log was empty. The existing large MapLibre bundle warning remains.

This is local UI validation. Producer data, regional qualification and remote publication were not changed or rerun.

## Page names and order

The shared menu now reads Home, Features, Sightings, Relationships, Viewshed, Health on all six routes. Features retains `#map` for existing saved links and has a matching accessible heading during loading and after data arrives. Health's heading and legend use the same name as navigation. Home's footer and catalog copy refer to Features and its complete local Data catalog.

Verified menu order and current-page markers on every route in the live browser at desktop and 390 × 844; mobile pages had no horizontal overflow. The Home catalog copy was also checked. Existing navigation and Home tests now assert the requested labels/order; all 96 tests, type checking, lint, production build and `git diff --check` passed. The existing large MapLibre bundle warning remains. No producer contracts, data preparation or publication changed.


## Viewshed integration, 2026-10-16

Viewshed now lives in the Features domain dock. The main menu and Home destination
list contain Home, Features, Sightings, Relationships and Health. The Home lookout
and saved `#viewshed` entry open Features with `#map?layer=viewshed`. The layer uses
the existing checked pilot and weight diagnostics, with land-to-water and
water-to-land pair lookup. Reverse results retain per-source identity and weights;
the all-source target overview remains explicit. The reusable renderer is
`src/components/ViewshedLayer.tsx`; there is no standalone Viewshed page route.

Current validation: the full frontend suite passed 184 tests with two workers;
subsequent focused Viewshed checks passed 42 tests, including a new geographic
reverse-color test. Typecheck, lint, isolated production build and whitespace
checks passed. A live browser using the retained v2 pilot verified land and water
map clicks, per-source weights, nullable above-ground weights and the narrow-screen
inspector. Target `8728d186bffffff` returned 86 saved pairs; target
`8728d1818ffffff` returned 108, including Dungeness terrain weight 61.3% and its
unknown complete above-ground factor. These are display/readback checks; producer
scoring, acquisition, empirical calibration and native/regional pipelines were not run.


Viewshed sidebar refinement, 2026-10-16: removed the water-target selector and
Overlay display section; H3 outlines are in Legend → Advanced. Active land/water
cell clicks toggle back to the all-source overview, as do empty-map clicks. Focus
uses both role and H3 ID, so land/water parts of a coastal cell remain distinct.
Reset preserves the weight, display configuration and mounted map camera. Focused
interaction tests cover both reset paths for both roles and a late reverse read
after reset. Live map checks confirmed same-cell and empty-map resets, the shorter
sidebar and the grid control's new location.


Viewshed basemap correction, 2026-10-16: the Features map now stays mounted while
Viewshed is active. `MapTilerCanvas` installs/updates the saved pair overlay on its
existing instance; the Viewshed component supplies controls and overlay state.
The production path does not render `ViewshedMap` or load its separate OpenFreeMap
basemap. Native overlay values clear while Viewshed is active, and switching back
restores the selected native layer. Lifecycle checks assert one map constructor,
unchanged style/center/zoom/bearing/pitch, no new camera movement or resource
installation on toggles, correct role-specific hits and removal on final unmount.
The Features integration test also retains the same map DOM/camera while switching
Seascape → Viewshed → Seascape. Live preview confirmed the single MapTiler map and
existing terrain cartography. Source products, geometry and weights are unchanged.


Viewshed settings alignment, 2026-10-16: the product drawer now contains only the
shared Family picker (Land → water / Water → land) and Score display picker. There
are no cell selectors, shortcuts, inspection buttons or explanatory paragraphs in
settings. Changing family returns to the overview without choosing an arbitrary
cell. Map clicks still choose either role automatically, and same-cell/background
clicks restore the overview while retaining display settings.

Viewshed now shares SurfaceDisplayControls with the other Features layers. Palette
cards open above a collapsed Advanced section containing coloring, Smooth surface,
radius, contours, Cell outlines and Layer opacity. The existing Features map's
worker/raster renders both water scores and reverse land-source scores, keyed by
the active role's native H3 IDs. Its support mask retains clipped land/water
polygons, holes and disjoint pieces; absent pairs stay outside the interpolation
support, and nulls remain unavailable. Gaussian blending precedes coloring,
including logarithmic coloring. Insights retain original fractional scores.
Selection outlines and geometry picking remain active over the smoothed image.
Overlay updates wait for resources on a replacement map/style before writing
paint or layout properties.

Validation: all 198 frontend tests passed with two workers when run separately
from the production build. One existing comparison test had timed out during the
first run concurrent with the build. The final map-loading guard then passed its
10 focused renderer/role tests. Typecheck, lint, isolated production build and
git diff --check passed. Live MapTiler preview confirmed the compact drawer,
smoothed overview, land-to-water and water-to-land clicks, and overview resets.
No producer data, acquisition, regional calculations or publication was run.


Static Home background, 2026-10-16: Home now renders one local generated coastal
WebP beside the ivory sidebar. The page does not import the React Three Fiber
scene or mount a canvas. Boat steering, pan/zoom, reset, pause and animation
instructions are removed. Sidebar navigation, collapse/expand, the shared menu
remain functional. The 1672 × 941 background
is 213 KB; its original generation prompt and provenance are in
[ARTWORK.md](../../public/assets/home/ARTWORK.md#static-coastal-background-2026-10-16).

Validation: 41 focused App, Home and Viewshed tests passed, followed by all five
Home tests after simplifying the shore shortcut. Typecheck, lint, isolated
production build and git diff --check passed. Live desktop (1280 × 720) and phone
(390 × 844) checks confirmed the image loaded, zero Home canvases, responsive
cropping, working navigation and no horizontal overflow. The production build
no longer emits the CoastalWorld chunk. Old scene sources/assets are retained
as historical work but are not loaded by Home. Native data/scientific pipelines
and publication were not run.


Home image motion (2026-10-16): The original coastal WebP now has a masked
WebGL cinemagraph. Water ripples, clouds drift and fog flows within the existing
image; the land stays fixed. A small lower-right control pauses/resumes motion.
Reduced-motion users start with the still image; hidden tabs stop rendering.
The original image is also the loading and unsupported-WebGL fallback.

Validation: 21 focused Home, App and photo-motion tests passed, with typecheck,
scoped lint and an isolated production build. Browser checks covered 1280 × 800
and 390 × 844, matching image/canvas bounds and no phone overflow. Pixel comparisons
between two running frames changed in sampled water/cloud/fog regions and stayed
identical in sampled forest/mountain regions; sampled paused regions were identical.
The build reports size advisories for large chunks, including the lazy photo renderer.
