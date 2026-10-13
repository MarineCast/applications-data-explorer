# Shared navigation and legends

All six application routes use the same 62 px header and wave navigation, including Home. The requested data-status footer is removed. Home retains its decorative artwork, motion and fixture catalog, with page navigation provided by the shared header. Viewshed retains its active mode/metric context.

`LegendDropdown` owns the trigger, upward popup, focus, Escape, close, trigger-toggle and outside-pointer dismissal. Map and Viewshed retain their separate scientific scales, missingness, units and opacity. Viewshed no longer duplicates color controls in Settings. Relationships, Sightings and Data health use that same bottom-left surface for chart keys; Sightings updates its key with the background toggle. Home has no quantitative data legend.

Validation: 96 tests across 18 files passed with `npm test -- --maxWorkers=2`. Type checking, lint, production build and `git diff --check` passed. Live browser checks covered all six routes at desktop and 390 × 844, including native Map/Viewshed, chart keys, popup dismissal and the Home catalog. All headers measured 62 px; mobile legends were 50 px high and remained within the viewport, without horizontal page overflow. Browser warning/error log was empty. The existing large MapLibre bundle warning remains.

This is local UI validation. Producer data, regional qualification and remote publication were not changed or rerun.

## Page names and order

The shared menu now reads Home, Features, Sightings, Relationships, Viewshed, Health on all six routes. Features retains `#map` for existing saved links and has a matching accessible heading during loading and after data arrives. Health's heading and legend use the same name as navigation. Home's footer and catalog copy refer to Features and its complete local Data catalog.

Verified menu order and current-page markers on every route in the live browser at desktop and 390 × 844; mobile pages had no horizontal overflow. The Home catalog copy was also checked. Existing navigation and Home tests now assert the requested labels/order; all 96 tests, type checking, lint, production build and `git diff --check` passed. The existing large MapLibre bundle warning remains. No producer contracts, data preparation or publication changed.
