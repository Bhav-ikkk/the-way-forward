import type * as pc from "playcanvas";

import type { MarkerKind } from "./landmarks";
import {
  addPointLight,
  addPrimitive,
  LAYOUT,
  loadModelInstances,
  makeMaterial,
  type Marker,
  type Placement,
} from "./shared";
import type { ColliderSpec } from "./types";

/**
 * A handle to a chapter structure's SUBTLE interaction highlight.
 *
 * `setHighlight(factor)` ramps the building's accent light + a soft ground glow
 * ring between idle (`0`) and fully highlighted (`1`). The
 * {@link ../InteractionController} eases this factor so the highlight fades in
 * as the player approaches and out as they leave — tasteful, not a hard
 * outline.
 */
export interface StructureHandle {
  /** Stable chapter id (matches the landmark / chapter content). */
  id: string;
  /** Drive the highlight; `factor` 0 (idle) → 1 (highlighted). */
  setHighlight: (factor: number) => void;
}

/** How much the accent light(s) brighten at full highlight (fraction). */
const HILITE_LIGHT_BOOST = 0.7;
/** Peak opacity of the soft ground glow ring at full highlight. */
const RING_MAX_OPACITY = 0.5;
/** Radius (world units) of the ground glow disc around a structure anchor. */
const RING_RADIUS = 5.4;

/**
 * Build the subtle highlight for a freshly-composed structure: a soft emissive
 * ground glow disc at its anchor plus an accent-light boost. The markers it
 * affects are exactly those appended to `markers` since `startMarkerIndex`
 * (i.e. this structure's own accent lights). Returns a {@link StructureHandle}.
 */
function makeHighlight(
  app: pc.AppBase,
  id: string,
  f: StructureFrame,
  markers: Marker[],
  startMarkerIndex: number,
  coolGlow: boolean,
): StructureHandle {
  const mine = markers.slice(startMarkerIndex);
  const baseIntensity = mine.map((m) => m.baseIntensity);

  const glow = coolGlow ? LAYOUT.marker.coolColor : LAYOUT.marker.color;
  const ringMat = makeMaterial(glow, { emissive: true, opacity: 0.001 });
  const ring = addPrimitive(
    app,
    "cylinder",
    ringMat,
    [f.ox, 0.06, f.oz],
    [RING_RADIUS, 0.04, RING_RADIUS],
  );
  ring.enabled = false;

  let last = -1;
  const setHighlight = (factor: number): void => {
    const ff = factor < 0 ? 0 : factor > 1 ? 1 : factor;
    if (Math.abs(ff - last) < 0.002) return;
    last = ff;
    // Boost (and let stepMarkers keep flickering around) the accent lights.
    for (let i = 0; i < mine.length; i++) {
      mine[i].baseIntensity = baseIntensity[i] * (1 + HILITE_LIGHT_BOOST * ff);
    }
    // Fade + gently swell the ground glow ring.
    const on = ff > 0.02;
    ring.enabled = on;
    if (on) {
      ringMat.opacity = RING_MAX_OPACITY * ff;
      ringMat.update();
      const s = RING_RADIUS * (1 + 0.14 * ff);
      ring.setLocalScale(s, 0.04, s);
    }
  };

  return { id, setHighlight };
}

/**
 * Structures system: the handcrafted, per-chapter environmental BUILDINGS the
 * player arrives at. This pass replaces the old "floating lantern / firepit"
 * markers with real architecture assembled from the building kit
 * (build_wall*, build_roof, build_floor, build_column, build_cylinder,
 * build_hexagon, build_cube, build_door) plus chapter-appropriate props, so
 * each checkpoint reads as a PLACE rather than a glowing dot.
 *
 * Every structure:
 *  - is composed in a local FRAME ({@link StructureFrame}) whose `along` axis
 *    follows the path tangent (the building's left-right) and whose `into` axis
 *    points from the path toward the anchor (its depth), with the FRONT facing
 *    back toward the road so doorways/silhouettes read as you arrive;
 *  - keeps a warm (or, for the AI lab, cool) accent light registered as a
 *    flickering {@link Marker} — the building, not the light, is the landmark;
 *  - emits a small number of simple box colliders for its footprint/tower so
 *    the player can't walk through it, consistent with the physics world.
 *
 * Kit pieces are ~1-unit Kenney models; the scale constants below push them up
 * to read against the ~3.0u-tall player. All scales/footprints are tunable.
 */

// ---- Tunable kit constants -----------------------------------------------

/** World height/width of one wall piece (Kenney ~1u kit, scaled up). */
const WALL_SCALE = 2.6;
/** A lower wall scale for the glass-walled AI lab (a low, modern building). */
const LOW_WALL_SCALE = 2.0;

/**
 * A structure's local placement frame. Built by `placeLandmark`; consumed by
 * the per-chapter builders here.
 */
export interface StructureFrame {
  /** Anchor (building centre) world X/Z. */
  ox: number;
  oz: number;
  /** Unit vector along the path tangent (building's left-right axis). */
  alongX: number;
  alongZ: number;
  /** Unit vector from the path toward the anchor (building's depth axis). */
  intoX: number;
  intoZ: number;
  /** Yaw (deg) the building FRONT faces (back toward the path). */
  faceYaw: number;
  /** The accent-light style chosen for this chapter. */
  marker: MarkerKind;
}

/** Convert a local (along, into) offset in the frame to a world X/Z. */
function toWorld(
  f: StructureFrame,
  along: number,
  into: number,
): { x: number; z: number } {
  return {
    x: f.ox + f.alongX * along + f.intoX * into,
    z: f.oz + f.alongZ * along + f.intoZ * into,
  };
}

/**
 * Small per-URL placement collector so each kit piece GLB is fetched ONCE and
 * instanced at all its transforms (performance-friendly for the repeated walls
 * / columns / floor tiles a building needs).
 */
class KitBatch {
  private readonly map = new Map<string, Placement[]>();

  /** Queue one instance of `url` at a frame-local (along, into) + world Y. */
  add(
    f: StructureFrame,
    url: string,
    along: number,
    into: number,
    y: number,
    extraYaw: number,
    scale: number | [number, number, number],
  ): void {
    const w = toWorld(f, along, into);
    const list = this.map.get(url);
    const p: Placement = {
      position: [w.x, y, w.z],
      yaw: f.faceYaw + extraYaw,
      scale,
    };
    if (list) list.push(p);
    else this.map.set(url, [p]);
  }

  /** Fire all the batched loads. */
  flush(app: pc.AppBase): void {
    for (const [url, placements] of this.map) {
      loadModelInstances(app, url, placements);
    }
  }
}

/** Push a single box footprint collider centred on the structure anchor. */
function pushFootprint(
  colliders: ColliderSpec[],
  id: string,
  f: StructureFrame,
  halfAlong: number,
  halfInto: number,
  height: number,
  centerY = height,
): void {
  colliders.push({
    id: `${id}-base`,
    type: "box",
    position: [f.ox, centerY, f.oz],
    halfExtents: [halfAlong, height, halfInto],
    rotation: [0, f.faceYaw, 0],
    role: "landmark",
  });
}

/** Register a warm/cool accent point light as a flickering marker. */
function accent(
  app: pc.AppBase,
  markers: Marker[],
  f: StructureFrame,
  along: number,
  into: number,
  y: number,
  kind: MarkerKind,
  opts: { cool?: boolean; intensity?: number; range?: number } = {},
): void {
  const w = toWorld(f, along, into);
  const intensity =
    opts.intensity ??
    (kind === "firepit"
      ? LAYOUT.marker.firepitIntensity
      : LAYOUT.marker.lanternIntensity);
  const color = opts.cool ? LAYOUT.marker.coolColor : LAYOUT.marker.color;
  const light = addPointLight(
    app,
    w.x,
    y,
    w.z,
    intensity,
    opts.range ?? LAYOUT.marker.range,
    color,
  );
  markers.push({
    kind,
    light,
    baseIntensity: intensity,
    baseY: y,
    model: null,
    phase: Math.random() * 6,
  });
}

/**
 * Assemble a rectangular building from wall pieces: front + back walls run
 * along the `along` axis, side walls along `into`, with corner posts. The front
 * can carry a door (or be left open), and the sides can carry windows. Optional
 * roof + floor. Pieces are batched per URL via {@link KitBatch}.
 */
interface RectOptions {
  halfAlong: number;
  halfInto: number;
  wallScale: number;
  /** How the front (path-facing) wall reads. */
  front: "door" | "open" | "wall";
  /** Use windowed wall pieces on the two sides. */
  windowSides?: boolean;
  /** Lay a roof across the top. */
  roof?: boolean;
  /** Lay floor tiles at the base. */
  floor?: boolean;
}

function buildRect(
  app: pc.AppBase,
  batch: KitBatch,
  f: StructureFrame,
  o: RectOptions,
): void {
  const w = o.wallScale;
  const nAlong = Math.max(2, Math.round((o.halfAlong * 2) / w));
  const nInto = Math.max(2, Math.round((o.halfInto * 2) / w));
  const wallY = 0;

  // Front (into = -halfInto) + back (into = +halfInto) walls, running along.
  const frontCentre = Math.floor(nAlong / 2);
  for (let i = 0; i < nAlong; i++) {
    const along = -o.halfAlong + w * (i + 0.5);
    // Back wall (faces away from the path).
    batch.add(f, "/models/build_wall.glb", along, o.halfInto, wallY, 180, w);
    // Front wall.
    if (o.front === "open") continue;
    if (o.front === "door" && i === frontCentre) {
      batch.add(f, "/models/build_wall_door.glb", along, -o.halfInto, wallY, 0, w);
    } else {
      const url = o.windowSides
        ? "/models/build_wall_window.glb"
        : "/models/build_wall.glb";
      batch.add(f, url, along, -o.halfInto, wallY, 0, w);
    }
  }

  // Side walls (along = ±halfAlong), running through the depth.
  for (let j = 0; j < nInto; j++) {
    const into = -o.halfInto + w * (j + 0.5);
    const sideUrl = o.windowSides
      ? "/models/build_wall_window.glb"
      : "/models/build_wall.glb";
    batch.add(f, sideUrl, -o.halfAlong, into, wallY, 90, w);
    batch.add(f, sideUrl, o.halfAlong, into, wallY, 270, w);
  }

  // Corner posts to close the silhouette.
  for (const sa of [-1, 1] as const) {
    for (const si of [-1, 1] as const) {
      batch.add(
        f,
        "/models/build_wall_corner.glb",
        sa * o.halfAlong,
        si * o.halfInto,
        wallY,
        si > 0 ? 180 : 0,
        w,
      );
    }
  }

  // Floor tiles.
  if (o.floor) {
    for (let i = 0; i < nAlong; i++) {
      for (let j = 0; j < nInto; j++) {
        const along = -o.halfAlong + w * (i + 0.5);
        const into = -o.halfInto + w * (j + 0.5);
        batch.add(f, "/models/build_floor.glb", along, into, 0.04, 0, w);
      }
    }
  }

  // Roof across the top (a couple of overlapping pieces sized to the span).
  if (o.roof) {
    const roofY = w * 0.96;
    const roofScale: [number, number, number] = [o.halfAlong * 2.2, w, o.halfInto * 2.2];
    batch.add(f, "/models/build_roof.glb", 0, 0, roofY, 0, roofScale);
  }
}

// ---- Per-chapter structure builders --------------------------------------

/**
 * Arrival Camp cabin — the richest, fully-built shelter. Exported so the spawn
 * camp ({@link ./spawn}) can drop it beside the existing campfire/benches.
 * Walls + doorway + windowed sides + roof + floor, with a warm lantern glow at
 * the door. Emits one footprint collider.
 */
export function buildArrivalCabin(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): StructureHandle {
  const startMarker = markers.length;
  const batch = new KitBatch();
  buildRect(app, batch, f, {
    halfAlong: 3.0,
    halfInto: 2.6,
    wallScale: WALL_SCALE,
    front: "door",
    windowSides: true,
    roof: true,
    floor: true,
  });
  // A standalone door prop in the front gap + a lantern beside it.
  batch.add(f, "/models/build_door.glb", 0, -2.6, 0, 0, WALL_SCALE);
  batch.add(f, "/models/lamp.glb", 1.8, -3.1, 0, 0, 1.4);
  batch.flush(app);

  accent(app, markers, f, 1.8, -3.1, 1.7, "lantern");
  pushFootprint(colliders, "arrival-camp", f, 3.4, 3.0, WALL_SCALE);
  return makeHighlight(app, "arrival-camp", f, markers, startMarker, false);
}

/** Workshop — an open-front canvas/timber workshop, industrious + hands-on. */
function buildWorkshop(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const batch = new KitBatch();
  buildRect(app, batch, f, {
    halfAlong: 3.2,
    halfInto: 2.6,
    wallScale: WALL_SCALE,
    front: "open", // open workshop frontage
    roof: true,
    floor: true,
  });
  // Working camp tent off to one side.
  batch.add(f, "/models/tent.glb", 5.0, 0.4, 0, 180, 4);
  // Workbench (bench) + crates/tools (cubes, logs) + an anvil-ish block.
  batch.add(f, "/models/bench.glb", -0.4, -1.0, 0, 90, 1.8);
  batch.add(f, "/models/build_cube.glb", 1.8, 0.6, 0, 15, 1.3); // crate
  batch.add(f, "/models/build_cube.glb", 2.4, 0.2, 0, 40, 0.9); // crate
  batch.add(f, "/models/build_cube.glb", -2.0, 1.2, 0.7, 0, [0.9, 0.7, 1.4]); // anvil block
  batch.add(f, "/models/log.glb", -1.4, 1.8, 0, 70, 1.4);
  batch.add(f, "/models/log.glb", 0.8, 2.0, 0, 20, 1.3);
  batch.add(f, "/models/stone_small.glb", 3.0, 1.6, 0, 0, 1.3);
  batch.flush(app);

  // Warm forge glow.
  accent(app, markers, f, -0.4, -1.0, 1.6, "firepit");
  pushFootprint(colliders, "workshop", f, 3.6, 3.0, WALL_SCALE);
}

/** Library — a quiet reading hall framed by the great tree + stacked books. */
function buildLibrary(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const batch = new KitBatch();
  buildRect(app, batch, f, {
    halfAlong: 3.2,
    halfInto: 2.8,
    wallScale: WALL_SCALE,
    front: "door",
    windowSides: true,
    roof: true,
    floor: true,
  });
  // Columns flanking the doorway.
  batch.add(f, "/models/build_column.glb", -1.6, -3.0, 0, 0, [1, WALL_SCALE, 1]);
  batch.add(f, "/models/build_column.glb", 1.6, -3.0, 0, 0, [1, WALL_SCALE, 1]);
  // Stacked books at the threshold + reading lamps.
  batch.add(f, "/models/books.glb", -1.0, -3.6, 0, 25, 1.6);
  batch.add(f, "/models/books.glb", 1.1, -3.7, 0, -35, 1.4);
  batch.add(f, "/models/lamp.glb", 2.2, -3.4, 0, 0, 1.4);
  batch.flush(app);

  // The great tree of knowledge framing the hall (loaded as its own instance).
  loadModelInstances(app, "/models/tree_knowledge.glb", [
    {
      position: [toWorld(f, -4.4, 1.6).x, 0, toWorld(f, -4.4, 1.6).z],
      yaw: f.faceYaw,
      scale: 5.2,
    },
  ]);

  accent(app, markers, f, 2.2, -3.4, 1.7, "lantern");
  pushFootprint(colliders, "library", f, 3.6, 3.2, WALL_SCALE);
  // Tree trunk collider.
  const tw = toWorld(f, -4.4, 1.6);
  colliders.push({
    id: "library-tree",
    type: "box",
    position: [tw.x, 3.0, tw.z],
    halfExtents: [1.0, 3.0, 1.0],
    rotation: [0, 0, 0],
    role: "prop",
  });
}

/** AI Laboratory — a low glass-walled lab with cool indicator lights + rigs. */
function buildAiLaboratory(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const batch = new KitBatch();
  buildRect(app, batch, f, {
    halfAlong: 3.4,
    halfInto: 2.8,
    wallScale: LOW_WALL_SCALE, // low, modern profile
    front: "door",
    windowSides: true, // "glass" walls
    roof: true,
    floor: true,
  });
  // Corner columns + a central cylinder "core" prototype rig.
  batch.add(f, "/models/build_column.glb", -2.8, -2.6, 0, 0, [0.9, LOW_WALL_SCALE, 0.9]);
  batch.add(f, "/models/build_column.glb", 2.8, -2.6, 0, 0, [0.9, LOW_WALL_SCALE, 0.9]);
  batch.add(f, "/models/build_cylinder.glb", 0, 0.8, 0, 0, [1.1, LOW_WALL_SCALE, 1.1]);
  // Prototype rigs: cubes + a smaller cylinder.
  batch.add(f, "/models/build_cube.glb", -1.8, 0.4, 0, 20, 0.9);
  batch.add(f, "/models/build_cylinder.glb", 1.8, 0.6, 0, 0, [0.6, 1.0, 0.6]);
  batch.flush(app);

  // Tiny emissive "indicator lights" dotted across the rigs (cool palette).
  const indicatorMat = makeMaterial(LAYOUT.marker.coolColor, { emissive: true });
  for (let i = 0; i < 6; i++) {
    const along = -2.4 + i * 0.95;
    const into = -0.4 + (i % 2) * 0.8;
    const w = toWorld(f, along, into);
    addPrimitive(app, "box", indicatorMat, [w.x, 1.1 + (i % 3) * 0.25, w.z], [0.12, 0.12, 0.12]);
  }

  // Cooler accent glow for the energised/inquisitive mood.
  accent(app, markers, f, 0, 0.8, 2.2, "lantern", { cool: true, range: 11 });
  pushFootprint(colliders, "ai-laboratory", f, 3.8, 3.2, LOW_WALL_SCALE);
}

/** Observatory — a raised stone drum + dome topped by the obelisk, on a rise. */
function buildObservatory(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const batch = new KitBatch();
  // Hexagonal stone base / rise.
  batch.add(f, "/models/build_hexagon.glb", 0, 0, 0, 0, [4.0, 1.4, 4.0]);
  // Stone drum on top of the base.
  batch.add(f, "/models/build_cylinder.glb", 0, 0, 1.4, 0, [3.0, 2.2, 3.0]);
  // Charting table (bench + a cube) on the rise, facing the valley.
  batch.add(f, "/models/bench.glb", 2.0, -1.6, 1.5, 90, 1.6);
  batch.add(f, "/models/build_cube.glb", -1.8, -1.4, 1.5, 0, [1.2, 0.6, 0.8]);
  batch.flush(app);

  // Dome (flattened sphere) crowning the drum, with the obelisk as the finial.
  const domeMat = makeMaterial([0.62, 0.66, 0.72]);
  const top = toWorld(f, 0, 0);
  addPrimitive(app, "sphere", domeMat, [top.x, 4.6, top.z], [6.0, 3.4, 6.0]);
  loadModelInstances(app, "/models/obelisk.glb", [
    { position: [top.x, 5.4, top.z], yaw: f.faceYaw, scale: 3.0 },
  ]);

  accent(app, markers, f, 2.0, -1.6, 2.4, "lantern");
  // Tall base collider (the rise + drum).
  pushFootprint(colliders, "observatory", f, 3.6, 3.6, 3.0);
}

/** Lighthouse — a tall stacked tower with a bright warm beacon + a small dock. */
function buildLighthouse(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const batch = new KitBatch();
  // Stacked cylinder drums forming the tapering tower.
  const drums = 5;
  for (let i = 0; i < drums; i++) {
    const y = i * 2.4;
    const r = 2.4 - i * 0.28;
    batch.add(f, "/models/build_cylinder.glb", 0, 0, y, 0, [r, 1.2, r]);
  }
  // Column lantern-room post at the top.
  batch.add(f, "/models/column.glb", 0, 0, drums * 2.4, 0, [1.4, 2.2, 1.4]);
  // A small plank dock reaching toward the water (front, low to the ground).
  for (let k = 0; k < 3; k++) {
    batch.add(f, "/models/build_floor.glb", 0, -3.0 - k * 2.2, 0.05, 0, 2.2);
  }
  batch.flush(app);

  // Bright warm beacon at the top.
  const beaconY = drums * 2.4 + 2.0;
  accent(app, markers, f, 0, 0, beaconY, "firepit", { intensity: 4.0, range: 26 });
  // Tall, narrow tower collider.
  pushFootprint(colliders, "lighthouse", f, 2.6, 2.6, beaconY * 0.5, beaconY * 0.5);
}

/**
 * Build the chapter structure for `id` into the world, emitting its colliders
 * + accent markers, and return a {@link StructureHandle} for its subtle
 * approach highlight. Unknown ids are a safe no-op returning `null` (the
 * checkpoint still fires).
 */
export function buildChapterStructure(
  app: pc.AppBase,
  id: string,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): StructureHandle | null {
  const startMarker = markers.length;
  switch (id) {
    case "workshop":
      buildWorkshop(app, f, colliders, markers);
      break;
    case "library":
      buildLibrary(app, f, colliders, markers);
      break;
    case "ai-laboratory":
      buildAiLaboratory(app, f, colliders, markers);
      break;
    case "observatory":
      buildObservatory(app, f, colliders, markers);
      break;
    case "lighthouse":
      buildLighthouse(app, f, colliders, markers);
      break;
    default:
      return null;
  }
  return makeHighlight(app, id, f, markers, startMarker, id === "ai-laboratory");
}
