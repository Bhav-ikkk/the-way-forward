import * as pc from "playcanvas";

import { addPrimitive, LAYOUT } from "./shared";

/**
 * Atmosphere system: the mood layer that makes the guided journey read as a
 * premium slice rather than a flat demo. It establishes one cohesive
 * GOLDEN-HOUR mood across four small, matched pieces:
 *
 * 1. SKY DOME — a large inverted sphere around the world with an unlit,
 *    emissive vertical gradient (warm cream at the horizon → cooler blue
 *    overhead) so the background reads as a real sky, not a flat clear colour.
 *    The gradient is generated procedurally (no cubemap/texture fetching); if a
 *    2D canvas isn't available (e.g. under the unit-test DOM) it falls back to a
 *    solid horizon-tinted emissive so the system never throws.
 * 2. DISTANCE FOG — a soft linear haze coloured to match the horizon so far
 *    landmarks fade in "hazy and inviting" while the path ahead stays clear.
 * 3. SEAMLESS HORIZON — the camera clear colour is set to the SAME horizon
 *    colour as the fog/sky so distant geometry dissolves into the background
 *    with no hard horizon line.
 * 4. FILMIC GRADING — ACES tone mapping + sRGB gamma + a gentle exposure lift on
 *    the camera so colours feel graded and cinematic instead of washed out.
 *
 * All values live in {@link LAYOUT.atmosphere} so the look is tuned in one place.
 * Every engine access is defensively guarded so the system stays a safe no-op
 * under the unit-test's mocked `playcanvas`, keeping `npm test` free of WebGL.
 */
export function buildAtmosphere(app: pc.AppBase, camera: pc.Entity): void {
  const { horizonColor, fogColor, fogStart, fogEnd, exposure } =
    LAYOUT.atmosphere;
  const haze = new pc.Color(fogColor[0], fogColor[1], fogColor[2]);

  // ---- Sky dome (built first so it sits behind everything) ---------------
  buildSkyDome(app);

  // ---- Distance fog (linear, matched to the horizon) --------------------
  const fog = app.scene.fog;
  if (fog) {
    fog.type = pc.FOG_LINEAR;
    fog.color = haze;
    fog.start = fogStart;
    fog.end = fogEnd;
  }

  // Subtle exposure lift so the ACES curve grades rather than dims the scene.
  app.scene.exposure = exposure;

  // ---- Camera grading + seamless horizon --------------------------------
  // Tone mapping / gamma live on the camera component in PlayCanvas 2.x. The
  // clear colour matches the horizon so the background and haze blend with no
  // seam (kept in sync with the sky dome's lowest gradient band).
  const cam = camera.camera;
  if (cam) {
    cam.clearColor = new pc.Color(
      horizonColor[0],
      horizonColor[1],
      horizonColor[2],
    );
    cam.toneMapping = pc.TONEMAP_ACES;
    cam.gammaCorrection = pc.GAMMA_SRGB;
  }
}

/**
 * Build the inverted sky-dome sphere with an unlit, emissive vertical gradient.
 *
 * Uses the primitive `"sphere"` (no GraphicsDevice geometry APIs) with front
 * culling so we see its INNER surface, fog disabled so the sky never washes to
 * haze, and depth-write disabled so it never occludes world geometry. The
 * gradient is symmetric (cool → warm at the equator → cool) which puts the warm
 * horizon band at eye level regardless of texture pole orientation.
 */
function buildSkyDome(app: pc.AppBase): void {
  const { horizonColor, zenithColor, skyRadius, skyCenterZ } =
    LAYOUT.atmosphere;

  const mat = new pc.StandardMaterial();
  mat.useLighting = false; // unlit: emissive defines the look
  mat.useFog = false; // the sky must not fade into its own fog
  mat.depthWrite = false; // never occlude world geometry
  mat.cull = pc.CULLFACE_FRONT; // render the inside of the dome
  mat.diffuse = new pc.Color(0, 0, 0);

  const gradient = makeGradientTexture(app, horizonColor, zenithColor);
  if (gradient) {
    mat.emissive = new pc.Color(1, 1, 1);
    mat.emissiveMap = gradient;
  } else {
    // Fallback (no 2D canvas, e.g. tests): a solid horizon-tinted sky.
    mat.emissive = new pc.Color(
      horizonColor[0],
      horizonColor[1],
      horizonColor[2],
    );
  }
  mat.update();

  const d = skyRadius * 2;
  addPrimitive(app, "sphere", mat, [0, 0, skyCenterZ], [d, d, d]);
}

/**
 * Procedurally render a small vertical gradient onto an offscreen canvas and
 * wrap it in a `pc.Texture`. Returns `null` when no usable 2D canvas exists
 * (so the caller can fall back to a solid colour) — this keeps the system
 * WebGL-free and crash-free under the mocked test environment.
 */
function makeGradientTexture(
  app: pc.AppBase,
  horizon: readonly [number, number, number],
  zenith: readonly [number, number, number],
): pc.Texture | null {
  try {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.createLinearGradient !== "function") return null;

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const z = toCss(zenith);
    const h = toCss(horizon);
    // Symmetric: cool at both poles, warm at the equator (horizon band).
    grad.addColorStop(0, z);
    grad.addColorStop(0.5, h);
    grad.addColorStop(1, z);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tex = new pc.Texture(app.graphicsDevice, {
      name: "sky-gradient",
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      minFilter: pc.FILTER_LINEAR,
      magFilter: pc.FILTER_LINEAR,
    });
    tex.setSource(canvas);
    return tex;
  } catch {
    return null;
  }
}

/** Convert a 0..1 RGB triple to a CSS `rgb()` string. */
function toCss(rgb: readonly [number, number, number]): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c(rgb[0])}, ${c(rgb[1])}, ${c(rgb[2])})`;
}
