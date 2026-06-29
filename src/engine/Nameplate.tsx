"use client";

/**
 * Floating, multiplayer-style nametag that hovers just above the player's head.
 *
 * The engine projects the player's head world position to screen coordinates
 * each frame (via `camera.worldToScreen`) and reports `{ x, y, visible }`; this
 * component renders a small dark-glass pill at that position with the player's
 * NAME and a little downward-pointing arrow (▼) beneath it — exactly like the
 * name tags floating over players in multiplayer games. Because it is
 * screen-space it always faces the camera.
 *
 * Per owner feedback this is intentionally minimal: just the name (from the
 * validated profile content) + the arrow. There is NO title / role line. The
 * caller hides it while a panel or the welcome card is open.
 *
 * It does NOT import `playcanvas` — it only receives plain numbers/strings.
 */
import { theme } from "./theme";

export interface NameplatePosition {
  x: number;
  y: number;
  visible: boolean;
}

interface NameplateProps {
  /** Screen placement reported by the engine (CSS pixels). */
  position: NameplatePosition | null;
  /** Player display name (profile.name) — the only text shown. */
  name: string;
  /** Hidden by the caller while a panel is open or the welcome card is up. */
  hidden?: boolean;
}

/** Arrow size (px) of the downward pointer beneath the name pill. */
const ARROW = 7;

export function Nameplate({ position, name, hidden }: NameplateProps) {
  if (hidden || !position || !position.visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 20,
        // Anchor the tag's bottom (its arrow tip) to the head, lifted slightly
        // so the arrow points down AT the character like a multiplayer tag.
        transform: "translate(-50%, calc(-100% - 14px))",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* The name pill: a crisp, subtle dark-glass chip. */}
      <div
        style={{
          padding: "4px 11px 5px",
          borderRadius: theme.radiusChip,
          background: theme.glassStrong,
          WebkitBackdropFilter: theme.blurSoft,
          backdropFilter: theme.blurSoft,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadowSoft,
          whiteSpace: "nowrap",
          fontFamily: theme.font,
          fontSize: 13,
          fontWeight: 600,
          color: theme.text,
          letterSpacing: 0.2,
          lineHeight: 1.1,
        }}
      >
        {name}
      </div>
      {/* Downward arrow (▼) pointing at the head, tinted to match the pill. */}
      <div
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeft: `${ARROW}px solid transparent`,
          borderRight: `${ARROW}px solid transparent`,
          borderTop: `${ARROW}px solid ${theme.glassStrong}`,
          filter: `drop-shadow(0 1px 0 ${theme.border})`,
        }}
      />
    </div>
  );
}
