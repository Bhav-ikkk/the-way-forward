import type * as pc from "playcanvas";

import type { Path } from "./path";
import { BRIDGE_CROSSING_T, SPAWN_T } from "./landmarks";
import {
  addPointLight,
  LAYOUT,
  layStripAlongPath,
  loadModelInstances,
  makeMaterial,
  yawFromDir,
} from "./shared";
import type { ColliderSpec } from "./types";

/**
 * Road system: the winding visual walking path, the wayfinding lanterns that
 * line it, and — critically for pass 1 — the INVISIBLE path-edge confinement
 * wall collider specs that keep the player on the corridor (out of the grass /
 * hills and out of the river).
 *
 * No physics is built here; the walls are emitted purely as {@link ColliderSpec}
 * data (role `"wall"`) for the later Rapier pass. Walls follow the path spline,
 * offset to both shoulders, oriented to the tangent, with a GAP left open at
 * the spawn clearing so the camp reads as open. Across the river the walls
 * naturally become guard rails flanking the open bridge walkway.
 */
export function buildRoad(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): void {
  // ---- Winding visual path (tan segments oriented to the tangent) --------
  layStripAlongPath(
    app,
    path,
    LAYOUT.path.segments,
    makeMaterial(LAYOUT.path.color),
    LAYOUT.path.width,
    LAYOUT.path.thickness,
    LAYOUT.path.y,
  );

  // ---- Wayfinding lanterns lining the path -------------------------------
  buildLanterns(app, path);

  // ---- Invisible path-edge confinement walls (collider specs only) -------
  buildConfinementWalls(path, colliders);
}

/**
 * Place lamp models along the path as wayfinding, spaced more tightly as the
 * road approaches the two emotional anchors — the spawn camp and the bridge
 * crossing — and sparser on the long straights. A capped subset of the lamps
 * NEAREST those anchors get a real warm point light so the approaches glow
 * (the cap keeps the lit-light budget tight); the rest are unlit models. All
 * lamps load from a single GLB fetch and instance out for performance.
 */
function buildLanterns(app: pc.AppBase, path: Path): void {
  const pts = path.getEvenlySpacedPoints(LAYOUT.path.segments + 1);
  const last = pts.length - 1;
  const halfW = LAYOUT.path.width / 2 + 0.9;

  /** Nearness (0..1) of t to an anchor over the given falloff. */
  const near = (t: number, anchor: number, falloff: number) =>
    Math.max(0, 1 - Math.abs(t - anchor) / falloff);

  interface Lamp {
    x: number;
    z: number;
    yaw: number;
    importance: number;
  }
  const lamps: Lamp[] = [];

  let i = 6;
  let sideFlip = 0;
  while (i <= last) {
    const t = i / last;
    const s = pts[i];
    const side = sideFlip % 2 === 0 ? 1 : -1;
    sideFlip++;
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;
    const x = s.position.x + rightX * halfW * side;
    const z = s.position.z + rightZ * halfW * side;
    const importance = Math.max(
      near(t, SPAWN_T, 0.14),
      near(t, BRIDGE_CROSSING_T, 0.12),
    );
    lamps.push({
      x,
      z,
      yaw: yawFromDir(s.tangent.x, s.tangent.z),
      importance,
    });
    // Tighter spacing approaching the camp / bridge, looser on straights.
    i += importance > 0.45 ? 3 : 6;
  }

  loadModelInstances(
    app,
    "/models/lamp.glb",
    lamps.map((l) => ({ position: [l.x, 0, l.z], yaw: l.yaw, scale: 1.4 })),
  );

  // Light only the lamps closest to the anchors, capped for perf.
  const lit = [...lamps]
    .filter((l) => l.importance > 0)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, LAYOUT.lantern.maxLit);
  for (const l of lit) {
    addPointLight(
      app,
      l.x,
      LAYOUT.lantern.lightY,
      l.z,
      LAYOUT.lantern.intensity,
      LAYOUT.lantern.range,
    );
  }
}

/**
 * Generate the tall, thin, tangent-oriented wall colliders along both shoulders
 * of the path, leaving the spawn clearing open. These are invisible in pass 1
 * (no entity is drawn) — only the spec data is emitted.
 */
function buildConfinementWalls(path: Path, colliders: ColliderSpec[]): void {
  const { segments, width, shoulder, wallHeight, wallThickness, spawnGap } =
    LAYOUT.path;
  const offset = width / 2 + shoulder;
  const pts = path.getEvenlySpacedPoints(segments + 1);

  for (let i = 0; i < pts.length - 1; i++) {
    // Approximate normalised position of this segment along the path.
    const t = i / (pts.length - 1);
    // Leave the spawn clearing open so the camp doesn't feel fenced in.
    if (t >= spawnGap[0] && t <= spawnGap[1]) continue;

    const a = pts[i];
    const b = pts[i + 1];
    const ax = a.position.x;
    const az = a.position.z;
    const bx = b.position.x;
    const bz = b.position.z;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;

    const midX = (ax + bx) / 2;
    const midZ = (az + bz) / 2;
    const yaw = yawFromDir(dx, dz);

    // Right-of-travel normal in XZ.
    const rightX = dz / len;
    const rightZ = -dx / len;
    // Overlap along the tangent so corners never leave a gap on the curves.
    const halfLen = (len * 1.08) / 2;

    for (const side of [1, -1] as const) {
      const cx = midX + rightX * offset * side;
      const cz = midZ + rightZ * offset * side;
      colliders.push({
        id: `wall-${side === 1 ? "r" : "l"}-${i}`,
        type: "box",
        position: [cx, wallHeight / 2, cz],
        halfExtents: [wallThickness, wallHeight / 2, halfLen],
        rotation: [0, yaw, 0],
        role: "wall",
      });
    }
  }
}
