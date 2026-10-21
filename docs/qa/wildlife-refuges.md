# Wildlife Refuges interface verification — 2026-10-18

The selected family exposes exactly these scientific choices at both native resolutions:

| Choice | Original column |
| --- | --- |
| Wildlife Refuge Count | `wildlife_refuges__recorded_feature_count` |
| Wildlife Refuge Assignment | `wildlife_refuges__feature_memberships_v1` |
| Wildlife Refuge Coverage | `wildlife_refuges__recorded_polygon_union_area_fraction` |

Count retains distinct recorded feature IDs, including separate source record/zone
identities with the same site name. Multipart hits count once. Assignment preserves
every paired source record and all overlaps; it chooses no dominant refuge. Coverage
uses polygon union area / full H3 cell area in EPSG:6933, including land where present.
It is not a water-only or inventory-completeness fraction. Unknown no-hit support
remains null. See the [producer contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#wildlife-refuges-scientific-interface-2026-10-18).

The browser renders Coverage as percent. Original values, source qualifiers and
JSON exports retain fractions; exports declare the percent conversion. Z-score
exports declare the conversion before standardization and label mean/std units.
Support statuses and line/point diagnostics are excluded from the feature selector
and retained in products. OriginalData and other Governance families are preserved.
The initial refuge selector was one list with no copy controls, copy-status text or group
headings. A removed saved selection falls back to Count at its current resolution.

Validation used the existing 2,621-row R6 and 88,243-row R8 products. Every value
in all 259 columns compared exactly equal before/after the metadata-only update.
R6 retains 270 non-null refuge cells, 10 with overlaps; R8 retains 7,044 non-null
cells, 35 with overlaps. Maximum count is four at both resolutions. Source
inventory bindings and unrelated field definitions compare unchanged.

Automated checks cover the producer declaration/catalog, union/count/membership
semantics, exact reader round-trips, percent/null/zero conversion, clean dropdown,
removed-selection fallback, JSON units and advanced display conversion. Live
browser inspection used a separate hidden tab on the existing dev server: the R6
and R8 dropdowns showed exactly the three labels, Coverage legends used `%`, and
R8 Assignment loaded its original names/qualified IDs and categorical legend.
No download, source refresh, regional overlay rebuild, publication or commit ran.
Native scientific/legal completeness remains unqualified. Strict MkDocs could not
run because the configured interpreter lacks MkDocs; edited local links were
checked directly. The application build passed with its existing large-chunk
warning. An existing unrelated App test timed out once under concurrent load; the
complete 396-test suite passed with two workers.


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


On 2026-10-19 Tyler requested the text-copy buttons back. Feature rows now include
a copy button, with check-mark/accessibility confirmation and no visible Governance
success banner. The current unified marine family and combined Assignment are
covered by [marine conservation QA](marine-conservation.md); this earlier refuge
verification remains historical.
