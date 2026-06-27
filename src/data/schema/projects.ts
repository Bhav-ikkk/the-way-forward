import { z } from "zod";

/**
 * Data_Schema: projects.json — array of project entries.
 *
 * `assetId` is a logical Asset_Index id (not a file path).
 *
 * See design.md "Data_Schema" -> projects.json table.
 */
export const projectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    techStack: z.array(z.string()),
    role: z.string().optional(),
    url: z.string().optional(),
    repoUrl: z.string().optional(),
    highlights: z.array(z.string()).optional(),
    assetId: z.string().optional(),
  })
  .strict();

export const projectsSchema = z.array(projectSchema);

export type Project = z.infer<typeof projectSchema>;
