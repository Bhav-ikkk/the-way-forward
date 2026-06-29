import type * as pc from "playcanvas";

import { createPath, type Path, type PathSample } from "./path";
import {
  BRIDGE_CROSSING_T,
  computeKeepClearZones,
  isInKeepClear,
  type KeepClearZone,
  RIVER_CONTROL_POINTS,
} from "./landmarks";
import {
  addPointLight,
  addPrimitive,
  LAYOUT,
  loadModel,
  loadModelInstances,
  makeMaterial,
  type Placement,
  yawFromDir,
} from "./shared";
import type { ColliderSpec } from "./types";

/** What the river system hands back to the orchestrator. */
export interface RiverResult {
  /** The river spline (forced to pass through the bridge crossing). */
  river: Path;
  /** The path sample at the bridge crossing (position + tangent). */
  crossing: PathSample;
}

/**
 * River system (Pass-2 Stage-3): a believable, hand-composed river crossing
 * rather than a flat blue slab. It layers:
 *
 *  - a DEEP channel (wider, darker, slightly lower) under
 *  - a translucent WATER surface whose width gently BREATHES along its length
 *    (so the shoreline is never a parallel channel), flanked by
 *  - sandy BANK margins that border the water on both sides, dressed with
 *  - an IRREGULAR shoreline of rocks/stones tumbling along the banks, reeds and
 *    bank foliage softening the approaches, and rocks EMBEDDED in the water, then
 *  - the BRIDGE at the path crossing — now grounded on stone PILLARS planted in
 *    the water and met by sandy ramp aprons on both banks for a natural
 *    elevation transition, with warm lanterns lighting each end.
 *
 * The river spline is forced through the exact path crossing point so the
 * bridge always lines up over the water. The walkable bridge DECK collider
 * (role `"bridge"`) spans the full corridor width at the crossing, so the
 * player always crosses on the bridge and never through the water; the
 * path-edge walls (from {@link ./road}) form the guard rails while the deck
 * stays an open walkway. Bank rocks near the walkway emit `"prop"` colliders;
 * everything else (water, banks, pillars, reeds, lilies) is pure dressing.
 */
export function buildRiver(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): RiverResult {
  const crossing = path.sample(BRIDGE_CROSSING_T);

  // Force the river to pass through the exact path crossing point.
  const riverPoints = RIVER_CONTROL_POINTS.map(
    (p, i) =>
      (i === Math.floor(RIVER_CONTROL_POINTS.length / 2)
        ? [crossing.position.x, crossing.position.z]
        : p) as readonly [number, number],
  );
  const river = createPath(riverPoints);

  // ---- Natural channel: deep bed + breathing water + sandy banks ---------
  layRiverChannel(app, river);

  // ---- Bridge at the crossing (oriented along the path tangent) ----------
  // Deck flush + centred on the path, oriented exactly to the path tangent so
  // the crossing reads as natural. Width matches the corridor; the deck spans
  // the river with planks meeting the path on both banks.
  const bridgeYaw =
    yawFromDir(crossing.tangent.x, crossing.tangent.z) + LAYOUT.bridge.yawOffset;
  loadModel(app, LAYOUT.bridge.url, (root) => {
    root.setLocalPosition(
      crossing.position.x,
      LAYOUT.bridge.y,
      crossing.position.z,
    );
    root.setEulerAngles(0, bridgeYaw, 0);
    root.setLocalScale(LAYOUT.bridge.scale, LAYOUT.bridge.scale, LAYOUT.bridge.scale);
  });

  // Stone pillars planted in the water beneath the span so the bridge reads as
  // resting on supports rather than floating. Pure dressing (no colliders).
  groundBridge(app, crossing);

  // Walkable bridge deck spanning the full corridor width at the crossing. The
  // depth reuses LAYOUT.bridge.halfDepth so the collider matches the model deck
  // (visuals + physics stay in sync) and lands on the banks, not the water.
  const deckHalfWidth = LAYOUT.path.width / 2 + LAYOUT.path.shoulder;
  colliders.push({
    id: "bridge-deck",
    type: "box",
    position: [crossing.position.x, 0.4, crossing.position.z],
    halfExtents: [deckHalfWidth, 0.4, LAYOUT.bridge.halfDepth],
    rotation: [0, bridgeYaw, 0],
    role: "bridge",
  });

  // ---- Crossing dressing (banks + rocks + reeds + lilies + lanterns) -----
  dressCrossing(app, river, crossing, colliders, computeKeepClearZones(path));

  return { river, crossing };
}

/**
 * Water width (world units) at river-spline parameter `rt` in [0,1]. The width
 * gently breathes via a sine of `rt` so the shoreline reads as natural rather
 * than a parallel channel; the variation is FORCED to zero at the crossing
 * (rt≈0.5) so the bridge always spans a consistent, nominal width.
 */
function waterWidthAt(rt: number): number {
  const breathe = LAYOUT.river.widthVariation * Math.sin((rt - 0.5) * Math.PI * 2.4);
  return LAYOUT.river.width * (1 + breathe);
}

/**
 * Lay an oriented-box strip along a spline where the box WIDTH can vary per
 * segment (via `widthAt(t)`), optionally pushed laterally off the centreline by
 * `lateralOf(t)` (signed, right-of-travel). Used for the breathing water
 * surface, the wider deep bed, and the two sandy bank margins so they all hug
 * the same winding curve while reading as distinct layers.
 */
function layVariableStrip(
  app: pc.AppBase,
  spline: Path,
  segments: number,
  material: pc.StandardMaterial,
  widthAt: (t: number) => number,
  thickness: number,
  y: number,
  lateralOf: (t: number) => number = () => 0,
): void {
  const pts = spline.getEvenlySpacedPoints(segments + 1);
  const last = pts.length - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i].position;
    const b = pts[i + 1].position;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    const t = i / last;
    const rX = dz / len;
    const rZ = -dx / len;
    const off = lateralOf(t);
    const midX = (a.x + b.x) / 2 + rX * off;
    const midZ = (a.z + b.z) / 2 + rZ * off;
    addPrimitive(
      app,
      "box",
      material,
      [midX, y, midZ],
      [widthAt(t), thickness, len * 1.12],
      yawFromDir(dx, dz),
    );
  }
}

/**
 * The layered river channel: a dark deep bed under a translucent water surface,
 * bordered on both banks by sandy margins. The water width breathes along the
 * length so the shoreline feels hand-cut, and the deep bed is wider + lower so
 * the river reads with depth.
 */
function layRiverChannel(app: pc.AppBase, river: Path): void {
  const { segments, bankSegments, thickness, y, color, opacity } = LAYOUT.river;
  const { deepColor, deepWidthFactor, deepY, bankColor, bankWidth } = LAYOUT.river;

  // Dark deep channel (wider, slightly lower) — read as depth under the surface.
  layVariableStrip(
    app,
    river,
    segments,
    makeMaterial(deepColor),
    (t) => waterWidthAt(t) * deepWidthFactor,
    thickness,
    deepY,
    () => 0,
  );

  // Translucent water surface (breathing width).
  layVariableStrip(
    app,
    river,
    segments,
    makeMaterial(color, { opacity }),
    waterWidthAt,
    thickness,
    y,
    () => 0,
  );

  // Sandy bank margins flanking the water on both sides, tracking the water
  // width so they always border the shoreline.
  const bankMat = makeMaterial(bankColor);
  for (const side of [1, -1] as const) {
    layVariableStrip(
      app,
      river,
      bankSegments,
      bankMat,
      () => bankWidth,
      thickness * 0.8,
      y - 0.005,
      (t) => side * (waterWidthAt(t) / 2 + bankWidth / 2 - 0.2),
    );
  }
}

/**
 * Plant a pair of stone pillars in the water on each side of the deck so the
 * bridge reads as resting on supports. Pure dressing — the deck collider
 * already carries the walkway physics.
 */
function groundBridge(app: pc.AppBase, crossing: PathSample): void {
  const cx = crossing.position.x;
  const cz = crossing.position.z;
  const rX = crossing.tangent.z;
  const rZ = -crossing.tangent.x;
  const yaw = yawFromDir(crossing.tangent.x, crossing.tangent.z);
  const { pillarUrl, pillarScale, pillarOffset } = LAYOUT.bridge;

  const pillars: Placement[] = [];
  for (const side of [1, -1] as const) {
    pillars.push({
      position: [cx + rX * pillarOffset * side, LAYOUT.river.deepY, cz + rZ * pillarOffset * side],
      yaw,
      scale: pillarScale,
    });
  }
  loadModelInstances(app, pillarUrl, pillars);
}

/**
 * Dress the river crossing so it reads as an intentional set piece:
 *  - a lantern on each bank-side at both ends of the bridge (the two near ends
 *    lit, for a warm wayfinding glow as you approach),
 *  - sandy RAMP aprons easing the path onto the bridge ends (elevation
 *    transition so the crossing feels natural rather than a plank dropped on a
 *    strip),
 *  - rock + stone clusters tumbling down both banks to anchor the crossing
 *    (irregular shoreline),
 *  - rocks EMBEDDED in the water poking above the surface,
 *  - reeds + bank foliage softening the approaches, and
 *  - lily pads floating on the water to either side of the deck.
 * Placement is deterministic and modest so the light/draw budget stays tight.
 * Each GLB loads once and instances out.
 */
function dressCrossing(
  app: pc.AppBase,
  river: Path,
  crossing: PathSample,
  colliders: ColliderSpec[],
  keepClear: readonly KeepClearZone[],
): void {
  const cx = crossing.position.x;
  const cz = crossing.position.z;
  // Forward (down-path) + right-of-travel unit vectors at the crossing.
  const fX = crossing.tangent.x;
  const fZ = crossing.tangent.z;
  const rX = crossing.tangent.z;
  const rZ = -crossing.tangent.x;
  const yaw = yawFromDir(fX, fZ);

  const deckHalf = LAYOUT.path.width / 2 + LAYOUT.path.shoulder; // ~2.8
  const endDist = LAYOUT.bridge.halfDepth + 0.4; // just past the deck end, on the bank
  const laneOff = LAYOUT.path.width / 2 + 0.9; // shoulder line for lanterns

  // ---- Sandy ramp aprons at both bridge ends (elevation transition) ------
  // A short sandy apron laid on each bank where the deck meets the path, easing
  // the road onto the bridge so the crossing reads with a believable
  // transition rather than a hard seam. Pure dressing.
  const rampMat = makeMaterial(LAYOUT.river.bankColor);
  for (const end of [1, -1] as const) {
    const ax = cx + fX * (LAYOUT.bridge.halfDepth + 0.6) * end;
    const az = cz + fZ * (LAYOUT.bridge.halfDepth + 0.6) * end;
    addPrimitive(
      app,
      "box",
      rampMat,
      [ax, LAYOUT.river.y + 0.01, az],
      [deckHalf * 2, 0.07, 2.2],
      yaw,
    );
  }

  // ---- Lanterns at both ends (4 models; one warm pool of light per end) --
  const lampPlacements: Placement[] = [];
  for (const end of [1, -1] as const) {
    const ex = cx + fX * endDist * end;
    const ez = cz + fZ * endDist * end;
    for (const side of [1, -1] as const) {
      lampPlacements.push({
        position: [ex + rX * laneOff * side, 0, ez + rZ * laneOff * side],
        yaw,
        scale: 1.4,
      });
    }
    // One warm light per end (on the +side lantern) for wayfinding glow.
    addPointLight(
      app,
      ex + rX * laneOff,
      LAYOUT.lantern.lightY,
      ez + rZ * laneOff,
      LAYOUT.marker.lanternIntensity,
    );
  }
  loadModelInstances(app, "/models/lamp.glb", lampPlacements);

  // ---- Bank rocks tumbling down both banks (irregular shoreline) ---------
  const rockLarge: Placement[] = [];
  const rockSmall: Placement[] = [];
  const stones: Placement[] = [];
  let rockIdx = 0;
  for (const end of [1, -1] as const) {
    const bx = cx + fX * (endDist + 1.2) * end;
    const bz = cz + fZ * (endDist + 1.2) * end;
    for (const side of [1, -1] as const) {
      // A large anchor rock just beyond the shoulder (gets a collider).
      const lo = deckHalf + 1.4;
      const lx = bx + rX * lo * side;
      const lz = bz + rZ * lo * side;
      rockLarge.push({ position: [lx, 0, lz], yaw: (end * 47 + side * 90) % 360, scale: 1.9 });
      colliders.push({
        id: `bridge-rock-${rockIdx++}`,
        type: "box",
        position: [lx, 0.7, lz],
        halfExtents: [0.9, 0.7, 0.9],
        rotation: [0, 0, 0],
        role: "prop",
      });
      // A smaller rock + a pebble spilling toward the water (decorative).
      rockSmall.push({
        position: [bx + rX * (lo - 1.0) * side, 0, bz + rZ * (lo - 1.0) * side],
        yaw: (end * 110 + side * 33) % 360,
        scale: 1.3,
      });
      stones.push({
        position: [bx + rX * (lo + 0.8) * side, 0, bz + rZ * (lo + 0.8) * side],
        yaw: (end * 200 + side * 17) % 360,
        scale: 1.2,
      });
    }
  }
  loadModelInstances(app, "/models/rock_large.glb", rockLarge);
  loadModelInstances(app, "/models/rock_small.glb", rockSmall);
  loadModelInstances(app, "/models/stone_small.glb", stones);

  // ---- Irregular shoreline scatter following the river spline ------------
  // Stones tumbling along BOTH banks of the winding river (beyond the immediate
  // crossing) so the shoreline reads as hand-cut. Skipped under the deck span
  // and inside any keep-clear apron. Pure dressing.
  const shoreStones: Placement[] = [];
  const shoreRocks: Placement[] = [];
  for (let k = 0; k <= 20; k++) {
    const rt = k / 20;
    const rs = river.sample(rt);
    const dAlong = (rs.position.x - cx) * fX + (rs.position.z - cz) * fZ;
    if (Math.abs(dAlong) < deckHalf + 1.0) continue; // keep clear of the deck
    const half = waterWidthAt(rt) / 2;
    for (const side of [1, -1] as const) {
      const jitter = ((k * 31.7) % 7) / 7 - 0.5; // -0.5..0.5 deterministic
      const lat = (half + 0.7 + Math.abs(jitter) * 1.4) * side;
      const sx = rs.position.x + rs.tangent.z * lat;
      const sz = rs.position.z - rs.tangent.x * lat;
      if (isInKeepClear(sx, sz, keepClear)) continue;
      const place: Placement = {
        position: [sx, 0, sz],
        yaw: (k * 53 + side * 90) % 360,
        scale: 0.9 + Math.abs(jitter),
      };
      if (k % 3 === 0) shoreRocks.push(place);
      else shoreStones.push(place);
    }
  }
  loadModelInstances(app, "/models/stone_small.glb", shoreStones);
  loadModelInstances(app, "/models/rock_small.glb", shoreRocks);

  // ---- Rocks embedded IN the water (poking above the surface) ------------
  const waterRocks: Placement[] = [];
  for (let k = 0; k < 6; k++) {
    const rt = 0.12 + k * 0.14;
    if (rt > 0.95) break;
    const rs = river.sample(rt);
    const dAlong = (rs.position.x - cx) * fX + (rs.position.z - cz) * fZ;
    if (Math.abs(dAlong) < deckHalf + 1.5) continue; // not under the deck
    const jitter = ((k * 71.3) % 9) / 9 - 0.5;
    const lat = jitter * (waterWidthAt(rt) * 0.5);
    const wx = rs.position.x + rs.tangent.z * lat;
    const wz = rs.position.z - rs.tangent.x * lat;
    waterRocks.push({
      position: [wx, LAYOUT.river.y - 0.05, wz],
      yaw: (k * 91) % 360,
      scale: 0.8 + (k % 3) * 0.2,
    });
  }
  loadModelInstances(app, "/models/rock_small.glb", waterRocks);

  // ---- Bank foliage + reeds softening the approaches (decorative) --------
  const bushes: Placement[] = [];
  const grass: Placement[] = [];
  const reeds: Placement[] = [];
  const flowers: Placement[] = [];
  for (let k = 0; k < 14; k++) {
    const end = k % 2 === 0 ? 1 : -1;
    const side = k % 3 === 0 ? 1 : -1;
    const a = endDist + 1.6 + (k % 4) * 0.8;
    const lat = deckHalf + 1.6 + ((k * 0.37) % 1) * 2.0;
    const x = cx + fX * a * end + rX * lat * side;
    const z = cz + fZ * a * end + rZ * lat * side;
    // Respect the shared keep-clear apron so bank foliage never crowds a
    // nearby structure.
    if (isInKeepClear(x, z, keepClear)) continue;
    const yawK = (k * 47) % 360;
    if (k % 4 === 0) bushes.push({ position: [x, 0, z], yaw: yawK, scale: 1.2 });
    else if (k % 4 === 1) flowers.push({ position: [x, 0, z], yaw: yawK, scale: 1.1 });
    else if (k % 4 === 2)
      reeds.push({ position: [x, 0, z], yaw: yawK, scale: [1.0, 1.7, 1.0] });
    else grass.push({ position: [x, 0, z], yaw: yawK, scale: 1.2 });
  }
  loadModelInstances(app, "/models/bush.glb", bushes);
  loadModelInstances(app, "/models/grass.glb", grass);
  // Tall grass tufts stand in for waterside reeds at the shoreline.
  loadModelInstances(app, "/models/grass_large.glb", reeds);
  loadModelInstances(app, "/models/flower_yellow.glb", flowers);

  // ---- Lily pads floating on the water, to either side of the deck -------
  // Sample the river spline around its middle (where it meets the crossing) so
  // the pads follow the water as it winds, dropping off to both sides of the
  // deck. Pads that would sit on/under the bridge deck are skipped.
  const lilies: Placement[] = [];
  for (let k = -4; k <= 4; k++) {
    const rt = 0.5 + k * 0.035;
    if (rt < 0 || rt > 1) continue;
    const rs = river.sample(rt);
    const dAlong = (rs.position.x - cx) * fX + (rs.position.z - cz) * fZ;
    if (Math.abs(dAlong) < deckHalf + 0.5) continue;
    const jitter = ((k * 53.1) % 10) / 10 - 0.5; // -0.5..0.5 deterministic
    const lat = jitter * (LAYOUT.river.width * 0.3);
    const lx = rs.position.x + rs.tangent.z * lat;
    const lz = rs.position.z - rs.tangent.x * lat;
    lilies.push({
      position: [lx, LAYOUT.river.y + 0.02, lz],
      yaw: (k * 64) % 360,
      scale: 1.1,
    });
  }
  loadModelInstances(app, "/models/lily.glb", lilies);
}
