import { z } from "zod";

/**
 * Data_Schema: experience.json — array of experience entries.
 *
 * `endDate` is a string (ISO) or null to represent an ongoing role.
 *
 * See design.md "Data_Schema" -> experience.json.
 */
export const experienceSchema = z
  .object({
    id: z.string(),
    company: z.string(),
    role: z.string(),
    startDate: z.string(),
    endDate: z.string().nullable(),
    summary: z.string(),
    highlights: z.array(z.string()).optional(),
  })
  .strict();

export const experiencesSchema = z.array(experienceSchema);

export type Experience = z.infer<typeof experienceSchema>;
