# Governance selector and clicked-cell QA — 2026-10-18

The reported disappearing Wildlife Refuges family was present in the actual
running catalog alongside Tribal First Nations Areas. A shortened window clipped
its nested dropdown: at 1230 × 440 the panel body was 101 px tall while the popup
extended to y=447.6, below the body ending at y=251. Its list could scroll within
an area that was itself hidden by the outer panel. No saved-state clearing or
catalog/data regeneration was needed.

The panel now uses the usable left-column height. SourcePicker fits the open
menu to the body's actual content height, brings the whole menu into that
scrollport, observes resize and keeps focused rows completely visible. Search,
picker heading and panel title retain space. Small-height padding leaves a full
44 px choice even at 390 × 320. Compact drawers temporarily conceal the legend,
zoom controls and Insights trigger occupying the same column; they return when
the drawer closes. No selection, appearance or data values are reset.

Verified in a separate hidden tab on the existing 127.0.0.1:5173 server:

- 1230 × 720: both families present; three Wildlife Refuge choices and two Tribal
  / First Nations choices; normal map and legend restored after closing selectors.
- 1230 × 440 and 1230 × 320: keyboard End reaches Wildlife Refuges and selects it;
  all three refuge features remain reachable, with no popup clipping.
- 390 × 440: wheel scrolling reaches both last families, fully inside the result
  scrollport; legends no longer intercept the Family trigger.
- Resize the open picker to 390 × 320: focused Wildlife Refuges row occupies
  y=184.59–228.59 inside the list's y=184.09–229.09 bounds.

Categorical H3 layers now use the existing map overlay popup mechanism on click.
Native geographic H3 picking works independently of fill/stripe rendering. The
popup identifies the selected feature, H3 ID and resolution, then renders every
membership and every paired source record with its original name/IDs, agency,
source jurisdiction, country/boundary type where supplied and part lineage.
No dominant assignment is chosen. Source strings render as inert React text.
Cards have bounded width/height and an internally scrollable body; Escape while
inside or the close button dismisses them. Numeric and other existing popup paths
remain covered by the full suite, and selection belongs to the clicked comparison
side. Local-renderer fallback cards are also bounded inside the map.

Actual click evidence at R6 cell `8628d1a1fffffff`:

- Wildlife Refuge Assignment: four area IDs/paired records, including Esquimalt
  Lagoon and Victoria Harbour Migratory Bird Sanctuary records.
- Tribal / First Nations Assignment: ESQUIMALT (`nrcan_indian_reserves:area:06808`,
  record `nrcan_indian_reserves:record:681`) and NEW SONGHEES 1A
  (`nrcan_indian_reserves:area:06839`, record `nrcan_indian_reserves:record:436`),
  with Canada, NRCan agency and Indian Reserve administrative reference details.
- Tribal / First Nations Area: true plus the same two supporting assignments,
  retaining boolean map rendering and the original source-field object identity.

Clicking `8628c27afffffff` in the boolean layer showed null/unknown value with
partial support and an explicit unknown-membership message. Automated fixtures
also verify observed empty lists/false separately; current retained products do
not contain verified false cells. At 1230 × 440, the tribal popup measured
x=638–998, y=124–432 with a 251 px detail viewport over 651 px of content. Keyboard
and wheel scrolling reached the remaining record. At 390 × 440, it remained
inside x=22–382, y=124–432. Screenshots and the precise follow-up patch are retained
in the task's compact evidence.

Validation: all 413 explorer tests in 78 files pass, including simultaneous family
visibility at R6/R8, short-scrollport fitting and resize, keyboard reachability,
all overlapping paired records, safe text, unknown versus empty, boolean support,
striped geographic picking, and existing numeric popup paths. Lint, TypeScript and
production build pass; the existing >500 kB chunk warning remains. Governance
catalog and both Parquet checksums are unchanged from the completed family update.
No data rebuild, source download, storage reset, server restart, commit, push or
merge accompanied these UI repairs.


The same fit logic was also checked in the short comparison dialog: its scroll
body ended at y=320, the open family menu remained within that body, and keyboard
End showed Wildlife Refuges completely inside the results area (row y=229–273;
list y=177–279). Fixed dialog actions stayed outside the menu scrollport.
Categorical popup placement reserves the top map-control strip; the final short
cards start at y=124, below zoom/Insights controls, and end at y=432.
