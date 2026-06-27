import { describe, it, expect } from "vitest";

import { loadPortfolio, validateFile } from "../loader";
import { profileSchema, skillsSchema, type DataFileName } from "../schema";

/**
 * Unit tests for Data_Schema edge cases (Task 2.5).
 *
 * Covers: the six required profile checkpoint fields, missing-file handling,
 * wrong-type handling, and the contents of the descriptive error messages.
 * _Requirements: 3.2, 4.3, 4.4_
 */

/** The five summary "checkpoint" answer fields plus the core identity fields. */
const CHECKPOINT_ANSWER_FIELDS = [
  "knowledgeSummary", // What do I know?
  "workSummary", // What have I built?
  "thinkingApproach", // How do I think?
  "futureDirection", // What am I building next?
  "collaborationValue", // Why work with me?
] as const;

const IDENTITY_FIELDS = ["name", "title", "tagline", "bio"] as const;

/** A complete, schema-conforming profile used as a baseline for mutation. */
function validProfile() {
  return {
    name: "Dev Demoson",
    title: "Builder",
    tagline: "Worlds from data.",
    bio: "Fictional demo developer.",
    knowledgeSummary: "Knows the web stack.",
    workSummary: "Built worlds.",
    thinkingApproach: "Story first.",
    futureDirection: "AI authoring.",
    collaborationValue: "Pragmatic delivery.",
  };
}

/** A minimal, complete, schema-conforming set of all eight Data_Files. */
function validDataset() {
  return {
    profile: validProfile(),
    projects: [
      { id: "p1", name: "Proj", description: "A project", techStack: ["ts"] },
    ],
    skills: [{ id: "s1", name: "TS", category: "lang", proficiency: 4 }],
    experience: [
      {
        id: "e1",
        company: "Acme",
        role: "Dev",
        startDate: "2020-01",
        endDate: null,
        summary: "Did work.",
      },
    ],
    education: [
      {
        id: "ed1",
        institution: "Uni",
        credential: "BSc",
        startDate: "2016",
        endDate: "2020",
      },
    ],
    achievements: [{ id: "a1", title: "Award", description: "Won a thing." }],
    settings: { theme: "dark", worldTitle: "My World" },
    socials: [{ platform: "github", label: "GitHub", url: "https://gh" }],
  } satisfies Record<DataFileName, unknown>;
}

describe("profile schema checkpoint fields", () => {
  it("includes the six required checkpoint fields (identity + summaries)", () => {
    const shapeKeys = Object.keys(profileSchema.shape);
    for (const field of [...IDENTITY_FIELDS, ...CHECKPOINT_ANSWER_FIELDS]) {
      expect(shapeKeys).toContain(field);
    }
  });

  it.each([...IDENTITY_FIELDS, ...CHECKPOINT_ANSWER_FIELDS])(
    "treats checkpoint field %s as required",
    (field) => {
      const profile: Record<string, unknown> = validProfile();
      delete profile[field];
      const result = validateFile("profile", profile, profileSchema);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.errors.find((e) => e.field === field);
        expect(err).toBeDefined();
        expect(err?.kind).toBe("missing_required");
      }
    },
  );

  it("accepts a complete profile", () => {
    const result = validateFile("profile", validProfile(), profileSchema);
    expect(result.ok).toBe(true);
  });
});

describe("Data_Loader missing-file edge cases", () => {
  it("reports a missing required Data_File naming the file", () => {
    const files = validDataset() as Record<string, unknown>;
    delete files.skills;
    const result = loadPortfolio(files);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find((e) => e.file === "skills");
      expect(err).toBeDefined();
      expect(err?.kind).toBe("missing_required");
      expect(err?.field).toBe("skills");
      expect(err?.message).toContain("skills");
    }
  });

  it("aggregates violations across multiple missing files", () => {
    const result = loadPortfolio({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // All eight files reported as missing.
      const files = new Set(result.errors.map((e) => e.file));
      for (const name of [
        "profile",
        "projects",
        "skills",
        "experience",
        "education",
        "achievements",
        "settings",
        "socials",
      ]) {
        expect(files.has(name)).toBe(true);
      }
    }
  });
});

describe("Data_Loader wrong-type edge cases", () => {
  it("reports a type mismatch naming the field and file", () => {
    const files = validDataset() as Record<string, unknown>;
    // proficiency must be a number; supply a string.
    (files.skills as Record<string, unknown>[])[0].proficiency = "high";
    const result = loadPortfolio(files);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find(
        (e) => e.file === "skills" && e.field.includes("proficiency"),
      );
      expect(err).toBeDefined();
      expect(err?.kind).toBe("type_mismatch");
      expect(err?.message).toContain("skills");
      expect(err?.message).toContain("proficiency");
    }
  });

  it("rejects an out-of-range proficiency value", () => {
    // proficiency max is 5.
    const result = validateFile(
      "skills",
      [{ id: "s1", name: "TS", category: "lang", proficiency: 9 }],
      skillsSchema,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown extra fields on a strict object (profile)", () => {
    const profile = { ...validProfile(), unexpected: "nope" };
    const result = validateFile("profile", profile, profileSchema);
    expect(result.ok).toBe(false);
  });
});
