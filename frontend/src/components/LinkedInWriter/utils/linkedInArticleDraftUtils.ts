/**
 * Structured LinkedIn article draft — parse, serialize, and merge with markdown.
 */

import type {
  ArticleContent,
  ImageSuggestion,
} from "../../../services/linkedInWriterApi";
import {
  extractLeadingIntroFromContent,
  mergeIntroIntoSections,
  normalizeArticleDraftState,
  shouldSerializeSectionAsIntro,
} from "./linkedInArticleIntroUtils";

const LOG_PREFIX = "[LinkedInArticleDraft]";

export interface LinkedInArticleSection {
  id: string;
  heading: string;
  body: string;
}

export interface LinkedInArticleDraftState {
  title: string;
  intro?: string;
  sections: LinkedInArticleSection[];
  coverImageUrl?: string;
  imageSuggestions: ImageSuggestion[];
  readingTime?: number;
  seoMetadata?: Record<string, unknown>;
}

export function createArticleSectionId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeApiSection(
  raw: Record<string, string>,
  index: number,
): LinkedInArticleSection {
  return {
    id: createArticleSectionId(),
    heading: (raw.heading || raw.title || `Section ${index + 1}`).trim(),
    body: (raw.body || raw.content || "").trim(),
  };
}

/** Split markdown body by ## headings into sections. */
export function splitMarkdownIntoSections(content: string): LinkedInArticleSection[] {
  const trimmed = (content || "").trim();
  if (!trimmed) return [];

  const chunks = trimmed.split(/\n(?=##\s+)/);
  return chunks.map((chunk, index) => {
    const lines = chunk.trim().split(/\r?\n/);
    const first = lines[0] || "";
    if (first.startsWith("## ")) {
      return {
        id: createArticleSectionId(),
        heading: first.replace(/^##\s+/, "").trim() || `Section ${index + 1}`,
        body: lines.slice(1).join("\n").trim(),
      };
    }
    return {
      id: createArticleSectionId(),
      heading: index === 0 ? "Introduction" : `Section ${index + 1}`,
      body: chunk.trim(),
    };
  });
}

export function articleResponseToDraftState(
  data: ArticleContent,
): LinkedInArticleDraftState {
  const title = (data.title || "Untitled Article").trim();
  let sections = (data.sections || []).map((sec, index) =>
    normalizeApiSection(sec as Record<string, string>, index),
  );

  const content = (data.content || "").trim();

  if (sections.length === 0 && content) {
    sections = splitMarkdownIntoSections(content);
  }

  if (sections.length === 0 && content) {
    sections = [
      {
        id: createArticleSectionId(),
        heading: "Introduction",
        body: content,
      },
    ];
  }

  const introCandidate = extractLeadingIntroFromContent(content, sections);
  sections = mergeIntroIntoSections(introCandidate, sections);

  const state: LinkedInArticleDraftState = normalizeArticleDraftState({
    title,
    sections,
    imageSuggestions: data.image_suggestions || [],
    readingTime: data.reading_time,
    seoMetadata: data.seo_metadata,
  });

  console.log(`${LOG_PREFIX} applied API response`, {
    title: state.title,
    sectionCount: state.sections.length,
    imageSuggestions: state.imageSuggestions.length,
  });

  return state;
}

export function articleStateToMarkdown(state: LinkedInArticleDraftState): string {
  const parts: string[] = [];
  parts.push(`# ${state.title.trim() || "Untitled Article"}`);

  if (state.coverImageUrl?.trim()) {
    parts.push(`![Cover image](${state.coverImageUrl.trim()})`);
  }

  state.sections.forEach((section, index) => {
    const heading = section.heading.trim() || "Section";
    const body = section.body.trim();

    if (shouldSerializeSectionAsIntro(section, index)) {
      if (body) parts.push(body);
      return;
    }

    parts.push(body ? `## ${heading}\n\n${body}` : `## ${heading}`);
  });

  const markdown = parts.join("\n\n");
  console.debug(`${LOG_PREFIX} merged state to markdown`, {
    length: markdown.length,
    sectionCount: state.sections.length,
  });
  return markdown;
}

/** Best-effort parse legacy flat article markdown. */
export function parseMarkdownToArticleDraft(
  markdown: string,
): LinkedInArticleDraftState {
  let text = (markdown || "").trim();
  let title = "Untitled Article";
  let coverImageUrl: string | undefined;

  if (text.startsWith("# ")) {
    const lineBreak = text.indexOf("\n");
    title =
      lineBreak === -1
        ? text.slice(2).trim()
        : text.slice(2, lineBreak).trim();
    text = lineBreak === -1 ? "" : text.slice(lineBreak + 1).trim();
  }

  const coverMatch = text.match(/^!\[[^\]]*\]\(([^)]+)\)\s*/);
  if (coverMatch) {
    coverImageUrl = coverMatch[1];
    text = text.slice(coverMatch[0].length).trim();
  }

  const sections = splitMarkdownIntoSections(text);

  const state: LinkedInArticleDraftState = normalizeArticleDraftState({
    title: title || "Untitled Article",
    sections:
      sections.length > 0
        ? sections
        : [
            {
              id: createArticleSectionId(),
              heading: "Introduction",
              body: text,
            },
          ],
    coverImageUrl,
    imageSuggestions: [],
  });

  console.log(`${LOG_PREFIX} parsed markdown to state`, {
    title: state.title,
    sectionCount: state.sections.length,
  });

  return state;
}

export function buildArticleDraftUpdate(data: ArticleContent): {
  state: LinkedInArticleDraftState;
  markdown: string;
} {
  const state = articleResponseToDraftState(data);
  const markdown = articleStateToMarkdown(state);
  return { state, markdown };
}

export function countArticleWords(state: LinkedInArticleDraftState): number {
  const normalized = normalizeArticleDraftState(state);
  const combined = [
    normalized.title,
    ...normalized.sections.map((s) => `${s.heading} ${s.body}`),
  ].join(" ");
  return combined.trim().split(/\s+/).filter(Boolean).length;
}
