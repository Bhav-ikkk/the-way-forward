import { z } from "zod";

/**
 * Data_Schema: chapters.json — the ordered narrative "blueprint" for the
 * journey. Each chapter answers one of the world's checkpoint questions and
 * carries ALL human-readable copy (title, question, dialogue, transition) so
 * that swapping `content/` completely re-personalises the experience. The
 * engine holds only placement/layout data and reads this copy by `id`.
 *
 * The chapter object doubles as the chapter blueprint: it describes the
 * narrative purpose, the emotional beat, the environment to stage, descriptive
 * asset hints, the spoken dialogue, which portfolio content it surfaces, and
 * the transition copy easing the player toward the next chapter.
 */
export const chapterDialogueSchema = z
  .object({
    /** Who speaks at this chapter (e.g. the guide NPC or the landmark voice). */
    speaker: z.string(),
    /** Ordered dialogue lines shown at the checkpoint. */
    lines: z.array(z.string()),
  })
  .strict();

export const chapterSchema = z
  .object({
    /** Stable id; matches the engine placement keyed to this chapter. */
    id: z.string(),
    /** Human-readable chapter title shown in the dialogue box. */
    title: z.string(),
    /** The checkpoint question this chapter answers (e.g. "Who am I?"). */
    question: z.string(),
    /** Narrative purpose of this beat. */
    purpose: z.string(),
    /** Emotional tone to evoke. */
    emotion: z.string(),
    /** Environment to stage for this chapter (descriptive). */
    environment: z.string(),
    /** Logical/asset hints — descriptive, not file paths. */
    requiredAssets: z.array(z.string()),
    /** The spoken dialogue for this chapter. */
    dialogue: chapterDialogueSchema,
    /** Which portfolio content this chapter surfaces (e.g. ["projects"]). */
    portfolioContent: z.array(z.string()),
    /** Copy easing the player toward the next chapter. */
    transition: z.string(),
  })
  .strict();

/** chapters.json is an ordered array of chapter blueprints. */
export const chaptersSchema = z.array(chapterSchema);

export type ChapterDialogue = z.infer<typeof chapterDialogueSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
