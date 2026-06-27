import * as pc from "playcanvas";

import type { Path } from "./path";
import type { LandmarkSpec, MarkerKind } from "./landmarks";
import { addPointLight, addPrimitive, LAYOUT, loadModel, makeMaterial, yawFromDir } from "./shared";
import type { Checkpoint, ColliderSpec } from "./types";

/**
 * Checkpoint system: environment-integrated markers (lanterns / firepits with a
 * warm point-light flicker/pulse) and the narrative landmarks they sit beside —
 * each landmark places its GLB models, a proximity checkpoint trigger, a glowing
 * marker, and a solid base collider (role `"landmark"`). There is NO floating
 * cube; the warm light IS the marker.
 */

/** A checkpoint marker that animates a warm point light (and bobs a lantern). */
export interface Marker {
  kind: MarkerKind;
  light: pc.Entity;
  baseIntensity: number;
  baseY: number;
  /** The loaded model root (set async); animated for the lantern bob. */
  model: pc.Entity | null;
  phase: number;
}

/**
 * Advance every marker's warm flicker/pulse and the lantern bob by `elapsed`
 * seconds. Lanterns flicker quickly and subtly; firepits pulse slower + wider.
 */
export function stepMarkers(markers: Marker[], elapsed: number): void {
  for (const m of markers) {
    const speed = m.kind === "lantern" ? 9 : 3.5;
    const amp = m.kind === "lantern" ? 0.18 : 0.45;
    const flick =
      Math.sin((elapsed + m.phase) * speed) * 0.6 +
      Math.sin((elapsed + m.phase) * speed * 2.3) * 0.4;
    if (m.light.light) {
      m.light.light.intensity = m.baseIntensity * (1 + flick * amp);
    }
    if (m.kind === "lantern" && m.model) {
      const mp = m.model.getLocalPosition();
      m.model.setLocalPosition(
        mp.x,
        m.baseY - 1.2 + Math.sin(elapsed * 1.6 + m.phase) * 0.08,
        mp.z,
      );
    }
  }
}

/** Build an immersive checkpoint marker (lantern or firepit) with a glow. */
export function buildMarker(
  app: pc.AppBase,
  kind: MarkerKind,
  x: number,
  z: number,
  markers: Marker[],
): void {
  if (kind === "lantern") {
    const lightY = 1.6;
    const light = addPointLight(app, x, lightY, z, LAYOUT.marker.lanternIntensity);
    const marker: Marker = {
      kind,
      light,
      baseIntensity: LAYOUT.marker.lanternIntensity,
      baseY: lightY,
      model: null,
      phase: Math.random() * 6,
    };
    markers.push(marker);
    loadModel(app, "/models/lamp.glb", (root) => {
      root.setLocalPosition(x, 0, z);
      root.setLocalScale(1.6, 1.6, 1.6);
      marker.model = root;
    });
  } else {
    // Firepit: a small campfire ringed by stones, with a slow warm pulse.
    const lightY = 1.0;
    const light = addPointLight(app, x, lightY, z, LAYOUT.marker.firepitIntensity);
    markers.push({
      kind,
      light,
      baseIntensity: LAYOUT.marker.firepitIntensity,
      baseY: lightY,
      model: null,
      phase: Math.random() * 6,
    });
    loadModel(app, "/models/campfire.glb", (root) => {
      root.setLocalPosition(x, 0, z);
      root.setLocalScale(1.4, 1.4, 1.4);
    });
    // Stone ring grounding the firepit in the world.
    const ringMat = makeMaterial([0.45, 0.45, 0.48]);
    const ringCount = 6;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;
      addPrimitive(
        app,
        "box",
        ringMat,
        [x + Math.cos(a) * 1.1, 0.15, z + Math.sin(a) * 1.1],
        [0.4, 0.3, 0.4],
        (a * 180) / Math.PI,
      );
    }
  }
}

/** Place a landmark's models, checkpoint, collider, and glowing marker. */
export function placeLandmark(
  app: pc.AppBase,
  path: Path,
  lm: LandmarkSpec,
  checkpoints: Checkpoint[],
  colliders: ColliderSpec[],
  markers: Marker[],
): void {
  const s = path.sample(lm.t);
  // Right-of-travel normal in XZ.
  const rightX = s.tangent.z;
  const rightZ = -s.tangent.x;
  const facingYaw = yawFromDir(s.tangent.x, s.tangent.z);

  // Landmark anchor sits just off the path along the normal.
  const ax = s.position.x + rightX * lm.offset;
  const az = s.position.z + rightZ * lm.offset;

  for (const model of lm.models) {
    loadModel(app, model.url, (root) => {
      root.setLocalPosition(ax + model.offset[0], model.offset[1], az + model.offset[2]);
      // Face roughly toward the path so silhouettes read from the road.
      root.setEulerAngles(0, facingYaw + 180 + model.yaw, 0);
      root.setLocalScale(model.scale, model.scale, model.scale);
    });
  }

  // Checkpoint trigger sits on the path side of the landmark anchor so the
  // dialogue fires as the player passes, not only when off the path.
  const cpX = s.position.x + rightX * (lm.offset * 0.45);
  const cpZ = s.position.z + rightZ * (lm.offset * 0.45);
  checkpoints.push({
    info: { id: lm.id, speaker: lm.name, line: lm.line },
    position: new pc.Vec3(cpX, 0, cpZ),
    radius: lm.radius,
  });

  // Environment-integrated marker between the path and the landmark.
  const mx = s.position.x + rightX * (lm.offset * 0.6);
  const mz = s.position.z + rightZ * (lm.offset * 0.6);
  buildMarker(app, lm.marker, mx, mz, markers);

  // Solid base/blocker for the physics pass.
  if (lm.collider) {
    colliders.push({
      id: `${lm.id}-base`,
      type: "box",
      position: [ax, lm.collider.yOffset ?? lm.collider.halfExtents[1], az],
      halfExtents: lm.collider.halfExtents,
      rotation: [0, facingYaw, 0],
      role: "landmark",
    });
  }
}
