# Orca reported sightings

The layer selector contains sighting types, time interval, view and optional whale-symbol controls. Source caveats remain in Insights; provider freshness and daily UTC-bin support are grouped under its collapsed **Source coverage and freshness** section. This applies to the main and comparison selectors. Source data, cache metadata and time assignments are unchanged.

The Marine mammals product has Family **Orca**. SRKW, Transient and Other are independent selections; All selects their union over stable source record IDs. Other retains mixed, unknown, northern-resident and offshore source classifications. Counts are source-deduplicated sighting records, not unique encounters or whale abundance. Different providers can report the same encounter.

The shared UTC timeline supports daily, Monday ISO-week, calendar-month, calendar-year and All time frames. Category changes retain the selected calendar period, including empty periods. Both H3 counts and reported-coordinate points use the identical filtered records. Intervals enter dated bins only when wholly contained. Unknown or unsupported UTC times enter All time only. Native lexical time precision and original raw dates remain visible; they do not establish UTC support. No synthetic noon or coordinates are introduced.

Points cluster at low zoom. Cluster numbers count reports; mixed-category clusters use slate. Optional whale symbols denote reports, not animals. H3 R6 assignments index reported/corrected coordinates without snapping; source uncertainty remains in the inspector. Empty cells mean no assigned reports and unknown effort, never surveyed absence.

Point inspection retains source pod/group assignments, native date/time, description, category, classifications, raw/corrected coordinates, uncertainty, lineage and source-use qualifications. Descriptions render as plain text. Full descriptions and classification evidence load from checksum-bound local detail shards. Grid inspection lists distinct current-filter records by explicit typed pod/group, retaining Unknown. Multiple reported groups can make line totals exceed the distinct sighting total. Untyped identifiers never become inferred pods.

Only primary-confirmed 2024 and 2025 SRKW annual census rows are shown in Insights. They remain a separate annual series, with no replication into daily sighting frames and no inferred 2026/transient demographics. The 17-row retained derivative evidence is excluded from the default app series.

## Prepare the local cache

From this repository, using Python with `pyarrow` and `h3` installed:

```sh
python scripts/orca_input.py --source ../../Data/MarineMammals/Orca/Sightings --output public/local-data/orca
npm run dev
```

The adapter is read-only against source products. It validates the frozen Arrow schema, source/family hashes, approved R6 registry/mask bindings, exact reported-coordinate H3 assignments and every persisted positive cell/category/time-bin count before writing its own cache. Assets are written before the atomic catalog replacement. It does not acquire providers or process producer inputs. Human, Seascape, Governance and weather caches are separate.

`public/local-data/` and build output remain ignored. Products contain internal-use and potentially restricted locations; the local cache does not establish redistribution permission. Synthetic fixtures exist only under tests and are rejected by the production loader.

## Validation

- All 256 frontend tests, TypeScript, lint and production build passed.
- Five new Python consumer tests cover hash drift, frozen nullability, independent sparse counts, whole-interval calendar support and source preservation; existing Human/Governance input and membership tests also passed.
- Real consumer independently reconciled all 91,830 persisted sparse rows across five grains for 72,422 source records. Totals: daily 67,810; weekly 71,015; monthly 71,524; yearly 71,654; All time 72,422.
- TypeScript matched persisted counts in 39 real-data checks across first/interior/last periods, all granularities and category unions. On this host: ~0.5–0.7 s decode; slowest measured standalone frame ~0.1 s. The page reuses its period array.
- Isolated native-map Chrome QA covered all-record clustering, glyph toggles, point descriptions and multiple pods, empty and populated grid inspection, and 390 px compact layout. No runtime errors in successful runs. All-record steady main-thread JS heap was ~138–152 MB after collection; transient allocation before collection was higher (~0.9 GB).
- Large vendor chunks produce Vite's existing bundle-size advisory; build succeeds.

Producer source bindings (final): Sightings catalog `0a6b1fdd24a3385de1e5e2fc7ef75271c7bcb843af699c5493f90ae127499fba`; Parquet `2205f2e07e849f9a5083fe1732879e975c8943e613fffb4a550c9246fc9cbb26`; root catalog `3e8c72d23306d4c7dc5d196fc73ae1e8679100a09c4b1e709585818bc50cb530`.

## Shared timeline presentation

Sightings uses the common controlled React timeline and keeps its source period keys, supported UTC dates, unassigned-time exclusions and All time/undated support. Its date axis is below the range, without a top title or date dropdown. The Daily/Weekly/Monthly/Yearly/All time selector is in layer settings. Centering and compact-screen stacking match Hydrology and Meteorology; no record assignment or aggregation rule changes.
