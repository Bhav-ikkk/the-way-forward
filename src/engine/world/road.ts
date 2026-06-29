import type * as pc from "playcanvas";

import type { Path } from "./path";
import {
  BRIDGE_CROSSING_T,
  computeEntrances,
  SPAWN_T,
} from "./landmarks";
import {
  addPointLight,
  LAYOUT,
  loadModelInstances,
  type Placement,
  yawFromDir,
} from "./shared";
import type { ColliderSpec } from "./types";

/**
 * Road system: the HANDCRAFTED dirt road laid along the path spline, the
 * per-building entrance PLAZAS where it widens into a paved court, the
 * wayfinding lanterns that line it, and — critically for pass 1 — the INVISIBLE
 * path-edge confinement wall collider specs that keep the player on the
 * corridor (out of the grass / ridges and out of the river).
 *
 * Pass-2 Stage-1 retired the old procedural tan box strip: the road is now a
 * ribbon of the curated `road_straight.glb` dirt tile, scaled to a CONSISTENT
 * width and oriented to the path tangent so the edges stay clean around the
 * bends, and at EACH building the road WIDENS into a small court of `road_tile`
 * paving that connects the through-road to the door — so every location reads
 * as a destination the road arrives at, not a path passing by.
 *
 * No physics is built here; the walls are emitted purely as {@link ColliderSpec}
 * data (role `"wall"`) for the later Rapier pass. Walls follow the path spline,
 * offset to both shoulders, oriented to the tangent, with a GAP left open at
 * the spawn clearing so the camp reads as open. Across the river the walls
 * naturally become guard rails flanking the open bridge walkway.
 */
export function buildRoad(
  app: pc.AppBase,
  path: Path,
  colliders: ColliderSpec[],
): void {
  // ---- Handcrafted dirt-road ribbon (tiles oriented to the tangent) ------
  layRoadRibbon(app, path);

  // ---- Per-building entrance plazas (the road widens into a court) -------
  buildEntrancePlazas(app, path);

  // ---- Wayfinding lanterns lining the path -------------------------------
  buildLanterns(app, path);

  // ---- Invisible path-edge confinement walls (collider specs only) -------
  buildConfinementWalls(path, colliders);
}

/**
 * Lay the dirt road as a ribbon of `road_straight.glb` tiles along the spline.
 *
 * Each tile spans one arc-length-even segment: it is centred on the segment
 * midpoint, oriented to the local tangent (so the road's long axis follows the
 * curve), scaled to the CONSISTENT road width across, and scaled along travel
 * to the segment length (with a small overlap so the curve seams never gap).
 * One GLB fetch fans out to all tiles via {@link loadModelInstances}.
 */
function layRoadRibbon(app: pc.AppBase, path: Path): void {
  const { width, roadModel, roadTileLength, roadSegments, roadOverlap, roadY } =
    LAYOUT.path;
  const pts = path.getEvenlySpacedPoints(roadSegments + 1);
  const tiles: Placement[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i].position;
    const b = pts[i + 1].position;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    tiles.push({
      position: [(a.x + b.x) / 2, roadY, (a.z + b.z) / 2],
      yaw: yawFromDir(dx, dz),
      // Native tile is 1u wide × roadTileLength long; scale X to the road
      // width and Z to the segment length (+overlap) so it tiles cleanly.
      scale: [width, 1, (len / roadTileLength) * roadOverlap],
    });
  }
  loadModelInstances(app, roadModel, tiles);
}

/**
 * At each building (the five chapters + the arrival camp) lay a small paved
 * COURT of `road_tile` paving spanning from the road centreline out to the
 * building's front door, WIDER than the road, so the road reads as widening
 * into an entrance/plaza the location is reached through. The court is a tight
 * grid laid in the building's frame (along the path tangent × into the door),
 * each tile oriented to the frame; one GLB fetch fans out across all courts.
 */
function buildEntrancePlazas(app: pc.AppBase, path: Path): void {
  const { tileModel, tileNative, cols, rows, halfAlong, overlap, y } =
    LAYOUT.plaza;
  const tiles: Placement[] = [];

  for (const e of computeEntrances(path)) {
    // Court depth runs from the road centreline (spur root) to the front door.
    const depth = Math.hypot(e.doorX - e.pathX, e.doorZ - e.pathZ);
    if (depth < 1e-3) continue;
    const tileYaw = yawFromDir(e.alongX, e.alongZ);
    const alongStep = (2 * halfAlong) / cols;
    const intoStep = depth / rows;

    for (let c = 0; c < cols; c++) {
      const along = -halfAlong + (c + 0.5) * alongStep;
      for (let r = 0; r < rows; r++) {
        const into = (r + 0.5) * intoStep;
        const x = e.pathX + e.alongX * along + e.intoX * into;
        const z = e.pathZ + e.alongZ * along + e.intoZ * into;
        tiles.push({
          position: [x, y, z],
          yaw: tileYaw,
          // Native tile is tileNative square; scale local Z→along, local X→into.
          scale: [
            (intoStep / tileNative) * overlap,
            1,
            (alongStep / tileNative) * overlap,
          ],
        });
      }
    }
  }

  loadModelInstances(app, tileModel, tiles);
}

/**
 * Place lamp models along the path as wayfinding, spaced more tightly as the
 * road approaches the two emotional anchors — the spawn camp and the bridge
 * crossing — and sparser on the long straights. A capped subset of the lamps
 * NEAREST those anchors get a real warm point light so the approaches glow
 * (the cap keeps the lit-light budget tight); the rest are unlit models. All
 * lamps load from a single GLB fetch and instance out for performance.
 */
function buildLanterns(app: pc.AppBase, path: Path): void {
  const pts = path.getEvenlySpacedPoints(LAYOUT.path.segments + 1);
  const last = pts.length - 1;
  const halfW = LAYOUT.path.width / 2 + 0.9;

  /** Nearness (0..1) of t to an anchor over the given falloff. */
  const near = (t: number, anchor: number, falloff: number) =>
    Math.max(0, 1 - Math.abs(t - anchor) / falloff);

  interface Lamp {
    x: number;
    z: number;
    yaw: number;
    importance: number;
  }
  const lamps: Lamp[] = [];

  let i = 6;
  let sideFlip = 0;
  while (i <= last) {
    const t = i / last;
    const s = pts[i];
    const side = sideFlip % 2 === 0 ? 1 : -1;
    sideFlip++;
    const rightX = s.tangent.z;
    const rightZ = -s.tangent.x;
    const x = s.position.x + rightX * halfW * side;
    const z = s.position.z + rightZ * halfW * side;
    const importance = Math.max(
      near(t, SPAWN_T, 0.14),
      near(t, BRIDGE_CROSSING_T, 0.12),
    );
    lamps.push({
      x,
      z,
      yaw: yawFromDir(s.tangent.x, s.tangent.z),
      importance,
    });
    // Tighter spacing approaching the camp / bridge, looser on straights.
    i += importance > 0.45 ? 3 : 6;
  }

  loadModelInstances(
    app,
    "/models/lamp.glb",
    lamps.map((l) => ({ position: [l.x, 0, l.z], yaw: l.yaw, scale: 1.4 })),
  );

  // Light only the lamps closest to the anchors, capped for perf.
  const lit = [...lamps]
    .filter((l) => l.importance > 0)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, LAYOUT.lantern.maxLit);
  for (const l of lit) {
    addPointLight(
      app,
      l.x,
      LAYOUT.lantern.lightY,
      l.z,
      LAYOUT.lantern.intensity,
      LAYOUT.lantern.range,
    );
  }
}

/**
 * Generate the tall, thin, tangent-oriented wall colliders along both shoulders
 * of the path, leaving the spawn clearing open. These are invisible in pass 1
 * (no entity is drawn) — only the spec data is emitted.
 */
function buildConfinementWalls(path: Path, colliders: ColliderSpec[]): void {
  const { segments, width, shoulder, wallHeight, wallThickness, spawnGap } =
    LAYOUT.path;
  const offset = width / 2 + shoulder;
  const pts = path.getEvenlySpacedPoints(segments + 1);

  for (let i = 0; i < pts.length - 1; i++) {
    // Approximate normalised position of this segment along the path.
    const t = i / (pts.length - 1);
    // Leave the spawn clearing open so the camp doesn't feel fenced in.
    if (t >= spawnGap[0] && t <= spawnGap[1]) continue;

    const a = pts[i];
    const b = pts[i + 1];
    const ax = a.position.x;
    const az = a.position.z;
    const bx = b.position.x;
    const bz = b.position.z;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;

    const midX = (ax + bx) / 2;
    const midZ = (az + bz) / 2;
    const yaw = yawFromDir(dx, dz);

    // Right-of-travel normal in XZ.
    const rightX = dz / len;
    const rightZ = -dx / len;
    // Overlap along the tangent so corners never leave a gap on the curves.
    const halfLen = (len * 1.08) / 2;

    for (const side of [1, -1] as const) {
      const cx = midX + rightX * offset * side;
      const cz = midZ + rightZ * offset * side;
      colliders.push({
        id: `wall-${side === 1 ? "r" : "l"}-${i}`,
        type: "box",
        position: [cx, wallHeight / 2, cz],
        halfExtents: [wallThickness, wallHeight / 2, halfLen],
        rotation: [0, yaw, 0],
        role: "wall",
      });
    }
  }
}
