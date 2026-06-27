import { z } from "zod";

/**
 * Data_Schema: settings.json — single settings object.
 *
 * `defaultCharacterAssetId` is a logical Asset_Index id (not a file path).
 *
 * See design.md "Data_Schema" -> settings.json.
 */
export const settingsSchema = z
  .object({
    theme: z.string(),
    worldTitle: z.string(),
    defaultCharacterAssetId: z.string().optional(),
    locale: z.string().optional(),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;
