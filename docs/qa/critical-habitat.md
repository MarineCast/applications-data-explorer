# Critical Habitat Count and Assignment — 2026-10-19

## ECCC marine reference addition — 2026-10-20

The approved eleven public ECCC marine Marbled Murrelet reference areas join the
same Count/Assignment family. Four terrestrial nesting records are excluded;
no withheld abalone locations or inferred enclosing polygons are added. The
source's Posted Final value concerns the recovery document. Actual habitat within
the reference areas requires specified biophysical attributes; membership does
not confirm habitat everywhere or blanket current legal protection. Every source
name, ID, original code and conditional qualification remains inspectable.

Independent full-original-geometry/H3 checks confirm all eleven IDs intersect
176 R6 cells and 4,547 R8 cells. These add 157/4,216 previously unassigned cells;
all-source assigned totals become 1,236/40,845, including 461/13,803 cells with
Canadian-source references. Fractions use the geometric polygon union/full H3
area, with maximum independent disagreement below `1e-12`. Count remains distinct
source features, not unique species or measured habitat sites.

The legend labels gray cells/hatching **Unknown habitat coverage**, explains
the partial NOAA/DFO/ECCC scope and explicitly rejects absence inference. Both
numeric Count and categorical Assignment display the note. Unknown categorical
support remains visible when category cell counts are disabled; verified empty
membership arrays do not become unknown. Existing routing-specific missing labels
remain unchanged. Tests cover these states plus a mixed NOAA/DFO/ECCC cell,
retained Canadian conditional-reference type, readable site names and source IDs.

The habitat addition is installed. Full current source and installed-wheel suites
pass 300 tests with two opt-in live-provider skips; 75 focused app tests, the
existing 14 adapter tests, typecheck/build, scoped lint and strict docs pass.
HTTP readback checks every R6/R8 H3/count/status/membership value and all provider
contexts exactly. The subsequent TSS-only refresh preserves all habitat data and
metadata; its [preservation receipt](../../../../Reports/governance-tss-grouping-2026-10-20/report.json)
explains the newer whole-file hashes.

An isolated in-app browser confirms Count/Assignment, both unknown-coverage notes,
all eleven murrelet legend labels at R6/R8 and 1,385/47,398 unknown cells. The
feature dropdown includes both metric-name copy controls; the Count button reports
success. The browser-session clipboard helper returned empty, so OS clipboard
contents were not validated. Native popup qualifications and source IDs are
rendered; every ECCC-specific context is independently checked through HTTP.
Screenshots retain the 720-pixel-high layout with bounded category-list scrolling.
A native scroll attempt after a source refresh lost its target; no additional
viewport override or Safari control was used. The isolated tab is closed.
The unrelated River influence source-change notice visible in screenshots belongs
to the concurrent Hydrology work. No shared worker was restarted.

See [current habitat evidence](../../../../Reports/governance-critical-habitat-2026-10-20/report.json)
and [rendered Assignment](../../../../Reports/governance-critical-habitat-2026-10-20/critical-habitat-r8-legend.jpg).

## Previously installed DFO baseline — 2026-10-19

The producer and Explorer present exactly **Critical Habitat Count** and **Critical
Habitat Assignment**, combining NOAA NMFS U.S. and DFO Canadian aquatic reference
records. Supporting line, point, coverage and status columns are retained outside
the selector. Browser adapters do not add counts or infer a missing country.

Count is the number of distinct source-qualified feature IDs per native H3 cell.
It is not a species count or a count of unique biological habitat units. Source
OBJECTIDs can identify many separate river/polygon records for one species;
geometry parts are not extra features. U.S./Canadian records stay distinct without
an explicit source-ID crosswalk. Species names do not establish identity or legal
equivalence across countries. Assignment retains every overlap and paired source
record, with original species/entity/population labels and IDs. Stripes express
membership, not area shares. Names become readable labels; duplicate display names
remain separated by their canonical source IDs.

The bounded DFO source returned 23 features and 506,759 response bytes after Tyler's
explicit approval. Whole original geometry, bilingual names, populations and all
provider attributes are retained. Source CH_STATUS_E is **Final/Proposed** for all
23 records and is never recoded as final, designated or legally protected. Source
listing status, ecology type, waterbody, comments and profile links remain in paired
context. Provider omissions include bounding-box descriptors and some riparian
habitat; this is not complete Canadian habitat geography or current law.

R6 intersects 12 DFO IDs across 304 cells; R8 intersects only the two marine
killer-whale population features across 9,586 cells. Combined assigned-cell counts
are 1,079/36,629 (previously 829/27,445). Source-feature identity totals are
5,896/3,611 (previously 5,884/3,609). All 23 original DFO records remain retained even
when outside current grid membership. NOAA counts and paired memberships/part IDs
reproduce exactly before the addition. Every existing NOAA membership and all 245
unrelated columns are exact after the addition. Human/Meteorology products and all
41 prior Governance original-source files remain unchanged.

Both choices use the existing bounded categorical popup/Insights and detailed
source context. Proposed/final labels and country/agency distinctions remain
inspectable and exported. Null/unknown does not become zero. Saved diagnostic
selections migrate to Count; unchanged Count/Assignment IDs restore directly at
native resolution. Both normal and comparison feature dropdowns retain copy
buttons, keyboard navigation and short-scrollport behavior.

Current live readback uses
`http://127.0.0.1:5173/local-data/seascape/catalog.json`, with checksum-bound native
membership/count/status assets. The historical public startup seed is not the live
catalog. Tests cover the two-choice contract, source-ID/status/name preservation,
U.S./Canadian synthetic overlap, unknown support, bounded source receipts and
multipart identity. The bounded source and every actual Canadian cell membership
are checked independently from full original feature geometry. No Safari or other
interactive browser control was taken; rendered visual QA remains unverified.

[Producer contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#combined-critical-habitat-count-and-assignment-2026-10-19),
[refresh evidence](../../../../Reports/governance-critical-habitat-2026-10-19/report.json)
and [independent DFO checks](../../../../Reports/governance-critical-habitat-2026-10-19/independent-dfo.json)
record the scoped definitions and validation.
