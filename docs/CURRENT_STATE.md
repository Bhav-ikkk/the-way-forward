# Portfolio World Engine — Current State

A living snapshot of what exists today, how it fits together, how to run it, and
where the rough edges are. Use this to decide what to refactor next.

Last updated after the "vertical slice loads + walks" fix.

---

## 1. What this project is

An interactive 3D developer portfolio built on **Next.js (App Router) + React +
PlayCanvas**. The guiding idea: a **handcrafted 3D world** that you walk through,
where the **content** (who you are, projects, skills, dialogue) comes from plain
**JSON files** — not the world geometry. Procedural/data-driven world generation
is explicitly out of scope; the world is authored by hand.

## 2. Tech stack (all versions pinned exactly)

| Concern | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.35 |
| UI runtime | React / React DOM | 18.3.1 |
| 3D engine | playcanvas | 2.7.7 |
| Language | TypeScript | 5.4.5 |
| Styling | TailwindCSS | 3.4.17 |
| Data validation | Zod | 3.23.8 |
| Tests | Vitest + fast-check | 2.1.8 / 3.23.1 |
| Lint/format | ESLint (flat) + Prettier | 8.57.1 / 3.3.3 |

## 3. Folder map

```
app/                     Next.js App Router (server components)
  layout.tsx             html/body shell + metadata
  page.tsx               dynamically mounts the engine (ssr:false)
  globals.css            full-viewport canvas styles
src/
  engine/                ALL PlayCanvas code lives here (import boundary)
    createEngine.ts       creates the pc.Application + input + lifecycle
    EngineMount.tsx       client-only React boundary; renders canvas + HUD
    DialogueOverlay.tsx   HUD: controls hint, loading cover, dialogue box
    CharacterController.ts WASD/arrow movement, facing, walk bob, follow cam
    world/
      buildWorld.ts       handcrafted scene: lights, ground, road, river,
                          bridge, scattered trees/rocks, character, checkpoint
      types.ts            engine-agnostic Checkpoint types
  data/                  Data layer (pure, no engine)
    schema/               Zod schema per content file + Portfolio type
    loader.ts             loadPortfolio() + validateFile() with located errors
    index.ts              public surface
  assets/                Asset_Index (logical id -> existing file metadata)
    types.ts, assets.data.ts, index.ts
content/                 The swappable portfolio data (8 JSON files)
public/
  models/                GLBs the browser loads at runtime (see §6)
assets/                  Original Kenney asset packs (source of truth, untouched)
docs/                    Documentation (this file lives here)
```

## 4. How it runs (request flow)

1. `app/page.tsx` (server component) dynamically imports `EngineMount` with
   `{ ssr: false }` so PlayCanvas never executes on the server.
2. `EngineMount` (client) creates the engine in a `useEffect` via `createEngine`.
3. `createEngine` builds the PlayCanvas app, input devices, and calls
   `buildWorld`, which assembles the handcrafted scene and loads GLB models.
4. A `CharacterController` drives the character and follow camera each frame and
   reports when the character enters a checkpoint radius.
5. Checkpoint enter/leave flows back to React, which shows a dialogue box whose
   text comes from `content/profile.json`.

## 5. The vertical slice (what you see today)

- **Scenery (handcrafted):** green ground plane, a tan road running forward, a
  blue river crossing it, a wooden **bridge** model over the river, and ~12
  scattered trees and rocks.
- **Character:** a Kenney character model spawned on the road.
- **Controls:** `W/A/S/D` or arrow keys to walk; the character turns to face its
  movement direction with a subtle walk bob; a follow camera trails behind.
- **Checkpoint + dialogue:** a glowing marker down the road; walking into it pops
  a dialogue box with your name + a line from `profile.json`.
- **HUD:** a "Use WASD / Arrow keys to walk" hint, and a "Loading world…" cover
  that clears once the world is ready (with a safety timeout so it can never get
  stuck).

### Tunable values (in `src/engine/world/buildWorld.ts` and `CharacterController.ts`)
- Ground 100×100; road width 4 / length 80; river at z=22, width 8.
- Bridge: position `[0,0.05,22]`, eulerAngles `[0,90,0]`, scale 4.
- Character: spawn `[0,0,0]`, scale 1.
- Checkpoint: position `[2.2,0.6,10]`, radius 4.5.
- Controller: MOVE_SPEED 6, TURN_RATE 12, CAMERA_DISTANCE 9, CAMERA_HEIGHT 5.5.

## 6. Assets & models — important details

- Original Kenney packs live in `assets/` and are never modified.
- The browser can only fetch files under `public/`, so the GLBs the slice needs
  were copied into `public/models/` with clean names: `character.glb`,
  `character-female.glb`, `bridge.glb`, `tree_oak.glb`, `tree_pine.glb`,
  `rock_large.glb`, `rock_small.glb`.
- **Texture gotcha (fixed):** the Kenney *character* GLBs referenced an external
  `Textures/colormap.png`. The character models in `public/models/` have been
  repacked so the texture is **embedded** in the GLB (self-contained), matching
  the nature models. To regenerate from the originals if needed:
  `npx @gltf-transform/core` read the source GLB and `writeBinary` to embed
  (the texture sits next to the source file under
  `assets/character/Models/GLB format/Textures/`).
- The `src/assets` **Asset_Index** is the data-driven catalog of logical ids →
  files. NOTE: the runtime scene currently loads from hardcoded `/models/*.glb`
  paths in `buildWorld.ts` rather than going through the Asset_Index. Wiring the
  scene to resolve through the Asset_Index is a natural refactor (see §9).

## 7. Data layer

- `content/*.json` holds all portfolio content: `profile, projects, skills,
  experience, education, achievements, settings, socials`.
- `src/data` validates each file against a Zod schema and returns either a typed
  `Portfolio` or a list of located errors (`file`, `field`, `kind`, `message`).
- Today only `profile.json` is consumed at runtime (for dialogue). The rest is
  validated and ready but not yet surfaced in the world.

## 8. Tests & verification

- 58 tests pass (`npm test`): property-based tests for the data loader and asset
  index, plus unit/smoke/fixture/integration tests and an engine lifecycle test.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass.
- The running scene was verified headlessly: loading clears, zero engine errors,
  the canvas renders varied color (not blank), and holding a movement key changes
  the view (walking works).

## 9. Known limitations / good refactor candidates

1. **Scene → Asset_Index wiring:** `buildWorld.ts` uses hardcoded model paths.
   Refactor to resolve models through `src/assets` so the catalog is the single
   source of truth.
2. **StrictMode disabled:** `reactStrictMode` is `false` (see `next.config.mjs`)
   because the dev double-mount tore down the engine mid-load. A more surgical
   fix would make the engine lifecycle fully idempotent and re-enable it.
3. **No animations:** the Kenney character mesh isn't rigged, so "walking" is a
   procedural bob. A rigged/animated character would need an animated GLB and the
   PlayCanvas anim component.
4. **Single checkpoint:** only one of the six planned story checkpoints exists.
5. **Bridge placement:** scale/rotation were chosen without visual fine-tuning.
6. **Content coverage:** projects/skills/experience etc. aren't represented in
   the world yet — only profile dialogue is.
7. **No collision/physics:** movement is free on a flat plane; the character can
   walk through scenery and off the ground.
8. **Camera is fixed-follow:** no orbit/zoom/mouse control.
9. **Deferred systems (not built):** audio, advanced camera behavior, checkpoint
   save/resume.
10. **favicon 404:** harmless; no favicon is provided yet.

## 10. How to run

```bash
npm install      # first time
npm run dev      # then open the printed URL (http://localhost:3000)
```
Walk with `W/A/S/D` or arrow keys. Other commands: `npm run build`,
`npm run lint`, `npm test`.
```
```
