import type * as pc from "playcanvas";

import type { Path } from "./path";
import { SPAWN_T } from "./landmarks";
import type { Marker } from "./checkpoint";
import {
  addPointLight,
  LAYOUT,
  loadModel,
  type ScenerySpec,
  yawFromDir,
} from "./shared";
import type { ColliderSpec } from "./types";

/** What the spawn system hands back to the orchestrator. */
export interface SpawnResult {
  /** Player spawn position (on the path). */
  spawn: pc.Vec3;
  /** Player initial facing (degrees), down the path. */
  spawnYaw: number;
  /** Campfire X (used by the NPC greeter placement). */
  fireX: number;
  /** Campfire Z (used by the NPC greeter placement). */
  fireZ: number;
}

/**
 * Spawn system: the cozy spawn camp at the start of the journey — a campfire
 * with a warm always-on glow, benches around it, framing trees/rocks, and a
 * sign. The framing trees/rocks emit `"prop"` collider specs so the player
 * bumps into them. The campfire's animated point light is registered as a
 * firepit {@link Marker} so it flickers like the checkpoint markers.
 */
export function buildSpawn(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
  markers: Marker[],
): SpawnResult {
  const spawnSample = path.sample(SPAWN_T);
  const spawnYaw = yawFromDir(spawnSample.tangent.x, spawnSample.tangent.z);

  const clearing = path.sample(0.05).position;
  // Campfire sits just off the path centre so the player doesn't spawn in it.
  const fireX = clearing.x - 3.2;
  const fireZ = clearing.z + 1.5;

  // ---- Campfire ----------------------------------------------------------
  loadModel(app, "/models/campfire.glb", (root) => {
    root.setLocalPosition(fireX, 0, fireZ);
    root.setLocalScale(1.6, 1.6, 1.6);
  });

  // Warm always-animated glow for the camp fire.
  const campLight = addPointLight(app, fireX, 1.2, fireZ, LAYOUT.marker.firepitIntensity);
  markers.push({
    kind: "firepit",
    light: campLight,
    baseIntensity: LAYOUT.marker.firepitIntensity,
    baseY: 1.2,
    model: null,
    phase: 0.7,
  });

  // ---- Benches around the fire ------------------------------------------
  const benches: ScenerySpec[] = [
    { url: "/models/bench.glb", position: [fireX + 2.6, 0, fireZ], yaw: 270, scale: 1.6 },
    { url: "/models/bench.glb", position: [fireX - 2.6, 0, fireZ - 0.4], yaw: 90, scale: 1.6 },
    { url: "/models/bench.glb", position: [fireX, 0, fireZ - 2.6], yaw: 0, scale: 1.6 },
  ];

  // ---- Framing trees / rocks / sign (trees + rocks get prop colliders) ---
  const framing: Array<ScenerySpec & { collider?: [number, number, number] }> = [
    { url: "/models/tree_oak.glb", position: [fireX - 6, 0, fireZ - 4], yaw: 20, scale: 2.6, collider: [0.4, 2.5, 0.4] },
    { url: "/models/tree_pine.glb", position: [fireX + 6, 0, fireZ - 5], yaw: 200, scale: 3.0, collider: [0.4, 3, 0.4] },
    { url: "/models/tree_oak.glb", position: [fireX + 7, 0, fireZ + 4], yaw: 120, scale: 2.4, collider: [0.4, 2.4, 0.4] },
    { url: "/models/rock_large.glb", position: [fireX - 5, 0, fireZ + 3], yaw: 0, scale: 1.8, collider: [0.9, 0.7, 0.9] },
    { url: "/models/rock_small.glb", position: [fireX + 4, 0, fireZ + 2.5], yaw: 60, scale: 1.6, collider: [0.6, 0.5, 0.6] },
    { url: "/models/sign.glb", position: [fireX + 3.5, 0, fireZ + 3.5], yaw: 200, scale: 1.5 },
  ];

  for (const s of [...benches, ...framing]) {
    loadModel(app, s.url, (root) => {
      root.setLocalPosition(s.position[0], s.position[1], s.position[2]);
      root.setEulerAngles(0, s.yaw, 0);
      root.setLocalScale(s.scale, s.scale, s.scale);
    });
  }

  for (let i = 0; i < framing.length; i++) {
    const f = framing[i];
    if (!f.collider) continue;
    colliders.push({
      id: `spawn-prop-${i}`,
      type: "box",
      position: [f.position[0], f.collider[1], f.position[2]],
      halfExtents: f.collider,
      rotation: [0, f.yaw, 0],
      role: "prop",
    });
  }

  return { spawn: spawnSample.position, spawnYaw, fireX, fireZ };
}
