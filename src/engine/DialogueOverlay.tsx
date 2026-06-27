"use client";

/**
 * HUD overlay rendered as a sibling of the engine canvas.
 *
 * This component intentionally does NOT import `playcanvas` — it only receives
 * plain strings/flags as props, so it is safe anywhere. It lives under
 * `src/engine` purely for cohesion with the Render_Engine boundary.
 *
 * It renders:
 *  - A persistent controls hint ("Use WASD / Arrow keys to walk").
 *  - A data-driven checkpoint dialogue box (speaker + line/lines), shown only
 *    while the character is inside a checkpoint trigger.
 *  - An NPC welcome card shown on first load (multi-line, dismissable).
 */

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
}

export function DialogueOverlay({
  dialogue,
  ready,
  welcome,
  onDismissWelcome,
}: DialogueOverlayProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#fff",
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
            background: "#000",
            fontSize: 20,
            letterSpacing: 0.5,
          }}
        >
          Loading world…
        </div>
      )}

      {/* Controls hint (top-left) */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "8px 12px",
          borderRadius: 8,
          background: "rgba(0, 0, 0, 0.45)",
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        Use <strong>WASD</strong> / <strong>Arrow keys</strong> to walk
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
            background: "rgba(0, 0, 0, 0.35)",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              width: "min(560px, calc(100vw - 48px))",
              padding: "24px 28px",
              borderRadius: 16,
              background: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(255, 214, 153, 0.35)",
              boxShadow: "0 12px 48px rgba(0, 0, 0, 0.55)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: "#ffd699",
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
                marginTop: 12,
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid rgba(255, 214, 153, 0.5)",
                background: "rgba(255, 214, 153, 0.16)",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Begin the journey
            </button>
          </div>
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
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(15, 23, 42, 0.86)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.45)",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 1,
              opacity: 0.7,
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
