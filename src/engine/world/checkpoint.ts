import * as pc from "playcanvas";

import type { Path } from "./path";
import type { LandmarkSpec } from "./landmarks";
import { type Marker, yawFromDir } from "./shared";
import { buildChapterStructure, type StructureFrame } from "./structures";
import type { Checkpoint, ColliderSpec, Interactable } from "./types";

/**
 * Checkpoint system: the narrative chapter STRUCTURES the player arrives at and
 * the proximity triggers that fire their content-sourced dialogue.
 *
 * Each along-path chapter is an actual environmental BUILDING (composed by
 * {@link ./structures} from the building kit + props) with a warm (or cool)
 * accent light registered as a {@link Marker} so it flickers/pulses. There is
 * NO lone floating lantern/cube as the sole marker — the structure IS the
 * landmark, and the checkpoint trigger sits on the path just before its door.
 */

// Re-exported for the orchestrator + spawn camp (single source of truth).
export type { Marker } from "./shared";

/**
 * Advance every marker's warm flicker/pulse and the lantern bob by `elapsed`
 * seconds. Lanterns flicker quickly and subtly; firepits/beacons pulse slower
 * + wider.
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

/**
 * Place a landmark's chapter STRUCTURE, its checkpoint trigger, and its solid
 * footprint collider(s).
 *
 * Narrative copy (speaker/line/lines) is NOT read from the placement data; it
 * is supplied by the caller from `content/chapters.json` (matched by id), so
 * the engine holds no human-readable strings. The visual building + props +
 * accent lights + colliders are composed by {@link buildChapterStructure},
 * keyed on the landmark id.
 */
export function placeLandmark(
  app: pc.AppBase,
  path: Path,
  lm: LandmarkSpec,
  copy: { speaker: string; line: string; lines?: string[] },
  checkpoints: Checkpoint[],
  colliders: ColliderSpec[],
  markers: Marker[],
  interactables: Interactable[],
): void {
  const s = path.sample(lm.t);
  // Right-of-travel normal in XZ.
  const rightX = s.tangent.z;
  const rightZ = -s.tangent.x;

  // Structure anchor (centre) sits off the path along the normal.
  const ax = s.position.x + rightX * lm.offset;
  const az = s.position.z + rightZ * lm.offset;

  // Build the local frame: the "along" axis follows the path tangent (the
  // building's left-right), the "into" axis points from the path toward the
  // anchor (the building's depth), and the front FACES back toward the path.
  const sign = lm.offset >= 0 ? 1 : -1;
  const intoX = rightX * sign;
  const intoZ = rightZ * sign;
  const faceYaw = yawFromDir(-intoX, -intoZ);
  const frame: StructureFrame = {
    ox: ax,
    oz: az,
    alongX: s.tangent.x,
    alongZ: s.tangent.z,
    intoX,
    intoZ,
    faceYaw,
    marker: lm.marker,
  };

  const handle = buildChapterStructure(app, lm.id, frame, colliders, markers);

  // Checkpoint trigger sits on the path side of the structure anchor so the
  // dialogue fires as the player arrives at the door, not only when off-path.
  const cpX = s.position.x + rightX * (lm.offset * 0.4);
  const cpZ = s.position.z + rightZ * (lm.offset * 0.4);
  checkpoints.push({
    info: { id: lm.id, speaker: copy.speaker, line: copy.line, lines: copy.lines },
    position: new pc.Vec3(cpX, 0, cpZ),
    radius: lm.radius,
  });

  // Register the structure as an interactable the player can approach + enter.
  // The approach centre matches the checkpoint trigger (on the path, at the
  // door); the title is the chapter title (copy.speaker), sourced from content.
  if (handle) {
    interactables.push({
      id: lm.id,
      title: copy.speaker,
      position: new pc.Vec3(cpX, 0, cpZ),
      radius: lm.radius,
      setHighlight: handle.setHighlight,
    });
  }
}
