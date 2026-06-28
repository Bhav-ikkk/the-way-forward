/**
 * Shared dark-glassmorphism design tokens for the HUD overlays.
 *
 * Centralising the colours, blur, borders, radii and typography here keeps the
 * loading screen, controls hint, welcome card, checkpoint dialogue, floating
 * nameplate and the building info panels reading as ONE cohesive, premium dark
 * design system. Plain data only — no React, no `playcanvas`.
 */
export const theme = {
  font: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",

  /** Warm accent reserved for the guide / chapter voice. */
  accent: "#ffd699",
  accentSoft: "rgba(255, 214, 153, 0.16)",
  accentBorder: "rgba(255, 214, 153, 0.38)",

  /** Cool accent used for links + interactive affordances. */
  link: "#8fc7ff",

  /** Primary readable text on the dark glass. */
  text: "rgba(244, 247, 255, 0.96)",
  textDim: "rgba(244, 247, 255, 0.66)",
  textFaint: "rgba(244, 247, 255, 0.45)",

  /** Glass surfaces (translucent dark, layered). */
  glass: "rgba(13, 17, 28, 0.72)",
  glassStrong: "rgba(10, 14, 24, 0.86)",
  glassRaised: "rgba(30, 38, 56, 0.55)",
  scrim: "rgba(6, 9, 16, 0.55)",

  /** Hairline light borders that catch the edge of the glass. */
  border: "rgba(255, 255, 255, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.08)",

  /** Blur strength for the frosted backdrop. */
  blur: "blur(18px)",
  blurSoft: "blur(10px)",

  /** Soft elevation shadows. */
  shadow: "0 18px 60px rgba(0, 0, 0, 0.55)",
  shadowSoft: "0 8px 30px rgba(0, 0, 0, 0.45)",

  radius: 16,
  radiusSm: 10,
  radiusChip: 999,
} as const;

export type Theme = typeof theme;
