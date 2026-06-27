import { z } from "zod";

/**
 * Data_Schema: education.json — array of education entries.
 *
 * `endDate` is a string or null to represent an in-progress credential.
 *
 * See design.md "Data_Schema" -> education.json.
 */
export const educationSchema = z
  .object({
    id: z.string(),
    institution: z.string(),
    credential: z.string(),
    field: z.string().optional(),
    startDate: z.string(),
    endDate: z.string().nullable(),
  })
  .strict();

export const educationsSchema = z.array(educationSchema);

export type Education = z.infer<typeof educationSchema>;
