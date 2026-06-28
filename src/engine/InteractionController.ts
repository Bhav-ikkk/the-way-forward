import * as pc from "playcanvas";

import type { Interactable, InteractableInfo } from "./world/types";

/**
 * Screen-space placement for the floating nameplate, reported to the
 * App_Framework each frame. `x`/`y` are CSS pixels relative to the canvas;
 * `visible` is false when the player's head is behind the camera or projects
 * off-screen.
 */
export interface NameplateScreen {
  x: number;
  y: number;
  visible: boolean;
}

/** Hooks + data the interaction controller needs. */
export interface InteractionOptions {
  /** All approachable chapter structures (with their highlight handles). */
  interactables: Interactable[];
  /** Fired when the nearest in-range interactable changes (or clears). */
  onInteractableChange?: (info: InteractableInfo | null) => void;
  /** Fired when the player "enters" the active interactable (E / tap). */
  onEnter?: (id: string) => void;
  /** Fired with the projected nameplate screen position each frame. */
  onNameplate?: (nameplate: NameplateScreen) => void;
  /** Canvas element used for tap detection + screen-size conversion. */
  canvas: HTMLCanvasElement;
}

/** Ease rate (per second) the subtle highlight fades in/out. */
const HIGHLIGHT_RAMP = 6;
/** Height (world units) of the nameplate above the player's feet. */
const NAMEPLATE_HEAD_HEIGHT = 3.4;
/** A click/tap counts as "enter" only if it moved less than this (CSS px). */
const TAP_MAX_MOVE = 8;
/** …and lasted less than this (ms) — longer/larger gestures are camera drags. */
const TAP_MAX_MS = 250;

/**
 * Drives the building INTERACTION layer on top of the on-rails movement:
 *
 * - Each frame it finds the NEAREST {@link Interactable} within its approach
 *   radius of the player's on-rails position and marks it active, reporting
 *   `{ id, title }` (or `null`) via {@link InteractionOptions.onInteractableChange}.
 * - It eases a per-structure highlight factor toward 1 for the active structure
 *   and 0 for the rest, calling each structure's `setHighlight` so the building
 *   glows subtly as you approach and fades as you leave.
 * - ENTER (which does NOT change the scene — it opens an info panel): pressing
 *   `E`, or a CLICK/TAP that is NOT a camera drag (small movement + short
 *   duration), fires {@link InteractionOptions.onEnter} for the active id.
 * - It projects the player's head to screen space via `camera.worldToScreen`
 *   and reports the nameplate position/visibility each frame.
 *
 * While {@link setPaused}(true) (a panel is open) it suppresses enter input so
 * the player can't open another panel behind the current one; the owning
 * {@link CharacterController} additionally freezes movement + camera orbit.
 *
 * It is constructed + driven by the {@link CharacterController} (which feeds it
 * the player position each frame) and never integrates motion itself.
 */
export class InteractionController {
  private readonly camera: pc.Entity;
  private readonly canvas: HTMLCanvasElement;
  private readonly options: InteractionOptions;

  private paused = false;
  private activeId: string | null = null;
  private readonly factors = new Map<string, number>();

  // Scratch vectors reused each frame (no per-frame allocation).
  private readonly tmpHead = new pc.Vec3();
  private readonly tmpScreen = new pc.Vec3();
  private readonly tmpDir = new pc.Vec3();

  // Nameplate de-duplication so React only re-renders on meaningful change.
  private npInit = false;
  private npX = 0;
  private npY = 0;
  private npVisible = false;

  // Tap-vs-drag detection state.
  private pointerActive = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartT = 0;

  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor(camera: pc.Entity, options: InteractionOptions) {
    this.camera = camera;
    this.canvas = options.canvas;
    this.options = options;
    for (const it of options.interactables) this.factors.set(it.id, 0);

    // ---- Tap detection (distinct from the CameraRig orbit drag) ---------
    this.onPointerDown = (e) => {
      if (e.button !== 0) return; // primary button only
      this.pointerActive = true;
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;
      this.pointerStartT = performance.now();
    };
    // Resolve the gesture on window so a release outside the canvas still ends
    // it. A SHORT press with LITTLE movement is a tap (enter); anything longer
    // or larger is treated as a camera orbit drag and ignored here.
    this.onPointerUp = (e) => {
      if (!this.pointerActive) return;
      this.pointerActive = false;
      if (e.button !== 0) return;
      const dist = Math.hypot(
        e.clientX - this.pointerStartX,
        e.clientY - this.pointerStartY,
      );
      const elapsed = performance.now() - this.pointerStartT;
      if (dist <= TAP_MAX_MOVE && elapsed <= TAP_MAX_MS) this.tryEnter();
    };
    this.onKeyDown = (e) => {
      if (e.repeat) return;
      if (e.key === "e" || e.key === "E") this.tryEnter();
    };

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
  }

  /** Pause/resume ENTER input (movement + orbit are frozen by the owner). */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.pointerActive = false;
  }

  /** Fire `onEnter` for the active interactable, unless paused / none active. */
  private tryEnter(): void {
    if (this.paused || this.activeId === null) return;
    this.options.onEnter?.(this.activeId);
  }

  /**
   * Advance one frame against the player's on-rails feet position. Updates the
   * active interactable, eases the highlights, and projects the nameplate.
   */
  update(dt: number, px: number, py: number, pz: number): void {
    // ---- Nearest in-range interactable ----------------------------------
    let nearest: Interactable | null = null;
    let nearestD2 = Infinity;
    for (const it of this.options.interactables) {
      const dx = px - it.position.x;
      const dz = pz - it.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= it.radius * it.radius && d2 < nearestD2) {
        nearest = it;
        nearestD2 = d2;
      }
    }
    const newId = nearest ? nearest.id : null;
    if (newId !== this.activeId) {
      this.activeId = newId;
      this.options.onInteractableChange?.(
        nearest ? { id: nearest.id, title: nearest.title } : null,
      );
    }

    // ---- Ease each structure's highlight toward its target --------------
    const ramp = 1 - Math.exp(-HIGHLIGHT_RAMP * dt);
    for (const it of this.options.interactables) {
      const cur = this.factors.get(it.id) ?? 0;
      const target = it.id === this.activeId ? 1 : 0;
      const next = cur + (target - cur) * ramp;
      this.factors.set(it.id, next);
      it.setHighlight(next);
    }

    // ---- Project the floating nameplate to screen space -----------------
    this.updateNameplate(px, py, pz);
  }

  /** Project the player's head and report the nameplate screen placement. */
  private updateNameplate(px: number, py: number, pz: number): void {
    const cb = this.options.onNameplate;
    const cam = this.camera.camera;
    if (!cb || !cam) return;

    this.tmpHead.set(px, py + NAMEPLATE_HEAD_HEIGHT, pz);

    // In front of the camera? (dot of head-direction with camera forward.)
    const camPos = this.camera.getPosition();
    this.tmpDir.set(
      this.tmpHead.x - camPos.x,
      this.tmpHead.y - camPos.y,
      this.tmpHead.z - camPos.z,
    );
    const fwd = this.camera.forward;
    const inFront =
      this.tmpDir.x * fwd.x + this.tmpDir.y * fwd.y + this.tmpDir.z * fwd.z > 0;

    const screen = cam.worldToScreen(this.tmpHead, this.tmpScreen);
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const x = Math.round(screen.x);
    const y = Math.round(screen.y);
    const visible = inFront && x >= 0 && x <= w && y >= 0 && y <= h;

    // Only report meaningful changes so the overlay doesn't re-render needlessly.
    if (
      this.npInit &&
      visible === this.npVisible &&
      x === this.npX &&
      y === this.npY
    ) {
      return;
    }
    this.npInit = true;
    this.npVisible = visible;
    this.npX = x;
    this.npY = y;
    cb({ x, y, visible });
  }

  /** Remove DOM listeners + revert highlights. Safe to call once. */
  destroy(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    for (const it of this.options.interactables) it.setHighlight(0);
  }
}
