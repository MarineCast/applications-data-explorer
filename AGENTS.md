# Data Explorer agent guidance

Independent React/TypeScript frontend. Read the current [README](README.md) for implemented
routes, synthetic versus source-backed adapters, preparation commands and integration limits.
Check `git status --short`, preserve unrelated work and read deeper instructions before editing.
Do not assume local uncommitted integration exists in a clean clone.

## Task routing

| Task | Read / check |
| --- | --- |
| UI/state/accessibility | Relevant `src/pages`, `src/components` and adjacent tests; existing [design QA](design-qa.md) when changing the mapped flow |
| Data/statistics/identity/display transformation | Relevant `src/data` adapter/tests plus README source/missingness/units contracts |
| Dependency or build | [package.json](package.json), lockfile and runtime requirements in README |
| Toolkit integration / shared schema | Owner's public product contract and [MarineCast infrastructure](https://github.com/MarineCast/.github/blob/HEAD/INFRASTRUCTURE.md); proposed standards are not adopted automatically |
| Prose-only | Target references/names and `git diff --check`; no UI suite solely for prose |
| Local product preparation | Current README and preparation script when present; explicitly supplied release/input/output paths, source validation and rights |

## Setup and validation

Use Node 22.12+ and npm. From this checkout: `npm ci`; `npm run dev` is a local preview.
For behavior changes, run relevant tests first (`npm test -- <test-path>`), then:

```sh
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Fixtures and mock inputs are software checks, not regional/scientific acceptance. A build can
include an existing ignored local browser cache: inspect output contents before any hosting or
upload. Do not prepare real data, install tooling, start acquisition or mutate sibling products
merely to test UI code. Use a fresh explicit output for authorized preparation and preserve
source checksums, readback/identity gates and refusal to overwrite existing snapshots.

## Contracts and handoff

Preserve native keys/grain, units, missingness, qualifiers, rights, provenance and validation
status. Unknown/unavailable is not zero or ecological absence. Source-backed views must not
silently fall back to synthetic values. Basemap cartography and illustrative artwork are not
scientific data; keep observation, detection and occurrence distinct. Display transformations
must preserve original values/units and explain their support/statistics; never rewrite sources.

Do not commit private products, browser caches or credentials. VITE values enter browser builds;
never put account service tokens in them. Keep origin/key restrictions and basemap attribution.
No backend, publication or remote feature-data integration is implied by frontend changes.
Use scoped source search; no graph generation is needed for ordinary edits. Inspect the final
diff/staged paths and report changes, checks actually run, visual QA and data/network/integration
limitations. Do not claim scientific validation from fixtures or a local preview.
