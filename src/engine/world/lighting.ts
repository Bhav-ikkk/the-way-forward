import * as pc from "playcanvas";

/**
 * Lighting system: a warm directional "sun" with shadows plus a soft ambient
 * fill. Kept tiny and declarative so the mood of the scene lives in one place.
 */
export function buildLighting(app: pc.AppBase): void {
  // Soft sky-tinted ambient fill so shadowed sides never go fully black.
  app.scene.ambientLight = new pc.Color(0.42, 0.45, 0.5);

  const sun = new pc.Entity("sun");
  sun.addComponent("light", {
    type: "directional",
    color: new pc.Color(1, 0.96, 0.86),
    intensity: 1.1,
    castShadows: true,
    shadowBias: 0.05,
    normalOffsetBias: 0.05,
    shadowDistance: 140,
    shadowResolution: 2048,
  });
  sun.setEulerAngles(48, 38, 0);
  app.root.addChild(sun);
}
