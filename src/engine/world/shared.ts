import * as pc from "playcanvas";

import { CHARACTER } from "./character.config";
import type { MarkerKind } from "./landmarks";

/**
 * Shared low-level helpers + tunable layout for the handcrafted world systems.
 *
 * Every world system (lighting, terrain, road, river, spawn, nature,
 * checkpoint, npc) builds on these small primitives so the systems stay focused
 * on WHAT they place rather than HOW a box/material/model is created. This
 * module never reaches up into the higher-level systems, so there are no import
 * cycles.
 *
 * The geometry of the JOURNEY is derived from two splines (the walking path and
 * the winding river in {@link ./landmarks}); the constants here control widths,
 * colours, the path-edge confinement corridor, the gentle-hill terrain, and the
 * cozy spawn camp. Units are world units; Kenney kit models are ~1-unit scale,
 * so scenery/landmarks/buildings are scaled up to read against the ~3.0u-tall
 * character (LAYOUT.character.scale ≈ 1.75).
 */
export const LAYOUT = {
  ground: {
    // Pass-2 widened the ground plane to cover the longer narrative ribbon
    // (the path now runs to ~z=184), so nothing floats off the meadow.
    size: 240,
    /** Ground plane centre on Z (the journey runs along +Z). */
    centerZ: 88,
    /** Warm, slightly desaturated meadow green that sits under golden light. */
    color: [0.4, 0.51, 0.26] as const,
  },
  path: {
    width: 3.4,
    thickness: 0.08,
    y: 0.03,
    color: [0.66, 0.58, 0.45] as const,
    /** Number of segments laid along the spline. */
    segments: 60,
    /** Place a wayfinding lantern every N path segments. */
    lanternEvery: 10,
    /**
     * Lateral shoulder added beyond the path half-width before the invisible
     * confinement walls sit. Wall offset from centreline = width/2 + shoulder.
     */
    shoulder: 1.1,
    /**
     * Extra keep-clear margin (beyond the path half-width) that defines the
     * ROAD CORRIDOR no scatter/foliage/rock/prop may intrude into, so the road
     * surface + its immediate edges stay visually clean. Road half-width +
     * this margin = the exclusion half-width used by {@link ./nature}. Lanterns
     * /benches/fences that intentionally LINE the road sit on the shoulder just
     * outside this margin.
     */
    clearMargin: 1.4,
    /** Height (full) of the invisible confinement walls. */
    wallHeight: 3,
    /** Thinness (half-extent across) of the confinement walls. */
    wallThickness: 0.15,
    /**
     * Path parameter range [start, end] left OPEN (no confinement walls) so the
     * spawn clearing/camp feels open rather than fenced in.
     */
    spawnGap: [0, 0.13] as const,
    // ---- Handcrafted dirt road (Pass-2 Stage-1) --------------------------
    /**
     * Curated dirt-road model laid as a tiled ribbon along the path spline
     * (replaces the old procedural tan box strip). `road_straight.glb` is
     * authored 1u wide × 2u long along its local +Z, lying flat with its top
     * at y≈0.05, so it tiles cleanly when scaled to the road width and oriented
     * to the path tangent.
     */
    roadModel: "/models/road_straight.glb",
    /** Native length (local Z) of one `road_straight.glb` tile. */
    roadTileLength: 2,
    /**
     * Segments laid along the spline for the dirt-road ribbon. Higher = smoother
     * tiling around the bends (each tile spans one segment, oriented + scaled to
     * the local tangent so the width stays CONSTANT and the edges stay clean).
     */
    roadSegments: 80,
    /** Per-tile overlap factor so curve seams never show a gap. */
    roadOverlap: 1.12,
    /**
     * Road surface placement height. Sits just above the ground plane and BELOW
     * the bridge deck (LAYOUT.bridge.y = 0.12) so the deck reads cleanly on top
     * where the road passes under the crossing.
     */
    roadY: 0.04,
  },
  /**
   * Per-building ENTRANCE PLAZA: where the road WIDENS into a small paved court
   * connecting the through-road to the building's door, so each location reads
   * as a destination the road ARRIVES at rather than a thin path passing by.
   * The court is a tight grid of the curated dirt tile (`road_tile.glb`, a 0.5u
   * square) laid flat in the building's frame, spanning from the road centreline
   * out to the building's front door. All values are tunable.
   */
  plaza: {
    /** Curated square dirt tile used to pave the court. */
    tileModel: "/models/road_tile.glb",
    /** Native edge length (local X and Z) of one `road_tile.glb`. */
    tileNative: 0.5,
    /** Court grid columns (across, along the path tangent). */
    cols: 6,
    /** Court grid rows (depth, from the road toward the building door). */
    rows: 5,
    /** Half-width (along the tangent) of the court — wider than the road. */
    halfAlong: 4.4,
    /** Tile overlap factor so the paved court shows no seams. */
    overlap: 1.06,
    /** Court surface height (just above the road ribbon, below the building pad). */
    y: 0.05,
  },
  river: {
    width: 7,
    thickness: 0.06,
    /**
     * River surface height. Kept just above the ground plane (so it reads as
     * water on the meadow) but BELOW the path strip top (~0.07) and the bridge
     * deck, so the water clearly passes under the crossing without z-fighting
     * the tan path where the two overlap beneath the deck.
     */
    y: 0.04,
    color: [0.18, 0.42, 0.78] as const,
    opacity: 0.78,
    segments: 48,
    // ---- Pass-2 Stage-3 natural-river dressing ---------------------------
    /**
     * Darker deep-channel colour laid as a WIDER, slightly LOWER bed beneath
     * the translucent surface so the river reads with depth (a dark centre
     * fading to the lighter blue surface) instead of a flat coloured slab.
     */
    deepColor: [0.08, 0.22, 0.46] as const,
    /** Deep-bed width factor (relative to surface width). */
    deepWidthFactor: 1.16,
    /** Deep-bed sits just under the surface for a layered depth read. */
    deepY: 0.02,
    /** Muddy/sandy shoreline margin colour bordering the water on both banks. */
    bankColor: [0.5, 0.43, 0.31] as const,
    /** Lateral width of the sandy bank margin on EACH side of the water. */
    bankWidth: 1.7,
    /**
     * Fraction the water width "breathes" along the river's length so the
     * shoreline is never a perfectly parallel channel. Zeroed at the crossing
     * (t≈0.5) so the bridge always spans a consistent, nominal width.
     */
    widthVariation: 0.26,
    /** Segments laid for the bank margins (matches the surface for clean edges). */
    bankSegments: 48,
  },
  bridge: {
    url: "/models/bridge.glb",
    /**
     * Bridge model scale. Tuned so the deck spans the full walkable corridor
     * (path width + both shoulders ≈ 5.6u) and the planks land on solid ground
     * on both banks rather than floating over the water.
     */
    scale: 4.2,
    /**
     * Deck height. Sits just above BOTH the river surface (river.y) and the
     * path strip (top ≈0.07) so the opaque deck reads cleanly on top while the
     * water passes UNDER it — no z-fighting at the deck/water/path seams.
     */
    y: 0.12,
    /**
     * Yaw offset (deg) added on top of the path tangent so the model's long
     * axis lies ALONG the corridor. The Kenney bridge already points down its
     * +Z (matching the path tangent), so this stays 0; exposed for tuning.
     */
    yawOffset: 0,
    /**
     * Half-depth (along travel) of the walkable deck. Exceeds the river
     * half-width (~3.5u) so the plank ends meet the path on both banks with no
     * gap/float; the deck collider reuses this so visuals + physics stay in
     * sync.
     */
    halfDepth: 4.2,
    // ---- Pass-2 Stage-3 grounding supports -------------------------------
    /**
     * Stone pillar model (roads-kit) planted in the water beneath the span on
     * both sides of the deck, so the bridge reads as resting on supports rather
     * than floating over the strip. Pure dressing (no colliders — the deck
     * collider already carries the walkway physics).
     */
    pillarUrl: "/models/bridge_pillar.glb",
    /** Pillar scale (tuned to rise from the water to just under the deck). */
    pillarScale: 2.6,
    /** Lateral offset of each pillar pair from the crossing centreline. */
    pillarOffset: 2.0,
  },
  character: {
    /**
     * Player model + scale are sourced from the single character config
     * ({@link ./character.config}) so a model swap is a ONE-FILE edit. These
     * fields are kept here only as the world-build's view onto that config;
     * do not hardcode a different model/scale here.
     */
    url: CHARACTER.model,
    scale: CHARACTER.scale,
  },
  marker: {
    /** Warm lantern/firepit glow. */
    color: [1.0, 0.74, 0.42] as const,
    /** Cooler accent glow for the AI Laboratory (energised/inquisitive). */
    coolColor: [0.55, 0.78, 1.0] as const,
    lanternIntensity: 1.5,
    firepitIntensity: 2.2,
    range: 9,
  },
  terrain: {
    /**
     * Half-width of the FLAT walkable corridor around the path centreline.
     * Inside this band the terrain stays at y≈0 so movement/physics stays
     * simple and the path never floats or clips. Sculpted ridge forms only
     * frame the journey beyond this band.
     */
    corridorHalfWidth: 4.4,
    /** Distance (beyond the corridor) over which the analytic baseline ramps. */
    hillRamp: 10,
    /** Maximum (gentle) baseline hill height in world units (analytic field). */
    maxHeight: 4.2,
    /**
     * Pass-2 Stage-1 replaced the uniform field of small repeated mound spheres
     * with a HANDFUL of large, sculpted ridge forms (see RIDGES in terrain.ts):
     * big, elongated, deliberately placed hills — several large enough to BLOCK
     * line of sight so upcoming chapters stay hidden until the road curves to
     * reveal them. These two colours dress the near ridges (warm meadow green)
     * and the distant backdrop ridges (cooler, rockier grey-green) for depth.
     */
    /** Near ridge material colour (deeper, slightly cooler green). */
    color: [0.31, 0.46, 0.23] as const,
    /** Distant/backdrop ridge colour (cooler, rockier; reads through the haze). */
    farColor: [0.42, 0.44, 0.4] as const,
  },
  /**
   * Atmosphere: a cohesive GOLDEN-HOUR mood — a gradient sky dome, distance fog
   * matched to the warm horizon, and filmic grading. The whole look is tuned
   * here so the sky, fog, and camera clear colour stay in lock-step.
   *
   * The sky reads warm + hazy at the horizon (where the low sun sits) and
   * deepens to a cooler blue overhead. The fog + clear colour use the SAME
   * horizon colour so distant hills/landmarks dissolve into the sky with no
   * hard seam, while the path ahead stays clearly visible.
   */
  atmosphere: {
    /** Warm, hazy cream at the horizon (where the low golden sun sits). */
    horizonColor: [0.9, 0.82, 0.71] as const,
    /** Cooler, deeper blue overhead so the dome reads as real sky. */
    zenithColor: [0.33, 0.49, 0.73] as const,
    /** Fog/clear colour — matched to the horizon so the world melts into sky. */
    fogColor: [0.9, 0.82, 0.71] as const,
    /** Linear fog: distance where haze begins (well past the player). */
    fogStart: 30,
    /** Linear fog: distance where geometry fully dissolves into haze. */
    fogEnd: 155,
    /** Subtle filmic exposure lift so ACES grading doesn't read as flat. */
    exposure: 1.06,
    /** Radius (world units) of the inverted sky dome (inside the far clip). */
    skyRadius: 520,
    /** Z centre of the sky dome (matches the ground centre). */
    skyCenterZ: 88,
  },
  /**
   * Cheap, NON-blocking ground dressing scattered just outside the corridor:
   * grass tufts, bushes, flowers, the odd mushroom. Counts are capped and
   * placement is deterministic so the slice stays performant. None of this
   * dressing emits colliders — it is pure set-dressing the player never bumps.
   */
  decor: {
    /** Lateral band (from path centre) where ground detail is scattered. */
    nearOffset: 3.2,
    farOffset: 8.5,
    /** Stations sampled along the path for ground detail (scales with the
     * longer pass-2 ribbon so the route stays dressed end-to-end). */
    stations: 130,
    /** Roughly 1-in-N stations sprout a flower / mushroom accent. */
    flowerEvery: 5,
    mushroomEvery: 17,
  },
  /** Warm wayfinding lanterns that actually cast light (capped for perf). */
  lantern: {
    /** Max number of LIT path lanterns (extra ones are unlit models). */
    maxLit: 5,
    lightY: 1.7,
    /** Warm pool range for a lit lantern (kept tight for performance). */
    range: 7,
    intensity: 1.35,
  },
  /**
   * Intentional tree/rock COMPOSITION beyond the path-edge walls: clustered,
   * species-varied, sparse near the path and denser further out so the corridor
   * is framed and bends hide/reveal what's ahead. Deterministic (no RNG).
   */
  scatter: {
    /** Stations sampled along the path for tree/rock clustering. */
    stations: 46,
    /** Lateral band starts just beyond the confinement walls. */
    bandStart: 5.5,
    /** Outer extent of the framing tree band. */
    bandEnd: 19,
    /** Trees nearer than this (from path centre) get a trunk collider. */
    colliderWithin: 7.5,
    /** Rock-cluster collider footprint trigger distance from path centre. */
    rockColliderWithin: 6.5,
  },
} as const;

/** A model placed in the world by URL with a transform. */
export interface ScenerySpec {
  url: string;
  position: [number, number, number];
  yaw: number;
  scale: number;
}

/**
 * A checkpoint/accent marker that animates a warm (or cool) point light, and
 * optionally bobs a lantern model. Shared here (rather than in checkpoint.ts)
 * so the spawn camp, the checkpoint landmarks, and the chapter structures can
 * all register markers without an import cycle. Animated by `stepMarkers`.
 */
export interface Marker {
  kind: MarkerKind;
  light: pc.Entity;
  baseIntensity: number;
  baseY: number;
  /** The loaded model root (set async); animated for the lantern bob. */
  model: pc.Entity | null;
  phase: number;
}

/** Create a StandardMaterial from an RGB triple, with optional transparency. */
export function makeMaterial(
  rgb: readonly [number, number, number],
  opts: { emissive?: boolean; opacity?: number } = {},
): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();
  mat.diffuse = new pc.Color(rgb[0], rgb[1], rgb[2]);
  if (opts.emissive) {
    mat.emissive = new pc.Color(rgb[0], rgb[1], rgb[2]);
  }
  if (opts.opacity !== undefined && opts.opacity < 1) {
    mat.opacity = opts.opacity;
    mat.blendType = pc.BLEND_NORMAL;
  }
  mat.update();
  return mat;
}

/** Add a primitive box/plane/sphere/cylinder entity to the scene. */
export function addPrimitive(
  app: pc.AppBase,
  type: "box" | "plane" | "sphere" | "cylinder",
  material: pc.StandardMaterial,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  yaw = 0,
): pc.Entity {
  const e = new pc.Entity(type);
  e.addComponent("render", { type, material });
  e.setLocalPosition(position[0], position[1], position[2]);
  e.setLocalEulerAngles(0, yaw, 0);
  e.setLocalScale(scale[0], scale[1], scale[2]);
  app.root.addChild(e);
  return e;
}

/** Yaw (deg) for a forward XZ direction. Yaw 0 == facing +Z (matches player). */
export function yawFromDir(dx: number, dz: number): number {
  return Math.atan2(dx, dz) * pc.math.RAD_TO_DEG;
}

/**
 * Deterministic pseudo-random value in [0, 1) from an integer-ish seed. Used so
 * all scenery scatter is stable frame-to-frame and run-to-run (no RNG), keeping
 * the composition art-directed rather than noisy.
 */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Create a warm point light entity (no model) and add it to the scene. */
export function addPointLight(
  app: pc.AppBase,
  x: number,
  y: number,
  z: number,
  intensity: number,
  range: number = LAYOUT.marker.range,
  color: readonly [number, number, number] = LAYOUT.marker.color,
): pc.Entity {
  const e = new pc.Entity("marker-light");
  e.addComponent("light", {
    type: "point",
    color: new pc.Color(color[0], color[1], color[2]),
    intensity,
    range,
    castShadows: false,
  });
  e.setLocalPosition(x, y, z);
  app.root.addChild(e);
  return e;
}

/**
 * Load a GLB via the PlayCanvas container workflow and add an instantiated
 * render entity to the scene root. Errors are logged and swallowed so a single
 * missing asset never breaks the rest of the world. An optional `onSettled`
 * callback fires after the load completes, whether it succeeded or failed.
 */
export function loadModel(
  app: pc.AppBase,
  url: string,
  place: (root: pc.Entity) => void,
  onSettled?: () => void,
): void {
  app.assets.loadFromUrl(url, "container", (err, asset) => {
    if (err || !asset) {
      console.error(`[world] Failed to load model: ${url}`, err);
      onSettled?.();
      return;
    }
    try {
      const resource = asset.resource as pc.ContainerResource;
      const root = resource.instantiateRenderEntity();
      app.root.addChild(root);
      place(root);
    } catch (e) {
      console.error(`[world] Failed to instantiate model: ${url}`, e);
    } finally {
      onSettled?.();
    }
  });
}

/**
 * A single placement for {@link loadModelInstances}: a transform for one
 * instantiated copy of a shared loaded model.
 */
export interface Placement {
  position: [number, number, number];
  yaw: number;
  /** Uniform scale, or a per-axis [x, y, z] scale. */
  scale: number | [number, number, number];
}

/**
 * Load a GLB ONCE and instantiate it at many transforms. This is the
 * performance-friendly path for scattered decoration (grass, flowers, fences,
 * lily pads): a single network fetch + parse feeds N cheap render-entity
 * clones that share the container's materials, instead of re-loading the same
 * asset per prop. Errors are logged and swallowed so one bad asset never breaks
 * the rest of the world.
 */
export function loadModelInstances(
  app: pc.AppBase,
  url: string,
  placements: Placement[],
): void {
  if (placements.length === 0) return;
  app.assets.loadFromUrl(url, "container", (err, asset) => {
    if (err || !asset) {
      console.error(`[world] Failed to load model: ${url}`, err);
      return;
    }
    try {
      const resource = asset.resource as pc.ContainerResource;
      for (const p of placements) {
        const root = resource.instantiateRenderEntity();
        app.root.addChild(root);
        root.setLocalPosition(p.position[0], p.position[1], p.position[2]);
        root.setEulerAngles(0, p.yaw, 0);
        const s =
          typeof p.scale === "number" ? [p.scale, p.scale, p.scale] : p.scale;
        root.setLocalScale(s[0], s[1], s[2]);
      }
    } catch (e) {
      console.error(`[world] Failed to instantiate model: ${url}`, e);
    }
  });
}

/**
 * Lay a strip of oriented boxes following an arc-length-even spline. Used for
 * both the walking path and the river so they hug their curves smoothly.
 */
export function layStripAlongPath(
  app: pc.AppBase,
  spline: { getEvenlySpacedPoints: (count: number) => Array<{ position: pc.Vec3 }> },
  segments: number,
  material: pc.StandardMaterial,
  width: number,
  thickness: number,
  y: number,
): void {
  const pts = spline.getEvenlySpacedPoints(segments + 1);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i].position;
    const b = pts[i + 1].position;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    const midX = (a.x + b.x) / 2;
    const midZ = (a.z + b.z) / 2;
    // Slightly overlap segments (len * 1.08) to avoid gaps on the curves.
    addPrimitive(
      app,
      "box",
      material,
      [midX, y, midZ],
      [width, thickness, len * 1.08],
      yawFromDir(dx, dz),
    );
  }
}
