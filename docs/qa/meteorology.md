# Daily meteorology integration — 2026-10-15

Ready for the local research explorer as ERA5 reanalysis. This is source/consumption consistency validation; independent observational accuracy is not established. The meteorology producer and its retained source files were not modified, acquired again, published or promoted.

## Inputs and readiness

Read the public producer contract in `Toolkits/toolkit-meteorology/docs/regional-api.md` and its `docs/CONTRACTS.md`, then inspected the actual files under `MarineCast/Data/Meteorology`. The application owns its read-only adapter; it does not import sibling producer internals.

| Product | Native grain | Rows | Metrics | Bytes |
| --- | --- | ---: | ---: | ---: |
| meteorology-daily.parquet | H3 R5 × UTC date | 11,428,890 | 14 | 585,945,174 |
| meteorology-hourly.parquet | H3 R5 × UTC hour start | 274,293,360 | 10 | 9,151,514,590 |

Both products cover **2009-01-01 through 2026-10-08**, 6,490 UTC days and **1,761 H3 R5 cells**, including land and water. The atmospheric support is kept independent of the seascape wet-cell support. Nearest native quarter-degree ERA5 sampling has approximately 31 km effective resolution. H3 and optional Gaussian display blending add no weather detail.

`scripts/meteorology_data.py --prepare` completed against the full actual files:

- Both Parquet SHA-256 digests match their source catalog, with embedded schema, units, method and UTC grain also checked.
- Every daily H3/date key and every hourly H3/UTC-hour key matches the complete expected support. Duplicate/missing keys: zero. Each row group is one complete UTC day.
- All values were scanned for nulls/nonfinite values, with null totals matched to producer status counts. Cloud, precipitation and direction domain checks passed. Missingness is never converted to zero.
- Hourly-to-daily mean/min/max/sum checks passed over all native cells for 2009-01-01, 2017-11-20 and 2026-10-08. Direction was excluded from scalar reduction checks because its daily statistic is a mean vector direction.
- Daily RH has 48,121 null records; hourly RH has 56,504. Other source metrics have complete value support in this snapshot. Hourly RH ranges up to 100.00999997727678%; the producer retains these values and the app does not clip them.
- Source identities were checked again for changes during preparation. Daily exact readback on 2026-10-08 matched all 1,761 original Parquet values, and an original selected cell returned exactly 24 hourly values.

Daily SHA-256: `b32d9cbcf59715d1b8fde122fa3d14a39550abba14291b91ac45e9f4663665e4`.
Hourly SHA-256: `2d6cbd2a12a319da80e679b4eea74e8340f268d2d7a16ebce3e080ab9bf8869e`.

The generated browser catalog is about 1.6 MB and is ignored by Git. Snapshot: `505741f6fdb9622031d33afeb3831b8114cbf972785feb5e6efd78fb020482ae`. Inspectable checks and queries are in [the readiness notebook](../../notebooks/meteorology-readiness.ipynb). Source run timestamp is distinct from source vintage: final ERA5 and preliminary ERA5T are not distinguished in this representation. Attribution remains Copernicus Climate Change Service / ECMWF, ERA5, CC BY 4.0.

## Application behavior

Meteorology is enabled after a validated local catalog is loaded. Family/Feature choices retain the existing icon, information and copy controls. Daily values retain source double precision, units, native R5 keys and nulls. The bottom-center shared React timeline takes a start/end date and daily increment. It shows date-axis labels underneath the range, a selected-date readout, previous/next day, play/pause and speed; the former top title and date input are removed. It waits for complete daily values, stops at the last date, restarts from the first date when played at the end, and pauses in a hidden tab. Leaving meteorology removes the timeline. R5 data are never coerced to R6/R8 for comparisons.

Default colors use each metric's full-record range; quantiles and requested z-scores remain active-day display choices. The old displayed frame and its dated legend remain until the requested day arrives, preserving the basemap between frames. Stale requests are aborted/ignored. Errors stay visible and retryable.

Insights shows 24 UTC hours for the displayed day, either at the selected native H3 cell or as a labeled unweighted mean of available native cells for each hour. Each hour retains its availability count; nulls remain chart gaps. Daily history uses descriptive unweighted native-cell means and offers one-year, five-year and full-record windows through the selected date. These are not area averages or independent-sample statistics. Hourly precipitation points are the following-hour totals, not a cumulative curve. Daily extrema use their original hourly variable for hourly charts.

Circular wind direction has no scalar regional mean or scalar z-score. Its map stays on native cells; scalar smoothing, median/mean summaries and ordinary correlations are omitted. Selected-cell hourly directions use points without misleading wraparound connections.

One local Python reader is started lazily by Vite development/preview. Requests are bounded to one day and one metric, with snapshot, source identity and native cell checks. The browser never reads either full Parquet. Daily browser caching is capped at 16 frames. Future static hosting needs a corresponding read-only API; no deployment was performed.

## Validation and evidence

- 169 frontend tests in 37 files passed with one worker and a 15-second timeout. The final native date-input compatibility adjustment also passed the focused playback checks.
- Two offline generated-Parquet tests passed for exact values/nulls, native hourly cell reads, zero rainfall, unknown date/cell rejection, changed snapshots and source corruption.
- Typecheck, ESLint and diff whitespace checks passed. An isolated production bundle passed with public-cache copying disabled; existing large-chunk advisories remain.
- Browser: real R5 daily map, end-of-record restart, playback from 2024-10-01 through 2024-10-11 followed by pause, direct date entry, stable color limits, hourly regional curve, selected cell `8528dc4bfffffff`, and changing its displayed day from October 8 to October 7 with matching exact daily value and hourly title.
- Desktop checked at 1280 × 900 and phone at 390 × 844. The phone timeline sits above the legend; Insights reserves space above both. No browser application errors were observed. Sustained playback/GPU profiling, physical touch hardware and future hosted API deployment were not tested.

Screenshots are in `/Users/tylerstevenson/.codex/visualizations/2026/10/15/01a141ee-3856-7791-bdd6-6e78def98511/`: `data-map-meteorology-insights.jpg`, `data-map-meteorology-mobile.jpg`, and `data-map-meteorology-cell-mobile.jpg`.

Affected checkout: `Applications/applications-data-explorer`. Added the Meteorology presentation/reader, timeline, hourly/history Insights, preparation and fixture checks, notebook, Vite data middleware and setup documentation. Existing source/native-grid interfaces, Insights, legends and comparison views were extended within that checkout. The producer checkout remained clean; its full toolkit suite and live acquisition were not run. Concurrent homepage and other adapter edits were preserved.


## Coastal snapshot repair — 2026-10-17

The source was replaced with `era5-retained-exact-coastal-r5-v1`, while the browser retained the previous rectangular snapshot. The reader correctly refused the stale catalog. The application now accepts both declared producer methods and verifies the coastal embedded membership hash, mask revision and reporting-cell count. Checksums, complete native time/key support, original nulls and sampled daily/hourly reductions remain required.

Reprepared all 6,492 UTC days (2009-01-01 through 2026-10-10), 463 native R5 coastal cells and 14 metrics. Snapshot: `4c6865d68c7e0537c7d961a08a755a41e848fd3d5f4721720679eb85fad3e65e`. October 10 precipitation remains null because the final following-hour accumulation is missing; October 9 is the latest complete all-metric day. No acquisition or producer changes were made. The running app displayed October 10 temperature for 463 cells and all 24 hourly values.

Right-click coordinate copying now works on the shared geographic map across products, in addition to the existing Viewshed support. The popup copies latitude then longitude in decimal degrees, supports Escape/close, and offers selectable text if clipboard access fails. Browser verification confirmed the popup and successful copying on Meteorology.


## Calendar summaries and playback — 2026-10-17

Added complete UTC Monday–Sunday and calendar-month frames. Per-cell means, minima/maxima, precipitation totals and U/V-derived direction preserve null support. Partial boundary periods are excluded. Daily/hourly source files remain unchanged. Aggregation method and inclusive date bounds are attached to layer qualifiers and exported values. Monthly precipitation uses a conservative fixed 31 × daily maximum color bound; weekly uses 7 ×, preserving playback colors. Hourly/history inspection remains available in Daily mode.

The next three frames preload sequentially, with shared in-flight requests and a sixteen-frame cache. Stale look-ahead is cancelled, speculative failures are ignored until requested, and the current layer remains displayed during reads. Loading/status and selected-date slots keep their dimensions. Browser playback advanced from January 2009 through April 2010 with unchanged slider bounds (x 509, y 595, width 250, height 34 at the test viewport). Sidebar height follows content, grows for open pickers, and caps scrolling to map space.
