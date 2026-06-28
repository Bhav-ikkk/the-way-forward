import type * as pc from "playcanvas";

import type { Path } from "./path";
import { addPrimitive, hash01, LAYOUT, makeMaterial } from "./shared";
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
 * Build the terrain: a flat green ground plane (with its ground collider spec)
 * plus gentle framing hills outside the walkable corridor.
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

  // ---- Gentle framing hills (mounds outside the corridor) ---------------
  // Sample the path into a polyline once for fast distance queries.
  const poly: P2[] = path
    .getEvenlySpacedPoints(81)
    .map((s) => ({ x: s.position.x, z: s.position.z }));

  const moundMat = makeMaterial(LAYOUT.terrain.color);
  const { moundSpacing, corridorHalfWidth, hillRamp } = LAYOUT.terrain;
  const half = size / 2;
  const minX = -half;
  const maxX = half;
  const minZ = centerZ - half;
  const maxZ = centerZ + half;

  // Only place mounds where hills have begun (just beyond the corridor) so the
  // flat corridor and its shoulders stay perfectly level.
  const placeFrom = corridorHalfWidth + hillRamp * 0.25;

  let moundSeed = 0;
  for (let gx = minX; gx <= maxX; gx += moundSpacing) {
    for (let gz = minZ; gz <= maxZ; gz += moundSpacing) {
      moundSeed++;
      // Deterministic jitter so the grid never reads as a regular lattice.
      const jx = hash01(moundSeed * 1.7 + 0.3);
      const jz = hash01(moundSeed * 2.9 + 1.1);
      const jSkip = hash01(moundSeed * 4.3 + 2.7);
      const x = gx + (jx - 0.5) * moundSpacing * 1.1;
      const z = gz + (jz - 0.5) * moundSpacing * 1.1;

      const dist = distanceToPath(x, z, poly);
      if (dist < placeFrom) continue;

      // Drop ~30% of cells so hills clump into ridges + hollows rather than a
      // uniform field of identical domes (organic variation).
      if (jSkip < 0.3) continue;

      const baseH = terrainHeight(x, z, poly);
      if (baseH < 0.4) continue; // too low to bother drawing

      // Organic size variation: vertical height and footprint both vary per
      // mound, and the further from the path the taller hills may rise.
      const farBoost = Math.min(1, (dist - placeFrom) / (hillRamp * 2));
      const hVar = 0.7 + hash01(moundSeed * 6.1) * 1.1; // 0.7..1.8
      const h = baseH * hVar * (1 + farBoost * 0.6);
      const vScale = h * 2; // sphere radius is 0.5 → top sits at ~h
      const hScale = moundSpacing * (1.3 + hash01(moundSeed * 8.7) * 1.4);
      const wobble = 0.8 + hash01(moundSeed * 3.3) * 0.5; // non-round footprint
      addPrimitive(app, "sphere", moundMat, [x, 0, z], [hScale, vScale, hScale * wobble]);
    }
  }

  // ---- Distant rock/cliff silhouettes for far-horizon depth -------------
  // A handful of taller, cooler-grey outcrops near the map edges that read as
  // distant cliffs through the haze, giving the horizon shape and scale.
  const outcropMat = makeMaterial(LAYOUT.terrain.outcropColor);
  const { outcrops } = LAYOUT.terrain;
  for (let i = 0; i < outcrops; i++) {
    const f = (i + 0.5) / outcrops;
    // Alternate sides; ride the far edge of the ground plane.
    const side = i % 2 === 0 ? 1 : -1;
    const edge = (half - moundSpacing) * side;
    const ox = edge + (hash01(i * 5.1) - 0.5) * moundSpacing;
    const oz = minZ + f * (maxZ - minZ) + (hash01(i * 7.7) - 0.5) * moundSpacing;
    // Skip any that would intrude toward the corridor.
    if (distanceToPath(ox, oz, poly) < corridorHalfWidth + hillRamp) continue;
    const ch = 6 + hash01(i * 9.3) * 5; // 6..11 tall
    const cw = moundSpacing * (1.0 + hash01(i * 2.2) * 0.8);
    const yaw = hash01(i * 4.4) * 360;
    addPrimitive(app, "sphere", outcropMat, [ox, 0, oz], [cw, ch, cw * 0.7], yaw);
  }
}
