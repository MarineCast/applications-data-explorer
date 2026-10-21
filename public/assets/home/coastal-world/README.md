# Continuous Salish Sea homepage world

Current region: Puget Sound, Hood Canal, Strait of Juan de Fuca, San Juan/Gulf Islands and Strait of Georgia, within 125.5° W–121.8° W and 46.8° N–50.3° N. The homepage opens wide and settles on the San Juans. Drag (or focus the scene and use arrow keys) to pan, scroll/use + and − to zoom, and use Return to San Juans to recenter. Explore by boat enables click steering/arrow-key driving and smooth camera following. Dragging while driving temporarily releases follow; the next steering click/key resumes it. Leaving the boat preserves the current view. Reduced motion skips the opening move; pause freezes simulation. Camera bounds prevent exposing the finite terrain edge.

## Current source and build

`prepare_regional_coast.py` reads the locally cached GSHHG 2.3.7 full-resolution L1 shapefile (Wessel and Smith, SOEST/NOAA, doi:10.1029/96JB00104). It performs no download and does not modify the toolkit or its products. The original San Juan source mask is inserted using its geodetic bounds. Regional raster: 1800 × 2600. SHA-256 of the archive actually read: `8dbbe7e071e77e9e75f2d639239099ebca8d5c16d6a07df8169729d49f15cf41` (recorded in `region.json`; differs from the cache manifest digest). GSHHG license texts are retained as `GSHHG-LICENSE.TXT` and `GSHHG-COPYING.LESSERv3`. Source archive: https://www.soest.hawaii.edu/pwessel/gshhg/gshhg-shp-2.3.7.zip . This is cartographic coastline, not a tidal survey or navigational chart.

`region.json` records bounds and world transform. `regional-land-mask.png` and `coast-field.png` drive the continuous terrain/water; `clearance.bin` stores conservative decimetre-coded world clearance (not real-world metres). Raster Manhattan distance divided by √2, minus a cell diagonal, underestimates Euclidean clearance; runtime checks all four surrounding samples and sweeps every movement segment. Tests confirm connected passable water from the initial boat area to Georgia Strait and northern Puget Sound. Very narrow passages can remain blocked by the conservative hull footprint.

`build_coastal_home.py` builds a continuous, nonuniform terrain grid with denser sampling around the San Juans. Regional relief and vegetation are illustrative, not measured elevation or land cover. The earlier artificial eastern mainland overlay is no longer rendered. Forests use spatial instance batches for frustum culling and simpler evergreen crowns at wide zoom. The terrain GLB is approximately 63 MiB; the regional forest is a 16.2 MiB binary asset with 707,981 placements; only the homepage loads it. Regional terrain is coarser than the San Juan detail. No scientific data pages or products are altered.

```sh
python scripts/blender/prepare_regional_coast.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build_coastal_home.py
```

## Regional forests and mountain ranges (2026-10-15)

The map bounds remain unchanged. `coastal_relief.py` supplies approximate geographic anchors for a connected Olympic range (Olympus, Hurricane Ridge, Anderson, Deception, Constance, the Brothers and southern ridges), Mount Baker, Cascade foothills and the in-bounds slopes of eastern/southern summits. Canadian relief includes the North Shore, Howe Sound, Garibaldi/Tantalus, Sunshine Coast and Vancouver Island ranges. Summits beyond the existing footprint contribute only their slopes; no new map area is created. Locations are approximate and heights/radii are artistic, not measured terrain. Geographic context: [Olympic National Park](https://www.nps.gov/olym/learn/nature/mountains.htm), [USGS Mount Baker](https://www.usgs.gov/volcanoes/mount-baker/), and [BC Parks Garibaldi](https://bcparks.ca/garibaldi-park/).

Every region uses the same tree candidate density as the San Juan inset, with shared grove/clearing noise, slope rejection, size variation and three evergreen variants. Trees thin between scene elevations 7 and 10.5; alpine terrain remains bare and the snow shader uses a higher, irregular snowline. Tree root heights are interpolated from the exact exported terrain triangles. Town plots and streets continue to exclude trees. These are illustrative distributions, not land-cover data.

`forest.bin` holds little-endian float32 records of six values: world x, height, world z, scale, wind phase, variant. `world.json` records its URL, stride and count. The browser validates the payload, then groups trees into spatially culled batches. Close views use the original needle/bough geometry and wind-driven shadows. At zooms below 1.8, 75% of instances use inexpensive conifer crowns, retaining dense cover without rendering detailed branch cards across the region. Wide crowns also sway. Sustained performance and memory profiling on other hardware has not been performed.

The following sections retain earlier local-scene asset history; current regional bounds and build instructions above supersede their old extent and navigation descriptions.

---

# Coastal homepage: San Juan archipelago

Built locally with Blender 5.2.2 and `scripts/blender/build_coastal_home.py`. Prepare the distance field with a Python environment containing Pillow, then rebuild from this checkout:

```sh
python scripts/blender/prepare_regional_coast.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/build_coastal_home.py
```

The preparation script resizes the retained `san-juan/land-mask.png` to 1200 × 800 with nearest-neighbor sampling and computes a two-pass chamfer distance field. Blender reads this directory's `coast-field.png` as non-color data. Red is land, green is decorative outside distance, blue inside distance; distance channels span 100 artwork pixels. Both scripts write only this asset directory and perform no acquisition. The full retained San Juan frame replaces the earlier isolated Orcas component. See `../san-juan/README.md` for source provenance. Small islets below the terrain mesh resolution may not have resolved relief.

Coordinates: original 1200 × 800 artwork maps to world X=(pixelX−600)/10, Z=(pixelY−400)/10. Blender Z-up becomes browser Y-up through the glTF exporter. The same raster transform supplies terrain, trees and navigation clearance. Relief is procedural and exaggerated; no DEM or measured canopy is used. Scene units are not metres. Do not present the coast shader as bathymetry/current predictions or this world as a navigational chart.

`terrain.glb` contains smooth, ridged procedural relief with correct upward-facing normals. The browser shades it with triplanar coastal rock, slope-dependent cliff exposure and mottled meadow colors. `fir-0.glb`, `fir-1.glb`, and `fir-2.glb` contain three evergreen variants with textured needle/bough cards and tapered trunks. There are 6,777 deterministic tree placements and 571 shoreline boulders. Six instanced mesh batches render the foliage/trunk pairs. Alpha-tested foliage casts and receives shadows; the depth material shares the wind deformation. `boat.glb` and `orca.glb` contain separate geometry/materials; the orca model is reused for a smaller companion. `world.json` retains clearance samples and deterministic placements. Whales use procedural group motion and breach rotation, not rigged biological swimming.

Two illustrative textures were generated with OpenAI ImageGen on 2026-10-15 and copied locally: `evergreen-bough.png` (transparent Douglas-fir needle bough, 1024 × 1536) and `coastal-rock.png` (fractured gray/ochre coastal rock tile, 1254 × 1254). No scientific observation is implied. Generation direction: isolated realistic evergreen branch with brown central twig, irregular fine needles and diffuse lighting on transparency; weathered stratified coastal stone with fractures, mineral variation and no vegetation. The bough texture is embedded into the three GLBs by Blender. No external model download was used.

Water highlights, shore foam, rings and persistent wake geometry are browser effects. They are art-directed rather than a fluid simulation. Click steering follows a heading toward the clicked point and stops on blocked clearance; it does not pathfind around land. A conservative hull radius checks all four surrounding clearance samples. The island is loaded only on Home, with lazy R3F code, DPR capped at 1.5, six instanced tree parts, and paused/hidden rendering on demand.

Water uses layered wave normals, specular glints, shelf bands, shore foam and cloud shadows. Four translucent procedural mist patches soften the edges. Geographic labels are canvas text sprites. Remaining differences from the supplied reference include the smaller San Juan geographic scope and lack of its mainland snow mountains; foliage and relief are real-time illustrative assets, not botanical scans or measured terrain. The boat and both whale footprints are checked against the expanded mask.


## Mainland mountain extension (2026-10-15)

`src/components/field-atlas/coastalMainland.ts` generates an illustrative eastern mainland mesh at runtime with overlapping ridges, eroded gullies and deterministic evergreen placements. It is a decorative extension inspired by the reference, not a geographic or elevation dataset. Snow follows altitude, surface slope and noise in the shared terrain material. The boat navigation boundary includes the new coastline with a conservative footprint margin. Water shelf shading uses the same coastline expression. Lighting uses a brighter warm sun and cool sky fill; water has wider turquoise shelves and quieter wave streaks. Boat, whale, wind and mist animations retain the shared pause clock. Portrait framing brings the scene closer to avoid exposing world edges.


## Island-first landscape refinement (2026-10-15)

The current preparation applies a 3 × 3 median filter and omits connected land components smaller than 45 pixels in the 1200 × 800 working mask. It removes 97 sub-resolution components while retaining 98.48% land intersection-over-union with the unsimplified source (4,406 changed pixels of 960,000). The source `san-juan/land-mask.png` is unchanged; `stylized-land-mask.png` records the derived silhouette. This is display simplification, not a replacement scientific coastline. Distance fields, terrain, placements and vessel clearance are rebuilt together.

Lower relief and a more overhead camera make the mapped San Juan, Orcas, Lopez and Shaw silhouettes readable. Noise-dependent shore ramps alternate hard bluffs with gradual pocket-beach slopes; terrain shading restricts sand to low edges and exposes rock on steeper surfaces. Groves use broad density fields, small-scale variation, clearings and slope rejection; individual instances vary size and subtle tone. Shore rocks cluster on exposed sections instead of encircling every island.

The eastern mainland is reduced to one northern snowy mass and two low background ridges, with lower-detail foothills and subdued snow. It is not a model of Mount Baker or a measured mainland landform. Water has irregular broad channel coloring, a very narrow muted littoral edge, and no stepped shore rings; its apparent depth is entirely illustrative. All existing boat, whale and wind animations are retained.
