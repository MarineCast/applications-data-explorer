# MarineCast Data Explorer

Frontend-only React + TypeScript demo. All values, sightings, quality summaries, and release metadata are deterministic synthetic fixtures. No filesystem data root, data API, backend, or production product is connected. The Map page optionally uses MapTiler for basemap cartography only. The Map fallback coastline is an illustrative SVG; H3 cells are generated locally with h3-js.

## Local development

Use Node 22.12+ (verified here with Node 25.6.1) and npm. From this repository:

```sh
npm ci
npm run dev
```

Vite prints the local URL, normally http://127.0.0.1:5173. With no MapTiler key, all runtime assets are local. When configured, the Map page requests MapTiler styles, fonts, sprites, and tiles; synthetic H3 feature values remain local. No toolkit-data or sightings API is connected.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Pages

- **Home:** the selected coastal artwork blends into a hex-map illustration, with working Map, Data catalog, Analyze, Sightings and Data Health navigation. The catalog selects one of the four synthetic map features. Artwork is decorative, not a scientific layer. Home and explorer routes support hash links and browser history; the explorer brand returns home.

- **Map:** feature and region selection, H3 cell inspector, layer visibility/opacity, zoom/reset, month controls, and side-by-side feature/date comparison. Static viewability hides the time slider. Coastline geometry is illustrative, not navigation-grade.
- **Relationships:** filtered Pearson correlations, scatterplots, histograms, a clickable correlation matrix, and a simple redundancy indicator. Advanced lags and scale analysis are future work.
- **Sightings:** synthetic species/encounter filters, locations, feature-pair scatter, background toggle, distributions, empty states, and observation-support placeholders. No ecological, detection, or occurrence inference is performed.
- **Data health:** synthetic coverage calendar, quality flags, join loss, provenance, release comparison, and explicitly simulated empty/error states with retry.

## Structure and future integration

`src/data/demo.ts` is the sole fixture source. Pages maintain UI state; shared controls, charts, and the local map live in `src/components`. Fixture statistics are calculated independently of chart display caps. Monthly viewability values exist only to illustrate chart/health UI; the map treats that feature as static.

A future approved data integration should replace fixture access behind a typed read-only product adapter. Keep product identity/grain, units, spatial/temporal support, missingness, rights, provenance, and validation status explicit. Add backend filtering and response limits before loading real artifacts. Do not read or mutate sibling products, assume the proposed shared manifest is already adopted, or equate this demo with scientific validation.

This repository deliberately contains no FastAPI service and no data-root setting yet. No data fixtures contain real sightings or vessel records. Do not commit private products or credentials.

## Optional MapTiler basemap

Copy `.env.example` to `.env.local`, set `VITE_MAPTILER_KEY` to your own browser maps API key, and restart Vite. The default terrain style is `outdoor-v4`; override `VITE_MAPTILER_MAP_ID` with a MapTiler map ID if needed. Never put an account service token in a VITE variable: these values are included in browser requests and builds.

Use a dedicated origin-restricted key. For this preview, MapTiler documents the allowed origin as `127.0.0.1` (without scheme/port); use a separate production key restricted to the eventual hosted domain. See [MapTiler key setup](https://docs.maptiler.com/guides/credentials/api-key/). `.env.local` is ignored by Git.

MapLibre renders the MapTiler cartography with built-in attribution plus local synthetic H3 overlays. Feature/month/region, opacity, visibility, selected-cell styling, zoom/pan/reset, and comparison use the same React state. A keyboard-accessible H3 picker appears on focus. Sightings keeps its local illustrative map. Missing keys, initialization failures, authorization failures, and basemap loading timeouts fall back to the local SVG without connecting to data. A live MapTiler render was verified locally with the user-provided browser key. No feature-data API is connected.

## Map page reference update

The Map page uses the supplied visual reference for a full-screen basemap, floating navigation, right-side metric controls, blue H3 colors, and a bottom cell-detail sheet. Time series, nearby-cell selection, environmental context, cell navigation, grid visibility, opacity, region filters, comparison, and monthly playback are interactive. The detail sheet and timeline follow the selected comparison map's feature and date. Leaving comparison clears the selection.

The example's species activity index, bathymetry, wind/current products, saved collections and sharing are not available in this frontend demo. The existing four synthetic fixture features retain their units and missingness; monthly data and resolution-5 H3 cells are labeled accurately. MapTiler supplies cartography only.

## Home reference update

The default route opens the reference-based home page; `/#map`, `/#relationships`, `/#sightings`, and `/#health` open existing explorer pages directly. The home background and wave mark are generated raster assets derived from the user-selected reference. The wordmark, tagline, mission and navigation are editable HTML. Desktop and mobile layouts use the same artwork with responsive cropping and spacing. No data integration was added.

Asset provenance and exact generation prompts: [ARTWORK.md](public/assets/home/ARTWORK.md). Current home QA: [design-qa.md](design-qa.md). Previous Map QA: [map-reference.md](docs/qa/map-reference.md).

## Home grid motion

The home artwork has a slow 14-second breathing glow, sparse asynchronous twinkles, and a mouse-proximity shimmer with a gentle fade. A source-derived mask restricts light to the existing coarse blue grid band; terrain, forest, navigation and the original artwork remain intact. The effect is illustrative, not data.

Reduced-motion preferences disable the effect. Touch keeps ambient motion but ignores cursor shimmer. Hidden tabs and the open Data catalog pause animation. Rendering is capped at 30 frames/second and 1.5 display density, with cleanup when leaving Home. Exact independently animated cell boundaries would require an authored grid layer; current glow centers approximate the artwork spacing and are clipped to its blue paint.

Motion QA: [design-qa.md](design-qa.md). Prior home QA: [home-reference.md](docs/qa/home-reference.md).
