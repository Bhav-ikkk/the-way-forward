import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadPortfolio } from "../src/data/loader";
import { dataFileSchemas, type DataFileName } from "../src/data/schema";

/**
 * Reusability & integration test (Task 10.1).
 *
 * Demonstrates that the Data_Files are swappable WITHOUT any source changes:
 * a second, different-but-valid dataset is written to a temporary directory and
 * loaded through the SAME `loadPortfolio` entry point used for the shipped
 * `content/` files. The loader needs no modification to accept it, and the
 * loaded portfolio reflects the ALTERNATE content — proving content is
 * swappable without touching engine/loader source.
 *
 * _Requirements: 8.4, 8.5, 12.1_
 *
 * External-tooling checks (Req 8.5, 7.6, 10.4, 11.2, 11.3): the production
 * build (`npm run build`), the linter (`npm run lint`), and dependency
 * resolution (`npm ls`) are run by the agent as verification steps rather than
 * as flaky in-process spawns. The dev-server-startup path (Req 11.3) requires a
 * long-running process and is therefore NOT spawned here; the production build
 * plus the existing EngineMount lifecycle test (Task 5.2) together cover the
 * engine-initialization path, and dev-server startup is verified manually.
 */

/**
 * An ALTERNATE, schema-conforming dataset. Deliberately different from the
 * shipped Demo_Developer content (different person, projects, settings, etc.)
 * so we can assert the loaded portfolio reflects THIS data, not the defaults.
 */
const ALTERNATE: Record<DataFileName, unknown> = {
  profile: {
    name: "Ada Alternate",
    title: "Systems Engineer & Data Storyteller",
    tagline: "Building swappable worlds, one data file at a time.",
    bio: "Ada is a second, entirely different fictional developer used to prove the content layer is interchangeable.",
    avatarAssetId: "character.female.b",
    knowledgeSummary: "Distributed systems, type-safe data pipelines, and browser-based 3D.",
    workSummary: "Shipped an analytics platform and a procedural music toy.",
    thinkingApproach: "Model the invariants first, then let the implementation follow the types.",
    futureDirection: "Composable authoring tools that treat content as data.",
    collaborationValue: "Clear contracts, calm delivery, and docs that outlive the author.",
  },
  projects: [
    {
      id: "project.alt-analytics",
      name: "Lumen Analytics",
      description: "A type-safe analytics pipeline with a live query surface.",
      techStack: ["TypeScript", "Rust", "PostgreSQL"],
      role: "Lead Engineer",
      url: "https://example.com/lumen",
      repoUrl: "https://example.com/git/lumen",
      highlights: ["End-to-end type safety", "Sub-second aggregate queries"],
      assetId: "world.bridge.main",
    },
    {
      id: "project.alt-music",
      name: "Procedural Lullaby",
      description: "A generative music toy for the browser.",
      techStack: ["TypeScript", "WebAudio"],
    },
  ],
  skills: [
    { id: "skill.rust", name: "Rust", category: "Languages", proficiency: 4, years: 4 },
    { id: "skill.postgres", name: "PostgreSQL", category: "Data", proficiency: 5 },
    { id: "skill.webaudio", name: "WebAudio", category: "Frontend", proficiency: 3, years: 2 },
  ],
  experience: [
    {
      id: "exp.alt-orbital",
      company: "Orbital Data Co.",
      role: "Principal Engineer",
      startDate: "2020-01-15",
      endDate: null,
      summary: "Leads the data platform team.",
      highlights: ["Designed the streaming ingestion layer"],
    },
  ],
  education: [
    {
      id: "edu.alt-tech",
      institution: "Alt Institute of Technology",
      credential: "M.Sc. Distributed Systems",
      field: "Computer Science",
      startDate: "2016-09-01",
      endDate: "2018-06-30",
    },
  ],
  achievements: [
    {
      id: "ach.alt-patent",
      title: "Patent: Adaptive Query Caching",
      description: "Co-authored a patent on adaptive caching for streaming queries.",
      date: "2022-08-01",
    },
  ],
  settings: {
    theme: "dawn",
    worldTitle: "Ada's Alternate World",
    defaultCharacterAssetId: "character.male.c",
    locale: "en-GB",
  },
  socials: [
    { platform: "github", label: "@adaalt", url: "https://example.com/github/adaalt" },
    { platform: "website", label: "ada.example", url: "https://ada.example" },
  ],
  chapters: [
    {
      id: "arrival-camp",
      title: "Ada's Arrival",
      question: "Who am I?",
      purpose: "Introduce Ada.",
      emotion: "calm, precise",
      environment: "A quiet observatory deck at dusk.",
      requiredAssets: ["deck", "telescope"],
      dialogue: {
        speaker: "Compass, the Guide",
        lines: ["Welcome. I'm Compass, and this is Ada's world."],
      },
      portfolioContent: ["profile"],
      transition: "Follow the rail toward the data hall.",
    },
  ],
  timeline: [
    {
      id: "alt.t1",
      date: "2016",
      title: "Started building systems",
      description: "Ada wrote her first distributed scheduler.",
      kind: "milestone",
    },
  ],
  dialogues: [
    { id: "alt.sign", speaker: "Beacon", lines: ["Data hall ahead."] },
  ],
};

const fileNames = Object.keys(dataFileSchemas) as DataFileName[];

// Write the alternate dataset to a temp directory, mirroring how an Adopter
// would drop in their own `content/` files. Cleaned up after the suite.
const tempDir = mkdtempSync(join(tmpdir(), "pwe-alt-content-"));
for (const name of fileNames) {
  writeFileSync(
    join(tempDir, `${name}.json`),
    JSON.stringify(ALTERNATE[name], null, 2),
    "utf-8",
  );
}

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function readFromTemp(name: DataFileName): unknown {
  return JSON.parse(readFileSync(join(tempDir, `${name}.json`), "utf-8"));
}

describe("reusability: Data_Files are swappable with no source changes", () => {
  it("loads an ALTERNATE schema-conforming dataset through the same loadPortfolio entry point", () => {
    // Read the alternate files exactly the way the shipped content is read —
    // no loader/source changes, only a different content source.
    const files = {} as Record<DataFileName, unknown>;
    for (const name of fileNames) {
      files[name] = readFromTemp(name);
    }

    const result = loadPortfolio(files);
    if (!result.ok) {
      throw new Error(
        `alternate dataset failed validation:\n${result.errors
          .map((e) => `  - [${e.file}] ${e.field}: ${e.message}`)
          .join("\n")}`,
      );
    }
    expect(result.ok).toBe(true);
  });

  it("yields the ALTERNATE content (not the shipped Demo_Developer defaults)", () => {
    const files = {} as Record<DataFileName, unknown>;
    for (const name of fileNames) {
      files[name] = readFromTemp(name);
    }

    const result = loadPortfolio(files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { portfolio } = result;
    // Content reflects the alternate dataset, proving it was actually loaded.
    expect(portfolio.profile.name).toBe("Ada Alternate");
    expect(portfolio.settings.worldTitle).toBe("Ada's Alternate World");
    expect(portfolio.projects.map((p) => p.id)).toEqual([
      "project.alt-analytics",
      "project.alt-music",
    ]);
    expect(portfolio.skills).toHaveLength(3);
    expect(portfolio.socials.map((s) => s.platform)).toEqual([
      "github",
      "website",
    ]);
  });

  it("round-trips the alternate dataset: serialize -> read -> load equals the source objects", () => {
    const files = {} as Record<DataFileName, unknown>;
    for (const name of fileNames) {
      files[name] = readFromTemp(name);
    }

    const result = loadPortfolio(files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { portfolio } = result;
    expect(portfolio.profile).toEqual(ALTERNATE.profile);
    expect(portfolio.projects).toEqual(ALTERNATE.projects);
    expect(portfolio.skills).toEqual(ALTERNATE.skills);
    expect(portfolio.experience).toEqual(ALTERNATE.experience);
    expect(portfolio.education).toEqual(ALTERNATE.education);
    expect(portfolio.achievements).toEqual(ALTERNATE.achievements);
    expect(portfolio.settings).toEqual(ALTERNATE.settings);
    expect(portfolio.socials).toEqual(ALTERNATE.socials);
  });
});
