import { z } from "zod";

/**
 * Data_Schema: achievements.json — array of achievement entries.
 *
 * See design.md "Data_Schema" -> achievements.json.
 */
export const achievementSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    date: z.string().optional(),
    url: z.string().optional(),
  })
  .strict();

export const achievementsSchema = z.array(achievementSchema);

export type Achievement = z.infer<typeof achievementSchema>;
