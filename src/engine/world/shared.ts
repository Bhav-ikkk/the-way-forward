import * as pc from "playcanvas";

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
 * so scenery/landmarks are scaled up to read against the ~1.7u-tall character.
 */
export const LAYOUT = {
  ground: {
    size: 110,
    /** Ground plane centre on Z (the journey runs along +Z). */
    centerZ: 36,
    color: [0.33, 0.55, 0.27] as const,
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
    scale: 1,
  },
  marker: {
    /** Warm lantern/firepit glow. */
    color: [1.0, 0.74, 0.42] as const,
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
    moundSpacing: 7,
    /** Mound material colour (slightly deeper green than the ground). */
    color: [0.29, 0.5, 0.24] as const,
  },
} as const;

/** A model placed in the world by URL with a transform. */
export interface ScenerySpec {
  url: string;
  position: [number, number, number];
  yaw: number;
  scale: number;
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

/** Create a warm point light entity (no model) and add it to the scene. */
export function addPointLight(
  app: pc.AppBase,
  x: number,
  y: number,
  z: number,
  intensity: number,
): pc.Entity {
  const e = new pc.Entity("marker-light");
  e.addComponent("light", {
    type: "point",
    color: new pc.Color(
      LAYOUT.marker.color[0],
      LAYOUT.marker.color[1],
      LAYOUT.marker.color[2],
    ),
    intensity,
    range: LAYOUT.marker.range,
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
