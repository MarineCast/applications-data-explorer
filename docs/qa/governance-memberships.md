# Governance feature memberships

## Self-contained final products — 2026-11-01

The independent reader now supports contract v5: identical selected physical
columns with lossless scientific support embedded in the final Parquet metadata.
It checks the embedded binding, aliases, labels and exact reconstruction. Source
watching needs only the final Data files for v5; required external audits remain
watched for legacy v2–v4 inputs. Existing delivered products were not migrated.

All 24 Governance Python reader tests passed with producer/sibling imports blocked.
Storage-only candidates matched all public and reconstructed scientific arrays
across the retained 2,621 R6 and 88,243 R8 rows, including independent consumer
readback. Temporary candidates were removed. This does not rerun regional overlays,
source acquisition or interactive browser QA. See the
[current producer contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#compact-delivery-and-external-audit).

Current family label (2026-10-19): **Fisheries Management Areas**, replacing
Management Areas in both normal and comparison selectors. Feature names remain
**Management Area Count** and **Management Area**. Native `management_areas`
keys, source bindings, values, memberships and support semantics are unchanged.
The browser catalog adapter and legacy-catalog normalization both apply the label.
Rename checks: 17 focused frontend tests and 15 Governance Python tests passed;
typecheck, repository lint and `git diff --check` passed. Live HTTP confirmation
was unavailable: the local catalog request returned 503 and the retry timed out.
No data rewrite or new rendered-browser validation was performed for this label.

## Management Areas selector update — 2026-10-19

The app now exposes only **Management Area Count** (the original recorded feature
count) and **Management Area** (the original full membership field) at R6/R8.
Other Management Areas fields remain retained source/support data. Hidden saved
selections restore Count at their existing resolution. No source data changed.

Validation: 69 focused tests across Management Areas, the native catalog/layer
adapter, the family picker and map page passed; TypeScript, repository ESLint,
code-only production build and `git diff --check` passed. Tests cover exact
bindings/qualifiers, native resolutions, legacy IDs, display names and saved-choice
fallback. The build retained the existing large-chunk warning and omitted public
data copies. No live browser, source acquisition or regional rebuild was run for
this presentation change. Build staging is recorded in
`/tmp/marinecast-management-areas-20261019/manifest.json`.

### Underlying data and pipeline removal — 2026-10-19

The later explicit request removes the eight remaining Management Areas
derived/status columns from both delivered R6/R8 Parquets, leaving exactly Count
and memberships. Polygon coverage, line length, point count and independent
native-attribute diagnostics are no longer created by this family's overlay.
`uniform_count_membership_support_v1` metadata preserves the exact shared support
state; browser-only status arrays satisfy the existing renderer/inspector contract.
Original data, paired names/IDs, overlaps and null support remain intact.

The producer suite passed 230 tests (two live-provider checks skipped); all 15
Governance adapter and seven live-reader Python tests passed. A regular wheel
passed 22 product/interface tests outside the checkout with application imports
blocked, and `pip check` passed. Strict producer MkDocs and both repo diff checks
passed. Live HTTP readback from port 5173 confirmed exactly the two named features
at both native resolutions, source catalog checksum binding, and checksum-verified
membership assets with count/null reconciliation. No new rendered-browser check,
acquisition or full regional rebuild was run. See the producer's
[two-column contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#management-areas-interface-2026-10-19)
and workspace `Reports/governance-management-areas-2026-10-19/` for migration and
live-reader evidence. The earlier presentation-only note above is historical.

The explorer consumes the producer's optional `membership_schema_version=1` fields through a dedicated checked JSON asset. Producer catalog and embedded schema versions remain 1. Legacy scalar caches still load. Nested membership records never enter scalar `map_kind`, numeric scales, standardization or smoothing.

Each available collection/source-role gets a **Recorded features** choice alongside its unchanged numeric counts and coverage. Selecting it automatically selects categorical legend mode. Single features use colors keyed to qualified identities; overlapping cells use diagonal stripes of the constituent colors. The full key lists features that occur only in overlaps too. The legend explicitly states that stripe widths are not area shares and stripe direction is not a boundary orientation.

The pattern atlas admits the 512 most frequent membership sets with deterministic ties. Sets reuse cached patterns; unreferenced images are removed when switching layers. Up to six feature colors are shown; an additional slate stripe indicates further memberships. Sets beyond the atlas bound use a distinct dense-combination hatch. This display limit never removes memberships from the inspector or JSON export. Unknown support and verified-empty inventories use separate patterns and labels.

The selected-cell inspector retains the native H3 identity and center, every canonical feature, paired source record, optional name/code/hierarchy, source status and intersecting geometry part IDs. Missing labels and native regions stay null. Closing the drawer leaves the selected layer on the map. Human's existing-cache extension also checks membership-asset checksums before reusing a catalog.

## Validation on 2026-10-16

- 95 focused frontend cases: dedicated decoder, all overlap retention, null/empty distinctions, bad checksums, row/support alignment, bounded patterns, categorical/numeric switching, inspector mounting, map lifecycle, existing Human R7 and Seascape behavior.
- 15 focused Python cases across Governance, general map preparation and Human cache integration, including static/dynamic slices, exact nested Arrow types, corruption rejection and membership asset checksum reuse.
- App TypeScript check, targeted ESLint, production Vite build and `git diff --check` passed. The build wrote to `/tmp/governance-consumer-build` with `copyPublicDir:false`; private source/cache assets were not copied. Vite reports its large-chunk warning.
- Real bounded producer sample: 1,535 native R6 cells; 2,362 memberships; 279 distinct features; 590 overlapping cells; 26 null-support cells. All 279 identity colors are distinct in this sample. The renderer used 405 cached patterns (404 membership sets plus unknown support).
- Installed Mac Chrome, desktop 1440×1000 and compact 390×844: complete 279-feature key, categorical mode, disabled standardization/smoothing, mixed cell `8628d1a1fffffff` with all three features, null cell `8628de11fffffff` with unknown membership support, and return to numeric count controls. No page errors and no compact horizontal overflow. Existing Human R7 and Seascape bathymetry were also checked.

Temporary evidence lives under `/tmp/governance-consumer-qa`: `real-report.json`, `browser-report.json` and `screenshots/`. The isolated QA server uses a temporary merged catalog and the bounded producer output; it does not replace the live browser catalog. Unit tests cover verified-empty support and >6-membership/atlas-overflow cases absent from the real bounded sample.

## Full-size upgrade and live readback

After direct user approval on 2026-10-16, the producer replaced only the two generated Governance Parquets and catalog, preserving all 40 OriginalData files and the preexisting `.DS_Store`. Every old numeric/status column matches the previous live version exactly. Strict validation passed a catalog-listed hardlink view of the actual live files; direct directory validation still rejects the untouched extra `.DS_Store`, and no validator exception was introduced.

The consumer checked all 70 group/grid membership assets, preserving 398,378 memberships across 2,621 R6 and 88,243 R8 cells. The largest full key has 5,884 identities. The legend uses searchable pages of at most 50 rendered rows, and colors are collision-resolved in canonical key order. Repeated source labels include their original canonical IDs for disambiguation. Unknown and verified-empty states stay separate in the map, inspector, exports and categorical insights.

Full preparation took 27.05 seconds, peaking at 1.24 GiB RSS; the final actual Governance-only updater staged its immutable snapshot in 29.46 seconds at 1.01 GiB RSS. Initial checked Node decoding peaked at 301 MiB RSS/135 MiB JS heap. The generated full browser snapshot is 108,723,380 bytes. It reuses the existing Human/Seascape bindings unchanged. Chrome's default-graphics memory snapshots were 2.11 GiB process-tree RSS for numeric R8, 2.44 GiB for management R8 and 2.67 GiB for critical habitat R8; these include basemap/WebGL/workers and retained allocations, not membership-only memory. Whole-page JS heap reached 645 MiB in that run.

The real app at `http://127.0.0.1:5173/#map` passed live readback with the activated catalog, all 1,477 referenced asset hashes, complete mixed/null inspection, continuous-control restoration and Human R7/Seascape bathymetry switching. Full R8 management/critical habitat, 50-row legend pages, `19-11` search and compact 390×844 rendering passed without page errors or horizontal overflow. R8 UI state became ready in 783 ms in the final live check; this is not a final GPU-idle benchmark. Management uses 512 membership-set patterns plus unknown/dense patterns; 173 of 5,919 overlap cells use the documented dense fallback.

Current identities:

- Source catalog SHA-256: `da8c131592bbc834173b50b0b4dec663df1b4522a7d9c3e2b12b8c7a63d9e47a`.
- R6 Parquet: `e9122ac95354260493d9d19e6411be93e6d3996ac46466796f39f6abbe39635c`.
- R8 Parquet: `094a22e1539bb3e95b776815a87700635214be6da32bdf5905de55fe567dd024`.
- Browser snapshot: `53f6019931cfd9c3bacdcbccf4988e63b9a45e3cb7a0bd67c0440f95ff57a463`.
- Browser catalog SHA-256: `d030871b04985c5c7c766ca404489cce24d50e85ff6c7682e8574d7ba6895632`.

Evidence and rollback:

- `/tmp/governance-membership-full-validation/promotion.json`, `report.json`, `native-membership-validation.json`; producer's three-file rollback is `promotion-rollback/` there.
- `/tmp/governance-consumer-full-qa/{decode-report.json,browser-memory-report.json}` records isolated full-size checks.
- `/tmp/governance-consumer-live-qa/{browser-report.json,full-grid-browser-report.json,screenshots/}` records the actual live app checks.
- `/tmp/governance-consumer-promotion-cache/activation-report.json` records cache activation; `live-browser-catalog-before.json` retains the previous catalog. Existing asset trees were retained for rollback.

No source downloads, raw source copies, push or merge occurred. The normal Vite app remains running on port 5173. To update only Governance in a future prepared map cache, run `python scripts/governance_input.py --governance ../../Data/Governance`; this verifies reused assets and sources before atomically replacing the catalog.


## App-only source tables — 2026-10-25

The user requested exactly the handpicked Explorer feature columns plus H3 in the
source Parquets. Application-v2 deliveries contain 21 columns per native R6/R8
static table. The combined conservation assignment is now materialized; all
selected counts/flags remain. Removed scientific support is retained in required,
checksum-bound external audits, with exact reconstruction of the original table.
The reader restores that support before using the established feature/inspection
pipeline. Audit paths participate in source watching and snapshot bindings;
missing/changed audits fail closed. Legacy v1 products remain readable.

Current checks: 21 Governance Python tests, 10 automatic-reader tests and 55
selected feature/picker tests passed; typecheck and lint passed. Both real native
products retained all twenty feature IDs, names, definitions, units, categories
and qualifiers, with exact H3 identities, all 53 encoded scalar arrays and all 15
membership payloads per resolution. Only source-file checksums and generated
asset locations changed. No new source acquisition, overlay, legal applicability
review, model validation or interactive browser QA was performed. See the
[producer contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#compact-delivery-and-external-audit)
and [dated validation](../../../../Reports/governance-app-only-2026-10-25/report.json).


## Friendly source names — 2026-10-25

Application-v3 source columns use `_count`, `_membership` and `has_`, with explicit
fraction units in `conservation_area_coverage_fraction`. The independent reader
verifies `column_aliases`, then restores the native scientific names internally;
existing feature IDs, labels, inspection keys and saved selections stay stable.
The alias change preserves all scalar/nested values, types and nulls. Existing
external audits are reused and remain checksum-bound. v1/v2 inputs remain readable.
Current rename validation is recorded in the [dated report](../../../../Reports/governance-column-names-2026-10-25/report.json).


## Readable membership values — 2026-10-25

Application-v4 replaces all eleven public membership structs with sorted distinct
readable name lists. Cells remain one native H3 row. Country and state/province
labels use explicit source codes/titles, fisheries prefer area titles, and other
labels use names/titles/codes. Conservation references retain `[Proposed]` and
`[Interim]`. Null lists and observed empty lists remain distinct. A future unnamed
feature retains a null list item. Names are display labels; counts still count
recorded identities and can differ from list lengths.

Every original typed membership is now in required external audit support. The
reader independently verifies name policy and exact labels, then restores typed
memberships for the existing map/inspection pipeline. Saved IDs, original records,
overlap details and scientific nulls remain preserved. Legacy v1/v2/v3 remain
readable. See the [dated validation](../../../../Reports/governance-membership-names-2026-10-25/report.json).
