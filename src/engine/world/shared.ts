import * as pc from "playcanvas";

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
    /** Height (full) of the invisible confinement walls. */
    wallHeight: 3,
    /** Thinness (half-extent across) of the confinement walls. */
    wallThickness: 0.15,
    /**
     * Path parameter range [start, end] left OPEN (no confinement walls) so the
     * spawn clearing/camp feels open rather than fenced in.
     */
    spawnGap: [0, 0.13] as const,
  },
  river: {
    width: 7,
    thickness: 0.06,
    y: 0.05,
    color: [0.18, 0.42, 0.78] as const,
    opacity: 0.78,
    segments: 48,
  },
  bridge: {
    url: "/models/bridge.glb",
    scale: 4,
    y: 0.05,
  },
  character: {
    url: "/models/character.glb",
    /**
     * Player model scale. Bumped ~25% in pass 2 (1.4 → 1.75) so the player
     * reads more believably against the world and the new buildings; the
     * physics capsule (total height ~3.0u) + camera head/boom offsets are tuned
     * to match this larger ~3.0u-tall silhouette.
     */
    scale: 1.75,
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
     * simple and the path never floats or clips. Hills only frame the journey
     * beyond this band (it sits a little past the confinement walls).
     */
    corridorHalfWidth: 4.4,
    /** Distance (beyond the corridor) over which hills ramp from 0 to full. */
    hillRamp: 10,
    /** Maximum (gentle) hill height in world units. */
    maxHeight: 4.2,
    /** Spacing of the low-poly mound grid that frames the journey. */
    moundSpacing: 9,
    /** Mound material colour (deeper, slightly cooler green for layered depth). */
    color: [0.31, 0.46, 0.23] as const,
    /** A few taller, distant outcrop mounds that give the horizon shape. */
    outcropColor: [0.44, 0.43, 0.39] as const,
    /** Number of distant rock outcrops dressed onto the far hills. */
    outcrops: 11,
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
    nearOffset: 2.4,
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

/** Add a primitive box/plane/sphere entity to the scene. */
export function addPrimitive(
  app: pc.AppBase,
  type: "box" | "plane" | "sphere",
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
