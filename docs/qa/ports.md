# Ports moved from Governance to Human — 2026-10-19

Physical Ports now appear in Human with **Port Locations** (native points) and
**Port Source Records · H3 summary** (native R7 source counts). Governance's ten
`ports__` columns and active collection/default entries are retired only after the
Human copy passed readback. The legacy Governance raw NGA original remains bound
and unchanged, and historical normalizers remain importable.

Human retains all 84 delivered NGA IDs and original point geometries/attributes;
70 occupy the unchanged 13,461-cell R7 grid and fourteen remain native points
outside that grid. Port counts do not count marinas or vessel activity, infer
port footprints, or claim unique physical facilities. Seventeen port names match
names in other Human classes and five point pairs are within 100 m; no shared
source-ID crosswalk verifies duplicates, so those records remain separate.

The `port` category is labeled Ports, with its own identity color and source note.
Source release comes from the NGA receipt and keeps the provider edition unknown,
separate from its retrieval timestamp. It does not inherit the generic legacy BC
circa-2004 label. Port popups and Insights retain every original attribute and
unknown; source harbor/facility codes remain uninterpreted. Popup attributes scroll
inside a bounded panel.

`GOVERNANCE__ports__*` choices restore `HUMAN_NATIVE__ports`, with Human's R7
product context. No R6/R8 values are relabeled as R7. Comparison fields are resolved
against available R7 products and the migration is explained in the selection
notice. Other Governance selections and all unrelated Human arrays remain intact.

Independent copy/retirement evidence:
[port readback](../../../../Reports/governance-conservation-2026-10-19/ports-retirement-qa.json).
Human source/provider method evidence remains in its owner's
`data/provenance/ports-migration-20261019/` directory.

Checks cover native geometry decoding, port source release, original attributes,
selector migration, current producer/adapter readback, typecheck, lint and build.
No interactive Safari control or new acquisition occurred.
