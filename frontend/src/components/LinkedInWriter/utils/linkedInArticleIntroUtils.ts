/**
 * Introduction section helpers — unify intro with section-based article editing.
 */

import type {
  LinkedInArticleDraftState,
  LinkedInArticleSection,
} from "./linkedInArticleDraftTypes";
import { createArticleSectionId } from "./linkedInArticleDraftTypes";

const LOG_PREFIX = "[LinkedInArticleIntro]";

export const INTRO_SECTION_HEADING = "Introduction";

export function isIntroductionHeading(heading: string): boolean {
  return heading.trim().toLowerCase() === INTRO_SECTION_HEADING.toLowerCase();
}

export function isIntroductionSection(
  section: LinkedInArticleSection,
  index: number,
): boolean {
  return index === 0 && isIntroductionHeading(section.heading);
}

/**
 * Extract leading prose before the first ## heading when it is not already in sections.
 */
export function extractLeadingIntroFromContent(
  content: string,
  sections: LinkedInArticleSection[],
): string | undefined {
  const trimmed = (content || "").trim();
  if (!trimmed || sections.length === 0) return undefined;

  const beforeFirstH2 = trimmed.split(/\n##\s+/)[0]?.trim();
  if (!beforeFirstH2 || beforeFirstH2.startsWith("##")) return undefined;

  const combinedBodies = sections
    .map((section) => section.body.trim())
    .filter(Boolean)
    .join("\n");
  if (combinedBodies.includes(beforeFirstH2)) {
    return undefined;
  }

  const hasMarkdownHeadings =
    trimmed.startsWith("## ") || trimmed.includes("\n## ");

  // When content includes ## sections, only treat extra leading prose as intro.
  if (hasMarkdownHeadings) {
    const sectionText = sections
      .map((section) => `${section.heading}\n${section.body}`)
      .join("\n");
    if (trimmed.length <= sectionText.length + 20) {
      return undefined;
    }
  }

  return beforeFirstH2;
}

/** Fold legacy `intro` text into the sections list for a single editor flow. */
export function mergeIntroIntoSections(
  intro: string | undefined,
  sections: LinkedInArticleSection[],
): LinkedInArticleSection[] {
  const introText = (intro || "").trim();
  if (!introText) return sections;

  if (sections.length === 0) {
    console.log(`${LOG_PREFIX} created introduction section from intro text`);
    return [
      {
        id: createArticleSectionId(),
        heading: INTRO_SECTION_HEADING,
        body: introText,
      },
    ];
  }

  const [first, ...rest] = sections;
  if (isIntroductionHeading(first.heading)) {
    const existingBody = first.body.trim();
    if (existingBody.includes(introText)) {
      console.debug(`${LOG_PREFIX} intro already present in introduction section`);
      return sections;
    }
    const mergedBody = existingBody
      ? `${introText}\n\n${existingBody}`
      : introText;
    console.log(`${LOG_PREFIX} merged intro into existing introduction section`);
    return [{ ...first, body: mergedBody }, ...rest];
  }

  console.log(`${LOG_PREFIX} prepended introduction section`);
  return [
    {
      id: createArticleSectionId(),
      heading: INTRO_SECTION_HEADING,
      body: introText,
    },
    ...sections,
  ];
}

/** Ensure intro lives in sections only — clears the legacy intro field. */
export function normalizeArticleDraftState(
  state: LinkedInArticleDraftState,
): LinkedInArticleDraftState {
  try {
    const sections = mergeIntroIntoSections(state.intro, state.sections);
    if (!state.intro?.trim() && sections === state.sections) {
      return state;
    }
    console.log(`${LOG_PREFIX} normalized article draft`, {
      hadIntro: Boolean(state.intro?.trim()),
      sectionCount: sections.length,
    });
    return { ...state, sections, intro: undefined };
  } catch (error) {
    console.error(`${LOG_PREFIX} failed to normalize article draft`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return state;
  }
}

/** Whether a section should serialize as plain prose (no ## heading). */
export function shouldSerializeSectionAsIntro(
  section: LinkedInArticleSection,
  index: number,
): boolean {
  return index === 0 && isIntroductionHeading(section.heading);
}
