import type * as pc from "playcanvas";

/**
 * Information about a checkpoint surfaced to the App_Framework HUD.
 *
 * This is intentionally engine-agnostic (plain strings/numbers) so the React
 * dialogue overlay never needs to import `playcanvas`.
 */
export interface CheckpointInfo {
  /** Stable id of the checkpoint. */
  id: string;
  /** Speaker name shown in the dialogue box (landmark name / NPC name). */
  speaker: string;
  /** Single line of dialogue shown in the dialogue box. */
  line: string;
  /**
   * Optional multi-line copy. When present the overlay renders each entry on
   * its own line (used by the NPC greeter / richer landmark beats).
   */
  lines?: string[];
}

/** A checkpoint placed in the world with its trigger geometry. */
export interface Checkpoint {
  info: CheckpointInfo;
  /** World-space position of the checkpoint marker. */
  position: pc.Vec3;
  /** Radius (world units) within which the checkpoint becomes active. */
  radius: number;
}

/**
 * Engine-agnostic info about the active interactable surfaced to the HUD so the
 * App_Framework can show an "enter" affordance and open the right info panel.
 */
export interface InteractableInfo {
  /** Stable chapter id (matches `content/chapters.json`). */
  id: string;
  /** Human-readable chapter title (sourced from content). */
  title: string;
}

/**
 * A chapter structure the player can approach + enter. Built alongside the
 * structure's geometry; the controller finds the nearest one within its
 * approach radius, highlights it, and fires "enter" against its id.
 */
export interface Interactable {
  /** Stable chapter id (matches `content/chapters.json`). */
  id: string;
  /** Chapter title (from content) shown in the enter prompt. */
  title: string;
  /** Approach centre on/near the path (world space). */
  position: pc.Vec3;
  /** Approach radius (world units) the player must be within. */
  radius: number;
  /**
   * Drive the building's subtle highlight. `factor` is 0 (idle) → 1 (fully
   * highlighted); the structure ramps its accent light + ground glow ring to
   * match. The controller eases the factor so the highlight fades in/out.
   */
  setHighlight: (factor: number) => void;
}

/**
 * The NPC welcome shown on first load (and re-triggered by proximity to the
 * greeter). Engine-agnostic plain data so the HUD never imports `playcanvas`.
 */
export interface WelcomeInfo {
  /** Name of the greeter NPC. */
  speaker: string;
  /** A short, multi-line intro (2-4 lines). */
  lines: string[];
}

/**
 * Declarative description of a STATIC collider in the world.
 *
 * Pass 1 (this pass) only PRODUCES these specs alongside the transform-based
 * visuals — no physics is created. The later Rapier pass consumes this list to
 * build static rigid bodies WITHOUT having to re-derive any geometry, so the
 * collision world stays perfectly in sync with what the player sees.
 *
 * All colliders are axis-aligned-ish boxes described in world space. `rotation`
 * is applied about the box centre (degrees, Euler XYZ) to let angled blockers
 * (e.g. the bridge oriented along the path tangent) be represented exactly.
 */
export interface ColliderSpec {
  /** Stable id, useful for debugging / de-duplication in the physics pass. */
  id: string;
  /** Shape kind. Only axis-box blockers are needed for the slice. */
  type: "box";
  /** World-space centre of the box: [x, y, z]. */
  position: [number, number, number];
  /** Half-extents of the box along each local axis: [hx, hy, hz]. */
  halfExtents: [number, number, number];
  /** Euler rotation in degrees about the box centre: [x, y, z]. */
  rotation: [number, number, number];
  /**
   * Semantic role of this collider, for clarity and so the later physics pass
   * can apply role-specific handling (e.g. friction, debug colour, filtering):
   * - `ground`   — the flat walkable ground plane.
   * - `wall`     — invisible path-edge confinement walls / bridge rails.
   * - `bridge`   — the walkable bridge deck spanning the corridor at the river.
   * - `prop`     — scenery the player bumps into (tree trunks, rocks).
   * - `landmark` — the solid base/footprint of a narrative landmark.
   */
  role?: "ground" | "wall" | "bridge" | "prop" | "landmark";
}
