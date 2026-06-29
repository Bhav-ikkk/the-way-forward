"use client";

/**
 * Dark-glassmorphism building info panel.
 *
 * Opened when the player "enters" a structure. It renders the chapter's content
 * from a {@link PanelModel} (built by the pure {@link ./panelContent} mapping
 * out of `content/chapters.json` + the validated Portfolio). Each
 * {@link PanelSection} is drawn by a GENERIC, reusable renderer (profile block,
 * project card, skill list, social links, …) so the panel is fully data-driven
 * — nothing is hardcoded per developer.
 *
 * Close affordances: the header X button, the Esc key, and a click on the
 * backdrop. It does NOT import `playcanvas`.
 */
import { useEffect } from "react";
import type { ReactNode } from "react";

import type {
  PanelModel,
  PanelSection,
  SkillGroup,
} from "./panelContent";
import type {
  Achievement,
  Education,
  Experience,
  Profile,
  Project,
  Skill,
  Social,
  TimelineEvent,
} from "../data";
import { theme } from "./theme";

interface InfoPanelProps {
  model: PanelModel | null;
  onClose: () => void;
}

/**
 * Entrance animations for the info panel: the backdrop fades the world out
 * slightly while the panel pops in. One injected stylesheet because inline
 * styles cannot declare `@keyframes`.
 */
const PANEL_KEYFRAMES = `
@keyframes panelFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes panelPopIn {
  from { opacity: 0; transform: scale(0.96) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
`;

export function InfoPanel({ model, onClose }: InfoPanelProps) {
  // Close on Esc whenever the panel is open.
  useEffect(() => {
    if (!model) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [model, onClose]);

  if (!model) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={model.title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: theme.scrim,
        WebkitBackdropFilter: theme.blurSoft,
        backdropFilter: theme.blurSoft,
        pointerEvents: "auto",
        animation: "panelFadeIn 220ms ease-out both",
      }}
    >
      <style>{PANEL_KEYFRAMES}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: theme.radius,
          background: theme.glassStrong,
          WebkitBackdropFilter: theme.blur,
          backdropFilter: theme.blur,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
          color: theme.text,
          overflow: "hidden",
          animation: "panelPopIn 340ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Header: chapter title + question, with a close button. */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "22px 24px 16px",
            borderBottom: `1px solid ${theme.borderSoft}`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: theme.accent,
                marginBottom: 6,
              }}
            >
              {model.question}
            </div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
              {model.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              flex: "0 0 auto",
              width: 36,
              height: 36,
              borderRadius: theme.radiusSm,
              border: `1px solid ${theme.border}`,
              background: theme.glassRaised,
              color: theme.text,
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body. */}
        <div
          style={{
            padding: "20px 24px 28px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {model.sections.map((section, i) => (
            <SectionView key={i} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Generic section dispatch                                            */
/* ------------------------------------------------------------------ */

function SectionView({ section }: { section: PanelSection }) {
  switch (section.kind) {
    case "profile":
      return <ProfileBlock profile={section.profile} />;
    case "prose":
      return <ProseBlock heading={section.heading} body={section.body} />;
    case "projects":
      return (
        <SectionShell heading={section.heading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {section.projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </SectionShell>
      );
    case "skills":
      return (
        <SectionShell heading={section.heading}>
          <SkillList groups={section.groups} />
        </SectionShell>
      );
    case "education":
      return (
        <SectionShell heading={section.heading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {section.education.map((e) => (
              <EducationRow key={e.id} education={e} />
            ))}
          </div>
        </SectionShell>
      );
    case "experience":
      return (
        <SectionShell heading={section.heading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {section.experience.map((e) => (
              <ExperienceRow key={e.id} experience={e} />
            ))}
          </div>
        </SectionShell>
      );
    case "achievements":
      return (
        <SectionShell heading={section.heading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {section.achievements.map((a) => (
              <AchievementRow key={a.id} achievement={a} />
            ))}
          </div>
        </SectionShell>
      );
    case "timeline":
      return (
        <SectionShell heading={section.heading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {section.events.map((ev) => (
              <TimelineRow key={ev.id} event={ev} />
            ))}
          </div>
        </SectionShell>
      );
    case "socials":
      return (
        <SectionShell heading={section.heading}>
          <SocialLinks socials={section.socials} />
        </SectionShell>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Shared presentational primitives                                    */
/* ------------------------------------------------------------------ */

function SectionShell({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: theme.textDim,
        }}
      >
        {heading}
      </h3>
      {children}
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: theme.radiusChip,
        background: theme.glassRaised,
        border: `1px solid ${theme.borderSoft}`,
        fontSize: 12,
        color: theme.text,
      }}
    >
      {children}
    </span>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 14px",
        borderRadius: theme.radiusSm,
        border: `1px solid ${theme.border}`,
        background: theme.glassRaised,
        color: theme.link,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Content-type renderers                                              */
/* ------------------------------------------------------------------ */

function ProfileBlock({ profile }: { profile: Profile }) {
  return (
    <section>
      <h2 style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 700 }}>
        {profile.name}
      </h2>
      <div style={{ fontSize: 14, color: theme.accent, marginBottom: 12 }}>
        {profile.title}
      </div>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 16,
          fontStyle: "italic",
          color: theme.textDim,
          lineHeight: 1.5,
        }}
      >
        {profile.tagline}
      </p>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>{profile.bio}</p>
    </section>
  );
}

function ProseBlock({ heading, body }: { heading: string; body: string }) {
  return (
    <SectionShell heading={heading}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>{body}</p>
    </SectionShell>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <article
      style={{
        padding: 16,
        borderRadius: theme.radiusSm,
        background: theme.glassRaised,
        border: `1px solid ${theme.borderSoft}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          {project.name}
        </h4>
        {project.role && (
          <span style={{ fontSize: 12, color: theme.textFaint }}>
            {project.role}
          </span>
        )}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: theme.textDim }}>
        {project.description}
      </p>

      {project.techStack.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {project.techStack.map((tech) => (
            <Chip key={tech}>{tech}</Chip>
          ))}
        </div>
      )}

      {project.highlights && project.highlights.length > 0 && (
        <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
          {project.highlights.map((h, i) => (
            <li key={i} style={{ color: theme.textDim }}>
              {h}
            </li>
          ))}
        </ul>
      )}

      {project.screenshots && project.screenshots.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {project.screenshots.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${project.name} screenshot ${i + 1}`}
              style={{
                width: 140,
                height: 88,
                objectFit: "cover",
                borderRadius: 8,
                border: `1px solid ${theme.borderSoft}`,
              }}
            />
          ))}
        </div>
      )}

      {(project.url || project.repoUrl) && (
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          {project.url && <LinkButton href={project.url}>Live demo</LinkButton>}
          {project.repoUrl && <LinkButton href={project.repoUrl}>GitHub</LinkButton>}
        </div>
      )}
    </article>
  );
}

function SkillList({ groups }: { groups: SkillGroup[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map((group) => (
        <div key={group.category}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.text,
              marginBottom: 8,
            }}
          >
            {group.category}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  const pct = (skill.proficiency / 5) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ flex: "0 0 130px", fontSize: 14 }}>{skill.name}</span>
      <span
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.10)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "block",
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: theme.accent,
          }}
        />
      </span>
      {typeof skill.years === "number" && (
        <span style={{ flex: "0 0 auto", fontSize: 12, color: theme.textFaint }}>
          {skill.years}y
        </span>
      )}
    </div>
  );
}

/** Format an ISO-ish date string to a short, locale-stable label. */
function formatDate(value: string | null): string {
  if (!value) return "Present";
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(value);
  if (!match) return value;
  const [, year, month] = match;
  if (!month) return year;
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mi = Number(month) - 1;
  const label = monthNames[mi] ?? month;
  return `${label} ${year}`;
}

function EducationRow({ education }: { education: Education }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{education.credential}</div>
      <div style={{ fontSize: 14, color: theme.textDim }}>
        {education.institution}
        {education.field ? ` · ${education.field}` : ""}
      </div>
      <div style={{ fontSize: 12, color: theme.textFaint, marginTop: 2 }}>
        {formatDate(education.startDate)} – {formatDate(education.endDate)}
      </div>
    </div>
  );
}

function ExperienceRow({ experience }: { experience: Experience }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          {experience.role} · {experience.company}
        </span>
        <span style={{ fontSize: 12, color: theme.textFaint }}>
          {formatDate(experience.startDate)} – {formatDate(experience.endDate)}
        </span>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: theme.textDim }}>
        {experience.summary}
      </p>
      {experience.highlights && experience.highlights.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
          {experience.highlights.map((h, i) => (
            <li key={i} style={{ color: theme.textDim }}>
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AchievementRow({ achievement }: { achievement: Achievement }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>{achievement.title}</span>
        {achievement.date && (
          <span style={{ fontSize: 12, color: theme.textFaint }}>
            {formatDate(achievement.date)}
          </span>
        )}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: theme.textDim }}>
        {achievement.description}
      </p>
      {achievement.url && (
        <div style={{ marginTop: 10 }}>
          <LinkButton href={achievement.url}>Read more</LinkButton>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <span
        style={{
          flex: "0 0 64px",
          fontSize: 13,
          fontWeight: 600,
          color: theme.accent,
        }}
      >
        {event.date}
      </span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{event.title}</div>
        <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.55, color: theme.textDim }}>
          {event.description}
        </p>
      </div>
    </div>
  );
}

function SocialLinks({ socials }: { socials: Social[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {socials.map((social) => (
        <LinkButton key={social.url} href={social.url}>
          <span style={{ color: theme.textFaint, marginRight: 6 }}>
            {social.platform}
          </span>
          {social.label}
        </LinkButton>
      ))}
    </div>
  );
}
