# Integer presence indicators — 2026-10-25

Current Human static v6/final-only v7 has 14 columns. Three new fields (`has_boat_launch`, `has_shore_access_site`, `has_place`) are positive-count indicators; `has_port` is now the same int64 0/1 representation. All four are nonnull and read as numeric layers with unit `0/1`, with no true/false values in their browser encodings. The retained count/population arrays and their feature IDs are unchanged. Prior Boolean-port static v5 remains readable.

The current reader exports thirteen value columns plus H3 identity and twelve selectable features. Producer validation recomputes each presence value from retained totals or original audited port counts, preserving the existing unknown-as-zero qualification and source masks externally. The [producer contract](../../../../Toolkits/toolkit-human/docs/final-delivery.md#compact-static) owns exact types and derivations. Dated sections below describe previous versions.

# Consolidated static — 2026-10-24

Current Human static v5/final-only v6 has 11 columns. Five population estimates lose `_collected` in their source names but retain the same values, units, allocation method and missing-contributions-as-zero assumption. The adapter recognizes current unsuffixed estimates only through current producer schema/metadata; retired historical strict fields remain excluded. Existing quantity feature IDs remain stable.

Boat launches and shore access expose one total each. Integer total columns and place counts fill source nulls as zero by user instruction; `has_port` is a Boolean/categorical layer derived from positive source count. Its distinct ID is `HUMAN__has_port`. Original counts/null masks and port multiplicities remain in the verified/watched external audit. Zero/false does not certify physical absence. Human shoreline length and access-category/evidence choices are removed; no alternative shoreline dataset is silently substituted.

The current reader exports ten value columns plus H3 identity and nine selectable features. Population inspection/classification uses unchanged stored estimates; detailed row support stays external. [The producer contract](../../../../Toolkits/toolkit-human/docs/final-delivery.md#compact-static) defines the transformations and original-data reconstruction. Dated sections below describe preceding versions.

# Quantities-only static — 2026-10-24

Current static v4/final-only v5 contains 18 columns. The user removed full-cell area and all eight population coverage/geographic-support columns from the preceding 27-column table. The external audit retains them losslessly by H3. The adapter still verifies and watches that receipt, but exports no removed support arrays; current Coverage is no longer selectable. Five population quantities and eleven infrastructure quantities/evidence fields remain selectable, with unchanged quantity feature IDs.

Population values and density are read directly. Density still means persons per full native cell km²; the denominator is audit evidence. Insights retains the scalar method, census vintages and missing-contributions-as-zero assumption, and directs row-specific support to the external receipt. It never treats absence of a public coverage column as complete support or supported zero. Earlier static schemas keep their qualified reader behavior. The [producer contract](../../../../Toolkits/toolkit-human/docs/final-delivery.md#compact-static) owns exact fields and reconstruction.

The dated checks below describe the preceding 27-column version; they are historical evidence.

# Compact static follow-up — 2026-10-24

Preceding Human static schema v3/final-only v4 retains exactly 27 columns. The adapter verifies the external static audit checksum, row count, column binding and H3 membership without reintroducing its removed columns as map variables. The watcher includes the external audit path, so audit-only corruption invalidates cached reads. Missing/corrupt audit evidence fails explicitly. Source count/density/25/50/100 km values, row-level coverage/support, infrastructure nulls, census vintages and research-only qualifications survive.

Population scales now use retained collected values when audit subtotal arrays are absent. Insights derives imputation qualification from retained coverage, distinguishes unavailable from supported zero, and directs detailed missing-source evidence to the external audit receipt. Metadata supplies the unchanged method. Count Coverage binds the retained count quantity even with the compact base coverage column name. Historical full-width inputs retain their existing reader path.

Regression coverage includes compact reader audit validation/watch invalidation, omitted browser audit columns, retained coverage bindings, zero/null classification and both unavailable/supported-zero inspection. Historical evidence below predates this compact projection.

# Current follow-up: two-file Human delivery — 2026-10-24

As of the 2026-10-24 Human review, `Data/Human` delivers only `static.parquet` and `dynamic-calendar.parquet`, plus the preserved user review note. The adapter accepts final-only v2 and historical v1 receipts, verifies every referenced product hash and retains exact static values/types/nulls. Current v2 files supply no native geometry overlays. Static port provenance comes from the static dictionary. Calendar v2 combines regional holidays per country/reference timezone and is not a map layer. The new regression covers the two-file receipt, omitted native overlays and calendar tamper rejection. Earlier three-file/native-geometry evidence below is historical; it does not describe the current output set.

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

## Static column names (2026-10-24)

The reader accepts static v3 / final-only v4 with 27 single-underscore `lower_snake_case` columns and keeps historical v1/v2 static support. Source names such as `port_record_count`, `boat_launch_record_count` and `population_count_coverage_status` replace mixed-case/double-underscore names. Units, values, nulls and native H3 identity are unchanged. The producer dictionary supplies explicit coverage/geographic-support references; external audit arrays stay outside the browser payload. Existing feature IDs and saved selections remain stable through the producer column mapping, including Coverage. Partial/unavailable population zeros retain their missing-as-zero qualification. See the [producer mapping](../../../../Toolkits/toolkit-human/docs/final-delivery.md#column-names).

Verified on 2026-10-24: 11 Human adapter tests, 10 automatic-reader tests, 500 frontend tests, type checking, lint and production build passed. The actual read-only Reader integration matched all 26 encoded value columns and H3 identities for 13,461 rows against renamed static v3; all 17 selectable feature IDs stayed stable and all five population support bindings survived. Interactive browser QA was not rerun.

Current 18-column verification (2026-10-24): 12 Human adapter tests, 10 automatic-reader tests, 502 frontend tests, type checking, lint and build passed. Actual Reader output matched H3 identities and all 17 encoded value columns for 13,461 rows; all nine removed fields were absent from assets and qualifiers, Coverage was absent, and all 16 remaining feature IDs were unchanged. Audit-only metadata retained the per-field scientific method. Interactive browser QA was not rerun.

Current consolidated verification (2026-10-24): 13 Human adapter tests, 10 automatic-reader tests, 509 frontend tests, type checking, lint and production build passed. Actual Reader output matched H3 identity and every one of ten encoded value columns for 13,461 rows. All three count fields were non-null int64; port presence was Boolean/categorical with 70 true cells. Five renamed population estimates retained the allocation method/assumption and their stable feature IDs; nine choices remain selectable. Interactive browser QA was not rerun.

Current presence verification (2026-10-25): 14 Human adapter tests, 10 automatic-reader tests, 509 frontend tests, type checking, lint and production build passed. Actual Reader output matched native H3 identity and all thirteen encoded value columns for 13,461 rows. The four presence assets contained only integer 0/1, with numeric layers and unit `0/1`. Counts/population values and retained feature IDs were preserved; twelve choices remained selectable. Interactive browser QA was not rerun.


## Coverage and civil calendar — 2026-10-26

This section supersedes earlier statements that per-cell evidence stays hidden in
an external receipt. The two delivered Human Parquets are unchanged. The reader
checks the bound static audit checksum and unique matching H3 keys, reorders audit
rows by H3, and adds only population evidence as nonselectable qualifiers. Public
quantities win over any companion column; current map classification continues to
use delivered values. Old prepared Human seeds are bypassed; no other domain seed
policy changed. Calendar data is a checksum-verified product asset, not a map
feature or analytical join. The reader checks embedded metadata, unique civil-date
× country × timezone keys, date bounds and configured country/reference zones.

Usage: Human → Population → Insights. Overview explains the partial-estimate
share. Selected cell shows population, radius/full-cell support, census vintages,
coverage, zero-imputation and unverified geography; Source qualifiers exposes
missing census IDs. Civil calendar has independent country/date controls and
source-rule qualifications. No nationwide observance, activity, effort or model
eligibility is inferred. No 250 km feature or new source collection was added.

Current-source validation: 13,461 rows, 12 selectable Human features and 40 value/
support columns passed exact exporter readback. Default 100 km: 13,023 partial of
13,461 (96.7% of estimates, not people). Calendar: 13,148 rows, 2009-01-01 through
2026-12-31 inclusive, rules 0.100, timezone rules 2026.3, as of 2026-10-16. Human
browser encoding was 4,808,134 bytes. The read-only validation retained identical
source/receipt/audit bindings before and after. Hashes:

- static: `a7ee7fff3c49490f4b9de89114d37eb1221c9464e0b433e33505e416ef6b8cee`
- calendar: `7b074434809f49fdb29317deee145606d04675e01bf43f789edc916b12b7ce3a`
- audit: `59d035500cc84b1df8bb9b3dbb950440050d7de854db0030996588254b4a4770`

Validation includes reversed audit row order, duplicate-key rejection, preservation
of public values, distinct radius support, selected-cell changes, supported and
imputed zeros, calendar country switches, date bounds, leap day, DST dates and
checksum tampering. Local reader and API regression suites passed. TypeScript,
ESLint, map/Insights tests and production build passed; Vite retains its existing
large-chunk advisory. No full census allocation, original-source qualification or
scientific model validation was rerun.

Actual browser QA used isolated task-owned ports 5183/8013. Human’s default 100 km
layer rendered with the 96.7% contextual explanation. Cell `8728d13a6ffffff`
showed 4,299,548.02 persons, partial coverage, imputation Yes, geographic support
unverified Yes, and source `CA2021:2021S051259153732`. July 1, 2026 showed Canada
Day / America/Vancouver and switched to no named holiday / America/Los_Angeles
without a date shift. Desktop and narrow layouts remained readable and scrollable.
The normal cold-start app also validated its other domain caches; no Data files
were written. Preview processes were stopped after QA. Screenshot evidence is
retained in the Codex task-3 workspace, not duplicated with datasets.
