"use client";

/**
 * Floating, screen-space nameplate that hovers above the player's head.
 *
 * The engine projects the player's head world position to screen coordinates
 * each frame (via `camera.worldToScreen`) and reports `{ x, y, visible }`; this
 * component simply renders a small dark-glass card at that position. Because it
 * is screen-space it always faces the camera. The name + title come from the
 * validated portfolio profile (content), never hardcoded.
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
  /** Player display name (profile.name). */
  name: string;
  /** Player title (profile.title). */
  title: string;
  /** Hidden by the caller while a panel is open or the welcome card is up. */
  hidden?: boolean;
}

export function Nameplate({ position, name, title, hidden }: NameplateProps) {
  if (hidden || !position || !position.visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 20,
        // Anchor the card's bottom-centre to the head, lifted slightly above it.
        transform: "translate(-50%, calc(-100% - 18px))",
        pointerEvents: "none",
        padding: "6px 12px",
        borderRadius: theme.radiusChip,
        background: theme.glass,
        WebkitBackdropFilter: theme.blurSoft,
        backdropFilter: theme.blurSoft,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadowSoft,
        textAlign: "center",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: theme.text,
          letterSpacing: 0.2,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: 11,
          color: theme.accent,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginTop: 1,
        }}
      >
        {title}
      </div>
    </div>
  );
}
