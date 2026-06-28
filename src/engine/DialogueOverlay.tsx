"use client";

/**
 * HUD overlay rendered as a sibling of the engine canvas.
 *
 * This component intentionally does NOT import `playcanvas` — it only receives
 * plain strings/flags as props, so it is safe anywhere. It lives under
 * `src/engine` purely for cohesion with the Render_Engine boundary.
 *
 * It renders (all in the cohesive dark-glassmorphism language from
 * {@link ./theme}):
 *  - A dark loading screen.
 *  - A persistent controls hint ("Use WASD / Arrow keys to walk").
 *  - A data-driven checkpoint dialogue box (speaker + line/lines), shown only
 *    while the character is inside a checkpoint trigger.
 *  - An NPC welcome card shown on first load (multi-line, dismissable).
 *  - A subtle "enter" prompt for the active interactable building.
 */
import { theme } from "./theme";

export interface DialogueData {
  speaker: string;
  /** Single line (checkpoints). */
  line: string;
  /** Optional multi-line copy (NPC greeter / richer beats). */
  lines?: string[];
}

/** The NPC welcome shown once on load (dismissable). */
export interface WelcomeData {
  speaker: string;
  lines: string[];
}

interface DialogueOverlayProps {
  /** Active checkpoint dialogue, or null when no checkpoint is in range. */
  dialogue: DialogueData | null;
  /** Whether the world has finished loading. */
  ready: boolean;
  /** NPC welcome card to show on load, or null once dismissed/none. */
  welcome?: WelcomeData | null;
  /** Called when the user dismisses the welcome card. */
  onDismissWelcome?: () => void;
  /** Title of the active approachable building, or null when none in range. */
  interactableTitle?: string | null;
  /** True on touch / coarse-pointer devices — swaps keyboard copy for touch. */
  touch?: boolean;
}

export function DialogueOverlay({
  dialogue,
  ready,
  welcome,
  onDismissWelcome,
  interactableTitle,
  touch = false,
}: DialogueOverlayProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        fontFamily: theme.font,
        color: theme.text,
        zIndex: 10,
      }}
    >
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(120% 120% at 50% 30%, #131a2b 0%, #060910 70%)",
            color: theme.textDim,
            fontSize: 20,
            letterSpacing: 0.5,
          }}
        >
          Loading world…
        </div>
      )}

      {/* Controls hint (top-left). Keyboard copy on desktop; touch guidance on
          coarse-pointer devices. Hidden behind the welcome card / panels by the
          dialogue layout below. */}
      <div
        style={{
          position: "absolute",
          top: "max(16px, env(safe-area-inset-top))",
          left: "max(16px, env(safe-area-inset-left))",
          maxWidth: "min(calc(100vw - 32px), 380px)",
          padding: "8px 14px",
          borderRadius: theme.radiusSm,
          background: theme.glass,
          WebkitBackdropFilter: theme.blurSoft,
          backdropFilter: theme.blurSoft,
          border: `1px solid ${theme.borderSoft}`,
          boxShadow: theme.shadowSoft,
          fontSize: 13,
          lineHeight: 1.4,
          color: theme.textDim,
        }}
      >
        {touch ? (
          <>
            Hold <strong style={{ color: theme.text }}>▲</strong> to walk · drag
            to look · pinch to zoom · tap a building to explore
          </>
        ) : (
          <>
            Use <strong style={{ color: theme.text }}>WASD</strong> /{" "}
            <strong style={{ color: theme.text }}>Arrow keys</strong> to walk
          </>
        )}
      </div>

      {/* NPC welcome card (centred, dismissable) — shown on first load. */}
      {ready && welcome && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: theme.scrim,
            WebkitBackdropFilter: theme.blurSoft,
            backdropFilter: theme.blurSoft,
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              padding: "26px 30px",
              borderRadius: theme.radius,
              background: theme.glassStrong,
              WebkitBackdropFilter: theme.blur,
              backdropFilter: theme.blur,
              border: `1px solid ${theme.accentBorder}`,
              boxShadow: theme.shadow,
            }}
          >
            <div
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: theme.accent,
                marginBottom: 12,
              }}
            >
              {welcome.speaker}
            </div>
            {welcome.lines.map((l, i) => (
              <p
                key={i}
                style={{ fontSize: 16, lineHeight: 1.55, margin: "0 0 8px" }}
              >
                {l}
              </p>
            ))}
            <button
              type="button"
              onClick={onDismissWelcome}
              style={{
                marginTop: 14,
                padding: "10px 18px",
                borderRadius: theme.radiusSm,
                border: `1px solid ${theme.accentBorder}`,
                background: theme.accentSoft,
                color: theme.text,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Begin the journey
            </button>
          </div>
        </div>
      )}

      {/* Subtle "enter" prompt for the active interactable (bottom-center,
          above the dialogue). Hidden while the welcome card is up. On touch the
          "Press E" key chip is swapped for a "Tap to explore" prompt. */}
      {ready && !welcome && interactableTitle && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: dialogue ? 140 : 32,
            transform: "translateX(-50%)",
            maxWidth: "calc(100vw - 32px)",
            padding: "8px 16px",
            borderRadius: theme.radiusChip,
            background: theme.glass,
            WebkitBackdropFilter: theme.blurSoft,
            backdropFilter: theme.blurSoft,
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadowSoft,
            fontSize: 14,
            color: theme.text,
            whiteSpace: "nowrap",
          }}
        >
          {touch ? (
            <>
              Tap to explore{" "}
              <strong style={{ color: theme.accent }}>{interactableTitle}</strong>
            </>
          ) : (
            <>
              Press{" "}
              <strong
                style={{
                  display: "inline-block",
                  padding: "1px 7px",
                  margin: "0 2px",
                  borderRadius: 6,
                  border: `1px solid ${theme.border}`,
                  background: theme.glassRaised,
                  color: theme.accent,
                }}
              >
                E
              </strong>{" "}
              to explore{" "}
              <strong style={{ color: theme.accent }}>{interactableTitle}</strong>
            </>
          )}
        </div>
      )}

      {/* Checkpoint dialogue box (bottom-center) */}
      {dialogue && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 32,
            transform: "translateX(-50%)",
            width: "min(680px, calc(100vw - 48px))",
            padding: "16px 22px",
            borderRadius: theme.radius,
            background: theme.glassStrong,
            WebkitBackdropFilter: theme.blur,
            backdropFilter: theme.blur,
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadow,
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: theme.accent,
              marginBottom: 6,
            }}
          >
            {dialogue.speaker}
          </div>
          {dialogue.lines && dialogue.lines.length > 0 ? (
            dialogue.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 16, lineHeight: 1.5 }}>
                {l}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 16, lineHeight: 1.5 }}>{dialogue.line}</div>
          )}
        </div>
      )}
    </div>
  );
}
