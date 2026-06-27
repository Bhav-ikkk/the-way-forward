# Coding Standards

This document defines the coding standards for the Portfolio World Engine. They
exist to keep the four systems (`Data_Loader`, `Asset_Index`, `Render_Engine`
integration, `App_Framework`) independently replaceable and the content/
presentation boundary clean. The standards are enforced by ESLint
(`eslint.config.mjs`) and Prettier (`.prettierrc`); run `npm run lint` and
`npm run format` to apply them.

## TypeScript Usage

- TypeScript runs in `strict` mode (see `tsconfig.json`). Do not weaken it.
- Avoid `any`. Prefer precise types, `unknown` for untyped inputs, and Zod
  schemas as the source of truth for `Data_File` shapes.
- Use `import type { ... }` for type-only imports so the module boundary stays
  clear and types are erased at build time.
- Prefer `const`; only use `let` when reassignment is required.
- Export explicit, named interfaces and types from each system's public surface
  (`index.ts`); avoid default exports for modules.
- Validation never throws for malformed content — return structured results
  (e.g. `LoadResult`) instead.

## File Organization

- Each named system owns exactly one directory and is reached only through its
  `index.ts` public surface:
  - `src/data/` — Data_Loader and `src/data/schema/` validators.
  - `src/assets/` — Asset_Index (`getAsset`, `findBrokenEntries`) and the static
    `assets.data.ts` entry list.
  - `src/engine/` — Render_Engine integration only; the only place that imports
    `playcanvas` and the only place that touches browser-only globals.
  - `src/scene/` — handcrafted scene strategy (documentation/placeholder).
- `app/` holds the Next.js App Router entry (Server Components, layout, routes).
- `content/` holds the swappable `Data_Files` (JSON only — no code, no real
  personal data).
- `docs/` holds the documentation set.
- Co-locate unit tests next to their source using the `.test.ts` suffix.

## Module Boundaries

- `App_Framework` code (`app/`) reaches the engine **only** through the
  client-only `Engine_Mount`, imported via `next/dynamic(..., { ssr: false })`.
  Server Components must never import `playcanvas` or engine code directly.
- Only `src/engine/` may import `playcanvas`.
- `Data_Files` reference visual assets by **logical Asset_Index id**, never by a
  filesystem path. Path resolution lives only in `src/assets/`.
- Content is read exclusively from `Data_Files`; never hardcode portfolio
  content in source.
- Systems depend on each other only through published `index.ts` exports, never
  by reaching into another system's internal files.

## Naming Conventions

| Kind | Convention | Example |
| --- | --- | --- |
| Folders | lowercase, hyphenate multi-word | `src/engine/`, `content/` |
| React component files | `PascalCase.tsx` | `EngineMount.tsx` |
| Other source files | `camelCase.ts` | `createEngine.ts`, `loader.ts` |
| Data file modules | `kebab.data.ts` / domain name | `assets.data.ts` |
| Public surface file | `index.ts` per system | `src/data/index.ts` |
| Data_Files (JSON) | lowercase singular/plural noun | `profile.json`, `projects.json` |
| Types & interfaces | `PascalCase` | `AssetEntry`, `Portfolio` |
| Functions & variables | `camelCase` | `loadPortfolio`, `getAsset` |
| Constants (module-level) | `UPPER_SNAKE_CASE` | `ASSET_INDEX` |
| Data_File fields | `camelCase`, content-only meaning | `avatarAssetId`, `knowledgeSummary` |
| Asset_Index ids | dotted, format-independent | `character.male.a` |

### Data_File field naming

- Fields describe **content**, never presentation, layout, or engine concepts.
- Asset-reference fields end in `AssetId` (or `...CharacterAssetId`) and carry a
  logical id, e.g. `avatarAssetId`, `assetId`, `defaultCharacterAssetId`.
- Dates use ISO 8601 strings; open-ended ranges use an explicit `null` end.
- Keep field names stable: they are the contract documented in
  `docs/DATA_SCHEMA.md`, so renames are breaking changes.
