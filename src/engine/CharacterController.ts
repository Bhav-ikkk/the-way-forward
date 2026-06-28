import * as pc from "playcanvas";

import { CameraRig } from "./CameraRig";
import type { Physics } from "./physics";
import type { Path } from "./world/path";
import type { Checkpoint, CheckpointInfo } from "./world/types";

/**
 * Tunable controller values (ON-RAILS movement).
 *
 * The player is no longer a free physics body steered by WASD. Instead its
 * position is a single distance `s` (world units) along the journey path
 * spline. Forward input drives `s` up; backward input drives it down for a
 * gentle retrace; there is no lateral movement. `s` is clamped to
 * [0, pathLength] so the player can never overshoot either end of the journey.
 */
/** Forward walk speed (units/s) at full ramp. */
const WALK_SPEED = 4.2;
/** Backward (retrace) speed (units/s) — gentler than forward. */
const REVERSE_SPEED = 2.6;
// Acceleration ramp on the along-path speed: frame-rate-independent easing
// (1 - e^(-rate*dt)) so starts and stops feel cinematic rather than abrupt.
const ACCEL_RATE = 6; // ease-in toward target speed (lower = floatier start)
const DECEL_RATE = 8; // ease-out back to rest (a touch snappier than accel)
/** Yaw catch-up rate for aligning the character to the path tangent. */
const TURN_RATE = 10;
/** Speed (units/s) below which the character is treated as idle (no bob). */
const MOVE_EPSILON = 0.05;
const BOB_FREQUENCY = 9; // walk bob cycles
const BOB_HEIGHT = 0.14; // walk bob amplitude (scaled up slightly with the player)
const BASE_Y = 0; // flat corridor: the player feet stay on the ground plane

interface ControllerOptions {
  checkpoints: Checkpoint[];
  onCheckpointChange?: (checkpoint: CheckpointInfo | null) => void;
  /** The journey path spline the player rides along. */
  path: Path;
  /** Starting distance `s` (world units) along the path (the spawn point). */
  initialDistance: number;
  /** App mouse used to drive the cinematic orbit camera rig. */
  mouse?: pc.Mouse | null;
}

/** Shortest signed angular difference (degrees) from `a` to `b`. */
function shortestAngleDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Drives the spawned character ON RAILS along the journey path spline.
 *
 * Movement model: the player's position is a distance `s` along the path.
 * W / ArrowUp ramps `s` forward; S / ArrowDown ramps it backward (gentle
 * retrace); there is no strafing. The along-path speed eases in/out with an
 * acceleration/deceleration ramp + inertia so starts and stops feel cinematic,
 * and `s` is clamped to [0, length] so the player can never leave the path.
 * Each frame the character is placed at the sampled spline position (flat
 * corridor, y ≈ 0) and its yaw eases to the travel tangent (reversed when
 * retracing). A subtle walk bob is layered on as a pure VISUAL Y offset.
 *
 * Because the motion is constrained to the spline the player is inherently
 * confined to the path. When a {@link Physics} handle is attached the kinematic
 * capsule is SNAPPED to the on-rails position each frame (so the physics state
 * stays consistent and is available for the camera-collision raycast), but the
 * motion is always DERIVED from the spline, never integrated by physics.
 *
 * The cinematic orbit camera is delegated to a {@link CameraRig}, which this
 * controller feeds the player position + travel tangent every frame.
 */
export class CharacterController {
  private readonly app: pc.AppBase;
  private readonly character: pc.Entity;
  private readonly options: ControllerOptions;
  private readonly path: Path;
  private readonly pathLength: number;
  private readonly rig: CameraRig;

  private physics: Physics | null = null;

  /** Distance along the path (world units), the single movement DOF. */
  private s: number;
  /** Smoothed along-path speed (units/s); signed (+ forward, - backward). */
  private speed = 0;
  private yaw = 0;
  private walkPhase = 0;
  private posX = 0;
  private posY = BASE_Y;
  private posZ = 0;
  private activeCheckpointId: string | null = null;

  private readonly onUpdate: (dt: number) => void;

  constructor(
    app: pc.AppBase,
    character: pc.Entity,
    camera: pc.Entity,
    options: ControllerOptions,
  ) {
    this.app = app;
    this.character = character;
    this.options = options;
    this.path = options.path;
    this.pathLength = options.path.length();
    this.s = pc.math.clamp(options.initialDistance, 0, this.pathLength);

    // Place the character at the spawn sample immediately and face down-path.
    const sample = this.path.sampleByDistance(this.s);
    this.posX = sample.position.x;
    this.posY = BASE_Y;
    this.posZ = sample.position.z;
    const tangentYaw =
      Math.atan2(sample.tangent.x, sample.tangent.z) * pc.math.RAD_TO_DEG;
    this.yaw = tangentYaw;
    this.character.setLocalPosition(this.posX, this.posY, this.posZ);
    this.character.setLocalEulerAngles(0, this.yaw, 0);

    // The cinematic orbit camera rig starts behind the player along the path.
    this.rig = new CameraRig(
      camera,
      options.mouse ?? null,
      tangentYaw * pc.math.DEG_TO_RAD,
    );

    this.onUpdate = (dt: number) => this.update(dt);
    this.app.on("update", this.onUpdate);
  }

  /**
   * Attach the physics world once it has loaded. From here the kinematic
   * capsule is snapped to the on-rails position each frame and the camera rig
   * can run its collision-avoidance ray. Idempotent.
   */
  attachPhysics(physics: Physics): void {
    this.physics = physics;
    this.rig.setPhysics(physics);
    // Snap the capsule to the current on-rails feet so the hand-off is seamless.
    physics.setCharacterPosition({ x: this.posX, y: this.posY, z: this.posZ });
  }

  private update(dt: number): void {
    const kb = this.app.keyboard;

    // ---- Read input (forward / backward only — no strafing) -------------
    let drive = 0;
    if (kb) {
      if (kb.isPressed(pc.KEY_W) || kb.isPressed(pc.KEY_UP)) drive += 1;
      if (kb.isPressed(pc.KEY_S) || kb.isPressed(pc.KEY_DOWN)) drive -= 1;
    }
    const moving = drive !== 0;

    // ---- Smooth along-path speed ramp (ease in/out + inertia) -----------
    const targetSpeed =
      drive > 0 ? WALK_SPEED : drive < 0 ? -REVERSE_SPEED : 0;
    const rampRate = moving ? ACCEL_RATE : DECEL_RATE;
    const ramp = 1 - Math.exp(-rampRate * dt);
    this.speed = pc.math.lerp(this.speed, targetSpeed, ramp);

    // ---- Advance `s` and clamp to the path ------------------------------
    this.s += this.speed * dt;
    if (this.s <= 0) {
      this.s = 0;
      if (this.speed < 0) this.speed = 0; // kill residual inertia at the start
    } else if (this.s >= this.pathLength) {
      this.s = this.pathLength;
      if (this.speed > 0) this.speed = 0; // kill residual inertia at the end
    }

    // ---- Sample the spline: position + travel tangent -------------------
    const sample = this.path.sampleByDistance(this.s);
    this.posX = sample.position.x;
    this.posY = BASE_Y;
    this.posZ = sample.position.z;
    const tangentYaw =
      Math.atan2(sample.tangent.x, sample.tangent.z) * pc.math.RAD_TO_DEG;

    // ---- Align yaw to the tangent (reverse facing when retracing) -------
    const absSpeed = Math.abs(this.speed);
    if (absSpeed > MOVE_EPSILON) {
      const targetYaw = this.speed < 0 ? tangentYaw + 180 : tangentYaw;
      const delta = shortestAngleDelta(this.yaw, targetYaw);
      this.yaw += delta * Math.min(1, TURN_RATE * dt);
    }

    // ---- Walk bob (visual only; idle when stopped) ----------------------
    let bob = 0;
    if (absSpeed > MOVE_EPSILON) {
      this.walkPhase += dt * BOB_FREQUENCY;
      bob = Math.abs(Math.sin(this.walkPhase)) * BOB_HEIGHT;
    } else {
      this.walkPhase = 0;
    }

    // ---- Place the character + keep the capsule in sync -----------------
    this.character.setLocalPosition(this.posX, this.posY + bob, this.posZ);
    this.character.setLocalEulerAngles(0, this.yaw, 0);
    if (this.physics) {
      // Snap the kinematic capsule to the on-rails feet (no bob — physics state
      // tracks the rail, the bob is purely a visual flourish), then step the
      // world so the collider position is committed for the camera ray.
      this.physics.setCharacterPosition({
        x: this.posX,
        y: this.posY,
        z: this.posZ,
      });
      this.physics.step(dt);
    }

    // ---- Drive the cinematic orbit camera -------------------------------
    this.rig.update(dt, {
      x: this.posX,
      y: this.posY,
      z: this.posZ,
      tangentYaw: tangentYaw * pc.math.DEG_TO_RAD,
    });

    // ---- Checkpoint detection (distance-based against on-rails pos) -----
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

  /** Remove the update handler + camera input listeners. Safe to call once. */
  destroy(): void {
    this.app.off("update", this.onUpdate);
    this.rig.destroy();
  }
}
