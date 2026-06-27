/**
 * Data_Loader public surface.
 *
 * Exposes the loader entry points (`loadPortfolio`, `validateFile`), the result
 * and error types, and the Data_Schema validators and shape types. Consumers
 * import from here rather than reaching into individual modules.
 *
 * See design.md "Components and Interfaces" -> Data_Loader (src/data).
 */
export {
  loadPortfolio,
  validateFile,
  type LoadResult,
  type ValidateResult,
  type ValidationError,
  type RawDataFiles,
} from "./loader";

export {
  dataFileSchemas,
  type DataFileName,
  type DataFileShapes,
  type Portfolio,
  type Schema,
  // Per-file schemas + types
  profileSchema,
  projectSchema,
  projectsSchema,
  skillSchema,
  skillsSchema,
  experienceSchema,
  experiencesSchema,
  educationSchema,
  educationsSchema,
  achievementSchema,
  achievementsSchema,
  settingsSchema,
  socialSchema,
  socialsSchema,
  type Profile,
  type Project,
  type Skill,
  type Experience,
  type Education,
  type Achievement,
  type Settings,
  type Social,
} from "./schema";
