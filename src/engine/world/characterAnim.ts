import * as pc from "playcanvas";

import { CHARACTER, type CharacterAnimation } from "./character.config";

/**
 * Animated-player wiring (PlayCanvas 2.7.7 separate-animation-asset workflow).
 *
 * The player model ({@link CHARACTER.model}) is a SKINNED character; its
 * locomotion clips ship in SEPARATE container GLBs ({@link CHARACTER.animations})
 * whose tracks bind to the model's skeleton BY BONE NAME. This module:
 *
 *   1. Adds a pc `anim` component to the instantiated player render entity.
 *   2. Programmatically loads a minimal locomotion state graph
 *      ({@link buildLocomotionStateGraph}) — an `Idle` default (looping) and a
 *      `Run` (looping) state, plus a single float parameter (`speed`) and two
 *      crossfading transitions (Idle→Run / Run→Idle) with hysteresis.
 *   3. Asynchronously loads the idle + run container GLBs, extracts their
 *      {@link pc.AnimTrack}, and `assignAnimation`s each track to its state.
 *
 * The controller then drives the graph each frame by writing the player's
 * current absolute along-path speed into the `speed` float (see
 * {@link CharacterController}); the graph blends Idle⇄Run automatically.
 *
 * GRACEFUL FALLBACK: every step is guarded + logged. If the anim component or a
 * track fails to load/parse the player still RENDERS and MOVES on the rails —
 * it simply won't animate. Nothing here can throw into the world build / the
 * loading gate.
 */

/** The single locomotion layer name (kept private to this module). */
const LAYER = "Locomotion";

/**
 * Build the programmatic locomotion state graph for {@link AnimComponent.loadStateGraph}.
 *
 * Shape matches the PlayCanvas 2.7.7 anim-state-graph schema: a single layer
 * with `START` → `Idle` (default) and an `Idle`⇄`Run` pair gated on the `speed`
 * float, plus a `speed` FLOAT parameter. Built inside a function (not at module
 * scope) so no `pc.ANIM_*` constants are read at import time.
 */
function buildLocomotionStateGraph(): object {
  const { speedParam, runEnterSpeed, runExitSpeed, blendTime } = CHARACTER.anim;
  return {
    layers: [
      {
        name: LAYER,
        states: [
          { name: "START" },
          { name: "Idle", speed: 1, loop: true, defaultState: true },
          { name: "Run", speed: 1, loop: true },
        ],
        transitions: [
          { from: "START", to: "Idle" },
          {
            from: "Idle",
            to: "Run",
            time: blendTime,
            conditions: [
              {
                parameterName: speedParam,
                predicate: pc.ANIM_GREATER_THAN,
                value: runEnterSpeed,
              },
            ],
          },
          {
            from: "Run",
            to: "Idle",
            time: blendTime,
            conditions: [
              {
                parameterName: speedParam,
                predicate: pc.ANIM_LESS_THAN,
                value: runExitSpeed,
              },
            ],
          },
        ],
      },
    ],
    parameters: {
      [speedParam]: {
        name: speedParam,
        type: pc.ANIM_PARAMETER_FLOAT,
        value: 0,
      },
    },
  };
}

/**
 * A container resource exposes its parsed clips as an array of `animation`
 * assets (`resource.animations`), each whose `.resource` is an {@link pc.AnimTrack}.
 * The type isn't on `pc.ContainerResource` in the published typings, so this
 * narrows it locally.
 */
interface AnimatedContainerResource {
  animations?: Array<{ resource?: pc.AnimTrack | null }>;
}

/**
 * Pull the wanted {@link pc.AnimTrack} out of a loaded container asset. Prefers
 * a track whose name matches the configured clip (e.g. "Root|Run"); falls back
 * to the first track present (each clip GLB holds a single clip). Returns
 * `null` if the container carries no usable track.
 */
function extractTrack(asset: pc.Asset, clip: string): pc.AnimTrack | null {
  const resource = asset.resource as AnimatedContainerResource | null;
  const anims = resource?.animations ?? [];
  if (anims.length === 0) return null;
  const match = anims.find((a) => a.resource?.name === clip);
  return (match ?? anims[0]).resource ?? null;
}

/**
 * Load one clip container GLB and assign its track to `stateName`. Fully
 * guarded: a failure logs + returns without throwing (the player keeps moving,
 * just without that clip).
 */
function loadClipInto(
  app: pc.AppBase,
  anim: pc.AnimComponent,
  stateName: string,
  spec: CharacterAnimation,
): void {
  app.assets.loadFromUrl(spec.url, "container", (err, asset) => {
    if (err || !asset) {
      console.error(`[character] Failed to load animation: ${spec.url}`, err);
      return;
    }
    try {
      const track = extractTrack(asset, spec.clip);
      if (!track) {
        console.error(
          `[character] No animation track in ${spec.url} (wanted "${spec.clip}")`,
        );
        return;
      }
      // assignAnimation(nodePath, animTrack, layerName, speed, loop)
      anim.assignAnimation(stateName, track, LAYER, 1, true);
    } catch (e) {
      console.error(`[character] Failed to assign animation: ${spec.url}`, e);
    }
  });
}

/**
 * Attach the locomotion anim state machine to the player entity and kick off
 * the (async) clip loads. Safe to call once the player render entity is in the
 * scene. Never throws — on any failure the player still renders + moves.
 *
 * @param app - The PlayCanvas application.
 * @param player - The instantiated player render entity (carries the skeleton).
 */
export function setupCharacterAnimation(
  app: pc.AppBase,
  player: pc.Entity,
): void {
  try {
    // `activate: true` begins playing the default (Idle) state as soon as it's
    // assigned. The component animates the skeleton on `player` by bone name.
    player.addComponent("anim", { activate: true });
    const anim = player.anim;
    if (!anim) {
      console.error("[character] anim component unavailable; player won't animate");
      return;
    }
    anim.loadStateGraph(buildLocomotionStateGraph());

    // Idle is the default looping state; Run blends in with along-path speed.
    loadClipInto(app, anim, "Idle", CHARACTER.animations.idle);
    loadClipInto(app, anim, "Run", CHARACTER.animations.run);
  } catch (e) {
    // Never let an anim wiring failure break the scene or the loading gate.
    console.error("[character] Failed to set up character animation", e);
  }
}
