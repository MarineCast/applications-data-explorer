# Viewshed weight layers — 2026-10-12

The Map layer dropdown adds Terrain weight, Distance weight, Above-ground weight (lower) and
Above-ground weight (complete). The original pilot score layers remain available. Settings
shares the same selection; changing layers preserves the map camera and cell inspection.
Target means and selected-source pair values both use the new saved fields, with existing
palette, opacity and coloring methods. The compact light dropdown sits at top left.

## Producer and cache evidence

- Producer checkout: the existing `viewshed-obstruction-fix` worktree; new opt-in
  `scripts/regional_weight_diagnostics.py`, its regression tests and methodology document.
- Parent pair checksum: `0e24f3283fe0b46aa4fe59d7fa066bd553755b7e255bf5231124ea51ced82168`.
- Weight diagnostic checksum: `48fd9c37d90c431c787d2b4c930d5de6f7912449f23be8bac97c90ef4f0eaa39`.
- Browser snapshot: `9403d86931d543a0ebacfc9f21d81bc5783ccb7948e398568116979f2dca62be`.
- All 47,295 pair keys match the original 163-source / 1,279-target universe. All original pair
  fields and all component fields passed exact JSON readback. Every asset checksum passed.
- Independently recomputed all target means and conditional support counts. Terrain/distance
  include all 163 sources, with absent out-of-reach pairs zero. Above-ground uses terrain-clear
  source pairs only; unresolved contributors retain null complete means and bounded estimates.
- Original pair and all 163 source-partition checksums remained unchanged. The producer also
  checked retained band/metadata and implementation hashes before completion.
- The canonical normalized logistic profile was independently verified against every stored
  centroid weight: d50 parameter 9 km, slope 2.7 km, cutoff 30 km. Terrain integrates the same
  curve at each observer–water comparison, retaining the pilot's 15-mile ray reach.
- The completed diagnostic pass took 2,997 seconds with two workers and 4,690,722,816 bytes peak
  summed parent/worker RSS under the 6 GiB cap. Switching layers reads saved values and does not
  start scoring. First-pass incomplete outputs are retained separately; only the completed v2
  run was installed.

## Sampling checks

Independent checks compared stride-2 sampling with the full retained water lattice and disabled
the optimization that skips sampled rays with a saved zero upper bound. The optimized sampled
results reproduced the unoptimized sampled results exactly for both sites, without applicability
changes. These checks are numerical evidence for the two sites, not empirical calibration or a
regional accuracy guarantee.

| Source | Water census points | Terrain max / p95 error (percentage points) | Above-ground lower max / p95 | Above-ground upper max / p95 |
| --- | ---: | ---: | ---: | ---: |
| Dungeness | 1,304,615 | 0.336 / 0.187 | 3.578 / 0.578 | 4.496 / 0.483 |
| Sequim coast | 1,239,413 | 0.772 / 0.083 | 2.480 / 0.319 | 2.418 / 0.388 |

Reports are the task-local `dungeness-weight-census-check.json`,
`sequim-weight-census-check.json` and `viewshed-weight-cache-verification.json`. Their independent
scripts are retained in `viewshed-weight-validation/` alongside the task artifacts.

## Browser and owner checks

The real cache was checked in the live Vite app. Source mode loaded Dungeness and Sequim without
checksum or support errors. Dungeness → `8728d1818ffffff` showed terrain 61.3%, centroid distance
weight 68.4% at 7.20 km, and conditional above-ground bounds 51.1%–63.6%, with a null complete
factor. Its original pilot bounds remained 49.9%–62.5%. Target mode showed terrain 4.2%, distance
7.8%, above-ground bounds 21.4%–55.8%, and 86 applicable above-ground sources, including 75
unknowns. The original all-source denominator remained 163.

Dungeness → `8728c2482ffffff` displayed above-ground **Not applicable**, terrain 0%, and an
original resolved zero score; it was not relabeled as missing vegetation. A 320 × 568 viewport
had no horizontal overflow: the 230 × 44 dropdown aligned with Settings, and the inspector fit
the bottom sheet. Desktop 1280 × 900 also passed visual inspection. No browser console errors
were recorded. Viewport overrides were reset. Evidence is stored in the task's
`viewshed-simplified/weight-*-inspector-*.png` screenshots.

App: 81 tests, typecheck, ESLint, build, seven exporter contract tests, Ruff/Black on changed
Python files and whitespace checks passed. Toolkit: 40 focused checks passed; the full run had
813 passes and one supervisor test blocked by sandboxed macOS process enumeration. That test
passed separately outside the sandbox (including its isolated child cases). Changed Python
files passed Ruff, Black and compilation checks. Canonical component orchestration was untouched.
Build retains the existing non-blocking MapLibre chunk-size advisory.

These are direct-ray research diagnostics on partial in-reach water support, rather than a
canonical GDAL production rebuild. Above-ground is conditional roof/WorldCover/CHM transmission;
its lower display is explicitly a bound. Null complete weights, no terrain-clear support and
known zero remain distinct. Component target means cannot be multiplied to reconstruct mean
viewability. No acquisition, original-input modification, production promotion, publication,
commit or push occurred; empirical qualification, Canadian elevation datum equivalence and
physical touch-device testing remain unrun.
