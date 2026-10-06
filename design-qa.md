# Home grid motion QA

final result: passed

## Source, state and comparison evidence

Approved source: /Users/tylerstevenson/Documents/Codex/2026-10-05/task-5/home-design/reference/home-reference.png; local approved home baseline commit c996012. Source and implementation both 1536 × 1024 pixels, CSS viewport 1536 × 1024, density 1, light home route, catalog closed. Pointer shimmer is an intentional addition requested by the user.

Implementation: http://127.0.0.1:5173/#home. Desktop evidence: /Users/tylerstevenson/Documents/Codex/2026-10-05/task-5/home-motion/qa/home-motion-desktop.png. Full combined input: /Users/tylerstevenson/Documents/Codex/2026-10-05/task-5/home-motion/qa/full-comparison.png (source left, motion frame right). Focused combined input: /Users/tylerstevenson/Documents/Codex/2026-10-05/task-5/home-motion/qa/navigation-comparison.png (same 450 × 530 branding/navigation crops). Both combined inputs were opened and inspected. Responsive evidence: /Users/tylerstevenson/Documents/Codex/2026-10-05/task-5/home-motion/qa/home-motion-mobile.png (390 × 844). Native desktop browser at a narrow viewport; touch behavior is verified by simulated pointer events in the focused tests, not by a physical phone.

Brief grid detail capture: /Users/tylerstevenson/Documents/Codex/2026-10-05/task-5/home-motion/qa/grid-motion.gif (600 × 600; two sampled pointer locations, 24 frames). This edited sample shows localized shimmer; the live preview is the source of truth for the 14-second breathing cycle. Library: libfile_1d329ff7f26c81919592944c3cef5023; attachment file_000000003c1c81f5bbf8911e5bb1893d.

## Findings / fidelity surfaces

No remaining actionable P0/P1/P2 findings.

- Fonts/typography: approved home branding, navigation and mission typography remain unchanged. Focus outlines remain visible, and the overlay cannot intercept clicks.
- Spacing/layout: no layout changes. Canvas uses the exact cover scale and the same left/10%-mobile horizontal and centered vertical crop as the artwork. Mobile retains the approved composition and has no horizontal overflow.
- Colors/tokens: a restrained pale-blue light is added only to the original blue coarse grid band. Ambient opacity rises and falls smoothly on a 14-second cycle. A fifth of candidate cells can twinkle, with independent 16–28 second periods and rounded roughly 4-second swells. Mouse proximity eases to a soft 135-source-pixel neighborhood and fades on leaving. No stars, particles, sharp flashes or full-page effects.
- Image quality: the approved raster is unchanged. A one-time source-derived color mask clips glow off terrain, forest, sea illustration and UI. Coarse-grid candidates use measured artwork spacing; coastal/hand-rendered hex geometry remains baked into the image. Broad soft glows avoid presenting approximate candidate coordinates as exact cell boundaries. No new generated artwork or scientific data.
- Copy/content: all approved copy and synthetic provenance remain unchanged. Existing explorer pages and data fixtures were not edited.

## Interaction, accessibility and performance verification

Browser inspected ambient motion and moved the pointer between upper/lower grid regions, then inspected detail captures. Data catalog remains functional and pauses motion while open; native Escape returns to home. Navigation to Analyze removes the motion canvas; returning home recreates it. Mobile layout inspected at 390 × 844. Browser console error count: 0.

Reduced-motion media handling was tested with live preference changes: no scheduled animation frames while reduced, canvas cleared, and animation restarts when the preference is removed. CSS also hides the decorative canvas under prefers-reduced-motion. Browser does not expose media emulation through the available control API, so no OS preference was changed; this branch is covered by focused automated tests rather than a claimed browser-emulated screenshot.

Focused tests also cover touch input ignoring pointer shimmer, mouse proximity fade, hidden-tab pause/resume with no time jump, at-most-30 rendered frames/second, catalog pause, matching cover transforms, bounded candidates, and observer/listener/RAF cleanup on unmount. Canvas display density is capped at 1.5; source mask is computed once per effect lifecycle; animation uses canvas without React state updates per frame. Ambient motion remains on touch devices; cursor shimmer requires a fine hover pointer and mouse events.

All 21 tests across 6 files, ESLint, TypeScript and production build pass. Existing lazy MapLibre chunk size advisory remains. No dependency installation, backend, real data connection, credential access or remote push.

## Iteration history / follow-up

Initial inspection confirmed crop/masking alignment but too many candidate cells could swell together. Restricted ambient twinkles to one fifth of retained candidates; pointer proximity still covers nearby grid paint. Post-fix desktop/full and focused captures retain legible reference composition. No P0/P1/P2 visual mismatch required a further layout iteration.

P3: the image contains artistically varied hexes, so light centers follow an approximate measured lattice, clipped to actual blue paint. Exact independently animated hex polygons would require a separately authored grid layer. The GIF is a short edited sample, not a complete breathing cycle.

## Checklist

- [x] Preserve artwork and explorer pages.
- [x] Add breathing, sparse twinkles and mouse shimmer confined to grid paint.
- [x] Disable reduced-motion animation; ignore touch pointer shimmer.
- [x] Pause hidden tabs/catalog; cap rendering; clean up listeners/RAF.
- [x] Inspect source/implementation together and desktop/mobile/detail frames.
- [x] Verify tests, lint, build, console and navigation.
- [x] Save Library motion sample; keep local preview running.
