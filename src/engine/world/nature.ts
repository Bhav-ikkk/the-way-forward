import type * as pc from "playcanvas";

import type { Path } from "./path";
import { BRIDGE_CROSSING_T, LANDMARKS, SPAWN_T } from "./landmarks";
import { LAYOUT, loadModel, yawFromDir } from "./shared";
import type { ColliderSpec } from "./types";

/** A scattered nature prop template. */
interface NatureProp {
  url: string;
  scale: number;
  /** Collider half-extents (trunk/rock footprint). */
  half: [number, number, number];
}

const TREES: NatureProp[] = [
  { url: "/models/tree_oak.glb", scale: 2.4, half: [0.4, 2.4, 0.4] },
  { url: "/models/tree_pine.glb", scale: 2.8, half: [0.4, 2.8, 0.4] },
];
const ROCKS: NatureProp[] = [
  { url: "/models/rock_large.glb", scale: 1.8, half: [0.9, 0.7, 0.9] },
  { url: "/models/rock_small.glb", scale: 1.4, half: [0.55, 0.45, 0.55] },
];

/**
 * Nature system: extra trees and rocks scattered along the journey just beyond
 * the path-edge walls so they line the corridor and frame the view without
 * blocking it. Each prop emits a `"prop"` collider so the player bumps into it
 * (pass 2). Placement is deterministic (no RNG) and spaced along the path,
 * skipping the spawn clearing, the river crossing, and the landmark anchors so
 * scenery never collides with handcrafted set pieces.
 */
export function buildNature(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): void {
  const offsetBase = LAYOUT.path.width / 2 + LAYOUT.path.shoulder + 1.2;
  const count = 22;

  let placed = 0;
  for (let i = 1; i < count; i++) {
    const t = i / count;

    // Skip near the spawn camp, the bridge crossing, and each landmark.
    if (t < 0.18 || Math.abs(t - SPAWN_T) < 0.04) continue;
    if (Math.abs(t - BRIDGE_CROSSING_T) < 0.06) continue;
    if (LANDMARKS.some((lm) => Math.abs(t - lm.t) < 0.05)) continue;

    const s = path.sample(t);
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;

    // Alternate sides and vary the distance out into the hill-framing zone.
    const side = i % 2 === 0 ? 1 : -1;
    const jitter = ((Math.sin(i * 53.17) + 1) / 2) * 3.5; // 0..3.5, deterministic
    const dist = offsetBase + jitter;

    const x = s.position.x + rightX * dist * side;
    const z = s.position.z + rightZ * dist * side;

    // Alternate trees and rocks for variety.
    const pool = i % 3 === 0 ? ROCKS : TREES;
    const prop = pool[i % pool.length];
    const yaw = yawFromDir(rightX * side, rightZ * side) + (i * 37) % 360;

    loadModel(app, prop.url, (root) => {
      root.setLocalPosition(x, 0, z);
      root.setEulerAngles(0, yaw, 0);
      root.setLocalScale(prop.scale, prop.scale, prop.scale);
    });

    colliders.push({
      id: `nature-${placed}`,
      type: "box",
      position: [x, prop.half[1], z],
      halfExtents: prop.half,
      rotation: [0, yaw, 0],
      role: "prop",
    });
    placed++;
  }
}
