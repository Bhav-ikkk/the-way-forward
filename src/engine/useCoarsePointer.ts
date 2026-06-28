"use client";

import { useEffect, useState } from "react";

/**
 * Detect a touch / coarse-pointer device (phones, tablets) from React.
 *
 * Evaluated on mount only (never during SSR) so the server and the first
 * client render agree on `false` and there is no hydration mismatch; the real
 * value is resolved in a `useEffect` right after mount. It combines the
 * `(pointer: coarse)` media query with an `ontouchstart` fallback so it works
 * across browsers that don't fully support pointer media queries.
 *
 * Touch-only affordances (the hold-to-walk control, the touch guidance copy,
 * the "Tap to explore" prompt) key off this so desktop is never affected.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      const mqCoarse =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;
      const hasTouch =
        "ontouchstart" in window ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
      setCoarse(Boolean(mqCoarse || hasTouch));
    };

    evaluate();

    // Re-evaluate if the primary pointer capability changes (e.g. a 2-in-1
    // device docking/undocking) so the UI stays correct.
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(pointer: coarse)");
    const onChange = () => evaluate();
    // Older Safari only supports the deprecated addListener API.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return coarse;
}
