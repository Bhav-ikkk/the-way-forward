"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createEngine, type EngineHandle } from "./createEngine";
import {
  DialogueOverlay,
  type DialogueData,
  type WelcomeData,
} from "./DialogueOverlay";
import { Nameplate, type NameplatePosition } from "./Nameplate";
import { InfoPanel } from "./InfoPanel";
import { WalkControl } from "./WalkControl";
import { useCoarsePointer } from "./useCoarsePointer";
import { getPortfolio } from "./content";
import { buildPanelModel } from "./panelContent";
import type { InteractableInfo } from "./world/types";

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
 * State flowing OUT of the engine into React:
 *  - checkpoint dialogue (`onCheckpointChange`) + NPC welcome (`onWelcome`),
 *  - the active approachable building (`onInteractableChange`),
 *  - an "enter" event that opens a content info panel (`onEnter`),
 *  - the floating nameplate's screen position (`onNameplate`).
 *
 * When a panel opens/closes React calls `setInputPaused` so the player isn't
 * walking or spinning behind it. All UI copy (nameplate, panels) is read from
 * the validated portfolio content — nothing is hardcoded here.
 */
export function EngineMount() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<EngineHandle | null>(null);

  const [dialogue, setDialogue] = useState<DialogueData | null>(null);
  const [welcome, setWelcome] = useState<WelcomeData | null>(null);
  const [ready, setReady] = useState(false);
  const [interactable, setInteractable] = useState<InteractableInfo | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [nameplate, setNameplate] = useState<NameplatePosition | null>(null);

  // Touch / coarse-pointer device? Drives the mobile-only affordances (the
  // hold-to-walk control + touch guidance copy). Resolved on mount.
  const isTouch = useCoarsePointer();

  // The single validated source of truth the UI reads (content/*.json).
  const portfolio = useMemo(() => getPortfolio(), []);

  // The structured model for the open panel (or null when closed).
  const panelModel = useMemo(
    () => (panelId ? buildPanelModel(panelId, portfolio) : null),
    [panelId, portfolio],
  );

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
      onInteractableChange: (info) => setInteractable(info),
      onEnter: (id) => setPanelId(id),
      onNameplate: (n) => setNameplate({ x: n.x, y: n.y, visible: n.visible }),
    });
    handleRef.current = handle;
    return () => {
      handle.dispose(); // dispose on unmount (Req 7.3)
      handleRef.current = null;
    };
  }, []);

  // Opening/closing a panel freezes/unfreezes movement + camera orbit + enter.
  useEffect(() => {
    handleRef.current?.setInputPaused(panelId !== null);
  }, [panelId]);

  const profile = portfolio.profile;

  // The walk control is shown only on touch devices, once the world is ready,
  // and never while the welcome card or an info panel is open (so it can't
  // overlap the near-fullwidth panel).
  const showWalkControl =
    isTouch && ready && welcome === null && panelId === null;

  // Stable so WalkControl's release-on-unmount effect only fires on a real
  // unmount (not on every parent re-render while the player is walking).
  const handleDrive = useCallback((drive: number) => {
    handleRef.current?.setMoveInput(drive);
  }, []);

  return (
    <>
      <canvas ref={canvasRef} />
      <DialogueOverlay
        dialogue={dialogue}
        ready={ready}
        welcome={welcome}
        onDismissWelcome={() => setWelcome(null)}
        interactableTitle={panelId ? null : interactable?.title ?? null}
        touch={isTouch}
      />
      <Nameplate
        position={nameplate}
        name={profile.name}
        title={profile.title}
        hidden={!ready || welcome !== null || panelId !== null}
      />
      {showWalkControl && <WalkControl onDrive={handleDrive} />}
      <InfoPanel model={panelModel} onClose={() => setPanelId(null)} />
    </>
  );
}
