import type * as pc from "playcanvas";

import type { Path } from "./path";
import { BRIDGE_CROSSING_T, LANDMARKS, SPAWN_T } from "./landmarks";
import {
  hash01,
  LAYOUT,
  loadModelInstances,
  type Placement,
} from "./shared";
import type { ColliderSpec } from "./types";

/**
 * Nature system: the scenery that turns the corridor into a composed scene.
 *
 * Rather than scattering props uniformly, this places three intentional layers:
 *
 * 1. LAYERED TREE LINES that FRAME the road — clustered, set back behind the
 *    path-edge walls in a near band (just behind the shoulder) and a far band
 *    (deeper into the framing hills), mixing oak / pine / tall-pine silhouettes
 *    with varied scale + rotation. Density swells near points of interest and
 *    on bends (to mask what's around the curve) and thins on long straights.
 * 2. ROCKS at bends + transitions (rock_large / rock_small / stone_small) to
 *    naturally anchor the corners.
 * 3. GROUND DETAIL near the path edges (bush / grass / flowers / mushrooms) in
 *    tasteful clusters, denser at clearings + points of interest.
 *
 * Placement is fully deterministic (hash-based, no RNG) so the composition is
 * art-directed and stable run-to-run. Trees + rocks in the NEAR band emit
 * `"prop"` colliders (the player can brush them at the shoulder); the far band
 * and all ground detail are decorative and beyond the walkable corridor, so
 * they carry no colliders to keep physics light. Every GLB is loaded ONCE and
 * instanced many times (via {@link loadModelInstances}) for performance.
 */

/** A tree silhouette template (scale range + trunk collider footprint). */
interface TreeKind {
  url: string;
  minScale: number;
  maxScale: number;
  /** Trunk collider half-extents (only used for near-band trees). */
  half: [number, number, number];
}

/** Silhouette-varied trees for the framing lines. */
const TREE_KINDS: readonly TreeKind[] = [
  { url: "/models/tree_oak.glb", minScale: 2.2, maxScale: 3.0, half: [0.4, 2.6, 0.4] },
  { url: "/models/tree_pine.glb", minScale: 2.6, maxScale: 3.3, half: [0.4, 3.0, 0.4] },
  { url: "/models/tree_pine_tall.glb", minScale: 2.8, maxScale: 3.9, half: [0.45, 3.6, 0.45] },
];

/** A rare, distinctive far-background tree for silhouette variety. */
const ACCENT_TREE: TreeKind = {
  url: "/models/tree_knowledge.glb",
  minScale: 3.4,
  maxScale: 4.2,
  half: [0.6, 3.4, 0.6],
};

/** Rock templates used to anchor bends. */
interface RockKind {
  url: string;
  minScale: number;
  maxScale: number;
  half: [number, number, number];
}
const ROCK_KINDS: readonly RockKind[] = [
  { url: "/models/rock_large.glb", minScale: 1.5, maxScale: 2.2, half: [0.9, 0.7, 0.9] },
  { url: "/models/rock_small.glb", minScale: 1.2, maxScale: 1.7, half: [0.55, 0.45, 0.55] },
  { url: "/models/stone_small.glb", minScale: 1.0, maxScale: 1.6, half: [0.35, 0.3, 0.35] },
];

/** Points of interest along the path that scenery should gather around. */
const POIS: readonly number[] = [
  SPAWN_T,
  BRIDGE_CROSSING_T,
  ...LANDMARKS.map((lm) => lm.t),
];

/** Nearness (0..1) to the closest point of interest; 1 == right on top of it. */
function poiProximity(t: number): number {
  let min = Infinity;
  for (const p of POIS) min = Math.min(min, Math.abs(t - p));
  // Falls off over ~0.12 of the path.
  return Math.max(0, 1 - min / 0.12);
}

/** How sharply the path turns near `t` (0 straight … ~2 hairpin). */
function turnAmount(path: Path, t: number): number {
  const d = 0.03;
  const a = path.sample(Math.max(0, t - d)).tangent;
  const b = path.sample(Math.min(1, t + d)).tangent;
  const dot = a.x * b.x + a.z * b.z;
  return 1 - Math.max(-1, Math.min(1, dot));
}

/** True if `t` sits inside an exclusion zone (set pieces own that ground). */
function isReserved(t: number): boolean {
  if (t < 0.14) return true; // spawn clearing / camp (dressed by spawn.ts)
  if (Math.abs(t - BRIDGE_CROSSING_T) < 0.05) return true; // bridge (river.ts)
  return LANDMARKS.some((lm) => Math.abs(t - lm.t) < 0.035);
}

export function buildNature(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): void {
  buildTreeFraming(app, path, colliders);
  buildRockFraming(app, path, colliders);
  buildGroundDetail(app, path);
}

/**
 * Layered, clustered tree lines that frame the road and hide the bends. Trees
 * are grouped per-URL so each GLB loads once and instances many times.
 */
function buildTreeFraming(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): void {
  const shoulder = LAYOUT.path.width / 2 + LAYOUT.path.shoulder; // ~2.8
  // Stations + tree budget scale with the path length so the longer pass-2
  // ribbon stays framed end-to-end (no bare stretches).
  const length = path.length();
  const STATIONS = Math.max(50, Math.round(length / 2.5));
  const MAX_TREES = Math.round(length * 0.6);

  // One placement bucket per tree URL (so a single load fans out to N clones).
  const buckets = new Map<string, Placement[]>();
  const push = (url: string, p: Placement) => {
    const b = buckets.get(url);
    if (b) b.push(p);
    else buckets.set(url, [p]);
  };

  let placed = 0;
  let colliderIdx = 0;

  for (let i = 1; i < STATIONS && placed < MAX_TREES; i++) {
    const t = i / STATIONS;
    if (isReserved(t)) continue;

    const s = path.sample(t);
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;

    // Composition density: always some framing, swelling on bends + near POIs.
    const density = 0.35 + 0.4 * poiProximity(t) + 0.5 * Math.min(1, turnAmount(path, t));

    for (const side of [1, -1] as const) {
      // Deterministic per-station-per-side dice.
      const seed = i * 2 + (side === 1 ? 0 : 1);
      const roll = hash01(seed * 1.7 + 0.3);
      if (roll > density) continue;

      // Cluster of 1..3 trees, more when denser.
      const clusterN = 1 + Math.floor(hash01(seed * 3.1) * (1 + density * 1.6));
      for (let c = 0; c < clusterN && placed < MAX_TREES; c++) {
        const h = hash01(seed * 9.7 + c * 4.3);
        const h2 = hash01(seed * 5.2 + c * 7.1);
        const h3 = hash01(seed * 2.6 + c * 1.9);

        // Near band hugs the shoulder; far band sits deep in the framing hills.
        const near = h2 < 0.55;
        const offset = near
          ? shoulder + 1.6 + h * 3.0 // ~4.4 .. 7.4
          : shoulder + 5.5 + h * 7.0; // ~8.3 .. 15.3
        // Spread the cluster along the path tangent so it doesn't stack.
        const along = (c - (clusterN - 1) / 2) * (1.7 + h3 * 1.4);
        const x = s.position.x + rightX * offset * side + s.tangent.x * along;
        const z = s.position.z + rightZ * offset * side + s.tangent.z * along;

        // Pick a silhouette: tall pines favoured deep, oaks/pines near; the
        // accent tree appears only rarely and only in the far band.
        let kind: TreeKind;
        if (!near && h3 > 0.92) kind = ACCENT_TREE;
        else kind = TREE_KINDS[Math.floor(h * TREE_KINDS.length) % TREE_KINDS.length];

        const scale = kind.minScale + h2 * (kind.maxScale - kind.minScale);
        const yaw = hash01(seed * 6.4 + c) * 360;
        push(kind.url, { position: [x, 0, z], yaw, scale });
        placed++;

        // Near-band trees get a trunk collider (player can brush the shoulder).
        if (near) {
          colliders.push({
            id: `nature-tree-${colliderIdx++}`,
            type: "box",
            position: [x, kind.half[1], z],
            halfExtents: kind.half,
            rotation: [0, yaw, 0],
            role: "prop",
          });
        }
      }
    }
  }

  for (const [url, placements] of buckets) {
    loadModelInstances(app, url, placements);
  }
}

/** Rocks clustered at bends + transitions to anchor the corners. */
function buildRockFraming(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): void {
  const shoulder = LAYOUT.path.width / 2 + LAYOUT.path.shoulder;
  const length = path.length();
  const STATIONS = Math.max(40, Math.round(length / 4));
  const MAX_ROCKS = Math.round(length * 0.16);

  const buckets = new Map<string, Placement[]>();
  const push = (url: string, p: Placement) => {
    const b = buckets.get(url);
    if (b) b.push(p);
    else buckets.set(url, [p]);
  };

  let placed = 0;
  let colliderIdx = 0;

  for (let i = 1; i < STATIONS && placed < MAX_ROCKS; i++) {
    const t = i / STATIONS;
    if (isReserved(t)) continue;

    const turn = turnAmount(path, t);
    // Rocks live at the corners (or, sparsely, near POIs).
    if (turn < 0.04 && poiProximity(t) < 0.4) continue;

    const s = path.sample(t);
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;
    const side = hash01(i * 4.7) < 0.5 ? 1 : -1;

    const h = hash01(i * 8.3);
    const h2 = hash01(i * 2.9 + 1.1);
    const kind = ROCK_KINDS[Math.floor(h * ROCK_KINDS.length) % ROCK_KINDS.length];
    const offset = shoulder + 1.0 + h2 * 2.5;
    const x = s.position.x + rightX * offset * side;
    const z = s.position.z + rightZ * offset * side;
    const scale = kind.minScale + h * (kind.maxScale - kind.minScale);
    const yaw = hash01(i * 3.3) * 360;

    push(kind.url, { position: [x, 0, z], yaw, scale });
    placed++;

    // Larger rocks near the shoulder get a collider; pebbles stay decorative.
    if (kind.url !== "/models/stone_small.glb" && offset < shoulder + 2.4) {
      colliders.push({
        id: `nature-rock-${colliderIdx++}`,
        type: "box",
        position: [x, kind.half[1], z],
        halfExtents: kind.half,
        rotation: [0, yaw, 0],
        role: "prop",
      });
    }
  }

  for (const [url, placements] of buckets) {
    loadModelInstances(app, url, placements);
  }
}

/**
 * Ground detail (bush / grass / flowers / mushrooms) scattered just outside the
 * corridor in tasteful clusters — denser at clearings + points of interest,
 * sparse on the long straights. Purely decorative: no colliders.
 */
function buildGroundDetail(app: pc.AppBase, path: Path): void {
  const { nearOffset, farOffset, stations } = LAYOUT.decor;

  const grass: Placement[] = [];
  const grassLarge: Placement[] = [];
  const bush: Placement[] = [];
  const flowerRed: Placement[] = [];
  const flowerYellow: Placement[] = [];
  const mushroom: Placement[] = [];

  const MAX_DETAIL = Math.round(path.length() * 1.2);
  let placed = 0;

  for (let i = 1; i < stations && placed < MAX_DETAIL; i++) {
    const t = i / stations;
    if (t < 0.12) continue; // spawn clearing dressed by spawn.ts
    if (Math.abs(t - BRIDGE_CROSSING_T) < 0.04) continue; // bridge dressed by river.ts

    const s = path.sample(t);
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;

    // Lusher near points of interest, sparse on straights.
    const lush = 0.25 + 0.75 * poiProximity(t);

    for (const side of [1, -1] as const) {
      const seed = i * 2 + (side === 1 ? 0 : 1);
      const roll = hash01(seed * 1.31);
      if (roll > lush) continue;

      const tuftN = 1 + Math.floor(hash01(seed * 2.7) * 3); // 1..3
      for (let c = 0; c < tuftN && placed < MAX_DETAIL; c++) {
        const h = hash01(seed * 4.9 + c * 3.7);
        const h2 = hash01(seed * 7.3 + c * 1.3);
        const h3 = hash01(seed * 9.1 + c * 5.5);
        const offset = nearOffset + h * (farOffset - nearOffset);
        const along = (h2 - 0.5) * 3.0;
        const x = s.position.x + rightX * offset * side + s.tangent.x * along;
        const z = s.position.z + rightZ * offset * side + s.tangent.z * along;
        const yaw = h3 * 360;
        const scale = 0.9 + h * 0.7;

        // Weighted pick: grass dominates, flowers/bushes accent, mushrooms rare.
        const pick = hash01(seed * 6.1 + c * 2.2);
        const p: Placement = { position: [x, 0, z], yaw, scale };
        if (pick < 0.4) grass.push(p);
        else if (pick < 0.6) grassLarge.push(p);
        else if (pick < 0.74) bush.push(p);
        else if (pick < 0.84) flowerRed.push(p);
        else if (pick < 0.94) flowerYellow.push(p);
        else mushroom.push({ ...p, scale: 0.8 + h2 * 0.5 });
        placed++;
      }
    }
  }

  loadModelInstances(app, "/models/grass.glb", grass);
  loadModelInstances(app, "/models/grass_large.glb", grassLarge);
  loadModelInstances(app, "/models/bush.glb", bush);
  loadModelInstances(app, "/models/flower_red.glb", flowerRed);
  loadModelInstances(app, "/models/flower_yellow.glb", flowerYellow);
  loadModelInstances(app, "/models/mushroom.glb", mushroom);
}
