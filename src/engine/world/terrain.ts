import type * as pc from "playcanvas";

import type { Path } from "./path";
import {
  computeKeepClearZones,
  isInKeepClear,
} from "./landmarks";
import { addPrimitive, LAYOUT, makeMaterial } from "./shared";
import type { ColliderSpec } from "./types";

/**
 * Terrain system: a handcrafted gentle-hills landscape that frames the journey
 * while keeping a FLAT walkable corridor (y≈0) along the path so the
 * transform-based character movement stays simple and the path never floats or
 * clips.
 *
 * Approach (mounds, not a deformed mesh): the flat green ground plane stays at
 * y=0, and gentle rolling hills are built from large low-poly flattened spheres
 * ("mounds") placed ONLY outside the corridor — i.e. behind the path-edge
 * confinement walls. This reads as rolling hills framing the path while being
 * trivially compatible with the unit-test's mocked `playcanvas` (no Mesh /
 * GraphicsDevice geometry APIs are touched, so `npm test` needs no mock
 * changes). A {@link terrainHeight} function expresses the same corridor/hill
 * intent analytically and is exported for reuse (e.g. a future deformed mesh or
 * physics heightfield in pass 2).
 */

/** A flattened XZ point used for distance queries. */
interface P2 {
  x: number;
  z: number;
}

/** Smoothstep on [0,1]. */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Distance from a point to a polyline segment (a→b) on the XZ plane. */
function distToSegment(px: number, pz: number, a: P2, b: P2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-9) return Math.hypot(px - a.x, pz - a.z);
  let t = ((px - a.x) * dx + (pz - a.z) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}

/** Min distance from (x,z) to a sampled path polyline. */
export function distanceToPath(x: number, z: number, poly: P2[]): number {
  let min = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = distToSegment(x, z, poly[i], poly[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Low-frequency, low-amplitude rolling-hill field (sum of sines) so the hills
 * vary gently rather than reading as a uniform wall. Deterministic — no RNG.
 */
function hillField(x: number, z: number): number {
  const a = Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4);
  const b = Math.sin(x * 0.13 - z * 0.05 + 2.1) * 0.5;
  return 0.6 + 0.4 * (a * 0.6 + b * 0.4); // ~[0.2, 1.0]
}

/**
 * Analytic terrain height at (x,z): ~0 inside the flat corridor around the
 * path, ramping smoothly up into gentle hills as distance from the path grows.
 */
export function terrainHeight(x: number, z: number, poly: P2[]): number {
  const { corridorHalfWidth, hillRamp, maxHeight } = LAYOUT.terrain;
  const dist = distanceToPath(x, z, poly);
  if (dist <= corridorHalfWidth) return 0;
  const ramp = smoothstep((dist - corridorHalfWidth) / hillRamp);
  return maxHeight * ramp * hillField(x, z);
}

/**
 * A single sculpted RIDGE/HILL form. Pass-2 Stage-1 replaced the old uniform
 * field of small repeated mound spheres with this HANDFUL of large, elongated,
 * deliberately-placed forms — the "bones" of the world. Positions are authored
 * in world XZ (verified against the path so each clears the flat corridor and
 * every building's keep-clear apron). Several are sized + placed specifically to
 * BLOCK line of sight so an upcoming chapter stays hidden until the road curves
 * to reveal it (reinforced by the dense occluder treelines in {@link ./nature}).
 *
 * A form is drawn as a single large flattened/stretched sphere: `sx`×`sz` are
 * the full XZ footprint diameters and `height` is the crown height (the sphere
 * is centred at y=0 so its top sits at `height`, base buried). `yaw` rotates the
 * footprint for natural, non-aligned ridgelines. `far` tints the distant
 * backdrop ridges cooler/rockier so they read through the golden-hour haze.
 *
 * ALL values are tunable — this array is the single place to re-sculpt the
 * world's terrain bones.
 */
interface RidgeSpec {
  /** Crown (top) height in world units — tall enough (≈9–13) to block sightlines. */
  height: number;
  /** Footprint full diameters on X and Z (large + elongated, not uniform). */
  sx: number;
  sz: number;
  /** World-space centre on the XZ plane. */
  cx: number;
  cz: number;
  /** Footprint yaw (deg) for a natural, non-grid ridgeline. */
  yaw: number;
  /** Distant backdrop ridge → cooler/rockier tint (vs near meadow green). */
  far?: boolean;
  /** Human note on the form's compositional job. */
  note: string;
}

/**
 * The curated terrain bones. Two broad RIDGELINES frame the corridor (an
 * eastern line and a western line) plus a few distant backdrop ridges shape the
 * horizon. R-WS / R-LIB back the early chapters and, together with the occluder
 * treelines, keep the Workshop hidden until the first bend and the Library
 * hidden until past the bridge.
 */
const RIDGES: readonly RidgeSpec[] = [
  // ---- Eastern ridgeline framing the early valley (spawn → bridge) -------
  { cx: 24, cz: 6, sx: 14, sz: 20, height: 10, yaw: 6, note: "east bone flanking the spawn valley" },
  { cx: 17, cz: 24, sx: 13, sz: 18, height: 10, yaw: 12, note: "east backdrop behind the workshop" },
  { cx: 24, cz: 40, sx: 16, sz: 24, height: 11, yaw: 8, note: "east hill flanking the bridge/river valley" },
  // ---- Western ridgeline (occluders + framing) ---------------------------
  { cx: -24, cz: 12, sx: 16, sz: 22, height: 11, yaw: -8, note: "west wall behind the first bend (hides the road's far reach)" },
  { cx: -32, cz: 60, sx: 16, sz: 22, height: 11, yaw: -8, far: true, note: "far-west headland framing the library reach" },
  { cx: -22, cz: 106, sx: 16, sz: 22, height: 11, yaw: -10, note: "west wall past the AI lab toward the observatory" },
  // ---- Mid + late framing ridges ----------------------------------------
  { cx: 20, cz: 76, sx: 14, sz: 18, height: 10.5, yaw: 10, note: "east rise before the AI-lab climb" },
  { cx: 18, cz: 128, sx: 14, sz: 18, height: 10, yaw: 8, note: "east rise approaching the observatory shoulder" },
  { cx: -24, cz: 150, sx: 18, sz: 24, height: 12, yaw: -8, far: true, note: "far-west headland framing the final stretch" },
  { cx: 28, cz: 150, sx: 18, sz: 26, height: 12, yaw: 6, far: true, note: "far-east horizon ridge for depth" },
  // ---- Distant backdrop closing the world behind the lighthouse ----------
  { cx: 4, cz: 198, sx: 32, sz: 16, height: 13, yaw: 0, far: true, note: "northern backdrop ridge behind the lighthouse" },
];

/**
 * Build the terrain: a flat green ground plane (with its ground collider spec)
 * plus a HANDFUL of large sculpted ridge forms (see {@link RIDGES}) that frame
 * the journey and block sightlines to upcoming chapters — while the walkable
 * corridor and every building's keep-clear apron stay perfectly flat (y≈0).
 */
export function buildTerrain(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): void {
  const { size, centerZ, color } = LAYOUT.ground;

  // ---- Flat walkable ground plane ---------------------------------------
  addPrimitive(app, "plane", makeMaterial(color), [0, 0, centerZ], [size, 1, size]);
  colliders.push({
    id: "ground",
    type: "box",
    position: [0, -0.5, centerZ],
    halfExtents: [size / 2, 0.5, size / 2],
    rotation: [0, 0, 0],
    role: "ground",
  });

  // ---- Sculpted ridge forms (the world's terrain "bones") ---------------
  // Sample the path into a polyline once so we can defensively assert each
  // ridge stays clear of the flat walkable corridor, and compute the shared
  // keep-clear aprons so no ridge ever rises into a building's clean ground.
  const poly: P2[] = path
    .getEvenlySpacedPoints(121)
    .map((s) => ({ x: s.position.x, z: s.position.z }));
  const keepClear = computeKeepClearZones(path);

  const nearMat = makeMaterial(LAYOUT.terrain.color);
  const farMat = makeMaterial(LAYOUT.terrain.farColor);
  const { corridorHalfWidth } = LAYOUT.terrain;

  for (const r of RIDGES) {
    // Defensive guards (the authored centres already satisfy these): never let
    // a ridge centre fall inside the flat corridor or a building's apron, so a
    // future re-sculpt can't accidentally heave the walkable ground or a pad.
    if (distanceToPath(r.cx, r.cz, poly) <= corridorHalfWidth) continue;
    if (isInKeepClear(r.cx, r.cz, keepClear)) continue;

    addPrimitive(
      app,
      "sphere",
      r.far ? farMat : nearMat,
      [r.cx, 0, r.cz],
      [r.sx, r.height * 2, r.sz],
      r.yaw,
    );
  }
}
