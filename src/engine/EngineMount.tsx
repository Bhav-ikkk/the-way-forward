"use client";

import { useEffect, useRef, useState } from "react";

import { createEngine } from "./createEngine";
import {
  DialogueOverlay,
  type DialogueData,
  type WelcomeData,
} from "./DialogueOverlay";

/**
 * Client-only React boundary that owns the Render_Engine lifecycle
 * (Requirement 7.1).
 *
 * It is imported by Server Components only through
 * `next/dynamic(() => import(...), { ssr: false })`, guaranteeing the engine
 * never runs during SSR (Requirement 7.2, 7.6). It renders a `<canvas>` plus a
 * HUD overlay, creates the engine in a `useEffect` (client-only), and disposes
 * it on unmount (Requirement 7.3). It reaches PlayCanvas only via
 * `createEngine`; App_Framework code never imports `playcanvas` directly
 * (Requirement 7.4).
 *
 * Checkpoint state flows out of the engine via the `onCheckpointChange`
 * callback and into React state, which drives the data-driven dialogue box.
 * The NPC greeter's welcome arrives via `onWelcome` and is shown as a
 * dismissable card on first load.
 */
export function EngineMount() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dialogue, setDialogue] = useState<DialogueData | null>(null);
  const [welcome, setWelcome] = useState<WelcomeData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const handle = createEngine(canvasRef.current, {
      onCheckpointChange: (checkpoint) => {
        setDialogue(
          checkpoint
            ? {
                speaker: checkpoint.speaker,
                line: checkpoint.line,
                lines: checkpoint.lines,
              }
            : null,
        );
      },
      onReady: () => setReady(true),
      onWelcome: (w) => setWelcome({ speaker: w.speaker, lines: w.lines }),
    });
    return () => handle.dispose(); // dispose on unmount (Req 7.3)
  }, []);

  return (
    <>
      <canvas ref={canvasRef} />
      <DialogueOverlay
        dialogue={dialogue}
        ready={ready}
        welcome={welcome}
        onDismissWelcome={() => setWelcome(null)}
      />
    </>
  );
}
