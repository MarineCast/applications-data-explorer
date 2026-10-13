# San Juan homepage scene

The demo homepage uses a north-up San Juan map plate guided by the retained mapped coastline, with separate boat, buoy, adult orca and calf layers. The blue water distorts subtly, current tracers move through marine space, and an illustrative warm-colored bloom fades to zero and returns every 14 seconds. Pause, reduced motion, hidden-page suspension and catalog pause apply to the complete WebGL scene.

## Geography and artwork

The source is `land_area` in the retained `seascape_native_bathymetry_20261006_v2/spatial_support/land-water.gpkg`. Its SHA-256 is `0ff0b2d9e7336b0269b5b38290be49b80be921ed1b8d96086763baca3006542f`. The release describes ENC/CanVec-refined mapped land with a Natural Earth baseline. Bounds: west -123.30, east -122.48, south 48.405, north 48.766517153043594. The 1536 × 1024 plate uses a north-up local equirectangular projection with longitude scaled at 48.60° N. No coastline simplification is applied before rasterizing the animation mask.

The painted scenery follows this geometry as an ImageGen guide. It is an artistic rendering with small shoreline brush variations, not a survey map. Trees, hills, shallow-water colors, currents and the heat patch are decorative, not measurements or forecasts. No alpine snow peaks were retained. Animation is gated by the source-derived land mask and the painted land colors.

## Assets and prompts

Built-in ImageGen produced all four final image assets. The app consumes `public/assets/home/san-juan/background.webp`, `boat.webp`, `buoy.webp`, `orca.webp`, `land-mask.png` and `geography.json`.

Background prompt: use the exact north-up cartographic coastline guide as the geometric target and the user's original illustration for style only. Preserve island positions, scale, bays, narrow channels and islets; paint watercolor turquoise/blue water, sandy shoreline edges, evergreen woodland and low forested San Juan hills. No boats, buoys, animals, snow peaks, clouds, current arrows, labels or pins.

Boat prompt: isolate the original right-facing navy-and-white research boat with orange trim, elevated oblique view, matching painterly miniature style, transparent background without water, wake or lettering.

Buoy prompt: isolate the yellow navigation buoy and black base, elevated oblique view, matching painterly style, transparent background without water or ripples.

Orca prompt: isolate a complete left-facing adult orca with black-and-white markings, dorsal fin and flippers, elevated oblique view, matching painterly style, transparent background without water or ripples. The same sprite is scaled for the calf; mesh deformation animates fluke motion.

## Verification

Desktop 1536 × 1024 and phone 390 × 844 browser screenshots were inspected. Full comparison combines the original style reference, exact source-derived coastline guide and rendered app. The earlier boat path overlapped shoreline; the corrected path and all other subject envelopes produced zero source-mask collisions in 384,128 boundary samples spanning 600 seconds. The mobile location text was moved above the buoy after the first visual pass.

Browser checks covered visible/absent heat states (opacity 0.718 vs 0.000), frozen scene time while paused, play, catalog open/close and no warning/error console entries. Reduced-motion preference changes and lazy-renderer cleanup are covered by focused tests. Context-loss fallback is implemented but was not artificially triggered in the browser.

Final checks: typecheck, lint, all 127 tests (28 files), production build and diff whitespace check passed. The build retains a large-chunk advisory. Shared navigation to Health and back was also checked, with no console warnings/errors.
