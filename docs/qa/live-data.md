# Automatic current-file reading — 2026-10-17

The local Features app now reads current source products without a manual browser-export step. Vite development and preview use `scripts/localDataPlugin.ts` and the read-only Python reader `scripts/local_data.py`. Delivery-file changes are detected every two seconds, including atomic file/symlink replacement and the Human external integrity receipt. The open app reloads catalogs, variable/period choices and selected values; map camera and user-opened Insights remain mounted. Updated files must satisfy their existing producer contracts and integrity bindings. Failed replacements remove the affected source instead of silently serving its old values.

Seascape, Governance, Human, Meteorology, Orca and Hydrology retain their existing adapters and native scientific support. Current browser encodings are automatic, process-owned, and limited to current/previous generations per domain. Old prepared assets are optional accelerators only after checking current source hashes and asset bytes. Missing/corrupt old encodings regenerate automatically. Weather retains direct bounded Parquet queries and verifies source hashes before accepting startup metadata, including replacements that preserve file size and timestamps. Sources are never rewritten or acquired by the reader.

The current Seascape folder includes an independently retained `research/` directory and native seagrass date-support columns. Final-file roster validation now ignores subdirectories, and native date/timestamp support is encoded as lossless ISO strings, with original Arrow types preserved. These fields stay in source support rather than becoming categorical map variables.

`Data/viewshed/READINESS.json` still declares no completed pair product. Its retained qualified pilot remains available. A delivered `Data/viewshed/runtime.json` with the producer's source/model metadata and land/water/pair Parquets is detected automatically; matching `components/` weights are supported. Explicit server-only `VIEWSHED_PILOT` and `VIEWSHED_COMPONENTS` can select another completed output. An incomplete new delivery fails rather than reviving old weights. No visibility weights are inferred from land-source geometry alone.

## Verification

- TypeScript and ESLint passed; 376 frontend tests passed in 72 files.
- All 51 Python adapter/reader tests passed, including source replacement, added/removed fields, zero/null preservation, invalid-replacement rejection/recovery, source symlink changes, missing/damaged startup encoding recovery, and weather hash validation with preserved size/mtime.
- Production build passed. `dist/local-data` is absent; existing public artwork is retained. Built preview successfully read changed source values and a native 463-cell daily weather query.
- Isolated browser fixture: source values changed from `[12.5, null]` to `[42.75, 0]`; the open Insights updated availability from 1/2 to 2/2, maximum to 42.75 and mean to 21.38. An added `NEW_MEASUREMENT` appeared in the Feature picker. No browser navigation or reload occurred between replacement and verification. Test source files were separate from canonical Data.
- Real source-backed catalog: 1,268 features (729 Seascape, 516 Governance, 23 Human), no unavailable component products. All 13,461 rows in each of Human count, density and 25/50/100 km quantities match `Data/Human/static.parquet` exactly. The retained count coverage label is `Coverage`.
- All three final Human Parquets and the old public catalog remained byte-identical. No source/scientific processing was rerun, and no producer Data products were changed by this integration.

Evidence, screenshots, source hashes and bounded test logs: `/Users/tylerstevenson/Documents/Codex/2026-10-16/task-7/live-source-work/`. The final actual map screenshot is `evidence/human-live-map.png`; numerical parity is `evidence/actual-data-parity.json`. Synthetic test/preview servers on 5187/5188 were stopped; the existing app on 5173 remains running.

The first read of a changed domain waits for its existing exact-value validation/encoding; a changed multi-year product can take longer than the two-second detection interval. The map shell stays mounted while its layer loads. Unsupported toolkit domains remain unavailable until an app reader is integrated.
