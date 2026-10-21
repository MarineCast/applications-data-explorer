# Geographic water assignments — 2026-10-19

The two water assignment interfaces are populated geographic modeling references.
They do not claim legal marine ownership, federal administration or exhaustive
jurisdiction. Source-native diagnostics and all other Governance families remain
retained. See the [producer method](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#geographic-water-assignment-interfaces-2026-10-19).

WA/OR use retained TIGER/Line counties clipped to retained U.S. water support.
BC uses the retained water source's explicit `AREA=BRITISH_COLUMBIA` region.
Country assignment uses existing positive-area country-water memberships. No
nearest-coast assignment, offshore extension or high-seas complement is generated.
All overlapping assignments and paired original source/part IDs remain available
in cell popups. Unknown counts stay null with unknown support.

| Resolution | WA | BC | OR | USA | Canada |
| --- | ---: | ---: | ---: | ---: | ---: |
| R6 | 592 | 1,817 | 28 | 773 | 1,817 |
| R8 | 17,834 | 58,467 | 705 | 26,369 | 58,467 |

Counts overlap. State assigned / unknown totals are 2,374 / 247 (R6),
76,558 / 11,685 (R8). Country totals are 2,532 / 89 and 84,418 / 3,825.
No International assignment is established; unknowns never default to it.
Remaining state gaps are mainly U.S. offshore waters beyond retained county
extents. Geographic assignment does not manufacture an extension.

Inspection of `sourceValue`, raw categorical values and cell inspector rendering
found no null-to-zero conversion: the earlier empty display reflected entirely
unpopulated columns. Geographic popups now show category names and paired country
labels, and explicitly label unresolved cells as unknown, not zero or International.
Region colors are distinct and stable across R6/R8 and overlap stripes.

Current run evidence and real browser checks are retained in
`/Users/tylerstevenson/Documents/Codex/2026-10-18/task-3/evidence/approved-water-baseline.json`
and `populated-browser.json`.


## Federal boundary follow-up

The former Federal Waters features are **Country Assignment** and
**International Boundary**, now alongside State / Province Assignment and the two
county/district features in **Administrative Boundaries**. The separate International
Boundaries family is hidden while all its native/scientific/source records remain
available to the producer and reader.
Country assignment and its accepted fixed colors are unchanged.

The boundary boolean uses actual retained IBC line sections, NOAA `RULEID` 1/4/5
and NRCan `TYPE_E=INTERN`. EEZ/territorial outer limits and polygon perimeters
are excluded. Any full closed-cell intersection counts, including shared edges
and corner contacts. Current R6 has true 52 / false 0 / unknown 2,569; R8 has
395 / 0 / 87,848. False is reserved for accepted complete geographic support;
no-hit cells are unknown under current partial inventory. Boundary presence is
independent of the International water category.

Automated coverage includes source filtering, full-cell/edge/corner intersections,
multiple paired border records, stable lineage, null versus qualified false,
checksums, exact preservation of all prior 273 arrays, old saved selections,
false/true categorical rendering, two Federal choices, one state choice, hidden
original support, cell popup provenance, and refuge/tribal family regressions.
Current test/build and native/short-height browser evidence is recorded in
`/Users/tylerstevenson/Documents/Codex/2026-10-18/task-3/evidence/boundary-result.json`.

State / Province Assignment category labels now show Washington, British Columbia
and Oregon without parenthetical abbreviations (2026-10-19). Native WA/BC/OR
category keys, color order, memberships and source records remain unchanged.

State / Province Assignment and Country Assignment legends were alphabetized by
displayed name on 2026-10-19. Display order is British Columbia, Oregon, Washington;
and Canada, International, United States. Each entry keeps its original category
index, color, filter key and overlap/count mapping on main and comparison maps.
Native source arrays and their order are unchanged.
