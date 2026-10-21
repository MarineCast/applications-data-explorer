# Current follow-up: final-only Human files — 2026-10-17

`Data/Human` now contains only `static.parquet`, `dynamic-calendar.parquet` and `static-native.parquet`. The producer stages work and writes checksum receipts outside that directory, under toolkit-managed ignored storage. Source values/types/nulls, calendar jurisdiction/local dates/DST boundaries and all native source geometry/properties are preserved exactly. The adapter validates embedded metadata plus the external receipt and all three source hashes. The calendar remains a distinct source product without a map layer. Existing adapter exclusions for retired access-state summaries still apply on cache refresh. Older filenames/evidence paths in the dated sections below are historical; the relocation ledger is in `Toolkits/toolkit-human/data/provenance/final-layout-20261017`.

# Human layer selectors — 2026-10-17

Native Human selectors, including Places, Boat Launches and Shore Access, contain
Family and Feature choices. Record-count notes, location search, record dropdowns
and the native-geometry record-count footer are removed from both the main drawer
and comparison setup. Map selection, source popups, legend categories and Insights
remain available. Removed search inputs no longer leave a hidden name filter.
Source data, native geometry and cache bindings are unchanged. Earlier validation
snapshots below describe their then-current controls.

# Current follow-up: density coverage removal — 2026-10-17

The density collected coverage alias is removed from source and app, including future rebuilds. All retained numeric values and types are identical. Current source has 13,461 rows / 64 columns; Human cache has 56 columns / 23 features. Actual feature-picker evidence: `Data/Human/provenance/population-density-coverage-removal-20261017/population-choices.jpg`. Current hashes and exact-value checks are in the adjacent `completion.json`.

All 497 Human toolkit tests, six adapter tests and all 340 explorer tests pass. Build and lint pass. The seven earlier appearance failures are resolved by the concurrent owner's popover support in the jsdom test environment; shared legend/test expectations were preserved. Native integration and its browser/export evidence below remain valid; its old hashes, schema counts and appearance-test caveat are historical.

# Current Human native integration — 2026-10-17

Current source: `Data/Human/human-r7-static.parquet` (13,461 rows,65 columns),
`human-native-features.geojson` (6,692 records plus60 context park areas), and
separate unchanged civil calendar. Population quantities are unchanged. The three
collected 25/50/100 km coverage-status aliases are removed from source and app;
original source/missingness provenance and zero-imputation flags remain.

Explorer: Population, Boat Launches, Shore Access and Places families. Native
locations have category/access filters, search, record popups, full original
attributes, optional park source areas and filtered original-geometry GeoJSON export.
Useful H3 summaries are separate. The unqualified legacy all-line accessible-length,
fraction and derived access-state fields are withheld from app choices/qualifiers.
Mapped records do not guarantee access, current operation or observed use. Mixed
source vintages include legacy BC circa2004. Representative points are not entrances.
Nine invalid park source polygons are repaired only in their display copy; original
WKB checksums, validity and source attributes remain inspectable.

Independent checks match all57 exported source columns and every native geometry/
attribute exactly; all1,492 combined-catalog assets hash verified. Non-Human
feature/product/dataset bindings and calendar bytes are unchanged. Actual browser
checks cover Don Armeni marker clicks, Alki category filtering, Deception Pass source
areas/repair evidence, visibility/domain transitions, independent comparison filters
and exact two-feature filtered GeoJSON export. No browser console errors.

497 native toolkit tests passed; final regular-wheel checks passed79tests and24CLI
help routes with Human AIS absent; six adapter tests and34Human frontend regressions
passed. Production build passed. The earlier complete frontend suite passed337tests;
a concurrent shared `LegendDropdown` popover change introduced seven appearance-test
failures requiring app-owner follow-up. These are not reported as passing.

Current source/static SHA-256: `255f99ddac2ca81a3785adab90da1917991b94a05cf5ec49644f4c41cfa25399`.
Current browser catalog SHA-256: `148bfe6ae94e5a56168500a24abb9881a90ed4a182efb8931df4399e6842177d`.
Full paths, hashes and validation evidence: `Data/Human/provenance/native-integration-20261017/`.

## Historical population-only verification

The following describes earlier snapshots; its hashes and counts are historical.

# Current unified Population schema (2026-10-17)

The five measurements are Population Count, Population Density (people/km²),
Population Within 25km, Population Within 50km and Population Within 100km.
They retain their `_collected` machine identifiers, values and every source/coverage
qualifier. Strict count/density scalar duplicates are removed, following the distance
cleanup. Measurements and coverage indicators all use the Population family.
Metadata/help retains the explicit missing-contribution-as-zero limitations.

The current product/cache identities and exact-value, future-export, legacy-cache
and live-selector evidence are recorded in
`Data/Human/provenance/population-schema-unified-20261017/`.
The following prior delivery records are historical, not current identities.

# Current distance schema (2026-10-17)

Public distance quantities are `population_within_25km_collected`,
`population_within_50km_collected` and `population_within_100km_collected` only.
The strict duplicate scalar fields are absent from the current source product,
field dictionary and browser options. The adapter also excludes them when extending
an older input/cache, and only collected-distance coverage flags are selectable.
Source-subtotal, coverage, missing-source, geographic-support, zero-imputation and
method evidence remains attached. Per-cell count/density fields are unchanged.

The current schema migration verifies every retained source column and browser
asset exactly against the corrected preceding product. No source acquisition or
population recalculation is needed. Current identities and live-selector evidence
are recorded in `Data/Human/provenance/distance-fields-collected-only-20261017/`.
The following earlier delivery records are historical evidence, not current hashes.

# Human collected population integration

The Human default is `population_within_100km_collected`, labeled **Collected population within 100 km**, in persons on the native 13,461-cell H3 R7 registry. The app reads the final `Data/Human` catalog and companion; it does not edit, acquire or recompute producer data. The producer reuses its original area-allocated available-source subtotal within a WGS84 100 km radius of each H3 center. Missing contributions are explicitly assumed zero only in this derived estimate. US 2020 and Canada 2021 remain a mixed-vintage static resident baseline, not visits, reporting effort, detection or whale occurrence.

All 13,461 estimates are finite and populated: 13,023 have partial coverage with `__zero_imputed=true`; 438 have complete coverage with the flag false. A positive subtotal can carry the zero assumption. The current 100 km product has no zero-valued estimates. Future imputed and supported zeros remain distinct in focused UI tests. The UI does not infer complete observed totals from a non-null derived value.

The selected-cell inspector shows value, radius, census vintages, source coverage, zero assumption and unverified geographic support. Source qualifiers retain the method `area_weighted_collected_sources_missing_as_zero.v1` and original missing-source identifiers. The map uses the existing numeric palette/legend and preserves source values in Insights. Original per-cell count/density and 25/50/100 km canonical metrics/statuses remain available; their nulls remain null. No 250 km field or selector is exported. Overlapping neighborhoods cannot be summed as independent regional totals.

## Preparation

```sh
python scripts/human_input.py --human ../../Data/Human
python -m unittest discover -s scripts -p test_human_input.py -v
```

Use a Python environment with `pyarrow` and `h3`. Preparation checks source catalog/metadata/Parquet bindings, all existing referenced map assets, native identity and exact exported column readback before atomically replacing the browser catalog. Retain referenced immutable snapshot directories. Other domains are reused, not rebuilt. The source and browser caches remain local.

## Verified delivery

- Producer static Parquet SHA-256: `c9a09150d0971ca6b6a947c9987be9ffdfcf01b03c2e2636bedb654827b30a6f`.
- Producer catalog SHA-256: `af5d3783fb5c61da683f56f8016396058102cf13b62a62afda737ce5e0d9e7f3`.
- Human browser snapshot: `cb54e0b6b3f22a95c45290c64bf2bfce968386fcf8d23cec5fac3fbc7d92692b`.
- All 27 exported columns independently compared exactly with the persisted source Parquet. All 1,473 referenced combined-catalog assets hash verified. Every non-Human feature/product binding and separate Orca/Hydrology catalog byte is unchanged.
- Three Python adapter tests pass, including exact zeros/nulls/partial sums, qualifier preservation, tamper rejection and membership asset verification.
- All 292 frontend tests pass, including Human native/default selection and five inspector cases for positive partial sums, supported zero, imputed zero, unknown zero support and unavailable values. Typecheck, lint, production build and diff checks pass. Build retains its vendor chunk-size advisory.
- Headless Chrome native-map clicks verify partial estimate 10,326.898965546905 persons and complete estimate 567,804.3110806381 persons against source; displayed values round only for readability. Both keep original map values.
- Real per-cell `known_zero` renders numeric 0; real partial canonical null renders Unavailable with neutral color, retaining the non-null available subtotal only as a qualifier. No synthetic live zero data was introduced.
- Desktop 1440×1000 and compact 390×844 inspector/drawer screenshots inspected; no horizontal overflow, runtime errors or canvas replacement. Mobile inspector scrolls to notes and source details.
- Regression clicks verify Orca source point/group details, Hydrology six-river overview and Governance WDFW membership details. No push, merge or deployment.

## Files changed for this update

`scripts/human_input.py`, `scripts/test_human_input.py`, `src/pages/SeascapeMapPage.tsx`, `src/pages/SeascapeMapPage.test.tsx`, `src/components/HumanPopulationInsights.tsx`, `src/components/HumanPopulationInsights.test.tsx`, `README.md`, and this document. Existing owner edits were retained. Ignored Human browser assets/catalog were activated separately.

The source binding above reflects the subsequent full radius-aware toolkit run.
Coverage flags remain identical; raw census inputs, displayed registry and other app
domains are unchanged. All 27 columns and 1,473 referenced assets were rechecked after
this cache refresh. Toolkit evidence is under
`Data/Human/provenance/radius-aware-collection/`; the original app implementation test
counts above describe that implementation check, not a rerun of unrelated app code.
