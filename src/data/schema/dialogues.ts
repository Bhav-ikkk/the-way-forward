import { z } from "zod";

/**
 * Data_Schema: dialogues.json — incidental/ambient dialogue lines keyed by id.
 *
 * These are the non-chapter beats (e.g. signposts, ambient remarks). Chapter
 * dialogue lives in chapters.json; this file holds the smaller, standalone
 * lines so all spoken copy stays in the data-driven `content/` folder.
 */
export const dialogueSchema = z
  .object({
    /** Stable id used to reference this incidental line. */
    id: z.string(),
    /** Who speaks the line. */
    speaker: z.string(),
    /** Ordered dialogue lines. */
    lines: z.array(z.string()),
  })
  .strict();

export const dialoguesSchema = z.array(dialogueSchema);

export type Dialogue = z.infer<typeof dialogueSchema>;
