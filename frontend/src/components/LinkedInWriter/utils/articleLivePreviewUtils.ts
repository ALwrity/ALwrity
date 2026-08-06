/**
 * Helpers for LinkedIn article live preview rendering.
 */

import type { LinkedInArticleDraftState } from "./linkedInArticleDraftTypes";
import { splitDraftByImageMarkdown } from "./linkedInImageDraftUtils";
import { isIntroductionSection } from "./linkedInArticleIntroUtils";

export interface ArticleLivePreviewModel {
  title: string;
  excerpt: string;
  readingTime?: number;
  sectionCount: number;
  heroImage?: {
    url: string;
    imageId: string | null;
    alt: string;
  };
}

function excerptFromText(text: string, maxLen = 160): string {
  const trimmed = (text || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "Your article preview will appear here.";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trim()}…`;
}

/** Build article card preview model from structured draft state. */
export function buildArticleLivePreviewModel(
  state: LinkedInArticleDraftState,
): ArticleLivePreviewModel {
  const title = state.title.trim() || "Untitled Article";
  const introSection = state.sections.find((section, index) =>
    isIntroductionSection(section, index),
  );
  const firstBodySection =
    state.sections.find(
      (section, index) =>
        section.body.trim() && !isIntroductionSection(section, index),
    ) ?? state.sections[0];

  const excerptSource =
    introSection?.body.trim() ||
    firstBodySection?.body.trim() ||
    firstBodySection?.heading ||
    "";

  const heroFromState = state.images?.[0];
  const heroImage = heroFromState
    ? {
        url: heroFromState.url,
        imageId: heroFromState.imageId,
        alt: heroFromState.alt || "Article image",
      }
    : undefined;

  return {
    title,
    excerpt: excerptFromText(excerptSource),
    readingTime: state.readingTime,
    sectionCount: state.sections.length,
    heroImage,
  };
}

/** Fallback when only markdown is available. */
export function buildArticleLivePreviewFromMarkdown(
  markdown: string,
): ArticleLivePreviewModel {
  let text = (markdown || "").trim();
  let title = "Untitled Article";

  if (text.startsWith("# ")) {
    const lineBreak = text.indexOf("\n");
    title =
      lineBreak === -1
        ? text.slice(2).trim()
        : text.slice(2, lineBreak).trim();
    text = lineBreak === -1 ? "" : text.slice(lineBreak + 1).trim();
  }

  const segments = splitDraftByImageMarkdown(text);
  const heroSegment = segments.find((segment) => segment.type === "image");
  const prose = segments
    .filter((segment) => segment.type === "text")
    .map((segment) => segment.content)
    .join("\n\n");

  const sectionCount = (prose.match(/^##\s+/gm) || []).length;

  return {
    title,
    excerpt: excerptFromText(prose.replace(/^##\s+[^\n]+\n?/gm, "")),
    sectionCount: Math.max(sectionCount, 1),
    heroImage: heroSegment
      ? {
          url: heroSegment.url,
          imageId: heroSegment.imageId,
          alt: heroSegment.alt || "Article image",
        }
      : undefined,
  };
}
