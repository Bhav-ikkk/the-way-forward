import type * as pc from "playcanvas";

import { createPath, type Path, type PathSample } from "./path";
import { BRIDGE_CROSSING_T, RIVER_CONTROL_POINTS } from "./landmarks";
import {
  LAYOUT,
  layStripAlongPath,
  loadModel,
  makeMaterial,
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
 * crossing, and the collider specs for the walkable bridge deck. The river
 * spline is forced through the exact path crossing point so the bridge always
 * lines up over the water.
 *
 * The walkable bridge DECK collider (role `"bridge"`) spans the full corridor
 * width at the crossing, so in pass 2 the player always crosses on the bridge
 * and never through the water; the path-edge walls (from {@link ./road}) form
 * the bridge's guard rails while the deck itself stays an open walkway.
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
  const bridgeYaw = yawFromDir(crossing.tangent.x, crossing.tangent.z);
  loadModel(app, LAYOUT.bridge.url, (root) => {
    root.setLocalPosition(
      crossing.position.x,
      LAYOUT.bridge.y,
      crossing.position.z,
    );
    root.setEulerAngles(0, bridgeYaw, 0);
    root.setLocalScale(LAYOUT.bridge.scale, LAYOUT.bridge.scale, LAYOUT.bridge.scale);
  });

  // Walkable bridge deck spanning the full corridor width at the crossing.
  const deckHalfWidth = LAYOUT.path.width / 2 + LAYOUT.path.shoulder;
  colliders.push({
    id: "bridge-deck",
    type: "box",
    position: [crossing.position.x, 0.4, crossing.position.z],
    halfExtents: [deckHalfWidth, 0.4, 4.2],
    rotation: [0, bridgeYaw, 0],
    role: "bridge",
  });

  return { river, crossing };
}
