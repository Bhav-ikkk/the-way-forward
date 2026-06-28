import { z } from "zod";

/**
 * Data_Schema: timeline.json — an ordered array of career timeline events.
 *
 * `date` is a free-form string (e.g. an ISO date or a year) so adopters can
 * author whatever granularity fits their story. `kind` is an optional
 * descriptive category (e.g. "role", "award", "release").
 */
export const timelineEventSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    title: z.string(),
    description: z.string(),
    kind: z.string().optional(),
  })
  .strict();

export const timelineSchema = z.array(timelineEventSchema);

export type TimelineEvent = z.infer<typeof timelineEventSchema>;
