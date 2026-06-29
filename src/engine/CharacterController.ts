import * as pc from "playcanvas";

import { CameraRig } from "./CameraRig";
import {
  InteractionController,
  type InteractionOptions,
} from "./InteractionController";
import type { Physics } from "./physics";
import { CHARACTER } from "./world/character.config";
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
/** Speed (units/s) below which the character is treated as idle. */
const MOVE_EPSILON = 0.05;
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
  /** Canvas element used by the camera rig for touch orbit + pinch gestures. */
  canvas?: HTMLCanvasElement | null;
  /**
   * Optional building-interaction layer. When provided, the controller builds
   * an {@link InteractionController}, feeds it the on-rails position each frame,
   * and pauses it (with movement + orbit) while a panel is open.
   */
  interaction?: InteractionOptions | null;
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
 * retracing). The skinned player's locomotion is driven by writing the current
 * absolute along-path speed into the anim `speed` float, so the state machine
 * crossfades Idle⇄Run on its own (no procedural walk bob).
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
  private readonly interaction: InteractionController | null;

  private physics: Physics | null = null;
  /** When true, movement + camera orbit + enter-input are frozen (panel open). */
  private paused = false;

  /** Distance along the path (world units), the single movement DOF. */
  private s: number;
  /** Smoothed along-path speed (units/s); signed (+ forward, - backward). */
  private speed = 0;
  /**
   * On-rails drive coming from the touch UI (the hold-to-walk control), in
   * [-1, 1]. Blended with keyboard input each frame ("max magnitude wins" so
   * the two input sources never fight). Set via {@link setMoveInput}.
   */
  private touchDrive = 0;
  private yaw = 0;
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
      options.canvas ?? null,
    );

    // Optional building-interaction layer (highlight + enter + nameplate).
    this.interaction = options.interaction
      ? new InteractionController(camera, options.interaction)
      : null;

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

  /**
   * Freeze/unfreeze player movement, camera orbit input, and enter-input. The
   * App_Framework calls this (via the engine handle's `setInputPaused`) when an
   * info panel opens/closes so the player isn't walking or spinning behind it.
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.rig.setPaused(paused);
    this.interaction?.setPaused(paused);
  }

  /**
   * Drive on-rails movement from the UI (mobile hold-to-walk control). `drive`
   * is clamped to [-1, 1]: +1 forward, -1 back, 0 idle. It is blended with the
   * keyboard each frame — whichever source has the larger magnitude wins, so
   * keyboard and touch never fight — and runs through the same accel/decel ramp.
   */
  setMoveInput(drive: number): void {
    this.touchDrive = pc.math.clamp(drive, -1, 1);
  }

  private update(dt: number): void {
    const kb = this.app.keyboard;

    // ---- Read input (forward / backward only — no strafing) -------------
    // While paused (a panel is open) all drive is suppressed so the player
    // eases to a stop and never walks behind the panel. Keyboard and the touch
    // hold-to-walk control are blended: whichever has the larger magnitude wins.
    let drive = 0;
    if (!this.paused) {
      let kbDrive = 0;
      if (kb) {
        if (kb.isPressed(pc.KEY_W) || kb.isPressed(pc.KEY_UP)) kbDrive += 1;
        if (kb.isPressed(pc.KEY_S) || kb.isPressed(pc.KEY_DOWN)) kbDrive -= 1;
      }
      drive =
        Math.abs(this.touchDrive) > Math.abs(kbDrive) ? this.touchDrive : kbDrive;
    }
    const moving = drive !== 0;

    // ---- Smooth along-path speed ramp (ease in/out + inertia) -----------
    const targetSpeed =
      drive > 0 ? WALK_SPEED * drive : drive < 0 ? REVERSE_SPEED * drive : 0;
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

    // ---- Drive the locomotion anim (idle ⇄ run via the speed float) -----
    // The skinned player carries a programmatic Idle/Run state machine (see
    // characterAnim.ts). We just feed it the current absolute along-path speed;
    // it crossfades between states on its own. Guarded so a missing/failed anim
    // component (graceful fallback) is a no-op — the player still renders/moves.
    const anim = this.character.anim;
    if (anim) {
      anim.setFloat(CHARACTER.anim.speedParam, absSpeed);
    }

    // ---- Place the character + keep the capsule in sync -----------------
    // No procedural bob: the real run cycle supplies the gait, so the feet stay
    // planted on the rail (y = BASE_Y) and the animation does the rest.
    this.character.setLocalPosition(this.posX, this.posY, this.posZ);
    this.character.setLocalEulerAngles(0, this.yaw, 0);
    if (this.physics) {
      // Snap the kinematic capsule to the on-rails feet, then step the world so
      // the collider position is committed for the camera ray.
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

    // ---- Building interaction (highlight + nearest + nameplate) ---------
    this.interaction?.update(dt, this.posX, this.posY, this.posZ);
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
    this.interaction?.destroy();
  }
}
