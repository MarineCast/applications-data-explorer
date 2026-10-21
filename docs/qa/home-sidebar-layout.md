# Home sidebar and card layout

Checked locally on 2026-10-20. Home always starts with the 68 px icon rail,
including after navigation and when an older session saved an expanded preference.
Mouse entry anywhere in the sidebar starts the 150 ms expansion delay; leaving
the whole sidebar closes the panel after 300 ms. Empty space, waves, Help and
destination items all trigger expansion. Moving between children keeps it open.
Mouse clicks never pin the panel. Touch/pen and keyboard retain a waves control;
Tab into navigation opens labels, Escape closes and restores waves focus, and
leaving the sidebar by keyboard closes it. The old width preference is ignored.

Above 700 px, the photograph and card grid reserve the current 68/264 px sidebar
width and follow its 180 ms transition. The photograph recrops within its resized
container; its motion canvases resize through their existing ResizeObserver.
Reduced-motion preferences disable the layout transition. At 700 px and below,
the touch/keyboard drawer retains its overlay and outside-dismissal scrim.
Cards use two columns above 1000 px and one scrollable column below that boundary.
Their minimum heights accommodate the visible action rows on short/phone screens.

Light-mode cards use translucent ivory/sage surfaces with dark ink and sea-green
accents. Dark-mode cards use navy surfaces, pale ink and mint accents. Borders,
icon tiles, pills, action separators, pointer glow and decorative canvas motifs
follow the selected mode. These motifs remain illustrative navigation artwork,
not scientific data, model outputs or predictions.

Earlier hover/theme validation: 26 focused App/Home/background tests passed with one worker;
typecheck, repository lint and isolated production build passed. The first
parallel run hit the existing 5 s comparison-test timeout; the serial rerun passed.
Live desktop checks confirmed background/card offsets of 68/142 px collapsed and
264/338 px expanded at 1280 px width, with card widths shrinking 514 → 416 px.
Moving the pointer away restored the rail and image. Light/dark surfaces were
visually checked, including the final dark CSS override after reloading the preview.
Phone and intermediate-width checks cover card text and horizontal overflow.
No standalone docs build is configured; affected links/properties and
`git diff --check` are checked separately.

The full frontend suite, scientific data, native/regional producer runs and
publication were not run for this Home-only change. Earlier layout checks are
superseded by the hover behavior documented here.

## Header alignment refinement — 2026-10-20

Home now uses a 62 px brand row instead of 132 px. The desktop waves control is
50 × 50 px at x=12, y=6, with the same 33 px glyph as the shared data-page header
(verified there at x=12, y=5.5; its border accounts for the half-pixel difference).
At phone widths the Home control is 44 × 44 px at x=6, y=9, matching the shared
mobile sizing and inset. Expanded wordmark, section label and navigation text
share the same desktop text column. Sidebar destinations begin around y=91.

Earlier header-alignment layout used top alignment instead of vertical centering: first-card y=78 on the
1280 × 808 desktop preview, and y=76 at 390 × 844. Their desktop top edge moves
up about 29 px from the preceding centered layout. Hover expansion still squeezes
the photograph and grid, and touch/keyboard navigation remains unchanged.

Current validation: 10 Home/navigation/theme tests, typecheck, repository lint,
isolated production build and whitespace checks passed. Browser checks compared
Home with the Models page's shared header and checked desktop/phone overflow.
Only Home CSS, its waves glyph size and related documentation changed in this
refinement. Full suite, scientific/native/regional paths and publication remain
outside this change. Build retains its existing large-chunk advisories.

## Compact translucent cards — 2026-10-20

Cards now use a 240 px desktop minimum height and 244 px phone minimum, reduced
padding, a 28 px desktop grid gap, 36 px icon tiles and smaller headings. The grid
has wider side gutters and a 1040 px cap. At 1280 × 808, collapsed cards measure
about 492 × 240 px, previously 514 × 287 px: about 17% shorter and 4% narrower.
These current dimensions supersede the earlier card measurements above.

Light surfaces now have 72–79% opacity, with dark surfaces at 72–76%; both were
about 91–94% opaque. Backdrop blur is 10 px instead of 14 px. Text remains fully
opaque; darker light-mode secondary ink and brighter dark-mode secondary ink
support readability over the more visible scenery. Hover/focus surfaces remain
slightly denser. Existing rail behavior and upper-left header alignment remain.

Current validation: 10 focused Home/theme tests, typecheck, repository lint,
isolated production build and whitespace checks passed. Desktop light/dark
screenshots were reviewed. Settled browser layouts at 1001, 390 and 320 px had no
horizontal text/page overflow or vertically clipped card content. Resize transition
frames are not final geometry. No full suite, data/native/regional runs or
publication were performed. Existing build chunk-size advisories remain.

## Entire sidebar hover target — 2026-10-20

The mouse hover handlers now belong to the sidebar container. Empty space,
branding, Help and destinations all open the panel, and moving within it keeps
it open. Mouse clicks still do not pin it. Startup, touch/pen, keyboard controls,
card styling and photograph/grid resizing remain as described above.

Validation for this interaction change: 10 focused Home/theme tests, typecheck,
repository lint, isolated production build and whitespace checks passed. The
hover regression checks empty container space, waves, Help, movement between
children, dismissal on leave and absence of mouse pinning. Existing touch and
keyboard checks still pass. Live preview verifies expansion from empty sidebar
space and corresponding image/card displacement. No full-suite, native/regional
data work or publication was run.

## Navigation label removal — 2026-10-20

Removed the Explore section heading above Home's sidebar destinations and its
unused style selectors. Navigation now begins 12 px below the 62 px brand row
in both rail states, closing the old heading gap without a jump on hover.
The footer motto remains. Cards, theme styling and hover behavior are unchanged.

Validation: nine existing Home/navigation tests, typecheck, repository lint,
isolated production build and whitespace checks passed. Affected documentation
links/properties were checked. No new browser, full-suite, native/regional or
publication check was performed for this small label removal.

## Centered card group — 2026-10-20

The card grid now uses safe vertical centering within its symmetric desktop
insets, retaining horizontal centering beside the current sidebar width. This
supersedes the earlier top alignment. At 1280 × 808, the card group spans
x=167.6–1180.4 and y=150–658, centered at (674, 404), exactly the available
image-area center with the 68 px rail. Compact sizing and translucency remain.
When the card stack exceeds its container, safe alignment starts from the top
so all four destinations remain reachable by scrolling.

Current validation: nine existing Home/navigation tests, typecheck, repository
lint, isolated production build and whitespace checks passed. Live desktop
measurements confirmed the group center; at 390 × 844 the first card remains
at y=76, the stack scrolls, and there is no horizontal page overflow. Affected
documentation links/properties were checked. Full-suite, native/regional data
and publication checks were not run; existing build advisories remain.

## Light sidebar tones — 2026-10-20

Light mode now uses a subtle sage gradient on the fixed 68 px icon rail and a
warmer ivory gradient behind the expanded labels, with a faint inset divider.
Both are keyed to the settled sidebar theme, preserving the existing scene-sweep
handoff. Dark-mode rail/expanded colors and all layout/hover behavior are unchanged.

Validation: 10 focused Home/theme tests, typecheck, repository lint, isolated
production build and whitespace checks passed. Browser inspection confirmed the
two light gradients after the theme sweep and retained dark colors (#102c3c rail,
#203e50 expanded). The expanded light sidebar was visually reviewed. Affected
documentation links/properties were checked. Full suite, data/native/regional
runs and publication were not run; existing build advisories remain.

## Further card translucency — 2026-10-20

Card surface opacity is now 62–66% in light mode and 59–64% in dark mode,
replacing the earlier 72–79% / 72–76% ranges. Hover/focus surfaces are 74–78%.
Text opacity stays at 1; light-mode secondary/action ink is darker to retain
readability. Blur, card size/centering, sidebar gradients and interaction remain.

Validation: 10 focused Home/theme tests, typecheck, repository lint, isolated
production build and whitespace checks passed. Light/dark browser screenshots
and computed gradient/paragraph opacity were reviewed at 1280 × 808. This is
visual readback, not a formal contrast certification. Affected documentation
links/properties were checked. No new phone, full-suite, data/native/regional or
publication checks were run; existing build advisories remain.
