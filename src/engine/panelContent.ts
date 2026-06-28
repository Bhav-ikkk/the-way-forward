/**
 * Pure mapping from a chapter id to the structured model an info panel renders.
 *
 * This module is the data-driven bridge between `content/chapters.json`
 * (`portfolioContent` + title + question) and the validated {@link Portfolio}
 * collections. It produces a list of typed {@link PanelSection}s; the React
 * {@link ./InfoPanel} renders each section with a generic, reusable renderer
 * (project card, skill list, social links, …). Nothing here is specific to a
 * particular developer — swapping `content/` re-personalises every panel.
 *
 * It imports no `playcanvas` and no React, so it is trivially unit-testable.
 */
import type {
  Achievement,
  Education,
  Experience,
  Portfolio,
  Profile,
  Project,
  Skill,
  Social,
  TimelineEvent,
} from "../data";

/** Skills grouped under a single category heading. */
export interface SkillGroup {
  category: string;
  skills: Skill[];
}

/**
 * One renderable section of an info panel. The `kind` selects the generic
 * renderer; the rest of the fields carry the validated content for it.
 */
export type PanelSection =
  | { kind: "profile"; profile: Profile }
  | { kind: "prose"; heading: string; body: string }
  | { kind: "projects"; heading: string; projects: Project[] }
  | { kind: "skills"; heading: string; groups: SkillGroup[] }
  | { kind: "education"; heading: string; education: Education[] }
  | { kind: "experience"; heading: string; experience: Experience[] }
  | { kind: "achievements"; heading: string; achievements: Achievement[] }
  | { kind: "timeline"; heading: string; events: TimelineEvent[] }
  | { kind: "socials"; heading: string; socials: Social[] };

/** The full model a single info panel renders. */
export interface PanelModel {
  id: string;
  /** Chapter title (panel header), from content. */
  title: string;
  /** Chapter question (panel sub-header), from content. */
  question: string;
  sections: PanelSection[];
}

/** Group skills by `category`, preserving first-seen category order. */
export function groupSkills(skills: Skill[]): SkillGroup[] {
  const order: string[] = [];
  const byCategory = new Map<string, Skill[]>();
  for (const skill of skills) {
    const list = byCategory.get(skill.category);
    if (list) {
      list.push(skill);
    } else {
      byCategory.set(skill.category, [skill]);
      order.push(skill.category);
    }
  }
  return order.map((category) => ({
    category,
    skills: byCategory.get(category) ?? [],
  }));
}

/**
 * Generic fallback: turn a chapter's `portfolioContent` keys directly into
 * sections. Used for any chapter without a bespoke layout below, so adding a
 * new chapter to `content/` still surfaces its content with zero engine code.
 */
function sectionsFromKeys(keys: string[], p: Portfolio): PanelSection[] {
  const sections: PanelSection[] = [];
  for (const key of keys) {
    switch (key) {
      case "profile":
        sections.push({ kind: "profile", profile: p.profile });
        break;
      case "projects":
        sections.push({ kind: "projects", heading: "Projects", projects: p.projects });
        break;
      case "skills":
        sections.push({
          kind: "skills",
          heading: "Skills",
          groups: groupSkills(p.skills),
        });
        break;
      case "education":
        sections.push({ kind: "education", heading: "Education", education: p.education });
        break;
      case "experience":
        sections.push({
          kind: "experience",
          heading: "Experience",
          experience: p.experience,
        });
        break;
      case "achievements":
        sections.push({
          kind: "achievements",
          heading: "Achievements",
          achievements: p.achievements,
        });
        break;
      case "socials":
        sections.push({ kind: "socials", heading: "Find me", socials: p.socials });
        break;
      default:
        break;
    }
  }
  return sections;
}

/**
 * Build the {@link PanelModel} for a chapter id from validated portfolio
 * content. The header (title + question) comes from `content/chapters.json`;
 * the body sections are composed per chapter following the design brief, with a
 * generic `portfolioContent`-driven fallback for any other chapter.
 */
export function buildPanelModel(
  chapterId: string,
  portfolio: Portfolio,
): PanelModel {
  const chapter = portfolio.chapters.find((c) => c.id === chapterId);
  const title = chapter?.title ?? chapterId;
  const question = chapter?.question ?? "";

  let sections: PanelSection[];
  switch (chapterId) {
    case "arrival-camp":
      sections = [
        { kind: "profile", profile: portfolio.profile },
        { kind: "education", heading: "Education", education: portfolio.education },
      ];
      break;
    case "workshop":
      sections = [
        { kind: "projects", heading: "Things I've built", projects: portfolio.projects },
      ];
      break;
    case "library":
      sections = [
        { kind: "skills", heading: "Skills", groups: groupSkills(portfolio.skills) },
        { kind: "education", heading: "Education", education: portfolio.education },
        { kind: "experience", heading: "Experience", experience: portfolio.experience },
      ];
      break;
    case "ai-laboratory":
      sections = [
        {
          kind: "projects",
          heading: "Experiments & AI projects",
          projects: portfolio.projects,
        },
        {
          kind: "achievements",
          heading: "Research & recognition",
          achievements: portfolio.achievements,
        },
      ];
      break;
    case "observatory":
      sections = [
        { kind: "experience", heading: "Experience timeline", experience: portfolio.experience },
        {
          kind: "timeline",
          heading: "Milestones",
          events: portfolio.timeline,
        },
        {
          kind: "prose",
          heading: "How I think",
          body: portfolio.profile.thinkingApproach,
        },
      ];
      break;
    case "lighthouse":
      sections = [
        {
          kind: "prose",
          heading: "Why work with me",
          body: portfolio.profile.collaborationValue,
        },
        { kind: "socials", heading: "Say hello", socials: portfolio.socials },
      ];
      break;
    default:
      sections = sectionsFromKeys(chapter?.portfolioContent ?? [], portfolio);
      break;
  }

  return { id: chapterId, title, question, sections };
}
