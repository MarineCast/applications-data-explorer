# Combined Coast Guard Assignment — 2026-10-19

Coast Guard Sectors has one visible feature, **Coast Guard Assignment**, combining
`coast_guard_sectors__ccg_administrative_region__feature_memberships_v1` and
`coast_guard_sectors__uscg_sector__feature_memberships_v1`. The two former recorded
feature choices and other Coast Guard diagnostics leave the Feature list. Old
Coast Guard saved selections restore the combined view at native R6/R8; comparison
maps retain independent feature selection.

The final producer Parquets now retain only combined membership/count/status
arrays under `coast_guard_sectors__feature_memberships_v1` (four columns total).
All twelve original CCG/USCG component columns are removed. The reader still
combines the component arrays in legacy products when needed. Original source
records, geometry and source-specific coverage metadata remain retained. It joins rows only within their
existing H3/date slice. Every name, source record and geometry-part ID survives;
canonical identities deduplicate repeated parts without combining different units.
No polygon processing, source acquisition, area summation or dominant assignment
occurs. Hidden counts count displayed administrative feature IDs, not unique
jurisdiction or operational coverage.

CCG Western is an administrative region; USCG Puget Sound and Columbia River are
sectors. Their source context states country, agency and administrative unit type.
These different units share a display, not a claimed equivalent jurisdiction.
Unknown/unavailable component support never establishes absence: no-hit cells stay
null unless both components have observed, verified-empty lists. Received matches
remain visible under partial support. All source memberships are checked by the
existing decoder; count/status corruption fails closed. Startup browser encodings
without the combined membership view trigger current reader preparation.

Initial app-view readback on 2026-10-19 checked every source membership and
all original Coast Guard arrays before compaction. The compact final products
retained exactly the same combined values before the Western water supplement below:

| Grid | Rows | Assigned | Unknown | Multiple units |
| --- | ---: | ---: | ---: | ---: |
| R6 | 2,621 | 1,930 | 691 | 13 |
| R8 | 88,243 | 41,021 | 47,222 | 44 |

Both grids include Western, Sector Puget Sound and Sector Columbia River. Source
coverage was partial, with Canadian coverage gaps. These are source
administrative references, not navigational safety or operational/legal authority.

Prior combined-view checks: 71 frontend cases cover picker, decoder/catalog,
saved selections and page integration; two dedicated Python cases cover combined
membership support, corrupt source counts and lossless static/dynamic browser
exports. Existing Governance reader and local-data checks also pass. Typecheck,
lint, production build and diff whitespace checks passed. Small readback evidence
is retained in `/private/tmp/marinecast-coastguard-20261019/real-readback.json`.
The canonical [producer source contract](../../../../Toolkits/toolkit-governance/src/governance/administrative_context/coast_guard_sectors/DATA_SOURCES.md)
retains each provider's scientific and rights limitations.


The later final-file cleanup uses producer method
`coast-guard-membership-union-1`. Tests cover normal offline builds and rebuilds
from retained OriginalData, as well as both legacy and compact reader inputs at
static and source-dated dynamic grain. All 251 non-Coast-Guard arrays and original
source bindings are preserved in the scoped R6/R8 refresh. See the
[compact producer contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#compact-coast-guard-assignment-2026-10-19).

## Western water coverage — 2026-10-19

The producer now supplements Western on explicit BC geographic model-water cells
missing that region. This closes 745 R6 and 47,539 R8 gaps while preserving original
CCG and USCG records, all overlaps and unrelated fields. All 1,817 / 58,467 supplied
BC water cells include Western. The four-column final interface is unchanged.
Derived records keep the same Western category key/color; their source and part
IDs identify the water geometry, and their type explicitly marks a derived region
assignment. This is neither an official boundary edit nor an operational/legal
coverage claim. The original CCG polygon remains retained.

The app reads producer definitions and source context rather than replacing these
qualifications with its legacy union description. Legacy products remain readable
and do not receive a speculative browser-side fill. See the
[canonical method](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#western-bc-water-assignment-2026-10-19).

Current checks passed: 39 focused frontend cases (including a shared original/derived
Western category), 17 Python reader cases, lossless encoding/decoding of the actual
updated R6/R8 Coast Guard arrays, typecheck, lint and production build. Producer
checks passed 234 tests with two optional live-provider tests skipped, standalone
wheel imports with sibling applications blocked, pip check and strict MkDocs.
Staged whole-product validation and installed table/catalog readback passed. No new
acquisition or unrelated regional rebuild was run. A rendered browser check was not
available because the local preview at port 5173 was not running. Bounded evidence
is under `/private/tmp/marinecast-coastguard-20261019/western-*.json` and logs.
