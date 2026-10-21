# Home artwork provenance

## Night background (2026-10-16)

Dark mode uses `salish-sea-night.png`, generated with the built-in Image Gen tool
from the approved daytime preview. Source output: `exec-de3fd34b-e5ca-4501-8bb9-4836bb9ae86f.png`.
The edit changes lighting to moonlit night while retaining the framing and landscape
layout. The same water, cloud, mist and restrained canopy animation is applied.
Light mode retains `salish-sea-preview.png`. Switching modes disposes the old
renderer and initializes the selected image, respecting reduced-motion preferences.

Prompt: Change only lighting and time of day to a natural moonlit night. Preserve
exact camera, crop, aspect ratio, shoreline and island silhouettes, mountain geometry
and tree placement so animation masks align. Deep midnight navy sky, existing clouds
softly silver-blue lit by an off-frame moon, subtle moonlight reflections following
existing water patterns, faint mist, readable dark forest and restrained rock
highlights. No visible moon, added stars, buildings, boats, lights, objects, text or UI.


## Review image (2026-10-16)

Home currently previews `salish-sea-preview.png`, the user-approved Image Gen variant
`exec-be720a8d-6cb1-4855-861b-21965b01806f.png`. The output is 1672 × 941,
not 4K, and has stronger lighting and reconstructed details. The original WebP
is retained for reverting. Existing water, cloud, fog and tree animation is unchanged.

## Static coastal background (2026-10-16)

The original Home background is `salish-sea-static.webp`: a single static, decorative
1672 × 941 image, generated with the built-in Image Gen tool. The artwork evokes
the Salish Sea; it is not a source photograph or verified geographic cartography.
The ivory sidebar, wordmark, page links and motion control are separate HTML. No text or interface controls are baked into the image.

Original generated file: `exec-ab4c4e29-a2e2-4699-8755-00b2bda0f7a3.png`.
The original remains in the task's generated-images directory. The app asset is a
213 KB WebP encoded with `cwebp -q 88 -m 6`. Responsive `object-fit: cover` crops
the same image on desktop and phones; a CSS gradient supports foreground text.
The original image file is unchanged. Home now layers a lightweight WebGL cinemagraph over it: image-coordinate masks isolate moving water, clouds and fog, preserving the island and mountain silhouettes. The image remains visible while loading or if WebGL is unavailable. Motion can be paused, follows reduced-motion preferences, and stops in hidden tabs. No generated video is used.
The earlier assets and generation prompts below document historical Home designs.

### Exact static background generation prompt

Use case: photorealistic-natural. Asset type: a full-screen static background photograph for the MarineCast marine data explorer home page, landscape 16:9 composition. Primary request: a beautiful, quiet Pacific Northwest coastal scene that complements an ivory editorial sidebar with navy icons and Georgia serif headings. Scene: an elevated oblique aerial view across the Salish Sea and San Juan Islands, evergreen-covered rocky islands and headlands in the middle distance and on the right, broad calm deep blue and muted teal water across the lower left and center, layered distant coastal mountains fading into soft marine haze, a restrained pale sky. Natural soft morning light, delicate silvery water reflections, realistic fir forest texture, sophisticated documentary landscape photography, restrained color, spacious and calm. Composition: place the most distinctive forested island on the right half; the left 20 percent will be hidden behind a sidebar, and the lower-left visible water should remain uncluttered to accommodate a small white page title. Strong composition when center-cropped on a phone as well as wide on desktop. Create only the scenic background, no app frame or user interface. Constraints: no text, labels, lettering, logos, map grids, borders, diagram elements, watermarks, people, boats or buildings. This is evocative scenic artwork, not a geographic map.

## Historical Home assets

Source: the user-selected MarineCast home reference, Library `libfile_6b7470f253a4819181a1936d9c4db169` (1536 × 1024). The original remains unchanged.

`marinecast-coastal-map.jpg` is an Image Gen edit of that reference with only editable branding/navigation removed. The geographic labels belong to the illustration. It is illustrative marketing artwork and must never be treated as scientific or navigational cartography. Original generation: `generated_images/exec-84ef22c8-f365-46c7-a226-fd5e0617d8cf.png` in the task workspace; JPEG encoded for local delivery.

`marinecast-wave.png` is an Image Gen extraction of the supplied wave mark, reduced to 256 × 128 with transparent alpha. Original generation: `generated_images/exec-4feaddfe-78a4-4fb2-bd95-6c72b2132057.png` in the task workspace.

The wordmark is editable HTML using self-hosted [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed), weight 600. The font is distributed under the adjacent `OFL.txt`, copied from the official Google Fonts repository. Navigation symbols use the existing Lucide icon library.

## Exact background generation prompt

Edit target: the supplied MarineCast homepage reference image. Produce only the 1536x1024 background artwork for implementation, preserving the reference composition, fine paper texture, muted ivory/navy/teal palette, the painted Pacific Northwest mountains and evergreen coastal scene in the lower left, and the right-hand topographic Vancouver Island/Salish Sea map with its blue honeycomb overlay blending softly into the left. Remove ONLY the UI branding, wave logo, word MARINECAST, small branding tagline, all five left navigation rows and their icons and vertical lines, and the small left divider/INTEGRATED DATA FOR HEALTHIER OCEANS text. Restore those upper-left areas with the same warm ivory paper, leaving clean negative space for real HTML navigation. Keep the geographic labels Salish Sea, Pacific Ocean, Vancouver Island, British Columbia and Washington as part of the illustrated background in their original positions. Preserve mountain, coastline, forest, water and map geography composition as closely as possible. This is an illustrative marketing artwork, not scientific data. Do not add people, UI, buttons, new branding, legends, statistics, watermarks or extra text. Retain all original art outside the small UI areas. Landscape aspect 3:2.

## Exact wave extraction prompt

Use case: background-extraction. Edit target: the exact supplied MarineCast reference screenshot. Extract only the dark-navy wave brand mark from the upper-left corner (the flowing wave lines to the left of MARINECAST). Preserve its original shape and delicate stroke style. Output a clean tightly framed image of that wave mark by itself on genuinely transparent alpha background; no wordmark, text, surrounding screenshot, paper texture, map, shadows or additional lines. The result is a small provided-brand asset for the website, not a new logo design. Wide horizontal mark, roughly 2:1 shape, with minimal transparent margins.

## Diffuse night revision

Active night asset: `salish-sea-night-soft.png`, built-in Image Gen output
`exec-141d713c-c1ad-4447-a29b-8c0415d0262f.png`.
Prompt: Remove the bright moonlight streak on left water and directional silver
lighting on clouds and rocks. Use dim diffuse night illumination, preserve exact
framing and landscape geometry, add no objects or text.
Day and night remain mounted during a 2.8-second feathered horizontal mask sweep;
both share the pause control. Reduced motion switches immediately.

## Northern sky overlay

Night stars now use approximate J2000 positions of Dubhe, Merak, Phecda, Megrez,
Alioth, Mizar, Alkaid and Polaris, polar-projected and uniformly scaled for the
artwork. This is a decorative constellation arrangement, not a sky chart for the
scene's location and time. The Big Dipper pointer-star relationship is described
by NASA: https://science.nasa.gov/solar-system/skywatching/what-is-the-north-star-and-how-do-you-find-it/
Mouse proximity increases the stars' glow and twinkle; pause/reduced motion
freezes the animation. Tree distortion has been removed.

## Live northern chart

The decorative constellation shader is no longer enabled. `LiveNorthernSky`
provides a separate, explicitly north-facing azimuth/altitude chart for a fixed
observer at 48.55 N, 123.08 W (San Juan Islands), using the current browser clock
and refreshing every 15 seconds. Pacific local time is displayed. The chart
includes 19 approximate bright-star J2000 positions, precessed to date using
IAU 1976, then converted using mean sidereal time and spherical horizon formulas.
The map is an azimuth/altitude chart, not a perspective calibration of the image.
Below-horizon and out-of-northern-view stars and connecting segments are omitted.
No live weather, atmospheric refraction, proper motion, nutation, terrain
obstruction, or complete star catalog is modeled. A low-precision solar position
labels daylight/twilight/night rather than treating the dark theme as real night.
Sources: https://aa.usno.navy.mil/faq/alt_az and https://aa.usno.navy.mil/faq/GAST.

## Scenic star overlay restored

The live chart panel is no longer mounted on Home. The night image now has an
unlabeled star overlay with the Big Dipper and Polaris pattern, plus a sparse
faint decorative star field. Cloud brightness and the sky mask limit visibility.
Mouse proximity adds gentle twinkle. This is scenic composition, not a calibrated
current-time sky; the unused chart implementation is retained separately.

## Catalog-based scenic sky (current)

The random filler and fixed eight-star patch have been replaced with HYG v4.1
catalog coordinates: 4,105 stars brighter than visual magnitude 5.8, with the Sun
excluded. Only stars above the horizon within 100 degrees east/west of north
are projected at the San Juan Islands observer, using the current browser clock,
precession and sidereal-time/horizon transforms. Positions refresh once per minute
while rendering. The photo sky mask hides stars behind the terrain; cloud brightness
subdues them. Magnitudes drive brightness, with hover twinkles retained.

The full 0–90 degree altitude range is compressed into the artwork's narrow sky;
this is deliberately a scenic panorama, not an optically calibrated sky chart.
Stars that are outside the view or behind terrain are not forced into the scene.

HYG data: David Nash / Astronexus, CC BY-SA 4.0.
https://github.com/astronexus/HYG-Database
https://creativecommons.org/licenses/by-sa/4.0/
Derived catalog and transformation/license details:
`src/data/scenicStarCatalog.json`, `src/data/scenicStarCatalog.LICENSE.md`.
