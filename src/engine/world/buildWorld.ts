import * as pc from "playcanvas";

import chapters from "../../../content/chapters.json";
import dialogues from "../../../content/dialogues.json";
import { createPath, type Path } from "./path";
import {
  computeEntrances,
  type EntranceLayout,
  LANDMARKS,
  PATH_CONTROL_POINTS,
  SPAWN_T,
} from "./landmarks";
import { buildLighting } from "./lighting";
import { buildAtmosphere } from "./atmosphere";
import { buildTerrain } from "./terrain";
import { buildRoad } from "./road";
import { buildRiver } from "./river";
import { buildSpawn } from "./spawn";
import { buildNature } from "./nature";
import { type Marker, placeLandmark, stepMarkers } from "./checkpoint";
import { buildWaypoints } from "./waypoints";
import { buildNpc } from "./npc";
import { setupCharacterAnimation } from "./characterAnim";
import { CHARACTER } from "./character.config";
import { LAYOUT, loadModel } from "./shared";
import type {
  Checkpoint,
  CheckpointInfo,
  ColliderSpec,
  Interactable,
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
   * All approachable+enterable chapter structures (the five along-path
   * landmarks + the arrival camp), each with its subtle highlight handle.
   */
  interactables: Interactable[];
  /**
   * Declarative static collider specs (ground, path-edge walls, bridge deck,
   * scenery props, landmark bases). The later Rapier pass consumes these
   * WITHOUT re-deriving geometry. Each carries a `role` for clarity.
   */
  colliders: ColliderSpec[];
  /** Initial facing (degrees) for the player, down the path. */
  spawnYaw: number;
  /** The journey path spline the player rides along (on-rails movement). */
  path: Path;
  /**
   * Resolved per-building ENTRANCE layout (the five chapters + the arrival
   * camp): road-spur root, building anchor, front-door point, frame axes, and
   * facing. Exposed so Stage 2 (building scale + staging) can re-stage each
   * location WITHOUT re-deriving geometry, and so the road plaza + buildings
   * stay in agreement on where each entrance is.
   */
  entrances: EntranceLayout[];
  /** Starting distance `s` (world units) along the path for the spawn point. */
  spawnDistance: number;
  /** Register a callback fired once the character entity is in the scene. */
  onCharacterReady: (cb: (character: pc.Entity) => void) => void;
  /** Tear down world-owned update handlers. */
  destroy: () => void;
}

/**
 * Thin orchestrator for the handcrafted narrative vertical slice. It owns the
 * shared placement truth (the path spline) and the camera, then delegates to
 * cohesive world systems that each build one concern:
 *
 * - {@link buildLighting} — sun + ambient.
 * - {@link buildTerrain}  — flat corridor ground + sculpted framing ridges.
 * - {@link buildRiver}    — river strip + bridge + bridge-deck collider.
 * - {@link buildRoad}     — handcrafted dirt road + entrance plazas + lanterns
 *   + confinement-wall colliders.
 * - {@link buildSpawn}    — cozy spawn camp + campfire light.
 * - {@link buildNpc}      — greeter NPC + welcome checkpoint (copy from content).
 * - {@link buildNature}   — scattered trees/rocks (each with a prop collider).
 * - {@link placeLandmark} — the narrative landmark placements + checkpoints,
 *   with all titles/dialogue sourced from content/chapters.json.
 *
 * It aggregates every system's checkpoints + collider specs onto the returned
 * {@link World} handle, and runs the shared marker flicker animation. No physics
 * is created in this pass — colliders are emitted as data only.
 */
export function buildWorld(app: pc.AppBase, options: BuildWorldOptions): World {
  const checkpoints: Checkpoint[] = [];
  const colliders: ColliderSpec[] = [];
  const markers: Marker[] = [];
  const interactables: Interactable[] = [];

  // All narrative copy is sourced from content/chapters.json, matched to engine
  // placements by chapter id. The engine itself holds no human-readable copy.
  const chaptersById = new Map(chapters.map((c) => [c.id, c]));

  // NPC greeter welcome copy comes entirely from the Arrival Camp chapter's
  // dialogue (speaker + lines) — authored in content, not the engine.
  const arrival = chaptersById.get("arrival-camp");
  const welcome: WelcomeInfo = {
    speaker: arrival?.dialogue.speaker ?? "",
    lines: arrival?.dialogue.lines ?? [],
  };

  // ---- Shared placement truth: the journey path spline -------------------
  const path = createPath(PATH_CONTROL_POINTS);

  // ---- World systems -----------------------------------------------------
  buildLighting(app);
  buildTerrain(app, path, colliders);
  buildRiver(app, path, colliders);
  buildRoad(app, path, colliders);
  const camp = buildSpawn(
    app,
    path,
    colliders,
    markers,
    interactables,
    arrival?.title ?? "",
  );
  buildNpc(app, checkpoints, {
    fireX: camp.fireX,
    fireZ: camp.fireZ,
    spawn: camp.spawn,
    welcome,
  });
  buildNature(app, path, colliders);
  for (const lm of LANDMARKS) {
    // Source each landmark's title/dialogue from its matching chapter content.
    const chapter = chaptersById.get(lm.id);
    if (!chapter) continue;
    placeLandmark(
      app,
      path,
      lm,
      {
        speaker: chapter.title,
        line: chapter.dialogue.lines[0] ?? "",
        lines: chapter.dialogue.lines,
      },
      checkpoints,
      colliders,
      markers,
      interactables,
    );
  }

  // Incidental signposts (content-sourced beats) + ruins dressing the gaps
  // between chapters so the longer route is never empty terrain.
  buildWaypoints(app, path, checkpoints, colliders, markers, dialogues);

  // ---- Camera (follow camera; positioned each frame by the controller) ---
  const camera = new pc.Entity("camera");
  camera.addComponent("camera", {
    // Matched to the atmosphere haze so the horizon blends seamlessly; the
    // atmosphere system re-asserts this plus tone mapping/exposure below.
    clearColor: new pc.Color(
      LAYOUT.atmosphere.horizonColor[0],
      LAYOUT.atmosphere.horizonColor[1],
      LAYOUT.atmosphere.horizonColor[2],
    ),
    fov: 58,
    nearClip: 0.1,
    farClip: 1000,
  });
  camera.setLocalPosition(0, 7, -10);
  camera.lookAt(0, 1, 0);
  app.root.addChild(camera);

  // ---- Atmosphere (fog + filmic grading; matched to the camera horizon) --
  buildAtmosphere(app, camera);

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
      // Wire the locomotion anim state machine (idle/run) onto the player ONLY
      // when the configured model is actually animated. The small static
      // `character.glb` (CHARACTER.animated === false) skips this entirely and
      // simply rides the procedural on-rails spline movement, so the parked
      // `player_*.glb` clips are never fetched. Fully guarded either way — a
      // missing anim component/clip still leaves the player rendering + moving.
      if (CHARACTER.animated) {
        setupCharacterAnimation(app, root);
      }
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
    interactables,
    colliders,
    spawnYaw: camp.spawnYaw,
    path,
    entrances: computeEntrances(path),
    spawnDistance: path.distanceForT(SPAWN_T),
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
