import * as pc from "playcanvas";

import type { Physics } from "./physics";
import type { Checkpoint, CheckpointInfo } from "./world/types";

/** Tunable controller values. */
const MOVE_SPEED = 6; // units / second (top speed)
const TURN_RATE = 12; // higher = snappier facing
// Acceleration ramp: how quickly the horizontal speed eases toward / away from
// the target. Higher = crisper starts/stops, lower = floatier. Frame-rate
// independent (used as 1 - e^(-rate*dt)).
const ACCEL_RATE = 12; // ease-in toward the target velocity
const DECEL_RATE = 14; // ease-out back to rest (a touch snappier than accel)
// Cinematic follow camera: a touch more distance + height, looking slightly
// down, with a gentle critically-damped catch-up so turns feel smooth.
const CAMERA_DISTANCE = 11; // how far behind the character the camera trails
const CAMERA_HEIGHT = 6.5; // how high above the character (higher = more "down" angle)
const CAMERA_SMOOTH = 3.5; // damping rate (higher = tighter follow, lower = more cinematic drift)
const LOOK_HEIGHT = 1.2; // camera aims slightly above the feet so it tilts down a touch
const LOOK_AHEAD = 2.5; // aim a little ahead of the character for a leading, cinematic framing
const BOB_FREQUENCY = 9; // walk bob cycles
const BOB_HEIGHT = 0.12; // walk bob amplitude
const BASE_Y = 0; // character feet stay on the ground plane (pre-physics idle)
// Camera collision: cast from the character's head toward the desired camera
// position; if blocked, pull the camera in to just before the hit.
const CAMERA_HEAD_HEIGHT = 1.5; // ray origin height above the feet
const CAMERA_COLLISION_MARGIN = 0.4; // keep the camera this far off the hit surface
const CAMERA_MIN_DISTANCE = 1.5; // never let the corrected pull-in get closer than this

interface ControllerOptions {
  checkpoints: Checkpoint[];
  onCheckpointChange?: (checkpoint: CheckpointInfo | null) => void;
  /** Initial facing (degrees) so the player starts looking down the path. */
  initialYaw?: number;
}

/** Shortest signed angular difference (degrees) from `a` to `b`. */
function shortestAngleDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Drives the spawned character with WASD / arrow keys, rotates it to face its
 * movement direction, applies a subtle walk bob (these models are not rigged),
 * trails a follow camera behind + above it, and reports checkpoint enter/leave.
 *
 * Movement is smoothed with an acceleration/deceleration ramp so starts and
 * stops ease in/out instead of snapping. When a {@link Physics} handle is
 * attached the horizontal motion is resolved through Rapier (slide along walls,
 * blocked by props/landmarks, confined to the corridor, crossing on the
 * bridge) and the character is placed from the resolved FEET position; the walk
 * bob is layered on purely as a visual Y offset so it never fights physics.
 * Before physics is attached the character simply idles in place (no transform
 * fallback that would later teleport once physics takes over).
 */
export class CharacterController {
  private readonly app: pc.AppBase;
  private readonly character: pc.Entity;
  private readonly camera: pc.Entity;
  private readonly options: ControllerOptions;

  private physics: Physics | null = null;

  private yaw = 0;
  private walkPhase = 0;
  private posX = 0;
  private posY = BASE_Y;
  private posZ = 0;
  // Current smoothed horizontal velocity (units/s) for the accel/decel ramp.
  private velX = 0;
  private velZ = 0;
  private activeCheckpointId: string | null = null;
  private cameraInitialized = false;

  private readonly onUpdate: (dt: number) => void;

  constructor(
    app: pc.AppBase,
    character: pc.Entity,
    camera: pc.Entity,
    options: ControllerOptions,
  ) {
    this.app = app;
    this.character = character;
    this.camera = camera;
    this.options = options;

    const start = character.getLocalPosition();
    this.posX = start.x;
    this.posY = start.y;
    this.posZ = start.z;
    this.yaw = options.initialYaw ?? 0;

    this.onUpdate = (dt: number) => this.update(dt);
    this.app.on("update", this.onUpdate);
  }

  /**
   * Attach the physics world once it has finished loading (and the character
   * capsule has been created at the spawn). From this point movement is
   * resolved through Rapier. Idempotent.
   */
  attachPhysics(physics: Physics): void {
    this.physics = physics;
    // Re-sync the visual position to the physics feet so the hand-off doesn't
    // pop (the capsule was spawned at this same position).
    const foot = physics.getCharacterFootPosition();
    this.posX = foot.x;
    this.posY = foot.y;
    this.posZ = foot.z;
  }

  private update(dt: number): void {
    const kb = this.app.keyboard;

    // ---- Read input ------------------------------------------------------
    let inputX = 0;
    let inputZ = 0;
    if (kb) {
      if (kb.isPressed(pc.KEY_W) || kb.isPressed(pc.KEY_UP)) inputZ += 1;
      if (kb.isPressed(pc.KEY_S) || kb.isPressed(pc.KEY_DOWN)) inputZ -= 1;
      if (kb.isPressed(pc.KEY_A) || kb.isPressed(pc.KEY_LEFT)) inputX -= 1;
      if (kb.isPressed(pc.KEY_D) || kb.isPressed(pc.KEY_RIGHT)) inputX += 1;
    }

    const moving = inputX !== 0 || inputZ !== 0;

    // ---- Smooth velocity ramp (ease in/out) ------------------------------
    // Target velocity is the normalized input direction at MOVE_SPEED. The
    // current velocity eases toward it (accel) or toward zero (decel) using a
    // frame-rate-independent exponential approach, so starts/stops feel smooth.
    let targetVX = 0;
    let targetVZ = 0;
    if (moving) {
      const len = Math.sqrt(inputX * inputX + inputZ * inputZ);
      targetVX = (inputX / len) * MOVE_SPEED;
      targetVZ = (inputZ / len) * MOVE_SPEED;
    }
    const rampRate = moving ? ACCEL_RATE : DECEL_RATE;
    const ramp = 1 - Math.exp(-rampRate * dt);
    this.velX = pc.math.lerp(this.velX, targetVX, ramp);
    this.velZ = pc.math.lerp(this.velZ, targetVZ, ramp);

    // ---- Face movement direction (smooth yaw) ----------------------------
    if (moving) {
      const targetYaw = Math.atan2(inputX, inputZ) * pc.math.RAD_TO_DEG;
      const delta = shortestAngleDelta(this.yaw, targetYaw);
      this.yaw += delta * Math.min(1, TURN_RATE * dt);
    }

    // ---- Walk bob (visual only; idle when still) -------------------------
    const speedSq = this.velX * this.velX + this.velZ * this.velZ;
    let bob = 0;
    if (speedSq > 0.04) {
      this.walkPhase += dt * BOB_FREQUENCY;
      bob = Math.abs(Math.sin(this.walkPhase)) * BOB_HEIGHT;
    } else {
      this.walkPhase = 0;
    }

    // ---- Advance position ------------------------------------------------
    if (this.physics) {
      // Resolve this frame's horizontal displacement through Rapier, then step
      // the world once and read back the resolved feet position.
      const dispX = this.velX * dt;
      const dispZ = this.velZ * dt;
      this.physics.moveCharacter({ x: dispX, z: dispZ }, dt);
      this.physics.step(dt);
      const foot = this.physics.getCharacterFootPosition();
      this.posX = foot.x;
      this.posY = foot.y;
      this.posZ = foot.z;
      // Bob is a VISUAL offset layered on the physics feet — never fed back in.
      this.character.setLocalPosition(this.posX, this.posY + bob, this.posZ);
    } else {
      // Physics not attached yet: idle in place (no transform-only movement
      // that would teleport once physics takes over).
      this.character.setLocalPosition(this.posX, this.posY + bob, this.posZ);
    }
    this.character.setLocalEulerAngles(0, this.yaw, 0);

    // ---- Cinematic follow camera (trails behind + above, smooth) ---------
    const yawRad = this.yaw * pc.math.DEG_TO_RAD;
    const forwardX = Math.sin(yawRad);
    const forwardZ = Math.cos(yawRad);
    let desiredX = this.posX - forwardX * CAMERA_DISTANCE;
    let desiredZ = this.posZ - forwardZ * CAMERA_DISTANCE;
    const desiredY = this.posY + CAMERA_HEIGHT;

    // Camera collision: raycast from the character's head toward the desired
    // camera position; if a static collider (wall / landmark / hill) is in the
    // way, pull the camera in to just before the hit so it never clips through.
    if (this.physics) {
      const headX = this.posX;
      const headY = this.posY + CAMERA_HEAD_HEIGHT;
      const headZ = this.posZ;
      const frac = this.physics.raycast(
        headX,
        headY,
        headZ,
        desiredX,
        desiredY,
        desiredZ,
      );
      if (frac !== null && frac < 1) {
        const dx = desiredX - headX;
        const dy = desiredY - headY;
        const dz = desiredZ - headZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        // Pull in to the hit minus a margin, clamped to a sane minimum.
        const hitDist = frac * dist;
        const corrected = Math.max(
          CAMERA_MIN_DISTANCE,
          hitDist - CAMERA_COLLISION_MARGIN,
        );
        const s = corrected / dist;
        desiredX = headX + dx * s;
        desiredZ = headZ + dz * s;
        // Leave desiredY as-is: the catch-up lerp below smooths any height
        // change so the corrected position never pops.
      }
    }

    const cam = this.camera.getLocalPosition();
    if (!this.cameraInitialized) {
      // Snap on the first frame so we don't sweep in from the origin.
      this.camera.setLocalPosition(desiredX, desiredY, desiredZ);
      this.cameraInitialized = true;
    } else {
      // Frame-rate-independent critically-damped style smoothing: the fraction
      // covered per frame is 1 - e^(-k*dt), which stays stable at any dt and
      // gives a gentle catch-up on turns (and a smooth, pop-free pull-in when
      // the camera-collision ray shortens the boom) without jitter.
      const t = 1 - Math.exp(-CAMERA_SMOOTH * dt);
      this.camera.setLocalPosition(
        pc.math.lerp(cam.x, desiredX, t),
        pc.math.lerp(cam.y, desiredY, t),
        pc.math.lerp(cam.z, desiredZ, t),
      );
    }

    // Aim a little ahead of and above the character for a leading, slightly
    // downward cinematic framing.
    this.camera.lookAt(
      this.posX + forwardX * LOOK_AHEAD,
      this.posY + LOOK_HEIGHT,
      this.posZ + forwardZ * LOOK_AHEAD,
    );

    // ---- Checkpoint detection -------------------------------------------
    this.checkCheckpoints();
  }

  private checkCheckpoints(): void {
    let active: Checkpoint | null = null;
    for (const cp of this.options.checkpoints) {
      const dx = this.posX - cp.position.x;
      const dz = this.posZ - cp.position.z;
      if (dx * dx + dz * dz <= cp.radius * cp.radius) {
        active = cp;
        break;
      }
    }

    const activeId = active ? active.info.id : null;
    if (activeId !== this.activeCheckpointId) {
      this.activeCheckpointId = activeId;
      this.options.onCheckpointChange?.(active ? active.info : null);
    }
  }

  /** Remove the update handler. Safe to call once during disposal. */
  destroy(): void {
    this.app.off("update", this.onUpdate);
  }
}
