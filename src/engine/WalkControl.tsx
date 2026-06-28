"use client";

/**
 * On-screen hold-to-walk control for touch devices.
 *
 * Mobile has no keyboard, so this thumb-reachable dark-glass control drives the
 * on-rails movement instead. A large "▲ Walk" button sets the drive to +1 while
 * held (pointerdown/touchstart) and back to 0 on release; a smaller "▼" button
 * sets -1 while held for the gentle retrace. It blends with the keyboard inside
 * the engine via {@link EngineHandle.setMoveInput} (max magnitude wins).
 *
 * It is rendered ONLY on touch devices and hidden whenever a panel or the
 * welcome card is open (so it never overlaps the near-fullwidth info panel). It
 * sits bottom-right, with safe-area-aware padding so it clears the iOS home
 * indicator / notch. It does NOT import `playcanvas`.
 */
import { useCallback, useEffect, useRef } from "react";

import { theme } from "./theme";

interface WalkControlProps {
  /** Push a drive value (+1 forward, -1 back, 0 idle) into the engine. */
  onDrive: (drive: number) => void;
}

export function WalkControl({ onDrive }: WalkControlProps) {
  // Track which direction each button currently asserts so a release only
  // clears the drive if it still owns it (defensive against lost pointerups).
  const activeRef = useRef(0);

  // If the control unmounts mid-press (a panel opens, the world isn't ready),
  // make sure the drive is released so the player doesn't keep walking.
  useEffect(() => {
    return () => onDrive(0);
  }, [onDrive]);

  const press = useCallback(
    (drive: number) => (e: React.PointerEvent) => {
      e.preventDefault();
      // Capture the pointer so we still get the release even if the finger
      // slides off the button edge.
      e.currentTarget.setPointerCapture?.(e.pointerId);
      activeRef.current = drive;
      onDrive(drive);
    },
    [onDrive],
  );

  const release = useCallback(
    (drive: number) => (e: React.PointerEvent) => {
      e.preventDefault();
      if (activeRef.current === drive) {
        activeRef.current = 0;
        onDrive(0);
      }
    },
    [onDrive],
  );

  return (
    <div
      style={{
        position: "fixed",
        right: "max(20px, env(safe-area-inset-right))",
        bottom: "max(24px, calc(env(safe-area-inset-bottom) + 20px))",
        zIndex: 25,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        // The control captures its own pointers; the rest of the HUD layer
        // remains click-through.
        pointerEvents: "auto",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        fontFamily: theme.font,
      }}
    >
      <button
        type="button"
        aria-label="Hold to walk forward"
        onPointerDown={press(1)}
        onPointerUp={release(1)}
        onPointerCancel={release(1)}
        onPointerLeave={release(1)}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          ...buttonBase,
          width: 96,
          height: 96,
          fontSize: 17,
          fontWeight: 700,
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }}>▲</span>
        Walk
      </button>
      <button
        type="button"
        aria-label="Hold to step back"
        onPointerDown={press(-1)}
        onPointerUp={release(-1)}
        onPointerCancel={release(-1)}
        onPointerLeave={release(-1)}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          ...buttonBase,
          width: 64,
          height: 64,
          fontSize: 22,
        }}
      >
        ▼
      </button>
    </div>
  );
}

const buttonBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: theme.radiusChip,
  background: theme.glassStrong,
  WebkitBackdropFilter: theme.blur,
  backdropFilter: theme.blur,
  border: `1px solid ${theme.accentBorder}`,
  boxShadow: theme.shadow,
  color: theme.text,
  cursor: "pointer",
  touchAction: "none",
  // Avoid the grey tap-highlight flash on mobile Safari/Chrome.
  WebkitTapHighlightColor: "transparent",
};
