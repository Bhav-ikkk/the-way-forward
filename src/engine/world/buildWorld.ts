import * as pc from "playcanvas";

import profile from "../../../content/profile.json";
import { createPath } from "./path";
import { LANDMARKS, PATH_CONTROL_POINTS, WELCOME } from "./landmarks";
import { buildLighting } from "./lighting";
import { buildTerrain } from "./terrain";
import { buildRoad } from "./road";
import { buildRiver } from "./river";
import { buildSpawn } from "./spawn";
import { buildNature } from "./nature";
import { type Marker, placeLandmark, stepMarkers } from "./checkpoint";
import { buildNpc } from "./npc";
import { LAYOUT, loadModel } from "./shared";
import type {
  Checkpoint,
  CheckpointInfo,
  ColliderSpec,
  WelcomeInfo,
} from "./types";

/** Options for {@link buildWorld}. */
interface BuildWorldOptions {
  onCheckpointChange?: (checkpoint: CheckpointInfo | null) => void;
  onReady?: () => void;
  /** Fired once (after load) with the NPC greeter's welcome copy. */
  onWelcome?: (welcome: WelcomeInfo) => void;
}

/** The handcrafted world handle returned to {@link createEngine}. */
export interface World {
  /** The follow camera entity (driven by the character controller). */
  camera: pc.Entity;
  /** All checkpoints placed in the world (landmarks + NPC greeter). */
  checkpoints: Checkpoint[];
  /**
   * Declarative static collider specs (ground, path-edge walls, bridge deck,
   * scenery props, landmark bases). The later Rapier pass consumes these
   * WITHOUT re-deriving geometry. Each carries a `role` for clarity.
   */
  colliders: ColliderSpec[];
  /** Initial facing (degrees) for the player, down the path. */
  spawnYaw: number;
  /** Register a callback fired once the character entity is in the scene. */
  onCharacterReady: (cb: (character: pc.Entity) => void) => void;
  /** Tear down world-owned update handlers. */
  destroy: () => void;
}

/**
 * Thin orchestrator for the handcrafted narrative vertical slice. It owns the
 * shared placement truth (the path spline + welcome copy) and the camera, then
 * delegates to cohesive world systems that each build one concern:
 *
 * - {@link buildLighting} — sun + ambient.
 * - {@link buildTerrain}  — flat corridor ground + gentle framing hills.
 * - {@link buildRiver}    — river strip + bridge + bridge-deck collider.
 * - {@link buildRoad}     — path strip + lanterns + confinement-wall colliders.
 * - {@link buildSpawn}    — cozy spawn camp + campfire light.
 * - {@link buildNpc}      — Wren greeter + welcome checkpoint.
 * - {@link buildNature}   — scattered trees/rocks (each with a prop collider).
 * - {@link placeLandmark} — the four narrative landmarks + checkpoints/markers.
 *
 * It aggregates every system's checkpoints + collider specs onto the returned
 * {@link World} handle, and runs the shared marker flicker animation. No physics
 * is created in this pass — colliders are emitted as data only.
 */
export function buildWorld(app: pc.AppBase, options: BuildWorldOptions): World {
  const checkpoints: Checkpoint[] = [];
  const colliders: ColliderSpec[] = [];
  const markers: Marker[] = [];

  // Welcome copy, lightly personalised with the developer name from profile
  // data (the rest of the copy is authored placeholder text).
  const welcome: WelcomeInfo = {
    speaker: WELCOME.speaker,
    lines: [
      `Welcome, traveller — this is ${profile.name}'s world.`,
      ...WELCOME.lines.slice(1),
    ],
  };

  // ---- Shared placement truth: the journey path spline -------------------
  const path = createPath(PATH_CONTROL_POINTS);

  // ---- World systems -----------------------------------------------------
  buildLighting(app);
  buildTerrain(app, path, colliders);
  buildRiver(app, path, colliders);
  buildRoad(app, path, colliders);
  const camp = buildSpawn(app, path, colliders, markers);
  buildNpc(app, checkpoints, {
    fireX: camp.fireX,
    fireZ: camp.fireZ,
    spawn: camp.spawn,
    welcome,
  });
  buildNature(app, path, colliders);
  for (const lm of LANDMARKS) {
    placeLandmark(app, path, lm, checkpoints, colliders, markers);
  }

  // ---- Camera (follow camera; positioned each frame by the controller) ---
  const camera = new pc.Entity("camera");
  camera.addComponent("camera", {
    clearColor: new pc.Color(0.53, 0.81, 0.92), // sky blue
    fov: 58,
    nearClip: 0.1,
    farClip: 1000,
  });
  camera.setLocalPosition(0, 7, -10);
  camera.lookAt(0, 1, 0);
  app.root.addChild(camera);

  // ---- Character ---------------------------------------------------------
  const characterReadyCbs: Array<(character: pc.Entity) => void> = [];
  let character: pc.Entity | null = null;

  // Reveal the world once rendering AND the character load has SETTLED (success
  // or failure). A safety timeout reveals the scene regardless, so a missing
  // model can never freeze the loading screen.
  let readyFired = false;
  const fireReady = () => {
    if (readyFired) return;
    readyFired = true;
    options.onReady?.();
    options.onWelcome?.(welcome);
  };

  loadModel(
    app,
    LAYOUT.character.url,
    (root) => {
      root.setLocalPosition(camp.spawn.x, 0, camp.spawn.z);
      root.setEulerAngles(0, camp.spawnYaw, 0);
      root.setLocalScale(
        LAYOUT.character.scale,
        LAYOUT.character.scale,
        LAYOUT.character.scale,
      );
      character = root;
      for (const cb of characterReadyCbs) cb(root);
      fireReady();
    },
    fireReady,
  );

  const readyTimeout = setTimeout(fireReady, 4000);

  // ---- Marker animation (world-owned update) -----------------------------
  let elapsed = 0;
  const onUpdate = (dt: number) => {
    elapsed += dt;
    stepMarkers(markers, elapsed);
  };
  app.on("update", onUpdate);

  return {
    camera,
    checkpoints,
    colliders,
    spawnYaw: camp.spawnYaw,
    onCharacterReady: (cb) => {
      if (character) cb(character);
      else characterReadyCbs.push(cb);
    },
    destroy: () => {
      clearTimeout(readyTimeout);
      app.off("update", onUpdate);
    },
  };
}
