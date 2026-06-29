/**
 * SINGLE SOURCE OF TRUTH for the player character.
 * ───────────────────────────────────────────────────────────────────────────
 * SWAPPING THE PLAYER MODEL = EDIT ONLY THIS FILE.
 *
 * The engine loads everything about the player from the {@link CHARACTER}
 * object below: the skinned model GLB, its uniform scale, the three separate
 * animation-clip GLBs (idle / run / jump), the locomotion state-machine tuning
 * (speed parameter, run thresholds, crossfade time), the Rapier capsule sizing,
 * and the camera / nameplate head offsets.
 *
 * To drop in a FUTURE character:
 *   1. Replace `model` with the new skinned GLB.
 *   2. KEEP THE SAME SKELETON / BONE NAMES so the existing clip GLBs still bind
 *      (this is the standard PlayCanvas separate-animation-asset workflow — the
 *      clip tracks bind to the model's skeleton by bone name). If the new model
 *      ships its own clips, point `animations.*.url` at the new GLBs and set the
 *      matching `clip` names.
 *   3. Tune `scale` so the character reads at a believable height, then adjust
 *      `capsule` (Rapier collider) and `headHeight` / `nameplateHeight` (camera
 *      + floating nameplate) so they track the new silhouette.
 *
 * This module is PURE DATA — it imports neither `playcanvas` nor Rapier — so it
 * can be shared by the PlayCanvas world build, the camera/nameplate, AND the
 * isolated physics layer (which never imports `playcanvas`) without coupling.
 */

/** One animation clip living in its own container GLB (bound by bone name). */
export interface CharacterAnimation {
  /** Public URL of the container GLB holding the clip. */
  url: string;
  /** The clip/track name inside that GLB (e.g. "Root|Run"). */
  clip: string;
}

export const CHARACTER = {
  /**
   * Player model. Reverted to the SMALL Kenney `character.glb` per owner
   * feedback (the larger converted animated `player.glb` is parked for now).
   * This is the SINGLE config constant the world reads
   * ({@link ../world/shared LAYOUT.character.url}) — a model swap is this one
   * line plus a re-check of `scale` + `capsule` + `headHeight` + `nameplateHeight`.
   */
  model: "/models/character.glb",

  /**
   * Uniform scale applied to the model. The small Kenney `character.glb` is a
   * compact, blocky figure (~1.2u tall at scale 1); 1.4 lifts it to a believable
   * ~1.7u on-screen silhouette — the small character the world framing
   * (camera/nameplate/capsule below) is tuned around. Edit this to re-fit a
   * future model, then re-check `capsule` + `headHeight` + `nameplateHeight`.
   */
  scale: 1.4,

  /**
   * Whether the model ships a skinned skeleton + locomotion clips
   * ({@link CHARACTER.animations}). The small `character.glb` is a STATIC mesh,
   * so this is `false` and the world build skips the anim state-machine wiring
   * (movement stays the procedural on-rails spline locomotion). Flip back to
   * `true` together with an animated `model` to re-enable the Idle⇄Run graph.
   */
  animated: false,

  /**
   * The locomotion clips. Each lives in its OWN container GLB; the engine loads
   * the container, pulls the {@link CharacterAnimation.clip} track out of it,
   * and binds it to {@link CHARACTER.model}'s skeleton by bone name. `jump` is
   * loaded/kept for the future but is not wired into a state on the on-rails
   * locomotion graph (there is no jump input).
   */
  animations: {
    idle: { url: "/models/player_idle.glb", clip: "Root|Idle" },
    run: { url: "/models/player_run.glb", clip: "Root|Run" },
    jump: { url: "/models/player_jump.glb", clip: "Root|Jump" },
  } satisfies Record<string, CharacterAnimation>,

  /**
   * Locomotion state-machine tuning. The controller writes the player's current
   * absolute along-path speed (units/s) into the `speedParam` float each frame;
   * the graph crossfades Idle⇄Run around the thresholds below. Two thresholds
   * (enter > exit) give a little hysteresis so the blend never flickers when the
   * player hovers right at walking-on speed.
   */
  anim: {
    /** Name of the float parameter the controller drives every frame. */
    speedParam: "speed",
    /** Idle→Run once speed climbs above this (units/s). */
    runEnterSpeed: 0.6,
    /** Run→Idle once speed drops below this (units/s) — lower for hysteresis. */
    runExitSpeed: 0.25,
    /** Crossfade duration (seconds) for the Idle⇄Run transitions. */
    blendTime: 0.18,
  },

  /**
   * Rapier kinematic capsule. A capsule is `2*halfHeight` of straight body
   * capped by two `radius` hemispheres, so total height = `2*(radius +
   * halfHeight)` = 1.7u, and the capsule CENTRE sits `radius + halfHeight`
   * (= 0.85u) above the feet. Reverted to the SMALL character silhouette
   * (~1.7u) so collisions + the camera framing match `character.glb` again.
   */
  capsule: {
    radius: 0.3,
    halfHeight: 0.55,
  },

  /**
   * Camera look-target / collision-ray origin height above the player's feet
   * (world units). Sits at roughly chest/shoulder height of the ~1.7u small
   * character so the cinematic framing keeps the head comfortably in frame.
   */
  headHeight: 1.4,

  /**
   * Floating-nameplate anchor height above the player's feet (world units).
   * Sits just above the ~1.7u small character's head so the tag hovers cleanly.
   */
  nameplateHeight: 2.0,
} as const;

export type CharacterConfig = typeof CHARACTER;
