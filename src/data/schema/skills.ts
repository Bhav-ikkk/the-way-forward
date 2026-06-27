import { z } from "zod";

/**
 * Data_Schema: skills.json — array of skill entries.
 *
 * `proficiency` is constrained to the 1–5 range per the contract.
 *
 * See design.md "Data_Schema" -> skills.json.
 */
export const skillSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    proficiency: z.number().min(1).max(5),
    years: z.number().optional(),
  })
  .strict();

export const skillsSchema = z.array(skillSchema);

export type Skill = z.infer<typeof skillSchema>;
