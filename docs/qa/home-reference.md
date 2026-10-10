# Home reference QA

Publication note: screenshots and user reference captures are retained privately and are not distributed in this source-only branch. Capture names below identify historical review evidence, not repository download links. Machine-specific paths and private Library identifiers are omitted.

final result: passed

## Target and evidence

Source visual truth: the privately retained user-selected homepage reference. The reference was supplied by the user. The original is unchanged.

Implementation: http://127.0.0.1:5173/ (home route), Codex in-app browser. Source and rendered desktop screenshots are both 1536 × 1024 pixels at a 1536 × 1024 CSS viewport, density 1. No scaling or browser chrome in the comparison. State: default home, catalog closed, no hovered navigation item, light appearance.

Full comparison: private QA capture full-comparison.png (3072 × 1024; source left, implementation right). Focused branding/navigation comparison: private QA capture navigation-comparison.png (900 × 530; equal 450 × 530 source crops). Both combined inputs were opened and visually reviewed. Final implementation screenshot: private QA capture home-desktop.png, retained privately with the original review artifacts.

Responsive evidence: private QA capture home-mobile.png (390 × 844); home-mobile-320.png (320 × 700); home-laptop.png (1280 × 720); catalog-mobile.png (390 × 844). These are adaptations: the source provides no mobile design. Native browser screenshots were inspected, including stable viewport dimensions. No horizontal overflow at 320px.

## Findings and required fidelity surfaces

No remaining actionable P0/P1/P2 findings within the supplied reference adaptation.

- **Fonts / typography:** self-hosted Barlow Condensed 600 approximates the tracked condensed wordmark. Editable HTML preserves the source capitalization and tagline; Georgia matches the serif navigation. Small letterspaced mission text retains the reference hierarchy. The condensed family is a close substitute, not an identified exact original font. All navigation labels remain legible and untruncated at checked widths.
- **Spacing / layout rhythm:** full-bleed 3:2 artwork; branding near x46/y45; navigation icons near x64 and labels near x106; 50px desktop rows; separated dark Map indicator and pale lower rail; divider and two-line mission near the reference positions. Short laptop and mobile layouts compact vertical gaps to keep mission copy off the forest. Mobile retains the coastline and a visible blue map edge.
- **Colors / visual tokens:** warm ivory paper, charcoal/navy text, subdued blue/teal map cells and forest palette follow the source. Hover backgrounds and keyboard focus outlines are visible. The small synthetic-artwork note is an intentional provenance addition.
- **Image quality / asset fidelity:** generated raster background preserves the coastal forest, mountains, islands, sea, topographic map and softly blended hex overlay. Geographic labels remain embedded in the illustration. The wave is a generated extraction of the supplied mark with verified alpha; UI icons use the existing library. No CSS/SVG approximations of the illustrated scene. JPEG compression is visually clean at target size. Geographic detail and extracted wave strokes have minor generative differences, classified P3.
- **Copy / content:** MARINECAST, tagline, five navigation labels, geographic labels and two-line mission match the source intent. The home states “Illustrative artwork · Synthetic demo · No data connected.” The catalog shows only the four existing synthetic features with their units and temporal support. No unavailable scientific products were invented.

## Comparison history

1. Initial desktop review found wordmark alignment and size drift. Moved the sidebar from 5.05% to 4.4% top, increased the condensed wordmark to 32px, and offset the navigation margin to retain row alignment. The combined focused post-fix capture confirms the corrected hierarchy.
2. Navigation rail initially ran continuously past the final row. Replaced it with the separate first-row indicator and a shorter lower rail matching the source. Post-fix evidence: navigation-comparison.png and full-comparison.png.
3. P2 responsive readability: at 320 × 700 and 1280 × 720, mission text touched the mountain/forest. Reduced short-screen vertical spacing while preserving 44px mobile row targets. Post-fix captures home-mobile-320.png and home-laptop.png show mission text in the lighter area above the artwork.
4. Viewport capture normalization: rapid browser viewport changes initially produced intermediate resize captures. Replaced these with fresh stable captures, verifying the 1536 × 1024 home bounds and 320px document width before judging the final views.

## Interaction and engineering verification

Browser verified Map, Analyze, Sightings and Data Health navigation, brand return to home, browser Back from Analyze, Data catalog open/close, native Escape dismissal and focus restoration, and selecting Physical viewability from the catalog. Selection opens the map showing “Physical viewability · Static demo” and “Static feature · no temporal axis.” No new browser console errors (count 0 in the verified tab). Native dialog behavior is verified in-browser; jsdom receives a test-only dialog shim.

All 16 tests passed across 5 files, including existing comparison-map context regressions and new home routing/catalog tests. TypeScript, ESLint and production build pass. The existing lazy MapLibre chunk retains its Vite size advisory. No dependencies installed, backend added, real product data read, or credentials exposed. The user-provided MapTiler configuration and explorer features remain in place.

## Open questions and follow-up polish

P3: the source font and exact wave geometry are not available as authored brand assets. Supplied official assets could improve exact branding later. Mobile artwork crops the far-right map and some Pacific Ocean lettering; this is expected for the wide source image. No new data integration, deployment or Git push is included.

## Implementation checklist

- [x] Inspect the exact selected source and generate real artwork assets.
- [x] Implement editable branding, navigation and responsive layout in the existing app.
- [x] Keep existing explorer behavior and synthetic provenance.
- [x] Compare source and rendered implementation in full and focused combined inputs.
- [x] Fix short-screen readability and inspect post-fix evidence.
- [x] Verify core navigation, modal, history, tests, lint and production build.
- [x] Save final screenshot to Library and preserve original reference.
