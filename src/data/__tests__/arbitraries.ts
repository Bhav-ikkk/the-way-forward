import fc from "fast-check";

import { type DataFileName, type Portfolio } from "../schema";

/**
 * Shared fast-check arbitraries that generate datasets conforming to the
 * Data_Schema, plus helpers for the loader property tests (P1, P2).
 *
 * The generators are "smart": they only emit values inside the schema's input
 * space (correct types, required keys present, optional keys either present
 * with a valid value or entirely absent — never an explicit `undefined`, so a
 * JSON round-trip is loss-free).
 */

/** A full set of raw Data_File contents keyed by file name. */
export type Dataset = Record<DataFileName, unknown>;

/**
 * Build an object containing only the keys whose value is defined. Keeps
 * generated optional fields out of the object entirely when absent, so
 * `JSON.parse(JSON.stringify(x))` equals `x` exactly.
 */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

// Non-empty so that array-element field mutations (P2) always have a target,
// and bounded so generation stays fast across 100+ iterations.
const reqString = fc.string();
const optString = fc.option(fc.string(), { nil: undefined });
const stringArray = fc.array(fc.string(), { maxLength: 4 });
const optStringArray = fc.option(fc.array(fc.string(), { maxLength: 4 }), {
  nil: undefined,
});
// Integers round-trip exactly through JSON (no -0 / float precision concerns).
const proficiency = fc.integer({ min: 1, max: 5 });
const optYears = fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined });
const nullableDate = fc.option(fc.string(), { nil: null });

const profileArb = fc
  .record({
    name: reqString,
    title: reqString,
    tagline: reqString,
    bio: reqString,
    avatarAssetId: optString,
    knowledgeSummary: reqString,
    workSummary: reqString,
    thinkingApproach: reqString,
    futureDirection: reqString,
    collaborationValue: reqString,
  })
  .map(compact);

const projectArb = fc
  .record({
    id: reqString,
    name: reqString,
    description: reqString,
    techStack: stringArray,
    role: optString,
    url: optString,
    repoUrl: optString,
    highlights: optStringArray,
    assetId: optString,
  })
  .map(compact);

const skillArb = fc
  .record({
    id: reqString,
    name: reqString,
    category: reqString,
    proficiency,
    years: optYears,
  })
  .map(compact);

const experienceArb = fc
  .record({
    id: reqString,
    company: reqString,
    role: reqString,
    startDate: reqString,
    endDate: nullableDate,
    summary: reqString,
    highlights: optStringArray,
  })
  .map(compact);

const educationArb = fc
  .record({
    id: reqString,
    institution: reqString,
    credential: reqString,
    field: optString,
    startDate: reqString,
    endDate: nullableDate,
  })
  .map(compact);

const achievementArb = fc
  .record({
    id: reqString,
    title: reqString,
    description: reqString,
    date: optString,
    url: optString,
  })
  .map(compact);

const settingsArb = fc
  .record({
    theme: reqString,
    worldTitle: reqString,
    defaultCharacterAssetId: optString,
    locale: optString,
  })
  .map(compact);

const socialArb = fc
  .record({
    platform: reqString,
    label: reqString,
    url: reqString,
  })
  .map(compact);

// Array files are generated non-empty (minLength: 1) so single-field mutations
// in P2 always have an element to target.
const nonEmpty = <T>(arb: fc.Arbitrary<T>) =>
  fc.array(arb, { minLength: 1, maxLength: 4 });

/**
 * Arbitrary producing a complete, schema-conforming dataset (all eight
 * Data_Files present and valid).
 */
export const datasetArb: fc.Arbitrary<Dataset> = fc.record({
  profile: profileArb,
  projects: nonEmpty(projectArb),
  skills: nonEmpty(skillArb),
  experience: nonEmpty(experienceArb),
  education: nonEmpty(educationArb),
  achievements: nonEmpty(achievementArb),
  settings: settingsArb,
  socials: nonEmpty(socialArb),
}) as unknown as fc.Arbitrary<Dataset>;

/** Convenience typed view used by the round-trip assertion. */
export type ConformingPortfolio = Portfolio;

/**
 * A reference to a single required field within a Data_File. For object files
 * `isArray` is false and the field lives at the document root; for array files
 * the field lives on each element.
 */
export interface RequiredFieldRef {
  file: DataFileName;
  isArray: boolean;
  field: string;
  /** True when the field's only valid type is numeric (proficiency). */
  numeric?: boolean;
}

/**
 * Every required field in the Data_Schema, used by P2 to pick exactly one field
 * to mutate (drop or wrong-type).
 */
export const requiredFields: RequiredFieldRef[] = [
  // profile (object)
  { file: "profile", isArray: false, field: "name" },
  { file: "profile", isArray: false, field: "title" },
  { file: "profile", isArray: false, field: "tagline" },
  { file: "profile", isArray: false, field: "bio" },
  { file: "profile", isArray: false, field: "knowledgeSummary" },
  { file: "profile", isArray: false, field: "workSummary" },
  { file: "profile", isArray: false, field: "thinkingApproach" },
  { file: "profile", isArray: false, field: "futureDirection" },
  { file: "profile", isArray: false, field: "collaborationValue" },
  // settings (object)
  { file: "settings", isArray: false, field: "theme" },
  { file: "settings", isArray: false, field: "worldTitle" },
  // projects (array element)
  { file: "projects", isArray: true, field: "id" },
  { file: "projects", isArray: true, field: "name" },
  { file: "projects", isArray: true, field: "description" },
  { file: "projects", isArray: true, field: "techStack" },
  // skills (array element)
  { file: "skills", isArray: true, field: "id" },
  { file: "skills", isArray: true, field: "name" },
  { file: "skills", isArray: true, field: "category" },
  { file: "skills", isArray: true, field: "proficiency", numeric: true },
  // experience (array element)
  { file: "experience", isArray: true, field: "id" },
  { file: "experience", isArray: true, field: "company" },
  { file: "experience", isArray: true, field: "role" },
  { file: "experience", isArray: true, field: "startDate" },
  { file: "experience", isArray: true, field: "endDate" },
  { file: "experience", isArray: true, field: "summary" },
  // education (array element)
  { file: "education", isArray: true, field: "id" },
  { file: "education", isArray: true, field: "institution" },
  { file: "education", isArray: true, field: "credential" },
  { file: "education", isArray: true, field: "startDate" },
  { file: "education", isArray: true, field: "endDate" },
  // achievements (array element)
  { file: "achievements", isArray: true, field: "id" },
  { file: "achievements", isArray: true, field: "title" },
  { file: "achievements", isArray: true, field: "description" },
  // socials (array element)
  { file: "socials", isArray: true, field: "platform" },
  { file: "socials", isArray: true, field: "label" },
  { file: "socials", isArray: true, field: "url" },
];

export type MutationKind = "drop" | "wrongType";

export interface Mutation {
  ref: RequiredFieldRef;
  kind: MutationKind;
}

/** Picks exactly one required field plus a mutation kind to apply to it. */
export const mutationArb: fc.Arbitrary<Mutation> = fc.record({
  ref: fc.constantFrom(...requiredFields),
  kind: fc.constantFrom<MutationKind>("drop", "wrongType"),
});

/** Deep clone via JSON (datasets are pure JSON values). */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Apply exactly one mutation to a (cloned) dataset: either delete a required
 * field or replace it with a value of the wrong type. Returns the mutated
 * dataset; the original is untouched.
 */
export function applyMutation(dataset: Dataset, mutation: Mutation): Dataset {
  const next = clone(dataset);
  const { ref, kind } = mutation;
  // A number is wrong for string / array / nullable-string fields; a string is
  // wrong for the one numeric field (proficiency).
  const wrongValue: unknown = ref.numeric ? "not-a-number" : 42;

  if (ref.isArray) {
    const arr = next[ref.file] as Record<string, unknown>[];
    const target = arr[0];
    if (kind === "drop") {
      delete target[ref.field];
    } else {
      target[ref.field] = wrongValue;
    }
  } else {
    const obj = next[ref.file] as Record<string, unknown>;
    if (kind === "drop") {
      delete obj[ref.field];
    } else {
      obj[ref.field] = wrongValue;
    }
  }
  return next;
}

/** Serialize then re-parse each file, mirroring a real JSON load. */
export function toRawFiles(dataset: Dataset): Record<DataFileName, unknown> {
  const raw = {} as Record<DataFileName, unknown>;
  for (const name of Object.keys(dataset) as DataFileName[]) {
    raw[name] = JSON.parse(JSON.stringify(dataset[name]));
  }
  return raw;
}
