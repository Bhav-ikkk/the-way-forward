import * as pc from "playcanvas";

/**
 * Lighting system: a warm, golden directional "sun" at a low, cinematic angle
 * with soft shadows, balanced by a cooler ambient fill so shadowed sides keep
 * colour and the scene reads with depth rather than flat or muddy. Kept to a
 * single directional + ambient (the warm point lights at markers/camp/lanterns
 * do the rest) so the mood lives in one place and the perf budget stays tight.
 *
 * The values here are tuned to match {@link buildAtmosphere}'s golden-hour
 * mood: a deep-amber low sun against a warm hazy horizon, with a cool-blue
 * ambient so shadows read as dusk-blue instead of muddy black — colour
 * separation without blowing out the lit, sun-facing surfaces.
 */

/** Tunable lighting constants (golden-hour mood). */
const LIGHTING = {
  /** Cool, sky-tinted ambient fill (kept low so the sun stays the hero). */
  ambient: [0.32, 0.38, 0.5] as const,
  sun: {
    /** Warm, deep-amber golden-hour sun colour. */
    color: [1.0, 0.84, 0.62] as const,
    /** Bright enough to model form, not so hot it blows out the path. */
    intensity: 1.3,
    /** Low pitch + side angle → long, raking, directional shadows. */
    pitch: 23,
    yaw: 46,
    shadowBias: 0.04,
    normalOffsetBias: 0.06,
    shadowDistance: 160,
    shadowResolution: 2048,
  },
} as const;

export function buildLighting(app: pc.AppBase): void {
  // Cool sky-tinted ambient fill: complements the warm sun so shadows read as
  // dusk-blue rather than dead black, giving colour separation while staying
  // bright enough that shadowed sides keep detail under the warm haze.
  app.scene.ambientLight = new pc.Color(
    LIGHTING.ambient[0],
    LIGHTING.ambient[1],
    LIGHTING.ambient[2],
  );

  const sun = new pc.Entity("sun");
  sun.addComponent("light", {
    type: "directional",
    color: new pc.Color(
      LIGHTING.sun.color[0],
      LIGHTING.sun.color[1],
      LIGHTING.sun.color[2],
    ),
    intensity: LIGHTING.sun.intensity,
    castShadows: true,
    // Softer shadow edges + larger normal offset to kill acne on the low angle.
    shadowBias: LIGHTING.sun.shadowBias,
    normalOffsetBias: LIGHTING.sun.normalOffsetBias,
    shadowDistance: LIGHTING.sun.shadowDistance,
    shadowResolution: LIGHTING.sun.shadowResolution,
  });
  // Low pitch for long, raking golden-hour shadows that give the flat corridor
  // and framing trees real depth and direction.
  sun.setEulerAngles(LIGHTING.sun.pitch, LIGHTING.sun.yaw, 0);
  app.root.addChild(sun);
}
