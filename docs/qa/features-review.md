# Features review improvements — 2026-10-16

Scope: application presentation and interaction in `applications-data-explorer`. Existing prepared native values, H3 identity, source units, nulls, row qualifiers and provenance remain authoritative. No producer, acquisition, cache preparation or promotion workflow was run.

| Review issue | Implemented behavior | Verification |
| --- | --- | --- |
| Hidden comparison setup | Compare opens symmetric Left/Right product, family, variable and slice settings. Persistent editable chips, Swap and Exit stay on the map. Dialog header/actions stay visible on phones; editing a chip focuses that side's variable. | Page interaction tests; desktop and phone browser checks |
| Actions vanish on Viewshed | Compare/Export retain their header positions and communicate unsupported pair operations with explanatory messages. | Hosted Viewshed test; shared header styling |
| Controls overlap | Legends occupy a row beside the bounded product rail; Insights reserves the right side. Phone analysis, timeline and legend regions stay separate. Short phone screens temporarily hide lower controls while Insights is open. | Live 1280×720 and 390×844 checks; direct hit testing of controls |
| Silent replacement / identical variables | Compatible choices survive grid changes. An unavailable right variable produces a notice. Identical variables/slices are identified in setup, the toolbar and Insights; tautological correlation is omitted. | Page regression test |
| Ambiguous appearance scope | Appearance is explicitly linked by default. Unlink for separate palettes, classification methods, opacity, outlines, smoothing and z-scores. Re-linking uses the left style. Selected-side exports describe that side's display settings. | Swap, unlink, standardization and palette regression test |
| Hidden category meaning | Source category keys, constant values and no-available-value states appear on closed legends. | Legend regression test; categorical browser inspection |
| Long / ambiguous variable names | Measurements are grouped separately from quality/coverage/processing. Lists of 12+ fields filter by names and native IDs. Governance labels retain the source and metric without repeating the family. Duplicate names show native identity. Information/copy/export preserve original names. | Picker filtering/copy/identity tests; actual Governance browser catalog |
| Uninformative defaults | Available, varying measurements are preferred over constant or unavailable fields. All-null fields remain accessible and explicitly labeled. | Native catalog inspection; Human and family picker tests |
| Inconsistent legends | Viewshed and native legends share sizing/type treatment. Both comparison sides show units, grid and weather date; long selected field names wrap. | Desktop and phone weather comparison |
| Icon-only / pointer-only operation | Optional product names include unavailable-product explanations. Hover/focus hints escape the scroll region. Native maps support arrows to pan and Enter to inspect the center cell, with focus crosshair/instructions; Viewshed supports same-cell and Escape reset. | Product-dock test; renderer keyboard test; live keyboard native-cell inspection |

## Checks

- Full frontend suite: 225 tests across 42 files passed.
- TypeScript and ESLint passed.
- Production build passed in a fresh temporary output directory. Vite retains its large-chunk advisory for the application/MapLibre bundles.
- `git diff --check` passed.
- Actual browser: native Seascape, Governance and daily Meteorology; symmetric comparison setup and desktop/phone layout. Hit tests confirmed that AIS, Viewshed and Acoustics buttons remain clear of the legends on desktop, and that date, playback, previous-day, scrubber, right-layer editing and right-legend controls remain clear on phone with Insights open.

## Boundaries

Comparison still requires compatible native H3 grids; this work adds no cross-resolution aggregation. Viewshed pair comparison and pair export remain unavailable and are now explicitly explained. A formal screen-reader audit and live regional/producer regeneration were not run. The browser checks use the existing local prepared catalog and MapTiler renderer, alongside deterministic component tests.


### Shared legend popup clipping in Safari (2026-10-17)

Native Safari at `localhost:5173/#map` reproduced a real rendering failure: clicking the legend exposed the Appearance dialog in the accessibility tree, but the dialog was clipped out of the visible page by the map legend's scroll container. The Chromium preview did not reproduce this failure, so Chromium/component checks alone did not qualify the interaction.

`LegendDropdown` now opens its existing settings element as a manual native popover in the browser top layer and anchors it to the clicked legend using viewport coordinates. The dialog remains in the same DOM subtree for focus restoration, outside-click handling and themed controls. Its own contents retain scrolling, while map/legend overflow cannot hide the popup. This applies to numeric, Hydrology, Viewshed and other shared legend panels. Regression coverage checks top-layer opening from a clipped ancestor, editing, Escape and focus restoration; native Safari is the rendering check.

Validation: 56 tests passed across shared dropdown, numeric legend, Hydrology legend, Viewshed layer and Features page suites. TypeScript, scoped ESLint, frontend production build (without copying the local data cache), and `git diff --check` passed. Native Safari at the user's existing `localhost` tab visibly displayed Appearance and expanded Advanced controls; screenshot: `outputs/legend-settings-safari.png` in the task workspace. The jsdom popover shim enables component interaction tests and is not browser-rendering evidence.


## Source availability warning — 2026-10-20

Partial catalog/source failures now share a compact red alert in the bottom-left
control region. A warning icon, short title and affected source names are visible;
Retry uses the existing catalog attempt/reload path. Details expands the original
source diagnostics in a bounded scroll area. River influence, Meteorology,
Hydrology, Orca and catalog-declared unavailable-product reasons are retained,
without duplicate central notices. A failed base catalog or selected-layer load
retains its existing blocking/loading state and retry behavior.

The warning occupies its own grid slot beside desktop timelines/legends. On
phones it stacks above them; comparison places it in a separate row. Light mode
uses a pale red box with dark red text; dark mode uses a dark red surface and
pale red text. The alert has an accessible name and native keyboard-operable
Details disclosure. Retry has an explicit accessible label and a 44 px phone
target. Scientific values, units, H3 support, missingness and readers are unchanged.

Changed application files: `src/components/SourceWarning.tsx`, its CSS,
`src/pages/SeascapeMapPage.tsx`, its page tests and `src/pages/FeaturesLayout.css`.
README and the Knowledge validation note link this scoped behavior.

Current validation: 36 Features-page tests passed, including combined adapter and
catalog-declared failures, preserving full diagnostics, retry recovery, warning
removal and an unchanged mounted map. Typecheck, repository lint, isolated
production build and whitespace checks passed; existing large-bundle advisories
remain. No standalone docs build is configured. Affected links/properties were
checked separately.

The current live reader had recovered, so browser failure-state validation used
an isolated localhost preview that returns a simulated 503 only for the River
influence catalog and proxies existing readers for everything else. It uses the
actual app code/styles and its own dependency cache. At 1280 × 808 the warning
occupies the lower-left map region; at 390 × 844 it measures about 312 × 84 px,
without legend overlap or horizontal page overflow. Details showed the full
simulated error, and dark colors and desktop comparison legend separation were
checked. The screenshot is evidence of UI behavior with a simulated failure, not
proof that the current River influence delivery is failing. The preview was
stopped after QA. No producer rebuild, acquisition, regional validation, full
frontend suite or publication was run for this presentation change.


## Shared map warnings — 2026-10-20

Features now provides one warning host for its nested renderers and Viewshed.
`WarningNotice` supplies the red icon/card, title/message, optional diagnostics,
retry and dismissal. `SourceWarning` uses it for grouped source diagnostics.
The shared stack handles basemap configuration/failure, native base/selected-layer
failure, smoothing errors, comparison notices and Viewshed load/weight/action
failures. Retry and dismissal retain their original owners and behavior. A
failed geographic map keeps its neutral canvas; its warning no longer occupies
the center. Empty warning stacks are hidden.

The stack starts at the lower-left map edge. Resize/mutation observers measure
actual legends and timelines and lift the stack when their horizontal bounds
intersect. Its height is bounded and scrollable on short screens. Comparison,
phone layout, Viewshed and changing timeline heights use the same calculation.
Dialog, Appearance and Insights diagnostics use the same red card inline to
retain their current focus/accessibility context. Loading indicators, keyboard
announcements and scientific support/coverage notes retain their own semantics.

Additional changed files: `MapWarnings.tsx`, `MapWarningsContext.ts`,
`MapWarnings.test.tsx`, `WarningNotice.tsx`, shared warning CSS/wrapper,
`MapCanvas.tsx` and tests, `MapTilerCanvas.tsx`, `MapLegend.tsx`,
`ViewshedLayer.tsx`, `DatasetInsights.tsx`, `ViewshedTargetSources.tsx`, and
Features page/tests/layout. README and Knowledge validation record current scope.
The earlier source-only grid placement above is superseded by this shared stack.

Current validation: 95 tests passed across the map warning, Features, MapCanvas,
MapTiler, legend, Viewshed and Insights suites; 13 App/navigation/theme tests also
passed (108 total). Tests cover independent nested warning actions, a stable
map during retries, modal containment, optional-source recovery and the retained
neutral/geographic rendering contract. Typecheck, repository lint, production
build and whitespace checks passed; existing bundle-size advisories remain.
No standalone docs build is configured. Affected prose links/properties were
checked separately.

An isolated localhost preview simulated a missing basemap key and a River
influence catalog error while proxying retained local readers. Desktop warnings
stacked at the lower-left without legend overlap. At 390 × 844 the stack ended
at y=674 above the legend at y=686, with no horizontal page overflow. Viewshed's
unsupported Compare action joined the same stack; dismissing it retained the
basemap/source notices. The preview screenshot contains deliberately simulated
failure states, not current live-delivery status. The task preview was stopped
after verification. No acquisition, producer rebuild, full frontend suite,
scientific/regional validation or publication was run.
