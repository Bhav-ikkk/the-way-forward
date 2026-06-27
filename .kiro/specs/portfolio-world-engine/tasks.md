# Implementation Plan: Portfolio World Engine (Foundation)

## Overview

This plan scaffolds the data-driven foundation for the Portfolio World Engine in TypeScript using Next.js (App Router), React, TailwindCSS, the `playcanvas` engine, Zod for schema validation, and Vitest + fast-check for testing. Tasks proceed incrementally: project scaffold and pinned versions first, then the Data_Schema and Data_Loader, the Asset_Index, the client-only Engine_Mount integration boundary, the Demo_Developer content, the handcrafted scene strategy, and finally the documentation set, principles, coding standards, and license. Each step builds on the previous and ends by wiring components into the App_Framework.

## Tasks

- [ ] 1. Scaffold project structure and pin dependency versions
  - [x] 1.1 Create the top-level folder structure and pinned Version_Manifest
    - Create directories: `app/`, `src/engine/`, `src/data/schema/`, `src/assets/`, `src/scene/`, `content/`, `docs/`
    - Create `package.json` pinning exact versions (no range prefixes) for Next.js 14.2.x, React/React DOM 18.3.x, TypeScript 5.4.x, TailwindCSS 3.4.x, and an exact `playcanvas` 2.x.y patch; add Zod, Vitest, and fast-check as exact dev/runtime deps
    - Create `tsconfig.json`, `tailwind.config.ts`, `next.config.mjs`, and `app/globals.css`
    - Run install to generate the `package-lock.json` lockfile recording resolved exact versions
    - Preserve the existing `assets/` folder in place; reference only, do not relocate or duplicate
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 8.1, 8.2_

  - [x]* 1.2 Write smoke tests for structure and version pinning
    - Assert required directories exist and each named system (engine, data, assets, scene) has its own directory
    - Assert `package.json` pins exact versions for Next.js, React, TypeScript, TailwindCSS, and `playcanvas`, and that a lockfile is present
    - _Requirements: 1.1, 1.5, 8.1, 8.2_

- [ ] 2. Implement the Data_Schema and Data_Loader
  - [x] 2.1 Define Data_Schema validators for all Data_Files
    - Create Zod schemas in `src/data/schema/` for `profile`, `projects`, `skills`, `experience`, `education`, `achievements`, `settings`, and `socials`, encoding field names, types, and required/optional status
    - Ensure `profile` defines the six checkpoint fields (`knowledgeSummary`, `workSummary`, `thinkingApproach`, `futureDirection`, `collaborationValue`, plus identity fields)
    - Define asset-reference fields (`avatarAssetId`, `assetId`, `defaultCharacterAssetId`) as logical id strings, not file paths
    - Export the `Portfolio` type aggregating all file shapes
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x] 2.2 Implement the Data_Loader with validation and descriptive errors
    - Implement `validateFile` and `loadPortfolio` in `src/data/loader.ts` and the `src/data/index.ts` public surface
    - Return a structured `LoadResult` with `ValidationError` entries carrying `file`, `field`, `kind`, and `message`; aggregate all violations per file rather than failing on the first
    - Treat a missing required file as a `missing_required` error naming the file
    - Read content exclusively from Data_Files; hardcode no portfolio content
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x]* 2.3 Write property test for loader round-trip
    - **Property 1: Schema-conforming data round-trips through the loader**
    - **Validates: Requirements 3.1, 3.3, 4.2, 12.1**

  - [x]* 2.4 Write property test for located validation errors
    - **Property 2: Any single schema violation produces a descriptive, located error**
    - **Validates: Requirements 4.3, 4.4**

  - [x]* 2.5 Write unit tests for schema edge cases
    - Assert `profile` schema includes the six required checkpoint fields
    - Test missing-file and wrong-type edge cases and error message contents
    - _Requirements: 3.2, 4.3, 4.4_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement the Asset_Index
  - [x] 4.1 Implement asset index types, entry list, and lookup logic
    - Define `AssetEntry`, `AssetPlaceholder`, `ModelFormat`, and `AssetPack` types in `src/assets/types.ts`
    - Create `src/assets/assets.data.ts` as a static list of `AssetEntry` records (id, pack, path, format, optional label/category) mapping logical ids to existing files in the six allowed packs, using the GLB → GLTF → FBX → OBJ format preference and recording the resolved format per entry
    - Implement a simple `getAsset(id)` lookup in `src/assets/index.ts` returning an `AssetEntry` or an `AssetPlaceholder`, never a path to a non-existent file
    - Implement `findBrokenEntries(entries, knownFiles)` as a pure integrity helper
    - Record needed-but-missing assets only as `AssetPlaceholder` records
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x]* 4.2 Write property test for asset-reference fields being logical ids
    - **Property 3: Asset references are logical identifiers, never file paths**
    - **Validates: Requirements 3.6**

  - [x]* 4.3 Write property test for asset index integrity
    - **Property 4: Asset index integrity**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x]* 4.4 Write property test for format-independent identifiers
    - **Property 5: Asset identifiers are independent of file format**
    - **Validates: Requirements 5.5**

- [ ] 5. Implement the Render_Engine integration boundary
  - [x] 5.1 Implement createEngine and the client-only Engine_Mount
    - Implement `createEngine(canvas)` in `src/engine/createEngine.ts` returning an `EngineHandle` with `app` and a `dispose()` that destroys the instance and releases resources
    - Implement `EngineMount.tsx` with the `"use client"` directive: render a `<canvas>`, create the engine in a client-side `useEffect`, and dispose it on unmount
    - Touch browser-only globals only inside `createEngine`; export the boundary via `src/engine/index.ts`
    - Keep the mount minimal with no gameplay logic
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x]* 5.2 Write unit tests for engine lifecycle and import boundary
    - Mock canvas/WebGL; assert mount creates an instance and unmount calls dispose/destroy
    - Assert only `src/engine` imports `playcanvas` and App_Framework reaches the engine only through Engine_Mount
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 12.5_

- [ ] 6. Create Demo_Developer content and scene strategy
  - [x] 6.1 Author Demo_Developer example Data_Files
    - Create one schema-conforming example instance for each of the eight Data_Files in `content/` populated only with fictional Demo_Developer content (no real personal data)
    - Use logical Asset_Index ids for all asset references
    - _Requirements: 3.3, 3.4, 3.6_

  - [x]* 6.2 Write fixture test validating shipped example files
    - Assert every shipped Demo_Developer example file validates against its schema via the Data_Loader
    - _Requirements: 3.3_

  - [ ] 6.3 Document the handcrafted scene organization strategy
    - Create `docs/SCENE_STRATEGY.md` and `src/scene/README.md` naming the six handcrafted checkpoints (Origin, Library, Workshop, Observatory, Horizon, Gateway) mapped to the developer questions and their Data_File sources
    - Describe the scenes as manually authored (handcrafted) worlds whose content slots are populated from the Data_Files, and the conceptual mapping of road, river, and bridges
    - Explicitly note that procedural or data-driven generation of the world itself is NOT a goal; data swaps change only the content shown within the authored scenes
    - Mark runtime world construction as a Placeholder_Entry deferred to a later spec
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 1.4_

- [ ] 7. Wire the world into the App_Framework
  - [x] 7.1 Implement the App Router entry that dynamically mounts the engine
    - Implement `app/layout.tsx` and `app/page.tsx` as Server Components
    - In `app/page.tsx`, import `EngineMount` via `next/dynamic(..., { ssr: false })` so the engine is never imported or executed on the server
    - Render the mount inside the page so the client initializes a Render_Engine instance on load
    - _Requirements: 7.1, 7.2, 7.4, 7.6, 11.3_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Author documentation set, principles, and standards
  - [ ] 9.1 Write the README and architecture/data/asset documentation
    - Create root `README.md` summarizing project purpose, technology stack, and links to other docs
    - Create `docs/ARCHITECTURE.md` documenting the integration boundary, browser-only global guarding, the confirmed compatible version set with its confirming source, and a Placeholder_Entry if compatibility cannot be confirmed
    - In `docs/ARCHITECTURE.md`, document the Performance Budget (60 FPS target, lazy loading of heavy assets/engine code, texture compression, and optimized/minimal asset usage)
    - In `docs/ARCHITECTURE.md`, document the deferred Future Placeholders as Placeholder_Entry items: Audio, Camera behavior, and Checkpoint save/resume
    - Create `docs/DATA_SCHEMA.md` documenting the full Data_Schema contract
    - Create `docs/ASSET_STRATEGY.md` documenting asset organization and the preferred model format when multiple formats exist
    - Mark references to later-spec systems as Placeholder_Entry
    - _Requirements: 2.1, 2.7, 3.1, 5.4, 7.4, 7.6, 8.3, 8.6, 9.3_

  - [ ] 9.2 Write setup, contributor, roadmap, and milestones docs
    - Create `docs/SETUP.md` listing required runtime tooling, exact versions, and commands to install and start the dev server
    - Create `docs/CONTRIBUTING.md` describing how a Contributor proposes, submits, and validates changes
    - Create `docs/ROADMAP.md` listing future capabilities (plugin system, multiple themes, asset indexing, AI-assisted authoring tooling); do NOT list procedural/data-driven world generation as a planned engine approach, consistent with the handcrafted-world decision
    - Create `docs/MILESTONES.md` describing development milestones, ending with a final "Vertical Slice" milestone that delivers a playable handcrafted prototype including player spawn, camera, movement, terrain, road, river, bridge, the first checkpoint, and basic dialogue; mark the interactive/gameplay implementation of the vertical slice as a Placeholder_Entry deferred to a later spec (document only, do not build gameplay)
    - Mark unimplemented extension points as Placeholder_Entry
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 11.1, 11.4, 12.3, 12.4_

  - [ ] 9.3 Write PROJECT_PRINCIPLES.md
    - Create `PROJECT_PRINCIPLES.md` stating all seven principles: story over visuals, simplicity over complexity, performance over effects, data-driven content, reusable/open-source-friendly assets, clear-purpose/independently-replaceable folders, environment-guided navigation
    - _Requirements: 2.2, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 9.4 Configure coding standards, linter, formatter, and license
    - Create `docs/CODING_STANDARDS.md` documenting TypeScript usage, file organization, module boundaries, and naming conventions for folders, files, modules, and Data_File fields
    - Create `eslint.config.mjs` and `.prettierrc` whose rules enforce the documented standards
    - Add an open-source `LICENSE` file (MIT) at the Repository root
    - _Requirements: 10.1, 10.2, 10.3, 12.2_

  - [ ]* 9.5 Write smoke tests for documentation, principles, and config
    - Assert documentation set exists with required references and placeholders
    - Assert `PROJECT_PRINCIPLES.md` states each of the seven principles
    - Assert linter/formatter configs and root `LICENSE` are present
    - _Requirements: 2.x, 9.1-9.7, 10.3, 12.2_

- [ ] 10. Verify reusability and external tooling integration
  - [x]* 10.1 Write reusability and integration tests
    - Assert replacing Data_Files with alternate schema-conforming files requires no source changes to load
    - Verify dependency install completes without unresolved peer conflicts; `next build` completes without dependency-mismatch or SSR reference errors; linter reports zero violations; dev server starts and the client Engine_Mount initializes an engine instance
    - _Requirements: 8.4, 8.5, 7.6, 10.4, 11.2, 11.3, 12.1, 12.5_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests (P1–P5) validate universal correctness properties for the pure logic (schema, loader, asset index)
- Unit, smoke, and integration tests validate structure, configuration, lifecycle, and external tooling
- Property-based tests use fast-check + Vitest with a minimum of 100 iterations each

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "4.2", "4.3", "4.4", "5.2", "6.3", "9.3", "9.4"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "6.1", "7.1", "9.1", "9.2"] },
    { "id": 4, "tasks": ["6.2", "9.5", "10.1"] }
  ]
}
```
