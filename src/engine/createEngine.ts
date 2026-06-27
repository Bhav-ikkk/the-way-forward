import * as pc from "playcanvas";

import { buildWorld } from "./world/buildWorld";
import { CharacterController } from "./CharacterController";
import { createPhysics, type Physics } from "./physics";
import type { CheckpointInfo, WelcomeInfo } from "./world/types";

/**
 * Callback invoked whenever the character enters or leaves a checkpoint
 * trigger radius. `null` means "no active checkpoint" (the character is not
 * inside any trigger). The App_Framework HUD uses this to show/hide dialogue.
 */
export type CheckpointChangeHandler = (checkpoint: CheckpointInfo | null) => void;

/** Optional hooks the App_Framework can pass into the engine. */
export interface CreateEngineOptions {
  /** Fired when the active checkpoint changes (enter/leave a trigger). */
  onCheckpointChange?: CheckpointChangeHandler;
  /** Fired once the handcrafted world + character have finished loading. */
  onReady?: () => void;
  /** Fired once (after load) with the NPC greeter's welcome copy. */
  onWelcome?: (welcome: WelcomeInfo) => void;
  /**
   * Enable the Rapier physics world (character movement + static world
   * collision). Defaults to `true`. Set `false` to run a pure-transform engine
   * (used by unit tests so WASM/physics never loads).
   */
  enablePhysics?: boolean;
}

/**
 * A handle to a running Render_Engine instance.
 *
 * - `app` is the live PlayCanvas application instance (Requirement 7.5).
 * - `dispose()` destroys the instance and releases GPU/engine resources
 *   (Requirement 7.3). It is safe to call more than once.
 */
export interface EngineHandle {
  app: pc.AppBase;
  dispose: () => void;
}

/**
 * Create a Render_Engine instance bound to the supplied canvas.
 *
 * This is the ONLY place browser-only globals (`window`, `document`, and the
 * WebGL context obtained from the canvas) are touched. It is only ever called
 * from a client-side `useEffect` inside {@link EngineMount}, so the import and
 * execution never run during server-side rendering (Requirement 7.2, 7.6).
 *
 * It builds a playable handcrafted vertical slice: lighting, a follow camera,
 * ground/road/river/bridge, scattered scenery, a walkable character, and a
 * checkpoint trigger that drives data-driven dialogue.
 *
 * @param canvas - The canvas element the engine renders into.
 * @param options - Optional lifecycle hooks (checkpoint + ready callbacks).
 * @returns An {@link EngineHandle} exposing the app and a `dispose()` cleanup.
 */
export function createEngine(
  canvas: HTMLCanvasElement,
  options: CreateEngineOptions = {},
): EngineHandle {
  // Input devices: mouse on the canvas, keyboard on the window so WASD/arrows
  // are captured wherever focus lands.
  const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: {
      antialias: true,
    },
  });

  // Fill the window and track its size automatically. Cap the device pixel
  // ratio to keep the fragment workload within the performance budget.
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

  const onResize = () => app.resizeCanvas();
  window.addEventListener("resize", onResize);

  app.start();

  // Build the handcrafted world. This wires up lighting, camera, terrain, and
  // kicks off async GLB loads; the character controller is attached once the
  // character entity exists.
  const world = buildWorld(app, {
    onCheckpointChange: options.onCheckpointChange,
    onReady: options.onReady,
    onWelcome: options.onWelcome,
  });

  let controller: CharacterController | null = null;
  let physics: Physics | null = null;
  let character: pc.Entity | null = null;
  let capsuleSpawned = false;
  let disposed = false;

  const enablePhysics = options.enablePhysics ?? true;

  // Create the character capsule + attach physics once BOTH the physics world
  // and the character entity are ready (either may arrive first). Idempotent.
  const linkPhysicsToCharacter = () => {
    if (!physics || !character || capsuleSpawned) return;
    const feet = character.getLocalPosition();
    physics.createCharacter({ x: feet.x, y: feet.y, z: feet.z });
    capsuleSpawned = true;
    controller?.attachPhysics(physics);
  };

  world.onCharacterReady((char) => {
    character = char;
    controller = new CharacterController(app, char, world.camera, {
      checkpoints: world.checkpoints,
      onCheckpointChange: options.onCheckpointChange,
      initialYaw: world.spawnYaw,
    });
    linkPhysicsToCharacter();
  });

  // Kick off physics asynchronously WITHOUT blocking the synchronous handle
  // return. Rapier (and its WASM) loads lazily via a dynamic import inside
  // createPhysics, so nothing physics-related touches the server or tests.
  if (enablePhysics) {
    createPhysics()
      .then((p) => {
        if (disposed) {
          p.destroy(); // engine was torn down before physics finished loading
          return;
        }
        physics = p;
        p.addStaticColliders(world.colliders);
        linkPhysicsToCharacter();
      })
      .catch((err) => {
        // A physics failure must never break the (visual) world; the character
        // simply idles. Log for diagnosis.
        console.error("[engine] physics initialization failed", err);
      });
  }

  const dispose = () => {
    if (disposed) return; // safe to call once (Req 7.3)
    disposed = true;
    window.removeEventListener("resize", onResize);
    controller?.destroy();
    world.destroy();
    physics?.destroy(); // free the Rapier world (if it finished loading)
    app.destroy(); // releases GPU/engine resources (Req 7.3)
  };

  return { app, dispose };
}
