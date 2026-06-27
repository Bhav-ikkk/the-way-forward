import { z } from "zod";

/**
 * Data_Schema: profile.json
 *
 * Answers the six world-checkpoint questions plus the developer's identity.
 * `avatarAssetId` is a logical Asset_Index id (not a file path).
 *
 * See design.md "Data_Schema" -> profile.json table.
 */
export const profileSchema = z
  .object({
    // Identity fields — "Who am I?"
    name: z.string(),
    title: z.string(),
    tagline: z.string(),
    bio: z.string(),
    avatarAssetId: z.string().optional(),

    // Six checkpoint fields
    knowledgeSummary: z.string(), // "What do I know?"
    workSummary: z.string(), // "What have I built?"
    thinkingApproach: z.string(), // "How do I think?"
    futureDirection: z.string(), // "What am I building next?"
    collaborationValue: z.string(), // "Why work with me?"
  })
  .strict();

export type Profile = z.infer<typeof profileSchema>;
