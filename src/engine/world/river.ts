import type * as pc from "playcanvas";

import { createPath, type Path, type PathSample } from "./path";
import {
  BRIDGE_CROSSING_T,
  computeKeepClearZones,
  isInKeepClear,
  type KeepClearZone,
  RIVER_CONTROL_POINTS,
} from "./landmarks";
import {
  addPointLight,
  LAYOUT,
  layStripAlongPath,
  loadModel,
  loadModelInstances,
  makeMaterial,
  type Placement,
  yawFromDir,
} from "./shared";
import type { ColliderSpec } from "./types";

/** What the river system hands back to the orchestrator. */
export interface RiverResult {
  /** The river spline (forced to pass through the bridge crossing). */
  river: Path;
  /** The path sample at the bridge crossing (position + tangent). */
  crossing: PathSample;
}

/**
 * River system: the winding river strip, the bridge spanning it at the path
 * crossing, the collider specs for the walkable bridge deck, and the DRESSING
 * that makes the crossing read as a designed river crossing rather than a plank
 * on a strip — rocks + stones on the banks, lily pads floating in the water,
 * and warm lanterns at each end of the bridge.
 *
 * The river spline is forced through the exact path crossing point so the
 * bridge always lines up over the water. The walkable bridge DECK collider
 * (role `"bridge"`) spans the full corridor width at the crossing, so in pass 2
 * the player always crosses on the bridge and never through the water; the
 * path-edge walls (from {@link ./road}) form the guard rails while the deck
 * stays an open walkway. Bank rocks near the walkway emit `"prop"` colliders;
 * lily pads + pebbles are pure dressing and carry none.
 */
export function buildRiver(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): RiverResult {
  const crossing = path.sample(BRIDGE_CROSSING_T);

  // Force the river to pass through the exact path crossing point.
  const riverPoints = RIVER_CONTROL_POINTS.map(
    (p, i) =>
      (i === Math.floor(RIVER_CONTROL_POINTS.length / 2)
        ? [crossing.position.x, crossing.position.z]
        : p) as readonly [number, number],
  );
  const river = createPath(riverPoints);

  // ---- Winding river (flat blue segments along its own spline) -----------
  layStripAlongPath(
    app,
    river,
    LAYOUT.river.segments,
    makeMaterial(LAYOUT.river.color, { opacity: LAYOUT.river.opacity }),
    LAYOUT.river.width,
    LAYOUT.river.thickness,
    LAYOUT.river.y,
  );

  // ---- Bridge at the crossing (oriented along the path tangent) ----------
  // Deck flush + centred on the path, oriented exactly to the path tangent so
  // the crossing reads as natural. Width matches the corridor; the deck spans
  // the river with planks meeting the path on both banks.
  const bridgeYaw =
    yawFromDir(crossing.tangent.x, crossing.tangent.z) + LAYOUT.bridge.yawOffset;
  loadModel(app, LAYOUT.bridge.url, (root) => {
    root.setLocalPosition(
      crossing.position.x,
      LAYOUT.bridge.y,
      crossing.position.z,
    );
    root.setEulerAngles(0, bridgeYaw, 0);
    root.setLocalScale(LAYOUT.bridge.scale, LAYOUT.bridge.scale, LAYOUT.bridge.scale);
  });

  // Walkable bridge deck spanning the full corridor width at the crossing. The
  // depth reuses LAYOUT.bridge.halfDepth so the collider matches the model deck
  // (visuals + physics stay in sync) and lands on the banks, not the water.
  const deckHalfWidth = LAYOUT.path.width / 2 + LAYOUT.path.shoulder;
  colliders.push({
    id: "bridge-deck",
    type: "box",
    position: [crossing.position.x, 0.4, crossing.position.z],
    halfExtents: [deckHalfWidth, 0.4, LAYOUT.bridge.halfDepth],
    rotation: [0, bridgeYaw, 0],
    role: "bridge",
  });

  // ---- Crossing dressing (banks + lilies + end lanterns) -----------------
  dressCrossing(app, river, crossing, colliders, computeKeepClearZones(path));

  return { river, crossing };
}

/**
 * Dress the river crossing so it reads as an intentional set piece:
 *  - a lantern on each bank-side at both ends of the bridge (the two near ends
 *    lit, for a warm wayfinding glow as you approach),
 *  - rock + stone clusters tumbling down both banks to anchor the crossing,
 *  - lily pads floating on the water to either side of the deck.
 * Placement is deterministic and modest so the light/draw budget stays tight.
 * Each GLB loads once and instances out.
 */
function dressCrossing(
  app: pc.AppBase,
  river: Path,
  crossing: PathSample,
  colliders: ColliderSpec[],
  keepClear: readonly KeepClearZone[],
): void {
  const cx = crossing.position.x;
  const cz = crossing.position.z;
  // Forward (down-path) + right-of-travel unit vectors at the crossing.
  const fX = crossing.tangent.x;
  const fZ = crossing.tangent.z;
  const rX = crossing.tangent.z;
  const rZ = -crossing.tangent.x;
  const yaw = yawFromDir(fX, fZ);

  const deckHalf = LAYOUT.path.width / 2 + LAYOUT.path.shoulder; // ~2.8
  const endDist = LAYOUT.bridge.halfDepth + 0.4; // just past the deck end, on the bank
  const laneOff = LAYOUT.path.width / 2 + 0.9; // shoulder line for lanterns

  // ---- Lanterns at both ends (4 models; one warm pool of light per end) --
  const lampPlacements: Placement[] = [];
  for (const end of [1, -1] as const) {
    const ex = cx + fX * endDist * end;
    const ez = cz + fZ * endDist * end;
    for (const side of [1, -1] as const) {
      lampPlacements.push({
        position: [ex + rX * laneOff * side, 0, ez + rZ * laneOff * side],
        yaw,
        scale: 1.4,
      });
    }
    // One warm light per end (on the +side lantern) for wayfinding glow.
    addPointLight(
      app,
      ex + rX * laneOff,
      LAYOUT.lantern.lightY,
      ez + rZ * laneOff,
      LAYOUT.marker.lanternIntensity,
    );
  }
  loadModelInstances(app, "/models/lamp.glb", lampPlacements);

  // ---- Bank rocks tumbling down both banks ------------------------------
  const rockLarge: Placement[] = [];
  const rockSmall: Placement[] = [];
  const stones: Placement[] = [];
  let rockIdx = 0;
  for (const end of [1, -1] as const) {
    const bx = cx + fX * (endDist + 1.2) * end;
    const bz = cz + fZ * (endDist + 1.2) * end;
    for (const side of [1, -1] as const) {
      // A large anchor rock just beyond the shoulder (gets a collider).
      const lo = deckHalf + 1.4;
      const lx = bx + rX * lo * side;
      const lz = bz + rZ * lo * side;
      rockLarge.push({ position: [lx, 0, lz], yaw: (end * 47 + side * 90) % 360, scale: 1.9 });
      colliders.push({
        id: `bridge-rock-${rockIdx++}`,
        type: "box",
        position: [lx, 0.7, lz],
        halfExtents: [0.9, 0.7, 0.9],
        rotation: [0, 0, 0],
        role: "prop",
      });
      // A smaller rock + a pebble spilling toward the water (decorative).
      rockSmall.push({
        position: [bx + rX * (lo - 1.0) * side, 0, bz + rZ * (lo - 1.0) * side],
        yaw: (end * 110 + side * 33) % 360,
        scale: 1.3,
      });
      stones.push({
        position: [bx + rX * (lo + 0.8) * side, 0, bz + rZ * (lo + 0.8) * side],
        yaw: (end * 200 + side * 17) % 360,
        scale: 1.2,
      });
    }
  }
  loadModelInstances(app, "/models/rock_large.glb", rockLarge);
  loadModelInstances(app, "/models/rock_small.glb", rockSmall);
  loadModelInstances(app, "/models/stone_small.glb", stones);

  // ---- Low stone embankment tidying the path↔water bank seam -------------
  // A tight line of flattened stones laid along each bank's water edge,
  // flanking the deck, so the seam where the path meets the water reads as a
  // tended stone embankment rather than a hard line. Laid at the water surface
  // so nothing floats. Pure dressing (no colliders).
  const embankment: Placement[] = [];
  const bankAlong = LAYOUT.river.width / 2 - 0.1; // ~3.4, right at the water edge
  for (const end of [1, -1] as const) {
    for (let s = 0; s < 5; s++) {
      // Lateral positions hugging the deck edge and tumbling outward to frame
      // the crossing; skip the span the opaque deck already covers.
      const lat = deckHalf - 0.3 + s * 0.95; // ~2.5 .. 6.3 from centre
      for (const side of [1, -1] as const) {
        const ex = cx + fX * bankAlong * end + rX * lat * side;
        const ez = cz + fZ * bankAlong * end + rZ * lat * side;
        embankment.push({
          position: [ex, LAYOUT.river.y, ez],
          yaw: (yaw + end * 37 + s * 21 + (side > 0 ? 0 : 90)) % 360,
          scale: [1.5 - s * 0.12, 0.45, 1.1],
        });
      }
    }
  }
  loadModelInstances(app, "/models/stone_small.glb", embankment);

  // ---- Bank foliage softening the approaches (decorative) ---------------
  const bushes: Placement[] = [];
  const grass: Placement[] = [];
  const flowers: Placement[] = [];
  for (let k = 0; k < 10; k++) {
    const end = k % 2 === 0 ? 1 : -1;
    const side = k % 3 === 0 ? 1 : -1;
    const a = endDist + 1.6 + (k % 4) * 0.8;
    const lat = deckHalf + 1.6 + ((k * 0.37) % 1) * 2.0;
    const x = cx + fX * a * end + rX * lat * side;
    const z = cz + fZ * a * end + rZ * lat * side;
    // Respect the shared keep-clear apron so bank foliage never crowds a
    // nearby structure.
    if (isInKeepClear(x, z, keepClear)) continue;
    const yawK = (k * 47) % 360;
    if (k % 4 === 0) bushes.push({ position: [x, 0, z], yaw: yawK, scale: 1.2 });
    else if (k % 4 === 1) flowers.push({ position: [x, 0, z], yaw: yawK, scale: 1.1 });
    else grass.push({ position: [x, 0, z], yaw: yawK, scale: 1.2 });
  }
  loadModelInstances(app, "/models/bush.glb", bushes);
  loadModelInstances(app, "/models/grass.glb", grass);
  loadModelInstances(app, "/models/flower_yellow.glb", flowers);

  // ---- Lily pads floating on the water, to either side of the deck ------
  // Sample the river spline around its middle (where it meets the crossing) so
  // the pads follow the water as it winds, dropping off to both sides of the
  // deck. Pads that would sit on/under the bridge deck are skipped.
  const lilies: Placement[] = [];
  for (let k = -4; k <= 4; k++) {
    const rt = 0.5 + k * 0.035;
    if (rt < 0 || rt > 1) continue;
    const rs = river.sample(rt);
    const dAlong = (rs.position.x - cx) * fX + (rs.position.z - cz) * fZ;
    if (Math.abs(dAlong) < deckHalf + 0.5) continue;
    const jitter = ((k * 53.1) % 10) / 10 - 0.5; // -0.5..0.5 deterministic
    const lat = jitter * (LAYOUT.river.width * 0.3);
    const lx = rs.position.x + rs.tangent.z * lat;
    const lz = rs.position.z - rs.tangent.x * lat;
    lilies.push({
      position: [lx, LAYOUT.river.y + 0.02, lz],
      yaw: (k * 64) % 360,
      scale: 1.1,
    });
  }
  loadModelInstances(app, "/models/lily.glb", lilies);
}
