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
  yawFromDir,
} from "./shared";
import type { ColliderSpec } from "./types";

/**
 * Structures system: the handcrafted, per-chapter environmental BUILDINGS the
 * player arrives at.
 *
 * Owner-feedback pass: each chapter is now a SINGLE, COMPLETE building model
 * from the curated catalogue (a finished GLB), dropped FLAT on a clean
 * foundation apron and oriented to face the road. STAGE 2 then makes each
 * building DOMINANT (roughly doubled in size) and stages it as a real
 * DESTINATION: a wide paved COURTYARD in front of the entrance, chapter-
 * appropriate props arranged around the court edges, a low fence ring with an
 * open entrance gate, landscaping framing the corners, and lit corner lamps —
 * all composed in the building's frame so the central entrance walkway (paved
 * by the road plaza in {@link ./road}) stays clear.
 *
 * Every structure:
 *  - sits at y≈0 on a subtle flat foundation pad (sized from the building's
 *    footprint) so nothing floats or sinks, with the courtyard pad extending it
 *    in front of the door;
 *  - is oriented so its front faces back toward the path (see
 *    {@link StructureFrame.faceYaw}), with a per-building `yawOffset` tunable
 *    for models whose authored "front" isn't +Z;
 *  - keeps a warm (or, for the AI lab, cool) accent light registered as a
 *    flickering {@link Marker} — the building, not the light, is the landmark;
 *  - emits one box footprint collider so the player can't walk through it.
 *
 * The keep-clear apron radius per chapter ({@link ./landmarks LandmarkSpec.clearRadius})
 * excludes all scatter/foliage/rocks/ruins from the building footprint so the
 * foundation stays clean.
 */

// ---- Tunable building constants ------------------------------------------

/**
 * Per-chapter COMPLETE building model + how it reads in the world. All values
 * are tunable: `scale` sizes the model against the small ~1.7u character;
 * `yawOffset` (deg) rotates a model whose authored front isn't +Z so its
 * entrance faces the road; `halfAlong`/`halfInto` size the footprint collider +
 * foundation pad; `height` sizes the collider's vertical extent.
 */
interface BuildingDef {
  /** Complete building GLB (single, finished model — no kit assembly). */
  url: string;
  /** Uniform scale applied to the model (tunable against the ~1.7u character). */
  scale: number;
  /** Extra yaw (deg) so the model's entrance faces the road. Tunable. */
  yawOffset: number;
  /** Footprint half-size along the path tangent (left-right). */
  halfAlong: number;
  /** Footprint half-size along the depth axis (into the scene). */
  halfInto: number;
  /** Approx building height (world units) for the collider's vertical extent. */
  height: number;
}

/**
 * The chosen complete-building model + scale per chapter. These are the
 * owner-recommended catalogue models; the scales are deliberately exposed here
 * as the single place to tune how big each building reads.
 *
 * STAGE 2 roughly DOUBLED every building so it DOMINATES its surroundings and
 * reads as a real destination towering over the ~1.7u character: the workshop
 * /library/AI-lab are now substantial halls, and the observatory/lighthouse are
 * genuinely tall towers. The `halfAlong`/`halfInto`/`height` were refit to the
 * new visual size so the foundation pad, the footprint collider, and the accent
 * -light heights (all derived from these) stay glued to the model — nothing
 * floats, sinks, or clips.
 */
const BUILDINGS = {
  workshop: {
    url: "/models/bld_c.glb",
    scale: 3.0,
    yawOffset: 0,
    halfAlong: 5.0,
    halfInto: 4.4,
    height: 7.6,
  },
  library: {
    url: "/models/bld_e.glb",
    scale: 3.0,
    yawOffset: 0,
    halfAlong: 5.2,
    halfInto: 4.8,
    height: 8.4,
  },
  "ai-laboratory": {
    url: "/models/bld_l.glb",
    scale: 3.0,
    yawOffset: 0,
    halfAlong: 5.4,
    halfInto: 4.8,
    height: 7.6,
  },
  observatory: {
    url: "/models/bld_tower_a.glb",
    scale: 3.3,
    yawOffset: 0,
    halfAlong: 4.2,
    halfInto: 4.2,
    height: 15.0,
  },
  lighthouse: {
    url: "/models/bld_tower_b.glb",
    scale: 3.7,
    yawOffset: 0,
    halfAlong: 4.0,
    halfInto: 4.0,
    height: 19.0,
  },
} as const satisfies Record<string, BuildingDef>;

/** The Arrival Camp's main shelter model + how it reads (cozy wooden hut). */
const ARRIVAL_HUT: BuildingDef = {
  url: "/models/camp_hut.glb",
  scale: 3.6,
  yawOffset: 0,
  halfAlong: 4.2,
  halfInto: 4.0,
  height: 4.6,
};

/** Lateral/depth margin (world units) the foundation pad extends past the footprint. */
const PAD_MARGIN = 1.4;
/** Foundation pad thickness (a subtle flat apron, just above the ground). */
const PAD_THICKNESS = 0.06;
/** Foundation pad top height above y=0. */
const PAD_Y = 0.03;
/** Clean packed-earth / stone foundation colour. */
const FOUNDATION_COLOR = [0.5, 0.47, 0.42] as const;

// ---- Courtyard staging constants (Stage 2) -------------------------------
//
// Every chapter building now sits at the head of a designed COURTYARD: a wide
// flat paved gathering court in FRONT of the entrance (composed in the
// building's frame, along the tangent × toward the road), ringed by a low fence
// with a GAP/gate at the entrance, lit at its front corners, and framed with a
// little landscaping just outside its corners. All values are tunable here.

/** Courtyard depth (world units) extending from the building's front face toward the road. */
const COURT_DEPTH = 5.4;
/** Courtyard half-width added to the building's half-along (so the court is WIDER than the building). */
const COURT_ALONG_MARGIN = 2.2;
/** Courtyard pad top height (above the foundation pad, just below the road plaza at 0.05). */
const COURT_Y = 0.045;
/** Courtyard pad thickness. */
const COURT_THICKNESS = 0.05;
/** Lightly-paved court colour (a touch lighter than the building foundation). */
const COURT_COLOR = [0.56, 0.53, 0.47] as const;
/** Clear half-width of the entrance walkway at the court's front edge — NO fence/props here. */
const ENTRANCE_GAP_HALF = 2.6;
/** Approx frame-local spacing between fence panels (and their colliders) along an edge. */
const FENCE_PANEL = 1.8;
/** Uniform scale applied to each courtyard fence panel/gate model. */
const FENCE_SCALE = 1.5;
/** Fence collider half-thickness (across the rail) and half-height. */
const FENCE_COLLIDER_T = 0.16;
const FENCE_COLLIDER_H = 0.6;
/** Courtyard fence model + the gate posts flanking the entrance gap. */
const FENCE_MODEL = "/models/fence_wood.glb";
const GATE_MODEL = "/models/fence_gate.glb";
/** Courtyard corner lamp post + its lit accent height. */
const COURT_LAMP_MODEL = "/models/lamp_post.glb";
const COURT_LAMP_Y = 2.6;

// ---- Highlight ------------------------------------------------------------

/**
 * A handle to a chapter structure's SUBTLE interaction highlight.
 *
 * `setHighlight(factor)` ramps the building's accent light + a soft ground glow
 * ring between idle (`0`) and fully highlighted (`1`). The
 * {@link ../InteractionController} eases this factor so the highlight fades in
 * as the player approaches and out as they leave.
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
 * affects are exactly those appended to `markers` since `startMarkerIndex`.
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
    for (let i = 0; i < mine.length; i++) {
      mine[i].baseIntensity = baseIntensity[i] * (1 + HILITE_LIGHT_BOOST * ff);
    }
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

// ---- Frame + placement helpers -------------------------------------------

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
 * Per-URL placement collector so each prop GLB is fetched ONCE and instanced at
 * all its frame-local transforms.
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
 * Lay a clean, subtle flat foundation apron under a building and place the
 * complete building model FLAT on it at y≈0, facing the road. Returns nothing;
 * callers add their own props + accent light + collider around it.
 */
function placeBuilding(
  app: pc.AppBase,
  f: StructureFrame,
  def: BuildingDef,
): void {
  // Clean flat foundation pad (slightly larger than the footprint), oriented
  // to the building so it reads as a deliberate apron rather than scatter.
  addPrimitive(
    app,
    "box",
    makeMaterial(FOUNDATION_COLOR),
    [f.ox, PAD_Y, f.oz],
    [(def.halfAlong + PAD_MARGIN) * 2, PAD_THICKNESS, (def.halfInto + PAD_MARGIN) * 2],
    f.faceYaw,
  );

  // The complete building, flat on the pad, entrance facing the road.
  loadModelInstances(app, def.url, [
    {
      position: [f.ox, 0, f.oz],
      yaw: f.faceYaw + def.yawOffset,
      scale: def.scale,
    },
  ]);
}

// ---- Courtyard staging (Stage 2) -----------------------------------------

/**
 * A chapter prop placed on/around the courtyard, expressed in the building's
 * frame (`along` = path tangent, `into` = depth; NEGATIVE into = toward the
 * road / in front of the building). Optionally carries a solid `collider`.
 */
interface StageProp {
  url: string;
  along: number;
  into: number;
  y?: number;
  /** Extra yaw (deg) on top of the building's faceYaw. */
  yaw?: number;
  scale: number | [number, number, number];
  /** Solid prop collider half-extents [hx, hy, hz]; omit for decorative props. */
  collider?: [number, number, number];
}

/** Decorative landscaping (tree/shrub) placed just OUTSIDE the courtyard. */
interface StagePlant {
  url: string;
  along: number;
  into: number;
  scale: number;
}

/** The composed staging for one chapter building. */
interface StageKit {
  /** Chapter-appropriate props arranged around the court edges. */
  props: StageProp[];
  /** Landscaping framing the building corners (just outside the court). */
  plants: StagePlant[];
  /** Cool (vs warm) courtyard corner lights — used by the AI laboratory. */
  coolLights?: boolean;
}

/**
 * Lay a run of low courtyard fence panels between two frame-local points,
 * orienting each panel to the edge and emitting a `"prop"` collider per panel
 * so the perimeter is solid in the physics world.
 */
function layFenceRun(
  f: StructureFrame,
  a0: number,
  i0: number,
  a1: number,
  i1: number,
  out: Placement[],
  colliders: ColliderSpec[],
  idBase: string,
  startIdx: number,
): number {
  const dA = a1 - a0;
  const dI = i1 - i0;
  const len = Math.hypot(dA, dI);
  if (len < 1e-3) return startIdx;
  const n = Math.max(1, Math.round(len / FENCE_PANEL));
  const step = len / n;
  const ua = dA / len;
  const ui = dI / len;
  // World-space direction of this edge → panel yaw (panel length lies on +Z).
  const dirX = f.alongX * ua + f.intoX * ui;
  const dirZ = f.alongZ * ua + f.intoZ * ui;
  const yaw = yawFromDir(dirX, dirZ);
  let idx = startIdx;
  for (let k = 0; k < n; k++) {
    const a = a0 + ua * step * (k + 0.5);
    const i = i0 + ui * step * (k + 0.5);
    const w = toWorld(f, a, i);
    out.push({ position: [w.x, 0, w.z], yaw, scale: FENCE_SCALE });
    colliders.push({
      id: `${idBase}-fence-${idx++}`,
      type: "box",
      position: [w.x, FENCE_COLLIDER_H, w.z],
      halfExtents: [FENCE_COLLIDER_T, FENCE_COLLIDER_H, step / 2],
      rotation: [0, yaw, 0],
      role: "prop",
    });
  }
  return idx;
}

/**
 * Ring the courtyard with a low fence: both side edges (from the building's
 * front face out to the court's front edge) plus the front edge in two runs
 * leaving a clear ENTRANCE GAP in the middle, with an open `fence_gate` set in
 * that gap. The gate carries NO collider so the on-rails walkway passes
 * straight through it.
 */
function buildCourtFence(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  id: string,
  halfAlong: number,
  backInto: number,
  frontInto: number,
): void {
  const fence: Placement[] = [];
  let idx = 0;
  // Side edges (building front face → court front edge).
  idx = layFenceRun(f, -halfAlong, backInto, -halfAlong, frontInto, fence, colliders, id, idx);
  idx = layFenceRun(f, halfAlong, backInto, halfAlong, frontInto, fence, colliders, id, idx);
  // Front edge in two runs, leaving the entrance gap open in the centre.
  idx = layFenceRun(f, -halfAlong, frontInto, -ENTRANCE_GAP_HALF, frontInto, fence, colliders, id, idx);
  layFenceRun(f, ENTRANCE_GAP_HALF, frontInto, halfAlong, frontInto, fence, colliders, id, idx);
  loadModelInstances(app, FENCE_MODEL, fence);

  // Open gate centred in the entrance gap, oriented ACROSS the walkway.
  const gw = toWorld(f, 0, frontInto);
  loadModelInstances(app, GATE_MODEL, [
    {
      position: [gw.x, 0, gw.z],
      yaw: yawFromDir(f.alongX, f.alongZ),
      scale: FENCE_SCALE,
    },
  ]);
}

/**
 * Compose the full COURTYARD staging in front of a building: a wide paved court
 * pad, the chapter props arranged around its edges (each solid prop emitting a
 * collider), landscaping framing the corners just outside it, a low fence ring
 * with an open entrance gate, and two lit corner lamp posts (registered as
 * flickering markers). Everything is laid in the building's frame so it sits on
 * the flat apron and the central entrance walkway stays clear.
 */
function stageCourtyard(
  app: pc.AppBase,
  f: StructureFrame,
  def: BuildingDef,
  colliders: ColliderSpec[],
  markers: Marker[],
  id: string,
  kit: StageKit,
): void {
  const halfAlong = def.halfAlong + COURT_ALONG_MARGIN;
  const backInto = -def.halfInto; // building front face
  const frontInto = -(def.halfInto + COURT_DEPTH); // court front edge (toward road)

  // 1) Paved courtyard pad in FRONT of the building entrance.
  const cInto = -(def.halfInto + COURT_DEPTH / 2);
  const cw = toWorld(f, 0, cInto);
  addPrimitive(
    app,
    "box",
    makeMaterial(COURT_COLOR),
    [cw.x, COURT_Y, cw.z],
    [halfAlong * 2, COURT_THICKNESS, COURT_DEPTH],
    f.faceYaw,
  );

  // 2) Chapter props + landscaping + corner lamp posts (one batch per URL).
  const batch = new KitBatch();
  for (const p of kit.props) {
    batch.add(f, p.url, p.along, p.into, p.y ?? 0, p.yaw ?? 0, p.scale);
  }
  for (const pl of kit.plants) {
    batch.add(f, pl.url, pl.along, pl.into, 0, 0, pl.scale);
  }
  batch.add(f, COURT_LAMP_MODEL, -halfAlong, frontInto, 0, 0, FENCE_SCALE);
  batch.add(f, COURT_LAMP_MODEL, halfAlong, frontInto, 0, 0, FENCE_SCALE);
  batch.flush(app);

  // Solid prop colliders (decorative plants/lamps get none).
  let ci = 0;
  for (const p of kit.props) {
    if (!p.collider) continue;
    const w = toWorld(f, p.along, p.into);
    colliders.push({
      id: `${id}-prop-${ci++}`,
      type: "box",
      position: [w.x, p.collider[1], w.z],
      halfExtents: p.collider,
      rotation: [0, f.faceYaw + (p.yaw ?? 0), 0],
      role: "prop",
    });
  }

  // 3) Low fence ring with an open entrance gate.
  buildCourtFence(app, f, colliders, id, halfAlong, backInto, frontInto);

  // 4) Two lit corner lamps at the court's front corners (markers).
  accent(app, markers, f, -halfAlong, frontInto, COURT_LAMP_Y, "lantern", {
    cool: kit.coolLights,
    range: 11,
  });
  accent(app, markers, f, halfAlong, frontInto, COURT_LAMP_Y, "lantern", {
    cool: kit.coolLights,
    range: 11,
  });
}

// ---- Per-chapter structure builders --------------------------------------

/**
 * Arrival Camp — a cozy wooden camp: the complete `camp_hut` shelter on a clean
 * pad, with a canvas tent, a fire pit, and a bedroll arranged AROUND it (never
 * overlapping), plus a warm lantern glow. Exported so the spawn camp
 * ({@link ./spawn}) can drop it beside the existing campfire/benches. Emits one
 * footprint collider.
 */
export function buildArrivalCabin(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): StructureHandle {
  const startMarker = markers.length;
  const def = ARRIVAL_HUT;
  placeBuilding(app, f, def);

  const sa = def.halfAlong;
  const si = def.halfInto;

  // Cozy, lived-in camp dressing arranged on the apron AROUND the hut (clear of
  // it and clear of the doorway), so the spawn point reads as a real little
  // settlement the player is happy to start in.
  const batch = new KitBatch();
  // Canvas tents flanking the hut.
  batch.add(f, "/models/camp_tent.glb", sa + 2.4, 0.6, 0, 20, 2.4);
  batch.add(f, "/models/camp_tent_canvas.glb", -(sa + 2.4), 1.4, 0, -25, 2.2);
  // A decorative fire pit + bedrolls just in front of the hut doorway.
  batch.add(f, "/models/campfire_pit.glb", -1.8, -(si + 1.4), 0, 0, 1.8);
  batch.add(f, "/models/bedroll.glb", 1.8, -(si + 1.2), 0, 10, 1.7);
  batch.add(f, "/models/bedroll.glb", 2.8, -(si + 2.0), 0, -15, 1.7);
  // Stores: a woodpile, barrels, a crate, a chest and a signpost around the edges.
  batch.add(f, "/models/woodpile.glb", sa + 1.8, -(si + 1.0), 0, 70, 1.6);
  batch.add(f, "/models/log_pile.glb", sa + 2.0, -(si + 2.6), 0, 70, 1.5);
  batch.add(f, "/models/barrel.glb", -(sa + 1.6), -(si + 1.0), 0, 0, 1.4);
  batch.add(f, "/models/barrel_open.glb", -(sa + 2.2), -(si + 0.4), 0, 0, 1.3);
  batch.add(f, "/models/crate.glb", -(sa + 1.4), -(si + 2.4), 0, 20, 1.4);
  batch.add(f, "/models/chest.glb", 1.4, si + 1.4, 0, 180, 1.4);
  batch.add(f, "/models/signpost_s.glb", -(sa + 0.6), -(si + 3.6), 0, 30, 1.7);
  batch.flush(app);

  // Solid camp props get small prop colliders (decorative tents/bedrolls/sign
  // do not) so the player can brush them consistently with the physics world.
  const solids: Array<{ along: number; into: number; half: [number, number, number]; yaw: number }> = [
    { along: sa + 1.8, into: -(si + 1.0), half: [0.9, 0.5, 0.5], yaw: 70 },
    { along: sa + 2.0, into: -(si + 2.6), half: [0.9, 0.5, 0.5], yaw: 70 },
    { along: -(sa + 1.6), into: -(si + 1.0), half: [0.5, 0.7, 0.5], yaw: 0 },
    { along: -(sa + 1.4), into: -(si + 2.4), half: [0.5, 0.5, 0.5], yaw: 20 },
  ];
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    const w = toWorld(f, s.along, s.into);
    colliders.push({
      id: `arrival-prop-${i}`,
      type: "box",
      position: [w.x, s.half[1], w.z],
      halfExtents: s.half,
      rotation: [0, f.faceYaw + s.yaw, 0],
      role: "prop",
    });
  }

  // Warm lantern glow at the hut's doorway, sized to the bigger hut.
  accent(app, markers, f, 2.2, -(si + 0.6), 2.0, "lantern");
  pushFootprint(colliders, "arrival-camp", f, sa, si, def.height / 2, def.height / 2);
  return makeHighlight(app, "arrival-camp", f, markers, startMarker, false);
}

/** Workshop — a dominant industrial hall fronted by a working courtyard. */
function buildWorkshop(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const def = BUILDINGS.workshop;
  placeBuilding(app, f, def);

  const sa = def.halfAlong;
  const si = def.halfInto;
  const ca = sa + COURT_ALONG_MARGIN; // court half-along
  const front = -(si + COURT_DEPTH); // court front edge (toward road)

  // Working props arranged around the court edges (clear of the building + the
  // central entrance walkway). Left edge = a workbench line; right edge =
  // timber; the front corners hold crates/barrels/pallets.
  stageCourtyard(app, f, def, colliders, markers, "workshop", {
    props: [
      // Left-edge workbench line (facing into the court).
      { url: "/models/workbench.glb", along: -(ca - 0.8), into: -(si + 1.2), yaw: 90, scale: 1.7, collider: [1.0, 0.5, 0.5] },
      { url: "/models/workbench_anvil.glb", along: -(ca - 0.8), into: -(si + 3.4), yaw: 90, scale: 1.6, collider: [1.0, 0.6, 0.5] },
      { url: "/models/workbench_grind.glb", along: -(ca - 0.8), into: -(si + 4.8), yaw: 90, scale: 1.6, collider: [0.9, 0.6, 0.5] },
      { url: "/models/tool_hammer.glb", along: -(ca - 1.0), into: -(si + 1.2), y: 1.0, yaw: 40, scale: 1.2 },
      { url: "/models/tool_axe.glb", along: -(ca - 1.4), into: -(si + 4.8), y: 0.9, yaw: -30, scale: 1.2 },
      // Right-edge timber stacks.
      { url: "/models/woodpile.glb", along: ca - 0.8, into: -(si + 1.6), yaw: 90, scale: 1.7, collider: [1.1, 0.5, 0.5] },
      { url: "/models/log_pile.glb", along: ca - 0.8, into: -(si + 3.4), yaw: 90, scale: 1.6, collider: [1.1, 0.5, 0.5] },
      { url: "/models/planks_stack.glb", along: ca - 1.0, into: -(si + 4.8), yaw: 90, scale: 1.5, collider: [0.9, 0.4, 0.5] },
      // Front-corner crates / barrels / pallet (off the central walkway).
      { url: "/models/crate_large.glb", along: 4.2, into: front + 0.8, yaw: 20, scale: 1.6, collider: [0.7, 0.7, 0.7] },
      { url: "/models/crate.glb", along: 3.1, into: front + 0.7, yaw: -15, scale: 1.4, collider: [0.5, 0.5, 0.5] },
      { url: "/models/barrel.glb", along: -3.4, into: front + 0.8, yaw: 0, scale: 1.4, collider: [0.5, 0.7, 0.5] },
      { url: "/models/pallet.glb", along: -4.6, into: front + 0.9, yaw: 25, scale: 1.5 },
    ],
    plants: [
      { url: "/models/tree_big.glb", along: -(ca + 1.6), into: front - 1.2, scale: 3.0 },
      { url: "/models/tree_pine_big.glb", along: ca + 1.6, into: front - 1.2, scale: 3.2 },
      { url: "/models/shrub.glb", along: -(ca + 1.4), into: si + 2.0, scale: 1.6 },
      { url: "/models/shrub.glb", along: ca + 1.4, into: si + 2.0, scale: 1.6 },
    ],
  });

  // Warm forge glow beside the workbench line.
  accent(app, markers, f, -(ca - 0.8), -(si + 3.4), 1.8, "firepit", { range: 9 });
  pushFootprint(colliders, "workshop", f, sa, si, def.height / 2, def.height / 2);
}

/** Library — a stately hall fronted by a reading courtyard (books/benches/lamps). */
function buildLibrary(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const def = BUILDINGS.library;
  placeBuilding(app, f, def);

  const sa = def.halfAlong;
  const si = def.halfInto;
  const ca = sa + COURT_ALONG_MARGIN;
  const front = -(si + COURT_DEPTH);

  stageCourtyard(app, f, def, colliders, markers, "library", {
    props: [
      // Stacked books flanking the doorway (on the apron, off the walkway).
      { url: "/models/books.glb", along: -3.2, into: -(si + 1.0), yaw: 25, scale: 1.7 },
      { url: "/models/books.glb", along: 3.0, into: -(si + 1.1), yaw: -35, scale: 1.5 },
      // Reading benches lining the side edges, facing into the court.
      { url: "/models/bench_park.glb", along: -(ca - 0.9), into: -(si + 2.6), yaw: 90, scale: 1.6, collider: [1.0, 0.4, 0.4] },
      { url: "/models/bench_park.glb", along: -(ca - 0.9), into: -(si + 5.0), yaw: 90, scale: 1.6, collider: [1.0, 0.4, 0.4] },
      { url: "/models/bench_park.glb", along: ca - 0.9, into: -(si + 2.6), yaw: -90, scale: 1.6, collider: [1.0, 0.4, 0.4] },
      { url: "/models/bench_park.glb", along: ca - 0.9, into: -(si + 5.0), yaw: -90, scale: 1.6, collider: [1.0, 0.4, 0.4] },
      // A double lamp post lighting the reading court.
      { url: "/models/lamp_post_double.glb", along: 0, into: front + 1.0, yaw: 0, scale: 1.6 },
    ],
    plants: [
      { url: "/models/tree_big.glb", along: -(ca + 1.6), into: front - 1.2, scale: 3.2 },
      { url: "/models/tree_big.glb", along: ca + 1.6, into: front - 1.2, scale: 3.2 },
      { url: "/models/shrub.glb", along: -(ca + 1.2), into: -(si + 1.0), scale: 1.7 },
      { url: "/models/shrub.glb", along: ca + 1.2, into: -(si + 1.0), scale: 1.7 },
      { url: "/models/flower_yellow.glb", along: -2.6, into: front + 0.6, scale: 1.4 },
      { url: "/models/flower_yellow.glb", along: 2.6, into: front + 0.6, scale: 1.4 },
    ],
  });

  // Calm lantern glow at the threshold.
  accent(app, markers, f, sa + 0.6, -(si + 0.8), 3.0, "lantern");
  pushFootprint(colliders, "library", f, sa, si, def.height / 2, def.height / 2);
}

/** AI Laboratory — a modern dominant block with a cool, fenced tech courtyard. */
function buildAiLaboratory(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const def = BUILDINGS["ai-laboratory"];
  placeBuilding(app, f, def);

  const sa = def.halfAlong;
  const si = def.halfInto;
  const ca = sa + COURT_ALONG_MARGIN;
  const front = -(si + COURT_DEPTH);

  stageCourtyard(app, f, def, colliders, markers, "ai-laboratory", {
    coolLights: true,
    props: [
      // Equipment crates / barrels lining the side edges.
      { url: "/models/crate.glb", along: ca - 0.9, into: -(si + 1.4), yaw: 0, scale: 1.4, collider: [0.5, 0.5, 0.5] },
      { url: "/models/crate_large.glb", along: ca - 0.9, into: -(si + 3.2), yaw: 10, scale: 1.5, collider: [0.7, 0.7, 0.7] },
      { url: "/models/barrel.glb", along: ca - 1.0, into: -(si + 5.0), yaw: 0, scale: 1.3, collider: [0.5, 0.7, 0.5] },
      { url: "/models/crate.glb", along: -(ca - 0.9), into: -(si + 1.4), yaw: 0, scale: 1.4, collider: [0.5, 0.5, 0.5] },
      { url: "/models/chest.glb", along: -(ca - 0.9), into: -(si + 3.2), yaw: -10, scale: 1.4, collider: [0.6, 0.4, 0.4] },
    ],
    plants: [
      { url: "/models/shrub.glb", along: -(ca + 1.4), into: front - 1.0, scale: 1.8 },
      { url: "/models/shrub.glb", along: ca + 1.4, into: front - 1.0, scale: 1.8 },
      { url: "/models/s_tree_tall.glb", along: -(ca + 1.6), into: si + 1.6, scale: 3.0 },
      { url: "/models/s_tree_tall.glb", along: ca + 1.6, into: si + 1.6, scale: 3.0 },
    ],
  });

  // A row of cool emissive "indicator lights" lining the front of the lab on
  // the apron, just clear of the wall (decorative — no colliders).
  const indicatorMat = makeMaterial(LAYOUT.marker.coolColor, { emissive: true });
  for (let i = 0; i < 7; i++) {
    const along = -3.0 + i * 1.0;
    const w = toWorld(f, along, -(si + 0.5));
    addPrimitive(app, "box", indicatorMat, [w.x, 0.7 + (i % 3) * 0.25, w.z], [0.14, 0.14, 0.14]);
  }

  // Cooler accent glow at the threshold for the energised/inquisitive mood.
  accent(app, markers, f, 0, -(si + 0.8), 2.6, "lantern", { cool: true, range: 12 });
  pushFootprint(colliders, "ai-laboratory", f, sa, si, def.height / 2, def.height / 2);
}

/** Observatory — a tall tower fronted by a charting courtyard with a low wall. */
function buildObservatory(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const def = BUILDINGS.observatory;
  placeBuilding(app, f, def);

  const sa = def.halfAlong;
  const si = def.halfInto;
  const ca = sa + COURT_ALONG_MARGIN;
  const front = -(si + COURT_DEPTH);

  stageCourtyard(app, f, def, colliders, markers, "observatory", {
    props: [
      // Charting benches + a crate of instruments facing the valley (the road).
      { url: "/models/bench_park.glb", along: -(ca - 0.9), into: -(si + 2.4), yaw: 90, scale: 1.6, collider: [1.0, 0.4, 0.4] },
      { url: "/models/bench_park.glb", along: ca - 0.9, into: -(si + 2.4), yaw: -90, scale: 1.6, collider: [1.0, 0.4, 0.4] },
      { url: "/models/crate.glb", along: -3.4, into: front + 0.8, yaw: 10, scale: 1.4, collider: [0.5, 0.5, 0.5] },
      { url: "/models/barrel.glb", along: 3.4, into: front + 0.8, yaw: 0, scale: 1.3, collider: [0.5, 0.7, 0.5] },
      { url: "/models/obelisk.glb", along: ca - 1.0, into: -(si + 4.6), yaw: 0, scale: 1.6, collider: [0.5, 1.2, 0.5] },
    ],
    plants: [
      { url: "/models/tree_pine_big.glb", along: -(ca + 1.6), into: front - 1.0, scale: 3.2 },
      { url: "/models/tree_pine_big.glb", along: ca + 1.6, into: front - 1.0, scale: 3.2 },
      { url: "/models/shrub.glb", along: -(ca + 1.2), into: si + 1.6, scale: 1.6 },
      { url: "/models/shrub.glb", along: ca + 1.2, into: si + 1.6, scale: 1.6 },
    ],
  });

  accent(app, markers, f, sa + 0.6, -(si + 0.6), 2.6, "lantern");
  pushFootprint(colliders, "observatory", f, sa, si, def.height / 2, def.height / 2);
}

/**
 * Lighthouse — the tallest tower, crowned with a bright warm BEACON point light
 * at its top, fronted by a small harbour-style courtyard (barrels, crates, a
 * bench, a low fence). No literal lighthouse model exists; a clean tall tower +
 * beacon reads better than a fragile assembly.
 */
function buildLighthouse(
  app: pc.AppBase,
  f: StructureFrame,
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const def = BUILDINGS.lighthouse;
  placeBuilding(app, f, def);

  const sa = def.halfAlong;
  const si = def.halfInto;
  const ca = sa + COURT_ALONG_MARGIN;
  const front = -(si + COURT_DEPTH);

  stageCourtyard(app, f, def, colliders, markers, "lighthouse", {
    props: [
      // Harbour barrels + crates at the foot of the tower.
      { url: "/models/barrel.glb", along: ca - 1.0, into: -(si + 1.6), yaw: 0, scale: 1.4, collider: [0.5, 0.7, 0.5] },
      { url: "/models/barrel.glb", along: ca - 1.4, into: -(si + 2.8), yaw: 0, scale: 1.3, collider: [0.5, 0.6, 0.5] },
      { url: "/models/barrel_open.glb", along: -(ca - 1.0), into: -(si + 1.6), yaw: 0, scale: 1.4, collider: [0.5, 0.6, 0.5] },
      { url: "/models/crate.glb", along: -(ca - 1.2), into: -(si + 3.0), yaw: 15, scale: 1.4, collider: [0.5, 0.5, 0.5] },
      { url: "/models/bench.glb", along: 0, into: front + 1.0, yaw: 0, scale: 1.6, collider: [1.0, 0.4, 0.4] },
    ],
    plants: [
      { url: "/models/tree_pine_big.glb", along: -(ca + 1.6), into: front - 1.0, scale: 3.0 },
      { url: "/models/shrub.glb", along: ca + 1.4, into: front - 1.0, scale: 1.8 },
      { url: "/models/shrub.glb", along: -(ca + 1.2), into: si + 1.6, scale: 1.6 },
    ],
  });

  // Bright warm beacon at the top of the (now much taller) tower.
  const beaconY = def.height + 0.6;
  accent(app, markers, f, 0, 0, beaconY, "firepit", { intensity: 4.5, range: 32 });
  pushFootprint(colliders, "lighthouse", f, sa, si, def.height / 2, def.height / 2);
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
