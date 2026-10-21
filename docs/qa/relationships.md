# Relationships implementation and QA — 2026-10-20

**final result: passed**

Approved visual truth: [desktop](../../../../Reports/relationships-design-2026-10-19/relationships-desktop.png),
[mobile](../../../../Reports/relationships-design-2026-10-19/relationships-mobile.png),
[response/night](../../../../Reports/relationships-design-2026-10-19/relationships-response-night.png)
and [brief](../../../../Reports/relationships-design-2026-10-19/design-brief.html).
The prototype's illustrative values were not reused as analytical data.

## Browser evidence and comparison

Verified in an isolated in-app browser against localhost Vite on port 5179 and
FastAPI on port 8001. Safari was not controlled. Source and implementation were
opened and compared together, including focused typography/selector/matrix crops.

- [Desktop implementation](relationships/desktop.jpg), CSS/pixels 1440 × 1150,
  devicePixelRatio 1, light theme, native R6 sand/mud/gravel/contour, manual scatter.
- [Desktop source comparison](relationships/desktop-comparison.jpg), equal size,
  source at left and implementation at right.
- [Mobile implementation](relationships/mobile.jpg), CSS/pixels 390 × 1100,
  light theme, same source selection/state.
- [Mobile source comparison](relationships/mobile-comparison.jpg), equal size.
- [Mobile drawer](relationships/mobile-variables.jpg), additionally tested at
  390 × 844: drawer top 74/bottom 832; import action bottom 813; no clipped action.
- [Qualified recorded-response night state](relationships/response-night.jpg).
  The response matrix and every predictor pair now use the positive-recorded-cell
  frame. Coverage is predictor completeness within that frame, not survey effort.
- [Strict precision empty state](relationships/strict-empty.jpg).
- [Existing Map route](relationships/map-preserved.jpg): geographic basemap/native
  H3 layer, legend, source dock and Compare/Export/Help enabled through the original
  Vite reader. No existing map adapter was replaced.
- Focus evidence: [type and tabs](relationships/desktop-detail-1.jpg),
  [source selectors](relationships/desktop-detail-2.jpg),
  [matrix region](relationships/desktop-detail-3.jpg).

Explicit clipped captures align the requested CSS viewport and image dimensions;
no image-density scaling was used. Temporary earlier captures had differing
scroll/capture bounds and were replaced for the final comparison. JPEG screenshot
compression is a capture limitation, not a font substitution.

### Fidelity surfaces and iteration

Typography: Georgia display/wordmark, Arial interface, navy hierarchy and the
Map's compact labels match the reference. Colors use the approved ivory/light
blue/navy/blue surfaces and the existing deep-blue/teal night theme. Cards retain
12 px radii, thin borders and low elevation. Standard icons reuse the app's Lucide
set and its actual DataDomainDock/SourcePicker; there are no missing decorative
raster assets. Charts are real data marks, not replacement artwork.

Initial P2 findings: an overly long contour label expanded matrix headers; plot
height and cohort placement stretched the analytical cards. Fixed by using the
verified original column to display “Distance to 50 m isobath”, reducing the plot
to 220 px, and moving common-cohort selection into the analysis toolbar. Final
screenshots and joint comparisons above are the post-fix evidence. A shared-header
landmark regression was fixed and verified by the Home/navigation tests.

Intentional production differences: current values/availability replace fixtures;
Apply validates a concrete plan; cohort and row-grain context are explicit; mobile
controls provide 44 px targets. These extra controls extend the mobile flow below
the illustrative mock while retaining its order, two-column context, cards and
internally scrolling matrix. The existing Map dock order and available/unavailable
products are reused. Current native contour support is 2,445 cells, not the old
preview's 2,621. Unknown units remain undeclared. Auto uses density for more than
2,000 pairs; the matched desktop comparison explicitly selects scatter.

No actionable P0/P1/P2 visual findings remain. P3 follow-up: mobile could make the
additional analysis context more compact without hiding observation rules. The
page has no horizontal overflow: document/body width equals 390 px. Native selects,
primary controls and source-info targets measured at least 44 px. Matrix overflow
is internal for larger selections.

### Interactions verified

Toolkit/family variable controls, multi-selection preservation, Apply, valid manual
scatter override, stale results/export disablement, pair matrix selection, source
information and nested Escape dismissal, mobile drawer/Escape, light/night theme,
strict empty response, explicit qualified response, recorded type/time/precision
controls, quality/support drawers, and local recipe export/import round trip were
checked. The exported recipe restored four variables with no error and validated
current source generations. Console error logs for Relationships were empty.
API/UI failure and cancellation paths are also covered by automated tests.

## Actual-data checks

[Machine-readable calculations](relationships/actual-data-checks.json) retain
source bindings, observation grain, denominators, exclusions and timings.
[Static recipe](relationships/static-recipe.json) is replayable against its pinned
generation. These are descriptive calculations, not ecological validation.

| Case | Result |
| --- | --- |
| R6 sand/mud | 2,305 complete / 2,621 union cells; 316 excluded; Spearman −0.5714182907 |
| Numeric/category | 2,197 complete / 2,637 union cells; box summaries, no numeric coding of category labels |
| Strict 2025 SRKW | 0 eligible positive cells; current positions cannot establish cell confinement |
| Qualified 2025 SRKW | 879 eligible source records; 244 positive monthly bins; 96 cells, 12 months; 96/96 complete for sand; Spearman 0.0528653066 |
| Weather 2026-10-09–10 | 926 native R5 cell-days; 463 complete; partial precipitation day excludes 463 cells; 50% pair coverage |
| Weather/finer grid | HTTP 422 with explicit native-resolution refusal |
| Recorded 2024 survey slice | 67 complete / 2,628 union cells; one slice/native cell; nulls retained |
| Governance exact membership sets | HTTP 200 with zero complete pairs for the tested assignment; unknown/partial support remains excluded, not invented empty memberships |
| Human R7 | 274 complete native cells for the tested pair |
| R8 bathymetry pair | 77,034 complete / 81,380 native cells; 4,346 excluded; density on all pairs; Spearman −0.5265065362 |

Static R6 warm analysis was approximately 0.3–1.0 s during checks; the R8 pair took
2.86 s. First Seascape validation was about 45 s; full reader validation/encoding
has additional memory overhead beyond the 256 MiB projected-analysis guard.
Only bounded JSON summaries/plot samples are transferred to Relationships.

## Automated verification

- Full frontend suite: **498 passed, 0 failed** (91 test files; Vitest's nested
  suite counter is 133). [Summary](relationships/test-summary.json).
- Backend: **20 passed**. Coverage includes one-to-one joins, null/outer-key
  denominators, ties/constants, pairwise/common cohorts, numeric-looking category
  labels, compatible plots, deterministic sampling/full-result statistics,
  explicit membership encoding, source-generation conflicts, spatial leakage,
  positive-response-frame consistency, UTC interval containment, partial weather,
  cancellation, request limits, source errors and localhost host/origin restrictions.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed. Final mobile/label
  refinements additionally passed the 13 relevant UI/navigation tests. Build retains
  the app's bundle-size advisory; there is no build failure.
- `git diff --check`: passed.

See [startup, methods, limits and deferred adapters](../relationships.md).
No final Data products were rebuilt or changed; no source datasets downloaded;
no deployment, commit, push or merge performed. Existing unrelated dirty work was
preserved with baseline hash checks before installing shared-file edits.

Final catalog qualification: survey availability is displayed as slice-dependent. A regression test rejects inherited cross-slice availability totals; analysis coverage continues to use the selected slice directly.
Final availability-label verification: 25 Relationships, Home and App UI/navigation tests passed, with typecheck, lint, build and whitespace checks passing again.
