/**
 * Client-side validated portfolio content.
 *
 * This module statically imports every `content/*.json` Data_File and runs the
 * whole set through the pure {@link loadPortfolio} loader (which never imports
 * `playcanvas`). The result is a single, typed, validated {@link Portfolio}
 * object that is the ONE source of truth the React UI (nameplate + info panels)
 * reads from — nothing about the developer is hardcoded in components or the
 * engine.
 *
 * It lives under `src/engine` only for cohesion with the Render_Engine
 * boundary; it pulls in no engine/`playcanvas` code, so it is safe to import
 * from React components.
 */
import { loadPortfolio, type Portfolio } from "../data";

import profile from "../../content/profile.json";
import projects from "../../content/projects.json";
import skills from "../../content/skills.json";
import experience from "../../content/experience.json";
import education from "../../content/education.json";
import achievements from "../../content/achievements.json";
import settings from "../../content/settings.json";
import socials from "../../content/socials.json";
import chapters from "../../content/chapters.json";
import timeline from "../../content/timeline.json";
import dialogues from "../../content/dialogues.json";

/** Memoised validated portfolio (the loader is pure + deterministic). */
let cached: Portfolio | null = null;

/**
 * Return the validated {@link Portfolio} assembled from `content/*.json`.
 *
 * The raw JSON is validated by the pure loader on first call and cached. If the
 * content fails validation (a missing required file/field or a type mismatch)
 * this throws an aggregated error naming every violation, so a misconfigured
 * `content/` folder fails loudly during development rather than rendering a
 * half-empty UI.
 */
export function getPortfolio(): Portfolio {
  if (cached) return cached;

  const result = loadPortfolio({
    profile,
    projects,
    skills,
    experience,
    education,
    achievements,
    settings,
    socials,
    chapters,
    timeline,
    dialogues,
  });

  if (!result.ok) {
    const summary = result.errors
      .map((e) => `  • [${e.file}] ${e.message}`)
      .join("\n");
    throw new Error(
      `Invalid portfolio content — ${result.errors.length} problem(s):\n${summary}`,
    );
  }

  cached = result.portfolio;
  return cached;
}
