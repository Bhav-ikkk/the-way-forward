import { type z } from "zod";

import { profileSchema, type Profile } from "./profile";
import { projectsSchema, type Project } from "./projects";
import { skillsSchema, type Skill } from "./skills";
import { experiencesSchema, type Experience } from "./experience";
import { educationsSchema, type Education } from "./education";
import { achievementsSchema, type Achievement } from "./achievements";
import { settingsSchema, type Settings } from "./settings";
import { socialsSchema, type Social } from "./socials";

export * from "./profile";
export * from "./projects";
export * from "./skills";
export * from "./experience";
export * from "./education";
export * from "./achievements";
export * from "./settings";
export * from "./socials";

/**
 * The aggregate Portfolio shape — one property per Data_File.
 *
 * See design.md "Data Models" -> Data_Schema shape summary.
 */
export interface Portfolio {
  profile: Profile;
  projects: Project[];
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  achievements: Achievement[];
  settings: Settings;
  socials: Social[];
}

/**
 * Maps each logical Data_File name to its validating schema. The keys are the
 * file names (without extension) the Data_Loader reads from the `content/`
 * folder; the values are the Zod schemas that validate each file's contents.
 */
export const dataFileSchemas = {
  profile: profileSchema,
  projects: projectsSchema,
  skills: skillsSchema,
  experience: experiencesSchema,
  education: educationsSchema,
  achievements: achievementsSchema,
  settings: settingsSchema,
  socials: socialsSchema,
} as const;

/** A Data_File key (e.g. "profile", "projects"). */
export type DataFileName = keyof typeof dataFileSchemas;

/** Tuple type binding each Data_File key to the type it parses into. */
export type DataFileShapes = {
  profile: Profile;
  projects: Project[];
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  achievements: Achievement[];
  settings: Settings;
  socials: Social[];
};

/** A generic Zod schema alias used by the loader's `validateFile`. */
export type Schema<T> = z.ZodType<T>;
