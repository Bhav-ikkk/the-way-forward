import type * as pc from "playcanvas";

import type { Path } from "./path";
import {
  ARRIVAL_CABIN_OFFSET,
  computeKeepClearZones,
  isInKeepClear,
  type KeepClearZone,
  SPAWN_CLEARING_T,
  SPAWN_FIRE_OFFSET,
  SPAWN_T,
} from "./landmarks";
import type { Marker } from "./shared";
import { buildArrivalCabin, type StructureFrame } from "./structures";
import {
  addPointLight,
  hash01,
  LAYOUT,
  loadModel,
  loadModelInstances,
  type Placement,
  type ScenerySpec,
  yawFromDir,
} from "./shared";
import type { ColliderSpec, Interactable } from "./types";

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
 * Spawn system: the cozy, lived-in "Arrival" camp at the start of the journey.
 *
 * A campfire with a warm always-on glow sits at the heart of it, ringed by
 * benches, logs, bedrolls, and a circle of hearth stones. Framing trees/rocks
 * anchor the clearing, camp stores (a woodpile, barrels, a crate) and a
 * signpost dress the edges, two lit lanterns mark the way out onto the path, a
 * low perimeter fence encloses the camp with a wide GATE opening toward the
 * road, and tufts of grass / flowers / a mushroom or two dress the ground so
 * the camp feels inhabited rather than staged.
 *
 * Solid set pieces the player can brush (trees, rocks, logs, stores, fence
 * posts) emit `"prop"` collider specs; the hearth stones, bedrolls, sign, and
 * ground foliage are decorative and carry none. The campfire's animated point
 * light is registered as a firepit {@link Marker} so it flickers like the
 * checkpoint markers.
 */
export function buildSpawn(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
  markers: Marker[],
  interactables: Interactable[],
  arrivalTitle: string,
): SpawnResult {
  const spawnSample = path.sample(SPAWN_T);
  const spawnYaw = yawFromDir(spawnSample.tangent.x, spawnSample.tangent.z);

  const clearing = path.sample(SPAWN_CLEARING_T).position;
  // Campfire sits just off the path centre so the player doesn't spawn in it.
  const fireX = clearing.x + SPAWN_FIRE_OFFSET.x;
  const fireZ = clearing.z + SPAWN_FIRE_OFFSET.z;

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

  // ---- Hearth stone ring grounding the fire (decorative, no colliders) ---
  const hearth: Placement[] = [];
  const ringN = 7;
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    hearth.push({
      position: [fireX + Math.cos(a) * 1.5, 0, fireZ + Math.sin(a) * 1.5],
      yaw: (a * 180) / Math.PI,
      scale: 0.9 + hash01(i * 3.1) * 0.5,
    });
  }
  loadModelInstances(app, "/models/stone_small.glb", hearth);

  // ---- Benches + logs + bedrolls as seating around the fire --------------
  const benches: ScenerySpec[] = [
    { url: "/models/bench.glb", position: [fireX + 2.7, 0, fireZ], yaw: 270, scale: 1.6 },
    { url: "/models/bench.glb", position: [fireX, 0, fireZ - 2.7], yaw: 0, scale: 1.6 },
    { url: "/models/bedroll.glb", position: [fireX - 2.5, 0, fireZ - 1.4], yaw: 55, scale: 1.5 },
    { url: "/models/bedroll.glb", position: [fireX + 1.4, 0, fireZ + 2.5], yaw: 200, scale: 1.5 },
  ];

  // ---- Framing trees / rocks / logs / stores / sign ----------------------
  // Solid pieces get colliders; bedrolls/sign stay decorative.
  const framing: Array<ScenerySpec & { collider?: [number, number, number] }> = [
    { url: "/models/tree_oak.glb", position: [fireX - 6.5, 0, fireZ - 4], yaw: 20, scale: 2.8, collider: [0.4, 2.7, 0.4] },
    { url: "/models/tree_pine_big.glb", position: [fireX + 6.5, 0, fireZ - 5], yaw: 200, scale: 3.2, collider: [0.4, 3.2, 0.4] },
    { url: "/models/tree_oak.glb", position: [fireX + 7, 0, fireZ + 4.5], yaw: 120, scale: 2.6, collider: [0.4, 2.6, 0.4] },
    { url: "/models/tree_pine.glb", position: [fireX - 6, 0, fireZ + 5], yaw: 60, scale: 3.0, collider: [0.4, 3.0, 0.4] },
    { url: "/models/rock_large.glb", position: [fireX - 5.5, 0, fireZ + 3], yaw: 0, scale: 1.8, collider: [0.9, 0.7, 0.9] },
    { url: "/models/rock_small.glb", position: [fireX + 4, 0, fireZ + 2.8], yaw: 60, scale: 1.6, collider: [0.6, 0.5, 0.6] },
    // Felled logs as rustic seating beside the fire.
    { url: "/models/log.glb", position: [fireX - 2.6, 0, fireZ + 0.8], yaw: 100, scale: 1.5, collider: [0.9, 0.35, 0.4] },
    { url: "/models/log.glb", position: [fireX + 1.4, 0, fireZ - 1.6], yaw: 20, scale: 1.4, collider: [0.85, 0.35, 0.4] },
    // Camp stores: a woodpile, barrels, a crate, and a chest tucked at the edges.
    { url: "/models/woodpile.glb", position: [fireX - 4.6, 0, fireZ - 2.6], yaw: 30, scale: 1.6, collider: [1.1, 0.5, 0.5] },
    { url: "/models/barrel.glb", position: [fireX + 3.6, 0, fireZ - 3.0], yaw: 0, scale: 1.4, collider: [0.5, 0.7, 0.5] },
    { url: "/models/barrel_open.glb", position: [fireX + 4.4, 0, fireZ - 2.2], yaw: 0, scale: 1.3, collider: [0.5, 0.6, 0.5] },
    { url: "/models/crate.glb", position: [fireX - 4.0, 0, fireZ + 2.2], yaw: 25, scale: 1.4, collider: [0.5, 0.5, 0.5] },
    // A signpost pointing the way down the road, near the camp gate.
    { url: "/models/signpost_s.glb", position: [fireX + 5.0, 0, fireZ + 1.4], yaw: 240, scale: 1.7 },
    { url: "/models/sign.glb", position: [fireX + 3.5, 0, fireZ + 3.8], yaw: 200, scale: 1.5 },
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

  // ---- Two lit lanterns marking the way out onto the path ---------------
  buildCampLanterns(app, path);

  // ---- Enclosing perimeter fence with a gate toward the road ------------
  buildCampPerimeter(app, path, fireX, fireZ, colliders);

  // ---- Ground foliage so the camp feels lived-in (decorative) -----------
  // The camp dresses around its OWN fire, but still keeps clear of the cabin +
  // the along-path structures so no grass clips into a building.
  const keepClear = computeKeepClearZones(path);
  buildCampFoliage(app, fireX, fireZ, keepClear);

  // ---- Arrival cabin: the fully-built shelter beside the fire -----------
  buildArrivalShelter(app, path, colliders, markers, interactables, arrivalTitle);

  return { spawn: spawnSample.position, spawnYaw, fireX, fireZ };
}

/**
 * Drop the fully-built Arrival cabin off the right shoulder of the clearing,
 * facing back toward the camp/path so its doorway reads as you spawn. The
 * structure (walls + doorway + windows + roof + floor, a door prop, and a warm
 * lantern at the threshold) is composed by {@link buildArrivalCabin}.
 */
function buildArrivalShelter(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
  markers: Marker[],
  interactables: Interactable[],
  arrivalTitle: string,
): void {
  const cs = path.sample(SPAWN_CLEARING_T);
  const rightX = cs.tangent.z;
  const rightZ = -cs.tangent.x;
  const offset = ARRIVAL_CABIN_OFFSET; // right of the clearing, clear of the fire + seating
  const ax = cs.position.x + rightX * offset;
  const az = cs.position.z + rightZ * offset;
  const frame: StructureFrame = {
    ox: ax,
    oz: az,
    alongX: cs.tangent.x,
    alongZ: cs.tangent.z,
    intoX: rightX,
    intoZ: rightZ,
    faceYaw: yawFromDir(-rightX, -rightZ),
    marker: "lantern",
  };
  const handle = buildArrivalCabin(app, frame, colliders, markers);

  // Register the camp as an interactable. Its approach centre is the spawn
  // clearing on the path so walking the player back into camp re-highlights it
  // and lets them re-open the profile panel.
  const spawnPt = path.sample(SPAWN_T).position;
  interactables.push({
    id: "arrival-camp",
    title: arrivalTitle,
    position: spawnPt,
    radius: 7,
    setHighlight: handle.setHighlight,
  });
}

/** Two warm lit lanterns flanking the path where it leaves the camp. */
function buildCampLanterns(app: pc.AppBase, path: Path): void {
  const s = path.sample(0.12);
  const rightX = s.tangent.z;
  const rightZ = -s.tangent.x;
  const off = LAYOUT.path.width / 2 + 0.9;
  const placements: Placement[] = [];
  for (const side of [1, -1] as const) {
    const x = s.position.x + rightX * off * side;
    const z = s.position.z + rightZ * off * side;
    placements.push({ position: [x, 0, z], yaw: yawFromDir(s.tangent.x, s.tangent.z), scale: 1.4 });
    addPointLight(
      app,
      x,
      LAYOUT.lantern.lightY,
      z,
      LAYOUT.lantern.intensity,
      LAYOUT.lantern.range,
    );
  }
  loadModelInstances(app, "/models/lamp.glb", placements);
}

/**
 * A low fence ENCLOSING the spawn camp in an arc around the camp heart (the
 * fire), with a wide GATE opening facing the road so the camp reads as a
 * lived-in, defined clearing the player steps out of onto the journey. Posts
 * follow a circle around the fire; the wedge facing the path is left open and a
 * `fence_gate` is set in it. Solid posts emit low `"prop"` colliders; the open
 * gate carries none so the on-rails path passes straight through.
 */
function buildCampPerimeter(
  app: pc.AppBase,
  path: Path,
  fireX: number,
  fireZ: number,
  colliders: ColliderSpec[],
): void {
  const clearing = path.sample(SPAWN_CLEARING_T).position;
  // Direction from the fire toward the path/road (where the gate opens).
  const gateAngle = Math.atan2(clearing.z - fireZ, clearing.x - fireX);
  const R = 6.4; // perimeter radius around the fire
  const N = 16; // posts around the full circle (the gate wedge is skipped)
  const gateHalf = 1.05; // half-angle (rad, ~60°) of the open gate wedge
  const step = (Math.PI * 2) / N;

  const posts: Placement[] = [];
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const a = i * step;
    // Angular distance to the gate direction, wrapped to [-π, π].
    let d = a - gateAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < gateHalf) continue; // leave the gate wedge open

    const x = fireX + Math.cos(a) * R;
    const z = fireZ + Math.sin(a) * R;
    // Orient each panel tangent to the circle (its length lies along +Z).
    const tanX = -Math.sin(a);
    const tanZ = Math.cos(a);
    const yaw = yawFromDir(tanX, tanZ);
    posts.push({ position: [x, 0, z], yaw, scale: 1.5 });
    colliders.push({
      id: `camp-fence-${idx++}`,
      type: "box",
      position: [x, 0.5, z],
      halfExtents: [0.16, 0.5, (R * step) / 2 + 0.1],
      rotation: [0, yaw, 0],
      role: "prop",
    });
  }
  loadModelInstances(app, "/models/fence_wood.glb", posts);

  // Open gate set in the wedge facing the road (no collider — path runs through).
  const gx = fireX + Math.cos(gateAngle) * R;
  const gz = fireZ + Math.sin(gateAngle) * R;
  const gTanX = -Math.sin(gateAngle);
  const gTanZ = Math.cos(gateAngle);
  loadModelInstances(app, "/models/fence_gate.glb", [
    { position: [gx, 0, gz], yaw: yawFromDir(gTanX, gTanZ), scale: 1.6 },
  ]);
}

/** Tufts of grass, flowers, bushes, and a mushroom dressing the camp ground. */
function buildCampFoliage(
  app: pc.AppBase,
  fireX: number,
  fireZ: number,
  keepClear: readonly KeepClearZone[],
): void {
  const grass: Placement[] = [];
  const bush: Placement[] = [];
  const flowerRed: Placement[] = [];
  const flowerYellow: Placement[] = [];
  const mushroom: Placement[] = [];

  // The camp's own "spawn-camp" zone is excluded so the foliage can dress
  // around its own fire; all other building aprons (cabin + landmarks) are
  // respected so nothing clips a structure.
  const exclude = new Set(["spawn-camp"]);

  // Scatter a deterministic ring of detail around the camp, kept clear of the
  // fire itself so nothing sits in the flames.
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = hash01(i * 1.7) * Math.PI * 2;
    const r = 4.5 + hash01(i * 2.9) * 4.5; // 4.5 .. 9 from the fire
    const x = fireX + Math.cos(a) * r;
    const z = fireZ + Math.sin(a) * r;
    // Skip foliage that would clip into the cabin (or any other structure).
    if (isInKeepClear(x, z, keepClear, exclude)) continue;
    const yaw = hash01(i * 4.1) * 360;
    const p: Placement = { position: [x, 0, z], yaw, scale: 0.9 + hash01(i * 5.3) * 0.6 };
    const pick = hash01(i * 6.7);
    if (pick < 0.4) grass.push(p);
    else if (pick < 0.6) bush.push(p);
    else if (pick < 0.76) flowerRed.push(p);
    else if (pick < 0.92) flowerYellow.push(p);
    else mushroom.push({ ...p, scale: 0.8 });
  }

  loadModelInstances(app, "/models/grass.glb", grass);
  loadModelInstances(app, "/models/bush.glb", bush);
  loadModelInstances(app, "/models/flower_red.glb", flowerRed);
  loadModelInstances(app, "/models/flower_yellow.glb", flowerYellow);
  loadModelInstances(app, "/models/mushroom.glb", mushroom);
}
