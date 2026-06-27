/**
 * Rapier physics integration for the Render_Engine (pass 2).
 *
 * This module owns the SINGLE Rapier world used by the slice. It is responsible
 * for character MOVEMENT and STATIC world COLLISION only — there are no dynamic
 * rigid bodies and nothing falls. The design is deliberately small and
 * performant:
 *
 *   - ONE `World` with downward gravity.
 *   - N fixed (static) colliders built directly from the pass-1
 *     {@link ColliderSpec} list (ground / walls / bridge / props / landmarks).
 *   - ONE kinematic capsule character driven by a `KinematicCharacterController`
 *     that resolves collisions (slide along walls, can't pass props/landmarks,
 *     can't leave the corridor, crosses on the raised bridge deck).
 *   - ONE `step()` per frame.
 *
 * HARD CONSTRAINT — server / unit-test safety: `@dimforge/rapier3d-compat`
 * (which bundles its WASM as base64) is imported ONLY via the DYNAMIC
 * `import(...)` inside {@link createPhysics}. Nothing in this module touches
 * Rapier at module-evaluation time, so importing this file never loads WASM on
 * the server or during Vitest. `createPhysics` is only ever awaited on the
 * client, behind the `ssr:false` Engine_Mount.
 *
 * This module also intentionally does NOT import `playcanvas`: it speaks in
 * plain `{x, y, z}` numbers so it stays a pure, isolated physics layer.
 */

import type * as RapierNamespace from "@dimforge/rapier3d-compat";

import type { ColliderSpec } from "../world/types";

// ---- Tunable constants (adjust here) -------------------------------------

/** Gravity (world units / s²). A touch stronger than Earth for snappy falls. */
const GRAVITY_Y = -20;

/**
 * Character capsule dimensions. A capsule is `2*halfHeight` of straight body
 * capped by two hemispheres of `radius`, so the total height is
 * `2*(halfHeight + radius)` ≈ 1.9u — a believable ~human silhouette against the
 * ~1.7u-tall character art. The capsule CENTRE therefore sits
 * `radius + halfHeight` above the feet (see {@link CAPSULE_CENTER_OFFSET}).
 */
const CAPSULE_RADIUS = 0.35;
const CAPSULE_HALF_HEIGHT = 0.6;
/** Vertical distance from the capsule centre down to the feet. */
const CAPSULE_CENTER_OFFSET = CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT; // 0.95

/** Collision gap kept between the character and the world (controller offset). */
const CHARACTER_OFFSET = 0.02;

/**
 * Autostep lets the character walk up small ledges without jumping. The pass-1
 * bridge deck sits ~0.8u proud of the continuous ground plane, so the max step
 * height is tuned to comfortably mount the bridge (the journey's landmarks all
 * lie PAST the river crossing, so the bridge MUST be traversable). `minWidth`
 * is the clear space required on top of a step before it counts.
 */
const AUTOSTEP_MAX_HEIGHT = 0.9;
const AUTOSTEP_MIN_WIDTH = 0.3;
const AUTOSTEP_INCLUDE_DYNAMIC = true;

/**
 * Snap-to-ground glues the character back down within this distance when it
 * walks off a small ledge (e.g. stepping off the far end of the bridge), so
 * descents stay smooth instead of turning into little hops. Sized to match the
 * bridge deck height for a clean step-down.
 */
const SNAP_TO_GROUND = 0.9;

/** Max slope (deg) the character can climb, and min slope (deg) before it slides. */
const MAX_SLOPE_CLIMB_DEG = 45;
const MIN_SLOPE_SLIDE_DEG = 30;

const DEG_TO_RAD = Math.PI / 180;

// ---- Public types ---------------------------------------------------------

/** A plain 3D vector. The physics layer never speaks `pc.Vec3`. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Result of a single {@link Physics.moveCharacter} call. */
export interface MoveResult {
  /** New capsule-centre translation after collision resolution. */
  position: Vec3Like;
  /** Whether the character is standing on the ground this frame. */
  grounded: boolean;
}

/**
 * The physics handle handed to {@link createEngine} / the character controller.
 * All methods are no-ops-safe before {@link Physics.createCharacter} is called.
 */
export interface Physics {
  /** Build one fixed rigid body + cuboid collider per pass-1 spec. */
  addStaticColliders(specs: ColliderSpec[]): void;
  /**
   * Create the kinematic capsule + character controller at the given FEET
   * position (the capsule centre is offset upward automatically).
   */
  createCharacter(feet: Vec3Like): void;
  /**
   * Move the character by a horizontal displacement (already dt-scaled),
   * applying gravity and resolving collisions. Returns the new capsule-centre
   * translation and grounded flag. Call {@link Physics.step} afterwards to
   * commit the kinematic move.
   */
  moveCharacter(horizontalDisplacement: { x: number; z: number }, dt: number): MoveResult;
  /** World-space FEET position of the capsule (centre minus the vertical offset). */
  getCharacterFootPosition(): Vec3Like;
  /**
   * Cast a ray (excluding the character) from → to. Returns the hit fraction in
   * [0, 1] along the segment, or `null` if nothing was hit. Used for camera
   * collision (pull-in to avoid clipping through walls/landmarks/hills).
   */
  raycast(
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
  ): number | null;
  /** Advance the simulation by `dt` seconds (called once per frame). */
  step(dt: number): void;
  /** Free the world and all Rapier resources. Safe to call once. */
  destroy(): void;
}

// ---- Rapier type aliases (derived from the dynamic module's types) --------
//
// This is a TYPE-ONLY import: TypeScript erases it entirely, so it emits NO
// runtime `require`/`import` of Rapier. The actual module (and its WASM) is
// pulled in solely by the dynamic `import(...)` inside `createPhysics`, keeping
// it off the server and out of unit tests.
type RapierModule = typeof RapierNamespace;
type RapierWorld = InstanceType<RapierModule["World"]>;
type RapierRigidBody = InstanceType<RapierModule["RigidBody"]>;
type RapierCollider = InstanceType<RapierModule["Collider"]>;
type RapierCharacterController = InstanceType<RapierModule["KinematicCharacterController"]>;

// ---- Helpers ---------------------------------------------------------------

/**
 * Convert an Euler rotation in DEGREES (XYZ) to a quaternion using the exact
 * same convention as PlayCanvas `Quat.setFromEulerAngles`, so each static
 * collider's orientation matches the visual entity it shadows 1:1 (important
 * for the tangent-oriented confinement walls and the angled bridge deck).
 */
function eulerDegToQuat(
  rotation: [number, number, number],
): { x: number; y: number; z: number; w: number } {
  const halfToRad = 0.5 * DEG_TO_RAD;
  const ex = rotation[0] * halfToRad;
  const ey = rotation[1] * halfToRad;
  const ez = rotation[2] * halfToRad;

  const sx = Math.sin(ex);
  const cx = Math.cos(ex);
  const sy = Math.sin(ey);
  const cy = Math.cos(ey);
  const sz = Math.sin(ez);
  const cz = Math.cos(ez);

  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
}

// ---- Implementation --------------------------------------------------------

class RapierPhysics implements Physics {
  private readonly RAPIER: RapierModule;
  private readonly world: RapierWorld;

  private charBody: RapierRigidBody | null = null;
  private charCollider: RapierCollider | null = null;
  private controller: RapierCharacterController | null = null;

  /** Vertical velocity (units/s) integrated for gravity + grounding. */
  private verticalVelocity = 0;

  private destroyed = false;

  constructor(RAPIER: RapierModule, world: RapierWorld) {
    this.RAPIER = RAPIER;
    this.world = world;
  }

  addStaticColliders(specs: ColliderSpec[]): void {
    const { RigidBodyDesc, ColliderDesc } = this.RAPIER;
    for (const spec of specs) {
      const [px, py, pz] = spec.position;
      const [hx, hy, hz] = spec.halfExtents;
      const q = eulerDegToQuat(spec.rotation);

      // All pass-1 roles are static: one fixed body carrying one cuboid.
      const bodyDesc = RigidBodyDesc.fixed()
        .setTranslation(px, py, pz)
        .setRotation(q);
      const body = this.world.createRigidBody(bodyDesc);
      this.world.createCollider(ColliderDesc.cuboid(hx, hy, hz), body);
    }
  }

  createCharacter(feet: Vec3Like): void {
    if (this.charBody) return; // only one character

    const { RigidBodyDesc, ColliderDesc } = this.RAPIER;

    // Kinematic position-based body: WE move it explicitly each frame via the
    // character controller; the solver never pushes it around.
    const centerY = feet.y + CAPSULE_CENTER_OFFSET;
    const bodyDesc = RigidBodyDesc.kinematicPositionBased().setTranslation(
      feet.x,
      centerY,
      feet.z,
    );
    this.charBody = this.world.createRigidBody(bodyDesc);
    this.charCollider = this.world.createCollider(
      ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS),
      this.charBody,
    );

    // Character controller tuned for smooth ground locomotion.
    const controller = this.world.createCharacterController(CHARACTER_OFFSET);
    controller.enableAutostep(
      AUTOSTEP_MAX_HEIGHT,
      AUTOSTEP_MIN_WIDTH,
      AUTOSTEP_INCLUDE_DYNAMIC,
    );
    controller.enableSnapToGround(SNAP_TO_GROUND);
    controller.setMaxSlopeClimbAngle(MAX_SLOPE_CLIMB_DEG * DEG_TO_RAD);
    controller.setMinSlopeSlideAngle(MIN_SLOPE_SLIDE_DEG * DEG_TO_RAD);
    controller.setApplyImpulsesToDynamicBodies(false);
    controller.setSlideEnabled(true);
    this.controller = controller;

    this.verticalVelocity = 0;
  }

  moveCharacter(
    horizontalDisplacement: { x: number; z: number },
    dt: number,
  ): MoveResult {
    const body = this.charBody;
    const collider = this.charCollider;
    const controller = this.controller;
    if (!body || !collider || !controller) {
      return { position: { x: 0, y: 0, z: 0 }, grounded: false };
    }

    // Integrate gravity into the vertical velocity, then turn it into this
    // frame's vertical displacement. Horizontal input is already dt-scaled.
    this.verticalVelocity += GRAVITY_Y * dt;
    const desired = {
      x: horizontalDisplacement.x,
      y: this.verticalVelocity * dt,
      z: horizontalDisplacement.z,
    };

    // Resolve the desired motion against the world (slide along obstacles). The
    // controller automatically excludes the collider it is moving.
    controller.computeColliderMovement(collider, desired);
    const movement = controller.computedMovement();
    const grounded = controller.computedGrounded();

    const current = body.translation();
    const next = {
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    };
    body.setNextKinematicTranslation(next);

    // Reset downward velocity once grounded so gravity doesn't accumulate; a
    // tiny residual keeps the capsule pressed into the ground for snap-to.
    if (grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = 0;
    }

    return { position: next, grounded };
  }

  getCharacterFootPosition(): Vec3Like {
    const body = this.charBody;
    if (!body) return { x: 0, y: 0, z: 0 };
    const t = body.translation();
    return { x: t.x, y: t.y - CAPSULE_CENTER_OFFSET, z: t.z };
  }

  raycast(
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
  ): number | null {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dz = toZ - fromZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-6) return null;

    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    const ray = new this.RAPIER.Ray({ x: fromX, y: fromY, z: fromZ }, dir);

    // `solid = true` so we hit the boundary; exclude the character collider so
    // the camera ray never collides with the player itself.
    const hit = this.world.castRay(
      ray,
      dist,
      true,
      undefined,
      undefined,
      this.charCollider ?? undefined,
    );
    if (!hit) return null;

    // Direction is normalised, so timeOfImpact is the hit distance; normalise
    // to a 0..1 fraction along the segment.
    return hit.timeOfImpact / dist;
  }

  step(dt: number): void {
    if (this.destroyed) return;
    // Keep the timestep in lockstep with the frame for a stable kinematic move.
    this.world.timestep = dt;
    this.world.step();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.controller) {
      this.world.removeCharacterController(this.controller);
      this.controller = null;
    }
    // Frees every body/collider/joint owned by the world in one shot.
    this.world.free();
    this.charBody = null;
    this.charCollider = null;
  }
}

/**
 * Asynchronously create the physics world.
 *
 * This is the ONLY place `@dimforge/rapier3d-compat` is loaded — via a dynamic
 * `import(...)` so the WASM never evaluates on the server or in unit tests. It
 * awaits `RAPIER.init()` (decodes the inlined WASM) and constructs one `World`
 * with downward gravity.
 */
export async function createPhysics(): Promise<Physics> {
  const RAPIER = await import("@dimforge/rapier3d-compat");
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: GRAVITY_Y, z: 0 });
  return new RapierPhysics(RAPIER, world);
}
