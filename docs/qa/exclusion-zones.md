# Exclusion Zones reference QA — 2026-10-20

Current finite completion: **223 R6 / 222 R8 areas**, **609 / 8,364 assigned cells**,
ten source datasets. Canada: TC 2, RCA 146/145, reefs 22 and WG active-only 1.
Washington: USCG 11, WAC harvest 25, USACE 14 and FWS landing/access 2.

Explorer offers exactly **Exclusion Zone Count** and **Exclusion Zone Assignment**.
All native IDs, source names, overlaps, counts, unknown support and source context
remain retained. The new generation is consumed through the existing validated
adapter. Friendly names remain an app display layer; source details retain native
IDs. Geometry evidence: five parsed legal rings, one agency diagram and 217/216
provider references. Neither geometry nor category establishes current prohibition.

The finite checklist integrates the feasible named static references and records
exact blockers for Pier 91, Canadian fixed shoreline/no-anchor zones and Scott/FWS
buffers. FWS administrative extents retain Matia/Turn/authorized-use exceptions;
they are not wholly closed to everyone. Standing activity rules, daily local-time
conditions, active-only tests and permitted transit remain distinct. Source/
effective/seasonal/knowledge dates remain separate. TC current page requalification
does not prove legacy full-page equivalence. Two DFO differences remain explicit.

This research/reference product is partial and model-ineligible. Broader fisheries,
temporary/moving/event rules, Oregon and activation/history remain unknown. Full
cell intersections do not imply water-only support; Lockheed’s 21.5 m reporting-mask
discrepancy remains. All prior memberships, 249 other arrays and 47 prior originals
are exact. Two new NOAA originals are stored once.

Current validation is recorded in
`Reports/governance-exclusions-2026-10-19/completion-report.json` at workspace root.
Earlier qualification/expansion reports describe historical increments. See the
[producer contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#exclusion-zones-bounded-static-reference-2026-10-19)
and [finite source dispositions](../../../../Toolkits/toolkit-governance/src/governance/vessel_management/exclusion_zones/DATA_SOURCES.md).

## Assignment names — 2026-10-20

Assignment now uses readable zone names in legends, Insights and membership
headings, without internal dataset prefixes. For example, the DFO dataset-prefixed
Smith Sound label displays as **Smith Sound**. RNA expands to **Regulated Navigation
Area**. Clause-heavy Thea Foss headings display as **Thea Foss Waterway Seabed
Restriction Area 1** and **Area 2**; Pender/Saturna include Island and Vessel
Restriction Zone. The WG heading is **Nanoose (WG) Exercise Area — When Active**,
retaining its conditional meaning.

This is app presentation only. Canonical category keys, raw source names/IDs,
source details, overlapping assignments, counts, null support and Data files are
unchanged. Focused label, membership, inspector and popup checks passed (34 tests),
as did TypeScript checking. The completion follow-up also verified the friendly WG heading in an isolated
rendered popup, with source identifiers retained in details. The source-qualification work described above remains separately scoped.
