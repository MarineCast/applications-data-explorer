# Empty prepared-cache validation — 2026-10-24

**All three prepared caches were validated as removable, then removed with user
approval. The isolated acceptance run below did not alter existing caches; see
[approved removal](#approved-removal--2026-10-24) for subsequent completion.**

| Prepared directory under `public/local-data/` | Existing bytes | Empty-cache frontend load |
| --- | ---: | ---: |
| `hydrology/` | 6,779,127 | 8.71 seconds |
| `river-influence/` | 5,168,508 | 2.24 seconds |
| `orca/` | 93,395,449 | 14.18 seconds |
| Total | 105,343,084 | |

These are single-run wall times for generating and loading encodings in a fresh
reader process, not filesystem-cold benchmarks or an added delay from removal.
`local_data.Reader.get` already calls the source-backed builders for these three
domains even when prepared files exist. Only Seascape/Governance/Human use the
startup seed path, Meteorology has its own validated startup encoding, and
Viewshed can depend on its retained prepared pilot. Those other caches are outside
this conclusion.

## Isolation and retained inputs

Each domain received a separate, empty `Sources.public` directory. All HTTP
requests used the real `Reader.request` handler and current retained Data roots.
The original three prepared-cache roots were denied to the reader with a file-open
guard; no read attempt occurred. All registered output assets were served from
process-owned directories, and the empty public directories remained empty.

The actual frontend `loadHydrologyData`, `loadRiverInfluence`, `loadOrcaData` and
`loadOrcaDetails` functions were bundled without changing their implementation
and run against the temporary localhost endpoint. This exercised their checksum,
schema, native-identity and provenance checks over real source-backed payloads.
Hydrology and influence layer construction, Orca monthly/all-time frames, and
on-demand Orca evidence loading passed. This was API/frontend-adapter validation,
not a new browser screenshot walkthrough.

## Exact source readback

- Hydrology: ten rivers, 6,497 provider dates and ten metrics. All 649,700 retained
  metric observations matched their contracted conditions/features table,
  including original values, statuses and reasons; 157,311 unavailable metric
  values remained null. The tested native R6 layer contains 2,427 grid cells;
  gauge observations retain their mouth-reference support.
- River influence: all 267,720 source factor rows matched the encoded spatial
  weights/distances and temporal discharge, relative-flow and interpolated-input
  arrays. Ten rivers, 2,427 native cells, 6,497 dates and both retained metrics
  passed the frontend decoder and layer construction. Retrospective/model-
  ineligible qualifications remain unchanged.
- Orca: 72,422 records, 214 monthly frames and 2,607,192 encoded field values
  matched the sightings Parquet, including exact time/identity/category support.
  Every source description and classification-evidence record matched across all
  256 evidence shards. Demography, product-family and sparse temporal reductions
  passed the existing producer-binding checks.

All 99 retained source/study files (31,401,058 bytes) were checksum-identical
before and after validation. All 262 existing prepared-cache files were also
checksum-identical. Original Data products, source inputs, registries, receipts,
evidence and demography must stay; this finding applies only to the three
prepared directories above.

## Checks and replay

- Python adapter/live-reader suite: 31 tests and five subtests passed.
- Frontend adapter/inspector/controls suite: 42 tests in six files passed.
- All temporary servers, empty-cache directories and generated encodings closed
  and were removed by their normal context-owned cleanup. No bulk copy was kept.
- Small results, environment/code fingerprints and the standalone replay script
  are in the workspace [validation evidence](../../../Reports/empty-prepared-cache-validation-2026-10-24/results.json).

No app runtime code changed. Full typecheck/build/browser sweeps were not repeated
for this isolated validation; the earlier production-preview checks remain
separate dated evidence. These checks establish regeneration, transport and exact
selected-source readback, not live-provider freshness or scientific completeness.


## Approved removal — 2026-10-24

Removed only `public/local-data/hydrology`, `public/local-data/river-influence`
and `public/local-data/orca`: 262 files, 105,343,084 logical bytes. The 99 retained
Data/study/provenance files and every other prepared-cache file remained
checksum-identical. Original receipts, source dependencies and current QA were
preserved. No app dependency or runtime-code change was needed.

After removal, the actual frontend loaders passed against a fresh production
preview using the normal local reader. Hydrology loaded ten rivers, 6,497 dates,
ten metrics and 2,427 native cells; river influence loaded both metrics over the
same dates/cells; Orca loaded 72,422 records, 214 monthly periods, an all-time
frame and on-demand classification evidence. Snapshot hashes match the isolated
exact-readback run above. None of the three directories was recreated.

Typecheck, ESLint, 497 frontend tests in 86 files, 119 Python tests plus 33
subtests, and the production build passed. This adds production HTTP/frontend
validation, not a new browser walkthrough or provider/scientific validation.
No dedicated docs build is configured; changed links and whitespace were checked.
See the [removal manifest and integrity evidence](../../../Reports/prepared-cache-removal-2026-10-24/completion.json)
and [frontend results](../../../Reports/prepared-cache-removal-2026-10-24/frontend-results.json).
