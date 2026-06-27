/**
 * Pure layout DATA for the narrative vertical slice.
 *
 * This module never imports `playcanvas` — it only describes WHERE things go in
 * terms of the journey path (parameter `t` along the spline + a lateral offset)
 * and WHAT copy each landmark shows. `buildWorld` reads this data, samples the
 * path, and instantiates the actual GLB entities + colliders.
 *
 * Keeping placement data separate from engine code keeps the scene easy to
 * re-stage and lets future passes (physics, content authoring) reuse it.
 */

/** Path control points (XZ) defining the gently winding S-curve journey. */
export const PATH_CONTROL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -8], // pre-spawn lead-in (clamped endpoint shaping)
  [0, 0], // spawn clearing centre
  [-7, 13], // first bend (hides the Tree of Knowledge until you round it)
  [5, 25], // approach to the river crossing / bridge
  [-6, 39], // bend past the workshop
  [7, 53], // climb toward the observatory
  [-3, 67], // final bend
  [0, 80], // far end near the lighthouse
];

/**
 * Parameter `t` along the path where the winding river crosses and the bridge
 * sits. The river spline is forced to pass through the path point here so the
 * crossing always lines up.
 */
export const BRIDGE_CROSSING_T = 0.42;

/**
 * River control points (XZ). The MIDDLE entry is a placeholder that buildWorld
 * overwrites with the exact path crossing point so the bridge always spans the
 * water. The river runs roughly east-west, winding in Z.
 */
export const RIVER_CONTROL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-46, 34],
  [-26, 24],
  [-10, 30],
  [0, 0], // <- replaced at build time with the path crossing point
  [16, 22],
  [32, 30],
  [48, 20],
];

/** Where the player spawns (path parameter + facing down the path). */
export const SPAWN_T = 0.16;

/** A model placed relative to a landmark anchor, in world-space offsets. */
export interface LandmarkModel {
  url: string;
  /** Offset from the landmark anchor in world units: [x, y, z]. */
  offset: [number, number, number];
  /** Y-axis rotation in degrees added to the landmark's facing. */
  yaw: number;
  /** Uniform scale. */
  scale: number;
}

/** How a checkpoint marker should read in the world. */
export type MarkerKind = "lantern" | "firepit";

/** A narrative landmark + its checkpoint trigger and collider footprint. */
export interface LandmarkSpec {
  id: string;
  /** Speaker / title shown in the dialogue box. */
  name: string;
  /** Short placeholder dialogue line. */
  line: string;
  /** Path parameter [0,1] where the landmark anchor sits. */
  t: number;
  /**
   * Lateral offset from the path centreline along the path normal.
   * Positive = right of travel, negative = left. Keeps landmarks just off the
   * path so they frame the journey without blocking it.
   */
  offset: number;
  /** GLB models composing the landmark, placed around its anchor. */
  models: LandmarkModel[];
  /** Checkpoint trigger radius (world units). */
  radius: number;
  /** Environment-integrated checkpoint marker. */
  marker: MarkerKind;
  /**
   * Optional solid base/blocker footprint for the later physics pass. Box is
   * centred on the landmark anchor (plus yOffset) with these half-extents.
   */
  collider?: {
    halfExtents: [number, number, number];
    yOffset?: number;
  } | null;
}

/**
 * The four narrative landmarks, ordered by increasing distance along the path.
 * Scales push the ~1-unit Kenney kit models up to landmark silhouettes that
 * read against the ~1.7u-tall player.
 */
export const LANDMARKS: readonly LandmarkSpec[] = [
  {
    id: "tree-of-knowledge",
    name: "The Tree of Knowledge",
    line: "The Tree of Knowledge — your skills will grow tall here.",
    t: 0.24,
    offset: -8,
    radius: 6.5,
    marker: "lantern",
    models: [
      { url: "/models/tree_knowledge.glb", offset: [0, 0, 0], yaw: 0, scale: 5.5 },
      { url: "/models/books.glb", offset: [1.6, 0, 1.2], yaw: 25, scale: 1.6 },
      { url: "/models/books.glb", offset: [-1.4, 0, 0.8], yaw: -40, scale: 1.4 },
    ],
    collider: { halfExtents: [1.1, 3.0, 1.1], yOffset: 3.0 },
  },
  {
    id: "workshop",
    name: "The Workshop",
    line: "The Workshop — where ideas are hammered into things that work.",
    t: 0.5,
    offset: 8,
    radius: 6.5,
    marker: "firepit",
    models: [
      { url: "/models/tent.glb", offset: [0, 0, 0], yaw: 200, scale: 4 },
      { url: "/models/bench.glb", offset: [3, 0, -2], yaw: 90, scale: 1.8 },
      { url: "/models/rock_small.glb", offset: [-2.6, 0, 1.5], yaw: 0, scale: 1.5 },
    ],
    collider: { halfExtents: [2.2, 1.4, 2.2], yOffset: 1.4 },
  },
  {
    id: "observatory",
    name: "The Observatory",
    line: "The Observatory — for charting where the work goes next.",
    t: 0.72,
    offset: -9,
    radius: 6.5,
    marker: "lantern",
    models: [
      { url: "/models/rock_large.glb", offset: [0, 0, 0], yaw: 0, scale: 2.6 },
      { url: "/models/obelisk.glb", offset: [0, 1.6, 0], yaw: 0, scale: 3.2 },
    ],
    collider: { halfExtents: [1.6, 3.5, 1.6], yOffset: 3.5 },
  },
  {
    id: "lighthouse",
    name: "The Lighthouse",
    line: "The Lighthouse — a steady signal for collaborators to find.",
    t: 0.95,
    offset: 7,
    radius: 7,
    marker: "firepit",
    models: [
      { url: "/models/rock_large.glb", offset: [0, 0, 0], yaw: 0, scale: 2.4 },
      { url: "/models/column.glb", offset: [0, 1.2, 0], yaw: 0, scale: 6 },
    ],
    collider: { halfExtents: [1.4, 4.5, 1.4], yOffset: 4.5 },
  },
];

/** The NPC greeter's welcome copy (placeholder, authored here). */
export const WELCOME = {
  speaker: "Wren, the Guide",
  lines: [
    "Welcome, traveller. I'm Wren — I tend this little camp.",
    "The path ahead winds past four landmarks, each a piece of the story.",
    "Follow the lanterns and firepits; they mark the way when the road bends.",
    "Take your time. Use WASD or the arrow keys to walk.",
  ],
} as const;
