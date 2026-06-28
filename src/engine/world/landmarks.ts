/**
 * Pure layout DATA for the narrative vertical slice.
 *
 * This module never imports `playcanvas` — it only describes WHERE things go in
 * terms of the journey path (parameter `t` along the spline + a lateral offset)
 * and WHICH chapter structure composes each landmark. It deliberately holds NO
 * human-readable copy: every title, question, and dialogue line lives in
 * `content/chapters.json` and is matched to a placement by its `id`. `buildWorld`
 * reads this data, samples the path, asks {@link ./structures} to build the
 * chapter's environmental BUILDING + props + colliders, and sources all
 * narrative copy from the loaded chapter content.
 *
 * Keeping placement data separate from content keeps the scene easy to re-stage
 * and lets a replaced `content/` folder completely re-personalise the journey.
 */

/**
 * Path control points (XZ) defining the gently winding journey ribbon.
 *
 * Pass 2 extended the ribbon (was ~110u long, now ~215u) so the five
 * along-path chapters are well spaced and the player keeps discovering a
 * structure / signpost as they walk, without sprawling into an open world. The
 * ground plane + sky centre (LAYOUT.ground / LAYOUT.atmosphere) were widened to
 * match so nothing floats off the meadow. On-rails movement auto-adapts to the
 * new path length.
 */
export const PATH_CONTROL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -8], // pre-spawn lead-in (clamped endpoint shaping)
  [0, 0], // spawn clearing centre
  [-9, 20], // first bend (hides the workshop until you round it)
  [8, 42], // approach to the river crossing / bridge
  [-6, 64], // bend past the bridge toward the library
  [11, 88], // climb toward the AI laboratory
  [-10, 112], // bend toward the observatory rise
  [6, 136], // observatory shoulder
  [-4, 160], // final bend
  [0, 184], // far end near the lighthouse + water
];

/**
 * Parameter `t` along the path where the winding river crosses and the bridge
 * sits. The river spline is forced to pass through the path point here so the
 * crossing always lines up. It falls between the Workshop (≈0.21) and the
 * Library (≈0.42) — an early, coherent crossing.
 */
export const BRIDGE_CROSSING_T = 0.31;

/**
 * River control points (XZ). The MIDDLE entry is a placeholder that buildWorld
 * overwrites with the exact path crossing point so the bridge always spans the
 * water. The river runs roughly east-west, winding in Z; retuned in pass 2 so
 * it threads through the new crossing position (~z=37).
 */
export const RIVER_CONTROL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-50, 40],
  [-28, 30],
  [-12, 36],
  [0, 0], // <- replaced at build time with the path crossing point
  [18, 30],
  [34, 40],
  [50, 30],
];

/** Where the player spawns (path parameter + facing down the path). */
export const SPAWN_T = 0.12;

/** How a checkpoint marker should read in the world (the warm accent light). */
export type MarkerKind = "lantern" | "firepit";

/**
 * A narrative landmark PLACEMENT + its checkpoint trigger. Holds layout data
 * only — NO narrative copy and NO model list: the matching chapter STRUCTURE is
 * built by {@link ./structures} keyed on `id`, and the title/question/dialogue
 * is looked up from `content/chapters.json` by the same `id`.
 */
export interface LandmarkSpec {
  /**
   * Stable id. MUST match a chapter `id` in `content/chapters.json` so the
   * world can source this landmark's title/dialogue from content AND select the
   * matching structure builder in {@link ./structures}.
   */
  id: string;
  /** Path parameter [0,1] where the structure anchor sits. */
  t: number;
  /**
   * Lateral offset from the path centreline along the path normal.
   * Positive = right of travel, negative = left. Keeps the structure just off
   * the path so it frames the journey while the player arrives at its door.
   */
  offset: number;
  /** Checkpoint trigger radius (world units). */
  radius: number;
  /** Environment-integrated checkpoint accent light style. */
  marker: MarkerKind;
  /**
   * Radius (world units) of the KEEP-CLEAR apron around the structure anchor.
   * Scatter/foliage/waypoint systems skip any placement falling inside this
   * radius so the building reads with a clean ground apron and nothing
   * intersects or crowds it. Sized to the structure's footprint + its own props
   * (e.g. the workshop tent, the library's great tree) plus a small margin.
   */
  clearRadius: number;
}

/**
 * The narrative landmark PLACEMENTS for the FIVE along-path chapters, ordered
 * by increasing distance along the path (arrival-camp is the spawn camp, built
 * by {@link ./spawn}). Each `id` matches a chapter id in
 * `content/chapters.json`, from which the world sources the title/dialogue, and
 * a structure builder in {@link ./structures}, which composes the building.
 *
 * Spacing: chapters sit ~0.12–0.16 of the path apart (~26–34 world units, a
 * comfortable walk) with incidental signposts/ruins ({@link ./waypoints})
 * dressing the gaps so the route is never empty. WALK_SPEED (controller) and
 * the path length are the tunables to dial the discovery cadence.
 */
export const LANDMARKS: readonly LandmarkSpec[] = [
  { id: "workshop", t: 0.21, offset: 9, radius: 7, marker: "firepit", clearRadius: 9.5 },
  { id: "library", t: 0.42, offset: -9, radius: 7, marker: "lantern", clearRadius: 10 },
  { id: "ai-laboratory", t: 0.57, offset: 9, radius: 7, marker: "lantern", clearRadius: 9 },
  { id: "observatory", t: 0.72, offset: -10, radius: 7, marker: "lantern", clearRadius: 9 },
  { id: "lighthouse", t: 0.92, offset: 8, radius: 7.5, marker: "firepit", clearRadius: 9 },
];

/**
 * Spawn-camp layout anchors (single source of truth, shared by {@link ./spawn}
 * and the keep-clear computation below so the camp dressing, the arrival cabin,
 * and the scatter exclusion all agree on WHERE the camp pieces sit).
 */
/** Path parameter at the heart of the spawn clearing (campfire + cabin anchor). */
export const SPAWN_CLEARING_T = 0.05;
/** Campfire offset from the clearing centre (camp heart). */
export const SPAWN_FIRE_OFFSET = { x: -3.2, z: 1.5 } as const;
/** Lateral offset (right of travel) of the arrival cabin from the clearing. */
export const ARRIVAL_CABIN_OFFSET = 7.5;
/** Keep-clear apron radius around the arrival cabin. */
export const ARRIVAL_CABIN_CLEAR_RADIUS = 8;
/** Keep-clear apron radius around the campfire/camp heart. */
export const SPAWN_CAMP_CLEAR_RADIUS = 7.5;

/**
 * A circular ground exclusion zone around a structure anchor. Scatter and
 * foliage systems skip any placement whose XZ position falls inside it, giving
 * every building a clean apron of ground.
 */
export interface KeepClearZone {
  /** Stable id (e.g. the chapter id, "arrival-camp", or "spawn-camp"). */
  id: string;
  /** Zone centre on the XZ ground plane. */
  x: number;
  z: number;
  /** Exclusion radius (world units). */
  radius: number;
}

/**
 * The minimal path-sampling surface the keep-clear computation needs. Declared
 * structurally so this DATA module stays free of any `playcanvas` import (the
 * real {@link ./path Path} satisfies it).
 */
interface PathLike {
  sample(t: number): {
    position: { x: number; z: number };
    tangent: { x: number; z: number };
  };
}

/**
 * Compute the shared list of keep-clear zones from the SAME path samples +
 * offsets the structures are built from, so the exclusion can never drift out
 * of sync with the buildings. Covers the five along-path chapter structures,
 * the arrival cabin, and the campfire/camp heart.
 *
 * Consumed by {@link ./nature}, {@link ./waypoints}, {@link ./spawn} (camp
 * foliage), and {@link ./river} (bank foliage) so no grass/bush/tree/rock/prop
 * intersects or crowds a building.
 */
export function computeKeepClearZones(path: PathLike): KeepClearZone[] {
  const zones: KeepClearZone[] = [];

  // Five along-path chapter structures (anchor = path point + lateral offset).
  for (const lm of LANDMARKS) {
    const s = path.sample(lm.t);
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;
    zones.push({
      id: lm.id,
      x: s.position.x + rightX * lm.offset,
      z: s.position.z + rightZ * lm.offset,
      radius: lm.clearRadius,
    });
  }

  // Arrival cabin off the spawn clearing's right shoulder + the camp heart.
  const cs = path.sample(SPAWN_CLEARING_T);
  const rightX = cs.tangent.z;
  const rightZ = -cs.tangent.x;
  zones.push({
    id: "arrival-camp",
    x: cs.position.x + rightX * ARRIVAL_CABIN_OFFSET,
    z: cs.position.z + rightZ * ARRIVAL_CABIN_OFFSET,
    radius: ARRIVAL_CABIN_CLEAR_RADIUS,
  });
  zones.push({
    id: "spawn-camp",
    x: cs.position.x + SPAWN_FIRE_OFFSET.x,
    z: cs.position.z + SPAWN_FIRE_OFFSET.z,
    radius: SPAWN_CAMP_CLEAR_RADIUS,
  });

  return zones;
}

/**
 * True if XZ point (x,z) falls inside ANY keep-clear zone. Optionally exclude
 * zones by id (e.g. the spawn camp's own foliage excludes the "spawn-camp"
 * zone so it can still dress around its own fire).
 */
export function isInKeepClear(
  x: number,
  z: number,
  zones: readonly KeepClearZone[],
  excludeIds?: ReadonlySet<string>,
): boolean {
  for (const zone of zones) {
    if (excludeIds?.has(zone.id)) continue;
    const dx = x - zone.x;
    const dz = z - zone.z;
    if (dx * dx + dz * dz < zone.radius * zone.radius) return true;
  }
  return false;
}
