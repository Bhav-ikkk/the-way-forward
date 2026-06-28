import * as pc from "playcanvas";

import type { Physics } from "./physics";

/**
 * A premium cinematic third-person orbit camera.
 *
 * The rig orbits a moving TARGET (the on-rails player). It is intentionally a
 * small, focused module: the {@link CharacterController} owns it and feeds it
 * the player's world position + travel tangent every frame via {@link update},
 * while the rig owns all of the camera FEEL:
 *
 * - DRAG TO ORBIT: holding the LEFT mouse button and moving the mouse rotates
 *   the camera (yaw + pitch) around the target. On touch devices a ONE-FINGER
 *   drag does the same, feeding the very same target-yaw/target-pitch
 *   accumulation + sensitivities so the feel matches the mouse exactly.
 * - WHEEL ZOOM: the mouse wheel dollies the boom distance between a min and max.
 *   On touch a TWO-FINGER PINCH maps to the same boom-distance clamp.
 * - TOUCH TAP PASS-THROUGH: a quick single-finger tap (little movement) never
 *   orbits — a small move threshold must be crossed before a drag begins — so
 *   the tap falls through to the InteractionController's tap-to-enter. Default
 *   page scrolling/pinch-zoom over the canvas is suppressed (preventDefault +
 *   `touch-action: none`).
 * - SPRING + INERTIA: orbit angles, boom distance and camera position all ease
 *   toward their targets with a frame-rate-independent critically-damped style
 *   smoothing; the orbit keeps a little inertia after the drag is released, then
 *   settles — no jitter, no snapping.
 * - AUTO-RECENTER: after a few idle seconds the yaw eases back to "behind the
 *   player, aligned with the path tangent" with the default downward pitch, so
 *   the player is gently re-oriented forward along the story. Recentering pauses
 *   while dragging.
 * - COLLISION AVOIDANCE: a ray is cast from the player's head toward the desired
 *   camera position (against the static scenery colliders, excluding the player
 *   capsule); if blocked, the boom is pulled in to just before the hit and the
 *   correction is smoothed so there is never any popping.
 *
 * All angles are kept in RADIANS internally. `pitch` is the camera's ELEVATION
 * above the target's horizontal plane: a higher pitch lifts the camera and tilts
 * the framing further DOWN. `orbitYaw` is the azimuth of the camera RELATIVE to
 * the target (the direction pointing FROM the target TO the camera on the XZ
 * plane), so "behind the player" is the travel tangent yaw + 180°.
 */

// ---- Tunable constants (adjust here to change the camera feel) -----------

/** Boom distance limits (world units) the wheel zooms between. */
const DISTANCE_MIN = 6;
const DISTANCE_MAX = 18;
/** Default boom distance on spawn. */
const DISTANCE_DEFAULT = 10.5;
/** Wheel zoom step (world units per wheel notch). */
const ZOOM_SPEED = 1.5;

/** Pitch (camera elevation) clamp + default, in DEGREES then converted. */
// Camera elevation range. Lower bound is slightly below the horizon (view tilts
// up ~8°); upper bound lifts the camera high for a ~35°-down cinematic look.
const PITCH_MIN_DEG = -8;
const PITCH_MAX_DEG = 35;
/** Gentle default downward tilt the idle-recenter settles to. */
const PITCH_DEFAULT_DEG = 16;

/** Drag sensitivity (radians of orbit per pixel of mouse movement). */
const YAW_SENSITIVITY = 0.0075;
const PITCH_SENSITIVITY = 0.006;

/**
 * Touch tuning. The one-finger drag reuses the same yaw/pitch accumulation +
 * sensitivities as the mouse (so the feel matches), but a small global scale
 * keeps a phone from feeling twitchy under a fast thumb. A drag only begins
 * once the finger has moved past {@link TOUCH_DRAG_THRESHOLD} CSS pixels from
 * its start, so a quick tap never orbits and falls through to tap-to-enter.
 */
const TOUCH_DRAG_SCALE = 0.85;
const TOUCH_DRAG_THRESHOLD = 8;
/** Two-finger pinch: world units of boom change per pixel of pinch-distance. */
const PINCH_ZOOM_SENSITIVITY = 0.03;

/**
 * Spring smoothing rates (per second). The fraction applied each frame is
 * `1 - e^(-rate*dt)`, which is stable at any frame rate and behaves like a
 * critically-damped catch-up. Higher = tighter/snappier, lower = floatier.
 */
const YAW_SPRING = 9;
const PITCH_SPRING = 9;
const DISTANCE_SPRING = 8;
const POSITION_SPRING = 12;
/** Collision pull-in smoothing (kept brisk so we never clip, slow back out). */
const COLLISION_IN_SPRING = 30;
const COLLISION_OUT_SPRING = 6;

/** Orbit inertia: how quickly the post-release glide decays (per second). */
const INERTIA_DAMP = 6;
/** Below this angular speed (rad/s) the inertia glide is considered settled. */
const INERTIA_MIN_SPEED = 0.02;

/** Idle time (seconds) without dragging before auto-recenter begins. */
const RECENTER_DELAY = 3.5;
/** How fast the yaw eases back behind the player once recentering (per second). */
const RECENTER_SPRING = 2.2;

/** Look-target + ray origin height above the player's feet (world units).
 * Raised in pass 2 to frame the taller ~3.0u player at chest/head height. */
const HEAD_HEIGHT = 2.5;
/** Keep the camera this far off any surface it would otherwise clip. */
const COLLISION_MARGIN = 0.4;
/** Never let the corrected pull-in get closer to the head than this. */
const COLLISION_MIN_DISTANCE = 1.2;

const DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;

/** Wrap an angle to (-π, π]. */
function wrapAngle(a: number): number {
  let r = a % TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  if (r <= -Math.PI) r += TWO_PI;
  return r;
}

/** Shortest signed angular difference (radians) from `a` to `b`. */
function shortestAngle(a: number, b: number): number {
  return wrapAngle(b - a);
}

/** Pixel distance between the first two active touches (for pinch zoom). */
function touchDistance(e: TouchEvent): number {
  const a = e.touches[0];
  const b = e.touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** A plain target the controller feeds the rig each frame. */
export interface CameraTarget {
  /** Player feet world position (y ≈ 0). */
  x: number;
  y: number;
  z: number;
  /** Yaw (radians) of the direction of travel along the path tangent. */
  tangentYaw: number;
}

/**
 * The cinematic orbit camera rig. Construct once with the camera entity and the
 * app's mouse; drive it each frame with {@link update}; free its input
 * listeners with {@link destroy}.
 */
export class CameraRig {
  private readonly camera: pc.Entity;
  private readonly mouse: pc.Mouse | null;
  private readonly canvas: HTMLCanvasElement | null;

  private physics: Physics | null = null;

  // ---- Orbit state (smoothed actual + targets) --------------------------
  private orbitYaw: number;
  private targetYaw: number;
  private pitch: number = PITCH_DEFAULT_DEG * DEG_TO_RAD;
  private targetPitch: number = PITCH_DEFAULT_DEG * DEG_TO_RAD;
  private distance: number = DISTANCE_DEFAULT;
  private targetDistance: number = DISTANCE_DEFAULT;
  /** Smoothed collision-corrected boom distance. */
  private correctedDistance: number = DISTANCE_DEFAULT;

  // ---- Drag / inertia / idle state --------------------------------------
  private dragging = false;
  private paused = false;
  private pendingDX = 0;
  private pendingDY = 0;
  private yawVelocity = 0;
  private idleTime = 0;
  private initialized = false;

  // ---- Touch gesture state (one-finger orbit + two-finger pinch) --------
  /** True once a single-finger drag has crossed the move threshold. */
  private touchDragging = false;
  /** Identifier of the finger driving the single-finger orbit (or null). */
  private touchId: number | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchLastX = 0;
  private touchLastY = 0;
  /** True while two fingers are down (pinch-zoom). */
  private pinchActive = false;
  private pinchPrevDist = 0;

  // Bound handlers so they can be removed on destroy (no leaks).
  private readonly onMouseDown: (e: pc.MouseEvent) => void;
  private readonly onMouseUp: (e: pc.MouseEvent) => void;
  private readonly onMouseMove: (e: pc.MouseEvent) => void;
  private readonly onMouseWheel: (e: pc.MouseEvent) => void;
  private readonly onTouchStart: (e: TouchEvent) => void;
  private readonly onTouchMove: (e: TouchEvent) => void;
  private readonly onTouchEnd: (e: TouchEvent) => void;

  constructor(
    camera: pc.Entity,
    mouse: pc.Mouse | null,
    initialTangentYaw = 0,
    canvas: HTMLCanvasElement | null = null,
  ) {
    this.camera = camera;
    this.mouse = mouse;
    this.canvas = canvas;
    // Start behind the player, aligned with the initial travel direction.
    this.orbitYaw = wrapAngle(initialTangentYaw + Math.PI);
    this.targetYaw = this.orbitYaw;

    this.onMouseDown = (e) => {
      if (e.button === pc.MOUSEBUTTON_LEFT) {
        this.dragging = true;
        this.yawVelocity = 0;
      }
    };
    this.onMouseUp = (e) => {
      if (e.button === pc.MOUSEBUTTON_LEFT) {
        this.dragging = false;
      }
    };
    this.onMouseMove = (e) => {
      if (!this.dragging) return;
      this.pendingDX += e.dx;
      this.pendingDY += e.dy;
    };
    this.onMouseWheel = (e) => {
      this.targetDistance = pc.math.clamp(
        this.targetDistance - e.wheelDelta * ZOOM_SPEED,
        DISTANCE_MIN,
        DISTANCE_MAX,
      );
    };

    // ---- Touch handlers: one-finger orbit + two-finger pinch ------------
    // DOM touch events on the canvas (PlayCanvas' Mouse covers only mouse).
    // preventDefault stops the page from scrolling / pinch-zooming so the
    // gesture controls the camera. A single-finger gesture only begins
    // orbiting once it crosses TOUCH_DRAG_THRESHOLD, so a quick tap never
    // orbits and passes through to the InteractionController's tap-to-enter.
    this.onTouchStart = (e) => {
      e.preventDefault();
      if (this.paused) return;
      if (e.touches.length >= 2) {
        // Two fingers down → pinch zoom; abandon any single-finger drag.
        this.touchDragging = false;
        this.touchId = null;
        this.pinchActive = true;
        this.pinchPrevDist = touchDistance(e);
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        this.touchId = t.identifier;
        this.touchStartX = this.touchLastX = t.clientX;
        this.touchStartY = this.touchLastY = t.clientY;
        this.touchDragging = false;
        this.pinchActive = false;
        this.yawVelocity = 0; // stop any inertia glide while a finger is down
      }
    };
    this.onTouchMove = (e) => {
      e.preventDefault();
      if (this.paused) return;
      if (this.pinchActive && e.touches.length >= 2) {
        // Map pinch-distance delta to the same boom-distance clamp as wheel:
        // spreading fingers (distance grows) dollies IN (distance shrinks).
        const dist = touchDistance(e);
        const delta = dist - this.pinchPrevDist;
        this.pinchPrevDist = dist;
        this.targetDistance = pc.math.clamp(
          this.targetDistance - delta * PINCH_ZOOM_SENSITIVITY,
          DISTANCE_MIN,
          DISTANCE_MAX,
        );
        this.idleTime = 0;
        return;
      }
      if (e.touches.length === 1 && this.touchId !== null) {
        const t = e.touches[0];
        const dx = t.clientX - this.touchLastX;
        const dy = t.clientY - this.touchLastY;
        this.touchLastX = t.clientX;
        this.touchLastY = t.clientY;
        if (!this.touchDragging) {
          const moved = Math.hypot(
            t.clientX - this.touchStartX,
            t.clientY - this.touchStartY,
          );
          if (moved < TOUCH_DRAG_THRESHOLD) return; // still a tap, don't orbit
          this.touchDragging = true;
        }
        // Feed the same pending-delta accumulation the mouse drag uses; the
        // update loop applies YAW/PITCH_SENSITIVITY + inertia identically.
        this.pendingDX += dx * TOUCH_DRAG_SCALE;
        this.pendingDY += dy * TOUCH_DRAG_SCALE;
      }
    };
    this.onTouchEnd = (e) => {
      if (this.paused) {
        this.touchDragging = false;
        this.pinchActive = false;
        this.touchId = null;
        return;
      }
      if (e.touches.length === 0) {
        // All fingers up: end the drag (any built-up yawVelocity now glides).
        this.touchDragging = false;
        this.pinchActive = false;
        this.touchId = null;
      } else if (e.touches.length === 1) {
        // Dropped from pinch back to one finger: restart single-drag tracking
        // from the remaining finger so it doesn't jump.
        this.pinchActive = false;
        const t = e.touches[0];
        this.touchId = t.identifier;
        this.touchStartX = this.touchLastX = t.clientX;
        this.touchStartY = this.touchLastY = t.clientY;
        this.touchDragging = false;
      }
    };

    if (mouse) {
      // Suppress the browser context menu so right-drag/extra clicks never
      // interrupt the orbit interaction.
      mouse.disableContextMenu();
      mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
      mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
      mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
      mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
    }

    if (canvas) {
      // `passive: false` so preventDefault is honoured and the page never
      // scrolls / pinch-zooms while a gesture is driving the camera.
      canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
      canvas.addEventListener("touchend", this.onTouchEnd);
      canvas.addEventListener("touchcancel", this.onTouchEnd);
    }
  }

  /** Attach the physics handle so the collision-avoidance ray can run. */
  setPhysics(physics: Physics): void {
    this.physics = physics;
  }

  /**
   * Pause/resume orbit INPUT. While paused (a panel is open) drag, inertia and
   * auto-recenter are suspended and any pending mouse delta is discarded, so the
   * camera holds steady behind the panel; it still springs to its current
   * targets so there is no popping when input resumes.
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.dragging = false;
      this.touchDragging = false;
      this.pinchActive = false;
      this.touchId = null;
      this.pendingDX = 0;
      this.pendingDY = 0;
      this.yawVelocity = 0;
    }
  }

  /**
   * Advance the rig one frame. `target` is the player's feet position + travel
   * tangent yaw. Places + aims the camera entity.
   */
  update(dt: number, target: CameraTarget): void {
    // ---- Apply drag input / inertia / idle-recenter to the targets ------
    if (this.paused) {
      // Suspended while a panel is open: drop any queued input and hold.
      this.pendingDX = 0;
      this.pendingDY = 0;
    } else if (this.dragging || this.touchDragging) {
      this.targetYaw = wrapAngle(this.targetYaw - this.pendingDX * YAW_SENSITIVITY);
      this.targetPitch = pc.math.clamp(
        this.targetPitch - this.pendingDY * PITCH_SENSITIVITY,
        PITCH_MIN_DEG * DEG_TO_RAD,
        PITCH_MAX_DEG * DEG_TO_RAD,
      );
      // Track angular velocity for the post-release inertia glide.
      if (dt > 1e-5) {
        this.yawVelocity = (-this.pendingDX * YAW_SENSITIVITY) / dt;
      }
      this.pendingDX = 0;
      this.pendingDY = 0;
      this.idleTime = 0;
    } else {
      // Post-release inertia: keep gliding, decaying smoothly, then settle.
      if (Math.abs(this.yawVelocity) > INERTIA_MIN_SPEED) {
        this.targetYaw = wrapAngle(this.targetYaw + this.yawVelocity * dt);
        this.yawVelocity *= Math.exp(-INERTIA_DAMP * dt);
      } else {
        this.yawVelocity = 0;
      }
      this.idleTime += dt;

      // Auto-recenter behind the player once idle (and inertia has mostly
      // settled), easing yaw to the travel tangent + 180° and pitch to default.
      if (this.idleTime > RECENTER_DELAY && this.yawVelocity === 0) {
        const behind = wrapAngle(target.tangentYaw + Math.PI);
        const t = 1 - Math.exp(-RECENTER_SPRING * dt);
        this.targetYaw = wrapAngle(
          this.targetYaw + shortestAngle(this.targetYaw, behind) * t,
        );
        this.targetPitch = pc.math.lerp(
          this.targetPitch,
          PITCH_DEFAULT_DEG * DEG_TO_RAD,
          t,
        );
      }
    }

    // ---- Spring the smoothed orbit state toward the targets -------------
    const yawT = 1 - Math.exp(-YAW_SPRING * dt);
    const pitchT = 1 - Math.exp(-PITCH_SPRING * dt);
    const distT = 1 - Math.exp(-DISTANCE_SPRING * dt);
    this.orbitYaw = wrapAngle(
      this.orbitYaw + shortestAngle(this.orbitYaw, this.targetYaw) * yawT,
    );
    this.pitch = pc.math.lerp(this.pitch, this.targetPitch, pitchT);
    this.distance = pc.math.lerp(this.distance, this.targetDistance, distT);

    // ---- Compute the desired camera position from the orbit -------------
    const headX = target.x;
    const headY = target.y + HEAD_HEIGHT;
    const headZ = target.z;

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    // Unit boom direction from the head outward to the camera.
    const dirX = Math.sin(this.orbitYaw) * cosP;
    const dirY = sinP;
    const dirZ = Math.cos(this.orbitYaw) * cosP;

    // ---- Collision avoidance: pull the boom in before any scenery hit ---
    let allowedDistance = this.distance;
    if (this.physics) {
      const camX = headX + dirX * this.distance;
      const camY = headY + dirY * this.distance;
      const camZ = headZ + dirZ * this.distance;
      const frac = this.physics.raycast(headX, headY, headZ, camX, camY, camZ);
      if (frac !== null && frac < 1) {
        const hitDist = frac * this.distance;
        allowedDistance = Math.max(
          COLLISION_MIN_DISTANCE,
          hitDist - COLLISION_MARGIN,
        );
      }
    }
    // Smooth the correction: snap in quickly (never clip), ease back out slowly.
    const collSpring =
      allowedDistance < this.correctedDistance
        ? COLLISION_IN_SPRING
        : COLLISION_OUT_SPRING;
    const collT = 1 - Math.exp(-collSpring * dt);
    this.correctedDistance = pc.math.lerp(
      this.correctedDistance,
      allowedDistance,
      collT,
    );

    const desiredX = headX + dirX * this.correctedDistance;
    const desiredY = headY + dirY * this.correctedDistance;
    const desiredZ = headZ + dirZ * this.correctedDistance;

    // ---- Place + aim the camera (snap on first frame, then spring) ------
    if (!this.initialized) {
      this.camera.setLocalPosition(desiredX, desiredY, desiredZ);
      this.initialized = true;
    } else {
      const posT = 1 - Math.exp(-POSITION_SPRING * dt);
      const cur = this.camera.getLocalPosition();
      this.camera.setLocalPosition(
        pc.math.lerp(cur.x, desiredX, posT),
        pc.math.lerp(cur.y, desiredY, posT),
        pc.math.lerp(cur.z, desiredZ, posT),
      );
    }
    // Aim at the head: since the camera sits above (positive pitch elevation),
    // this yields the gentle downward cinematic framing.
    this.camera.lookAt(headX, headY, headZ);
  }

  /** Remove all input listeners. Safe to call once during disposal. */
  destroy(): void {
    if (this.mouse) {
      this.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
      this.mouse.off(pc.EVENT_MOUSEUP, this.onMouseUp, this);
      this.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
      this.mouse.off(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
    }
    if (this.canvas) {
      this.canvas.removeEventListener("touchstart", this.onTouchStart);
      this.canvas.removeEventListener("touchmove", this.onTouchMove);
      this.canvas.removeEventListener("touchend", this.onTouchEnd);
      this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    }
  }
}
