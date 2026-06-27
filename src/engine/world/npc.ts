import * as pc from "playcanvas";

import { loadModel, yawFromDir } from "./shared";
import type { Checkpoint, WelcomeInfo } from "./types";

/** Inputs the greeter placement needs from the orchestrator. */
export interface NpcOptions {
  /** Campfire X (the greeter stands near the fire). */
  fireX: number;
  /** Campfire Z. */
  fireZ: number;
  /** Player spawn position (the greeter faces it). */
  spawn: pc.Vec3;
  /** Welcome copy shown on first load and re-shown by proximity. */
  welcome: WelcomeInfo;
}

/**
 * NPC system: places Wren, the greeter, beside the campfire facing the player's
 * spawn, and registers her as a proximity checkpoint so walking back to camp
 * re-shows the welcome copy as multi-line dialogue.
 */
export function buildNpc(
  app: pc.AppBase,
  checkpoints: Checkpoint[],
  options: NpcOptions,
): void {
  const { fireX, fireZ, spawn, welcome } = options;
  const npcX = fireX - 1.6;
  const npcZ = fireZ + 1.4;

  loadModel(app, "/models/character-female.glb", (root) => {
    root.setLocalPosition(npcX, 0, npcZ);
    // Face the spawn point.
    root.setEulerAngles(0, yawFromDir(spawn.x - npcX, spawn.z - npcZ), 0);
    root.setLocalScale(1, 1, 1);
  });

  checkpoints.push({
    info: {
      id: "greeter",
      speaker: welcome.speaker,
      line: welcome.lines[0],
      lines: welcome.lines,
    },
    position: new pc.Vec3(npcX, 0, npcZ),
    radius: 5,
  });
}
