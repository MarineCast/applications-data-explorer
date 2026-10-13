# Local seascape map QA

Verified 2026-10-08 in the application checkout. The Map defaults to the published partial seascape release; Home's catalog, Relationships, Sightings and Data health retain explicitly synthetic fixtures.

## Source and preparation

Source: `../../Data/seascape/releases/seascape_consolidated_static_native_r6_r8_20261007_v3`. The matching publication receipt records publication on 2026-10-07; the immutable manifest's earlier prepublication flags remain intact.

Manifest SHA-256: `99ae96b8490b8cb74f18544ae510db07243d7404fd23b5f775160bd6a936b0e7`.

The read-only preparation script verified all 50 manifest file checksums. Independent generation to `/private/tmp/marinecast-seascape-independent-cache` read every exported column back and compared every value/null against Parquet in native row order.

| Native table | Rows | Exported non-key columns | Numeric map entries | Populated entries |
| --- | ---: | ---: | ---: | ---: |
| R6 | 2,621 | 284 | 137 | 106 |
| R8 | 88,243 | 448 | 214 | 181 |

All-null numeric fields remain available and labeled. Categorical/boolean qualifiers remain in the inspector. Linked field roles, units, source hashes, release identity and modeling eligibility remain source-qualified. No R8 variables are averaged into R6.

## Automated checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 29 tests passed across 8 files.
- `npm run build`: passed; the existing lazy MapLibre bundle exceeds Vite's 500 kB warning threshold.
- `git diff --check`: passed.
- `python3 -m py_compile scripts/prepare_seascape.py`: passed.

Tests cover native identity, exact zero/null handling, checksum rejection, malformed packed columns, missing-source error/retry, incompatible-resolution selection, comparison inspector provenance, R8 zoom gating and map-source readiness after reinitialization.

## Browser checks

Checked the live app at `http://127.0.0.1:5173/#map` with MapTiler cartography, desktop 1440 × 900, mobile 390 × 844 and the normal in-app browser size. Restored the normal viewport afterward.

- R6 `8628c2b07ffffff`: `BATHYMETRY` exact source value **74.27570093457943 m**, positive down.
- R8 `8828d10691fffff`: `SLOPE` exact source value **1.1236463020532825°**; comparison bathymetry **255 m**. Inspector values and qualifiers followed the selected comparison side.
- R6 `8628c2167ffffff`: actual bathymetry null displayed **Unavailable** on mobile, with source qualifiers retained.
- Numeric selection, native-resolution switching, comparison, cell selection, layer visibility and R8 zoom gating worked. Native H3 overlays were visible above the basemap. Fresh reload and R6 → R8 → R6 produced no new console warnings/errors after the lifecycle fix.

Local screenshot evidence: `/private/tmp/marinecast-seascape-map-qa/native-r8-comparison.jpg` and `/private/tmp/marinecast-seascape-map-qa/mobile-native-null.jpg`. Final preview: `/Users/tylerstevenson/.codex/visualizations/2026/10/08/01a11ade-ab6a-7ac0-b905-d26882f67cfc/seascape-map.jpg`.

## Boundaries

This validates local consumer integration. It does not acquire data, change source products, qualify ecological inference, promote a release or publish remotely. Annual kelp and directional coastal-ray sidecars retain separate year/bearing grain and are not flattened into the static map. Partial inventories, historical observations, unknown dates and fallback support do not establish current habitat presence/absence. Display means are unweighted cell summaries; source overlays use full H3 polygons.

The browser cache is ignored by Git but included in a local production build when present. Toolkit tests, new provider acquisition and remote deployment were not run because those repositories/services were not changed.

## Map corner cleanup

Removed the native H3 finder, map source selector and map header coverage badge. Every Map entry now opens the local seascape release, including navigation from the Home catalog. Cell inspection remains available by clicking map cells. Verified the cleaned corner in the live browser; type checking, lint, all 29 tests, the production build and `git diff --check` passed again. The MapLibre chunk size warning remains.

Removed the Region selector, Native H3 grid visibility toggle and variable search. Seascape map layers and summary statistics always use the full release area, with the native grid visible. The native resolution and variable selectors remain available.

## Ten-color legends

Added four ten-color palettes and a standalone legend outside the layers panel. Equal bins use ten equal-width intervals; quantiles use linearly interpolated full-area empirical deciles; min/max uses a continuous gradient through ten color stops. Source values and missingness remain unchanged. Ties share colors, constant data use one color, and all-null products show no numeric scale. Both map renderers and the legend use the same scale object. Each comparison side has its own thresholds and legend.

Type checking, lint, 33 tests across 9 files, the production build and `git diff --check` passed. New checks cover interval boundaries, skewed quantiles, ties, zero/null/constant values, interpolated colors, exact GeoJSON scalars and legends remaining outside the closed panel.

Browser checks covered palette changes, equal/quantile/min-max scales, separate comparison legends and mobile 390 × 844 plus desktop 1440 × 900 layouts. Bathymetry quantile median displayed 73.35 m; its full-area endpoints remained 1 and 1,808.644 m. The preview uses Viridis quantiles. Screenshot: `/Users/tylerstevenson/.codex/visualizations/2026/10/08/01a11ade-ab6a-7ac0-b905-d26882f67cfc/seascape-map-legend.jpg`. The temporary viewport override was reset.

## Atlas cards, sidebar and compact legend dropdown

The map now follows the supplied atlas card/sidebar reference. The rail supports Explore, Layers, Compare, local layer JSON export, Help and label collapse. The user's follow-up removes the bottom analysis sheet and moves palette, color scale and opacity into a dropdown opened from the compact top-left colorbar. The collapsed card contains only colors, numeric ticks and unit. Each palette row has a ten-color preview and current-selection checkmark; equal bins, quantiles and min/max sit below, followed by opacity. Layers retains native feature/resolution selection and the Standardize toggle; advanced source notes remain in Source & quality.

Cell popups retain value/status. Source & quality opens a native dialog with the exact original scalar, source path/hash, release identity, units, definition, eligibility and all linked row qualifiers. Export serializes the current full native layer, preserving H3 order, zero, null and qualifier arrays.

All 36 tests across 10 files, type checking, lint, production build and whitespace checks pass. Browser checks covered palettes/scales/opacity, Escape/outside dismissal, native cell/null/source inspection, responsive comparison menus, Layers, Export and Help at 1536 × 1024, 1024 × 768 and 390 × 844. Fresh reload/primary interactions produced no new warnings or errors. The existing MapLibre bundle advisory remains.

Current visual QA and comparison evidence: [design-qa.md](../../design-qa.md). Final screenshot: `/Users/tylerstevenson/.codex/visualizations/2026/10/08/01a11ade-ab6a-7ac0-b905-d26882f67cfc/atlas-redesign/final-preview.jpg`. Viewport overrides were reset and the local map preview retained. Source data, native area, missingness, producer artifacts and existing ecological qualification boundaries are unchanged.

## Remove cell saving

Removed Bookmarks from the rail and the saved-cell state/dialog. Save cell is absent from both the popup and source dialog. Native cell inspection, exact values, source qualifiers and local layer export remain available. The 36 tests, type checking, lint, build and whitespace check pass. Browser verification confirmed the cleaned rail and popup/source actions.

## Full-area standardization

Replaced all Layers advanced-option items with a Standardize switch. The display calculation is `(value - mean) / std`, using unweighted finite non-null native cells and population std (`ddof=0`). Comparison layers compute separately. Both map renderers and all legend modes consume the transformed values. Raw source values, H3 identity, qualifiers and units stay intact for inspection/export; export adds transformation metadata when enabled. Nulls remain null. All-null and constant layers have no defined z-scores and show an explicit unavailable status. Centered/scaled Welford accumulation avoids variance overflow and retains small differences around large offsets.

Independent NumPy validation of the real prepared R6 BATHYMETRY source: 2,494 finite values; mean `112.83185261279216 m`; population std `157.550326267209 m`; standardized range `[-0.7098166996057041, 10.763619168058769]`. Live Source & quality reported matching mean/std to floating-point tolerance. Cell `8628d1aefffffff` retained raw `44.333333333333336 m` and displayed `-0.434772309917555 z`. A missing cell remained unavailable in both representations. Switching off restored the metre legend. A real all-null anomaly field showed an unavailable status and no numeric scale. Live comparison produced independent z-score legends.

Type checking, lint, 44 tests across 11 files, production build and `git diff --check` passed. Tests cover population variance, large offsets/magnitudes, zero/negative constants, empty support, native identity/null preservation, independent comparison transforms, restoration and original-value JSON export. The build retains its existing non-blocking MapLibre chunk-size warning. Live MapTiler browser QA covered the Standardize switch, source inspector, comparison, missing support and 390 × 844 mobile layout; no fresh browser warnings/errors were recorded. Temporary viewport override reset. Evidence: `atlas-redesign/standardize.jpg` and `atlas-redesign/standardize-mobile.jpg` under `/Users/tylerstevenson/.codex/visualizations/2026/10/08/01a11ade-ab6a-7ac0-b905-d26882f67cfc/`. These are display/software checks; they do not change producer release qualification.
