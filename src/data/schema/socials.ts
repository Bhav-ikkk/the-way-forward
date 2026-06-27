import { z } from "zod";

/**
 * Data_Schema: socials.json — array of social link entries.
 *
 * See design.md "Data_Schema" -> socials.json.
 */
export const socialSchema = z
  .object({
    platform: z.string(),
    label: z.string(),
    url: z.string(),
  })
  .strict();

export const socialsSchema = z.array(socialSchema);

export type Social = z.infer<typeof socialSchema>;
