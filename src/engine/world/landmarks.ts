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
  { id: "workshop", t: 0.21, offset: 9, radius: 7, marker: "firepit" },
  { id: "library", t: 0.42, offset: -9, radius: 7, marker: "lantern" },
  { id: "ai-laboratory", t: 0.57, offset: 9, radius: 7, marker: "lantern" },
  { id: "observatory", t: 0.72, offset: -10, radius: 7, marker: "lantern" },
  { id: "lighthouse", t: 0.92, offset: 8, radius: 7.5, marker: "firepit" },
];
