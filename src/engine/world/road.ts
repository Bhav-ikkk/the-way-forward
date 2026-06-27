import type * as pc from "playcanvas";

import type { Path } from "./path";
import {
  LAYOUT,
  layStripAlongPath,
  loadModel,
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
  const linePoints = path.getEvenlySpacedPoints(LAYOUT.path.segments + 1);
  for (
    let i = LAYOUT.path.lanternEvery;
    i < linePoints.length;
    i += LAYOUT.path.lanternEvery
  ) {
    const s = linePoints[i];
    const side = i % (LAYOUT.path.lanternEvery * 2) === 0 ? 1 : -1;
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;
    const lx = s.position.x + rightX * (LAYOUT.path.width / 2 + 0.9) * side;
    const lz = s.position.z + rightZ * (LAYOUT.path.width / 2 + 0.9) * side;
    loadModel(app, "/models/lamp.glb", (root) => {
      root.setLocalPosition(lx, 0, lz);
      root.setEulerAngles(0, yawFromDir(s.tangent.x, s.tangent.z), 0);
      root.setLocalScale(1.4, 1.4, 1.4);
    });
  }

  // ---- Invisible path-edge confinement walls (collider specs only) -------
  buildConfinementWalls(path, colliders);
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
