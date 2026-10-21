# Tribal / First Nations interface verification — 2026-10-18

Exactly two choices appear at native R6 and R8:

| Feature | Product column |
| --- | --- |
| Tribal / First Nations Area | `tribal_first_nations_areas__mapped_area` |
| Tribal / First Nations Assignment | `tribal_first_nations_areas__feature_memberships_v1` |

Area is a nullable Arrow boolean derived from validated positive-area component
memberships. Assignment retains all source-qualified area IDs, paired original
names/record IDs and intersecting part IDs. Same local IDs/names in different
countries stay distinct. Multipart records deduplicate within their original area
identity. All overlaps survive; there is no dominant assignment or pooled area metric.
The supporting combined count counts mapped area IDs, not Tribes or Nations.

The U.S. inventory is [BIA land-area references](https://biamaps.geoplatform.gov/server/rest/services/DivLTR/BIA_AIAN_National_LAR/FeatureServer/0).
The Canadian inventory is the qualified BC Indian Reserve subset of the
[NRCan CLSS administrative boundary service](https://proxyinternet.nrcan-rncan.gc.ca/arcgis/rest/services/CLSS-SATC/CLSS_Administrative_Boundaries/MapServer/0).
These can share mapped administrative/reserve membership without equating their
legal categories. BIA classification codes 1 and 3 in the retained source remain
undecoded; Sechelt Land and other Canadian distribution classes remain excluded.
Country, source agency and boundary type are explicit source-context metadata in
Assignment inspection. All original source attributes, classifications, IDs,
source-specific metrics, quality fields, receipts and coverage are preserved.
The interface does not establish sovereign/traditional territories, ownership,
treaty rights, broader legal jurisdiction or all interested Tribes/Nations.
See [the producer contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#tribal-first-nations-interface).

True requires a qualifying recorded intersection. A polygon boundary touch does
not qualify. False requires independently qualified full-cell geographic coverage
for both sources and observed empty memberships. Current source support is partial;
complete query receipts and national extents do not establish geographic coverage.
No-hit cells therefore remain null, never false. Unknown is separate from false in
the categorical legend and counts. Feature information explains this distinction;
source/coverage/quality columns are retained support, without selector choices.
Removed source-component assignments migrate to combined Assignment; other removed
component choices migrate to Area at their selected resolution.

| Current data check | R6 | R8 |
| --- | ---: | ---: |
| Supplied cells | 2,621 | 88,243 |
| True / mapped cells | 379 | 1,330 |
| False / verified empty | 0 | 0 |
| Null / unknown support | 2,242 | 86,913 |
| Overlapping assignment cells | 76 | 44 |
| Distinct mapped area IDs | 341 | 315 |
| Maximum memberships in a cell | 6 | 3 |

The narrow update adds six columns (the two features plus supporting count/status
columns), changing each table from 259 to 265 columns. All 259 original column
values compare exactly equal. Unrelated field definitions, every existing component
coverage entry and all 40 OriginalData bindings/hashes remain unchanged. Human and
Meteorology file identity/size/mtime checks remain unchanged. The source inventory
contains 215 BIA and 1,569 NRCan records; source selection was not expanded.

Checks completed: 196 producer tests passed (2 opt-in live-provider checks skipped),
10 Governance reader tests, 7 live-reader tests and all 405 explorer tests across
77 files. Lint, TypeScript/production build, config/package catalog byte equality,
local documentation links and diff whitespace checks passed. A regular wheel was
installed outside the checkout with application imports blocked; package import,
CLI help, fresh workspace initialization and the packaged two-feature declaration
passed, with no broken requirements from pip check.

Live browser QA used a separate hidden in-app tab on the existing local server.
Both resolutions showed exactly two choices. R6 Assignment showed 379 mapped,
76 overlapping and 2,242 unknown cells; R8 showed 1,330, 44 and 86,913. Legends
retained both countries' original names and per-feature cell counts. The boolean
legend showed false=0, the matching true count, and a separate unknown-support key.
Feature information showed positive-area, false/null and administrative-reference
qualifications. Captured tab console errors were empty. Screenshots are retained
with the task's small QA evidence. The user's page and running server were preserved.

Limitations: strict canonical-directory validation still rejects two preexisting
Finder files (`.DS_Store`, `OriginalData/.DS_Store`). They were preserved; the full
owner validator passed on temporary hardlink views of every catalog-listed product
and source, with checksums and readback verified. Strict MkDocs was unavailable in
the configured interpreter. The production build retains its existing >500 kB
chunk warning. No source download/refresh, native overlay recalculation, full
Governance rebuild, public publication, commit, push or merge ran. This is interface
and delivery validation, not scientific/legal completeness certification.


## Follow-up interaction verification — 2026-10-18

The reported missing-family issue came from short-window clipping, not removed
catalog entries. The dropdown and outer panel had independent height limits;
last options could remain outside the clipped panel even at maximum list scroll.
Dropdown height now follows the actual body scrollport, with resize observation
and complete keyboard reveal. Compact drawers conceal overlapping legend/zoom
controls until closed. Both Governance families remain available with exactly
three Wildlife Refuge choices and two Tribal / First Nations choices.

Categorical H3 cell clicks now open bounded, scrollable information cards with
all paired membership names/IDs and available provenance. Unknown and verified
empty support remain distinct. Numeric/other existing popup behavior is preserved.
See [the complete interaction QA](governance-interactions.md).

## Administrative Boundaries grouping — 2026-10-19

Tyler moved both approved Tribal features into the existing Administrative
Boundaries family. Its five existing county/district, country, international-boundary
and state/province choices remain available, with Tribal / First Nations Area and
Tribal / First Nations Assignment added. The old Tribal family menu entry disappears.

Only family/display metadata changes. Both feature IDs remain unchanged, so saved
selections restore directly at the same R6/R8 resolution. Positive-area values,
all paired memberships, overlap stripes, popups and partial/unknown support remain
exact. BIA U.S. land-area references and Canadian NRCan Indian Reserve administrative
geometry retain their source/legal-type qualifications; the grouping does not
establish traditional territories or blanket sovereignty. Tribal selections retain
plain feature controls without clipboard status.

Current Data field/catalog grouping is consistent with the adapter and frontend.
The metadata-only update independently checked all 255 arrays unchanged per table;
[evidence](../../../../Reports/governance-conservation-2026-10-19/administrative-grouping.json).
Focused producer, adapter, frontend, picker and popup regressions cover the change.
No new geometry, acquisition or interactive browser control occurred.


### Text-copy controls restored (2026-10-19)

Tyler's follow-up restored the feature text-copy button, including both Tribal /
First Nations choices under Administrative Boundaries. It copies without selecting
or closing the dropdown. A check mark and accessible message confirm success;
no visible Governance success banner is added. Both comparison selectors use the
same component. Existing source/identity/scrolling behavior is unchanged.
