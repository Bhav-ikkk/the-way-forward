import * as pc from "playcanvas";

import type { Path } from "./path";
import {
  BRIDGE_CROSSING_T,
  computeKeepClearZones,
  isInKeepClear,
  type KeepClearZone,
} from "./landmarks";
import {
  addPointLight,
  LAYOUT,
  loadModelInstances,
  type Marker,
  type Placement,
  yawFromDir,
} from "./shared";
import type { Checkpoint, ColliderSpec } from "./types";

/**
 * Waypoints system: the light incidental composition that keeps the longer
 * pass-2 ribbon from ever feeling empty BETWEEN the chapter structures.
 *
 * It dresses the gaps with two kinds of beat:
 *  - SIGNPOSTS that carry an incidental line of copy from `content/dialogues.json`
 *    (a weathered crossroads sign before the workshop/bridge, a carved marker at
 *    the river crossing). These register proximity checkpoints so the beat fires
 *    as the player passes, exactly like the chapter checkpoints.
 *  - small RUINS (a broken wall fragment + a toppled column + rocks) at the
 *    mid-points between chapters, purely as set dressing with a simple collider.
 *
 * All copy still lives in content (passed in as `beats`); the engine holds no
 * strings. Every GLB is loaded once and instanced for performance.
 */

/** An incidental dialogue beat sourced from content/dialogues.json. */
export interface IncidentalBeat {
  id: string;
  speaker: string;
  lines: string[];
}

/** A signpost placement bound to a content beat id. */
interface SignpostPlacement {
  /** Path parameter where the signpost sits. */
  t: number;
  /** Lateral offset from the path centreline (sign reads from the road). */
  offset: number;
  /** Content beat id to source the speaker/lines from. */
  beatId: string;
  /** Trigger radius. */
  radius: number;
}

/** Where the signposts stand + which content beat each one speaks. */
const SIGNPOSTS: readonly SignpostPlacement[] = [
  { t: 0.16, offset: 4.6, beatId: "signpost.crossroads", radius: 5 },
  { t: BRIDGE_CROSSING_T, offset: -4.6, beatId: "signpost.bridge", radius: 5 },
];

/** Mid-gap ruin set-pieces (t values that fall between chapters). */
const RUINS: readonly { t: number; offset: number }[] = [
  { t: 0.5, offset: -6.5 },
  { t: 0.65, offset: 6.5 },
  { t: 0.82, offset: -7.0 },
];

export function buildWaypoints(
  app: pc.AppBase,
  path: Path,
  checkpoints: Checkpoint[],
  colliders: ColliderSpec[],
  markers: Marker[],
  beats: IncidentalBeat[],
): void {
  const beatsById = new Map(beats.map((b) => [b.id, b]));
  // Same shared keep-clear apron the scatter uses, so ruins/signposts never
  // intersect a building either.
  const keepClear = computeKeepClearZones(path);
  buildSignposts(app, path, checkpoints, markers, beatsById, keepClear);
  buildRuins(app, path, colliders, keepClear);
}

/** Place the content-bound signposts + their proximity checkpoints. */
function buildSignposts(
  app: pc.AppBase,
  path: Path,
  checkpoints: Checkpoint[],
  markers: Marker[],
  beatsById: Map<string, IncidentalBeat>,
  keepClear: readonly KeepClearZone[],
): void {
  const signs: Placement[] = [];
  for (const sp of SIGNPOSTS) {
    const s = path.sample(sp.t);
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;
    const x = s.position.x + rightX * sp.offset;
    const z = s.position.z + rightZ * sp.offset;
    // Skip a signpost that would stand inside a building's clean apron (its
    // checkpoint beat is dropped with it to avoid a phantom trigger).
    if (isInKeepClear(x, z, keepClear)) continue;
    const faceYaw = yawFromDir(s.tangent.x, s.tangent.z);
    signs.push({ position: [x, 0, z], yaw: faceYaw + 180, scale: 1.6 });

    const beat = beatsById.get(sp.beatId);
    if (beat) {
      checkpoints.push({
        info: {
          id: beat.id,
          speaker: beat.speaker,
          line: beat.lines[0] ?? "",
          lines: beat.lines,
        },
        // Trigger sits on the path beside the sign so it fires as you pass.
        position: new pc.Vec3(
          s.position.x + rightX * (sp.offset * 0.4),
          0,
          s.position.z + rightZ * (sp.offset * 0.4),
        ),
        radius: sp.radius,
      });
    }

    // A small warm glow at each signpost so it reads at dusk (flickers).
    const lightY = 1.6;
    const light = addPointLight(app, x, lightY, z, LAYOUT.marker.lanternIntensity);
    markers.push({
      kind: "lantern",
      light,
      baseIntensity: LAYOUT.marker.lanternIntensity,
      baseY: lightY,
      model: null,
      phase: Math.random() * 6,
    });
  }
  loadModelInstances(app, "/models/sign.glb", signs);
}

/**
 * Small ruins at the mid-gaps: a leaning wall fragment, a toppled column, and a
 * couple of rocks, with one simple collider per ruin. Pure set dressing that
 * keeps the route interesting between the chapter structures.
 */
function buildRuins(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
  keepClear: readonly KeepClearZone[],
): void {
  const walls: Placement[] = [];
  const columns: Placement[] = [];
  const rocks: Placement[] = [];
  let idx = 0;

  for (const r of RUINS) {
    const s = path.sample(r.t);
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;
    const x = s.position.x + rightX * r.offset;
    const z = s.position.z + rightZ * r.offset;
    // Skip a ruin set-piece (and its collider) inside a building's apron.
    if (isInKeepClear(x, z, keepClear)) continue;
    const faceYaw = yawFromDir(s.tangent.x, s.tangent.z);

    walls.push({ position: [x, 0, z], yaw: faceYaw + 90, scale: 2.2 });
    columns.push({
      // A toppled column lying beside the wall fragment.
      position: [x + rightX * 1.8, 0.4, z + rightZ * 1.8],
      yaw: faceYaw,
      scale: [1, 1.8, 1],
    });
    rocks.push({ position: [x - rightX * 1.6, 0, z - rightZ * 1.6], yaw: faceYaw * 1.3, scale: 1.6 });

    colliders.push({
      id: `ruin-${idx++}`,
      type: "box",
      position: [x, 1.1, z],
      halfExtents: [1.4, 1.1, 0.5],
      rotation: [0, faceYaw + 90, 0],
      role: "prop",
    });
  }

  loadModelInstances(app, "/models/build_wall.glb", walls);
  loadModelInstances(app, "/models/build_column.glb", columns);
  loadModelInstances(app, "/models/rock_small.glb", rocks);
}
