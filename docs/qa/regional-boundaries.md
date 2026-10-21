# Regional Boundaries — 2026-10-19

Governance presents one **Administrative Boundaries** family combining the former
Regional Boundaries, Federal Waters and State Provincial Waters families. Its five
Feature choices are **County / District Count**, **County / District Assignment**,
**Country Assignment**, **International Boundary** and **State / Province
Assignment**, alphabetized together in one list. Existing native
field IDs remain stable. Removed saved regional diagnostics fall back to Count at
the same R6/R8 resolution. Unrelated family choices remain available.

The reader validates compact producer support `positive_partial_null_unknown_v1`
on both fields. Positive count/nonempty assignment means partial received inventory;
null means unknown or unavailable as declared. Count/list-length and paired source
identities must agree. Browser-only support fields keep existing inspector/export
contracts compatible; the final Parquet has just the two regional columns.

Source-backed local data checks: R6 has 2,184 assigned cells (1,568 with BC districts);
R8 has 66,629 assigned cells (47,146 with BC districts). Multiple intersections and
all names remain retained. Original source geometry and all other Governance
metrics are unchanged by the consumer. The producer independently recalculates this
family from official retained full county/district polygons; the reader does no
spatial calculation. Unknown support is not zero. Reference geometry does not
establish current law, exhaustive jurisdiction or legal marine ownership.

Before the grouping change on 2026-10-19, a live local browser check confirmed
the Regional Boundaries family and its two feature choices, Count values spanning 1–4 at R6, and the Assignment legend
including Capital, Cowichan Valley, Nanaimo, Metro Vancouver and other district
names alongside county names. Source-reader round-trip fixtures validate both
regional names and IDs, compact support and fail-closed count/status mismatches.
Native grid selection and the existing paired-membership map/inspector are reused.
See the [producer contract](../../../../Toolkits/toolkit-governance/docs/parquet-products.md#regional-boundaries-interface-2026-10-19).


The later Administrative Boundaries grouping changes presentation only. The three
producer collection keys, data arrays, per-feature definitions, source bindings,
nulls, membership records and exports remain distinct. Moving between its five
features preserves the shared family. Saved selections still resolve by their
original field IDs at the same resolution; comparison selectors remain independent.
No source acquisition or producer/data rebuild is needed for this grouping.

Current grouping verification on 2026-10-19: the live local Family picker shows
Administrative Boundaries and omits the three former family choices. Its Feature
picker displays all five named features in one alphabetized list. Focused tests
passed for both R6 and R8 (35 frontend checks and 14 Python reader checks), with
TypeScript, lint and production build passing. Final Governance catalog bytes
were verified unchanged from the preceding validated data refresh.

On 2026-10-19, Country Assignment replaced the app label Federal Water Assignment.
The native `federal_waters__assignment__feature_memberships_v1` field, source
metadata, values and saved selections remain intact.


County / District Assignment label cleanup on 2026-10-19: regional membership
labels use original `feature_name` values only, such as San Juan County and Capital
Regional District. Source/system prefixes and duplicate-label ID suffixes are
omitted from legend/Insights labels and inspector headings. Same-name features
retain separate canonical category keys, counts, overlaps and source records.
Missing names display Name not supplied. Other Governance systems retain their
qualified labels. Source IDs and geometry-part lineage remain in inspection details;
no source/product values or membership identities are rewritten.

On 2026-10-19, County / District Assignment legend entries were alphabetized by
displayed name, ignoring case. Sorting the displayed entries retains each original
category index, color, filter key and membership mapping. State / Province Assignment and Country Assignment now use the same alphabetical
display; other legends retain their existing category order.

On 2026-10-19, explanatory source/method notes were removed from map legends on
both the main and comparison maps. Category names, colors and unknown-support
keys/counts remain visible. Source qualifications stay in feature/cell details
and original metadata.
