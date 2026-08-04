/**
 * Normalize assistive-writing citation hints so raw URLs / [Source N] never enter the editor.
 * Sources remain available on the suggestion card as title links.
 */

import type { LinkedInAssistiveSource } from "../services/linkedInAssistiveWritingApi";

const LOG_PREFIX = "[linkedInAssistiveCitationUtils]";

/** `((Author, 2021)[https://example.com])` and close variants. */
const ASSISTIVE_URL_CITATION_RE =
  /\(\(\s*([^)\]]*?)\s*\)\[\s*(https?:\/\/[^\]\s]+)\s*\]\)/gi;

/** Studio / assistive markers: [Source 2], ([Source 2]). */
const SOURCE_MARKER_RE =
  /\(\s*\[Source\s+\d+\]\s*\)|\[Source\s+\d+\]/gi;

export interface CitationSourceLike {
  url?: string | null;
  title?: string | null;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function cleanupCitationWhitespace(text: string): string {
  return text
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[^\S\n]+([.,;:!?])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/**
 * Resolve 1-based source index for a citation URL.
 * Prefers researchSources when provided, then suggestion sources.
 */
export function resolveAssistiveSourceIndex(
  citationUrl: string,
  suggestionSources?: CitationSourceLike[] | null,
  researchSources?: CitationSourceLike[] | null,
): number | null {
  const target = normalizeUrl(citationUrl);
  if (!target) return null;

  const pools: CitationSourceLike[][] = [];
  if (researchSources?.length) pools.push(researchSources);
  if (suggestionSources?.length) pools.push(suggestionSources);

  for (const pool of pools) {
    const index = pool.findIndex(
      (source) => source.url && normalizeUrl(source.url) === target,
    );
    if (index >= 0) return index + 1;
  }

  if (suggestionSources?.length) return 1;
  return null;
}

/** Remove URL citation hints without leaving markers. */
export function stripAssistiveCitationHints(text: string): string {
  if (!text) return "";
  return cleanupCitationWhitespace(text.replace(ASSISTIVE_URL_CITATION_RE, " "));
}

/** Remove `[Source N]` markers from assistive editor text. */
export function stripAssistiveSourceMarkers(text: string): string {
  if (!text) return "";
  return cleanupCitationWhitespace(text.replace(SOURCE_MARKER_RE, " "));
}

/**
 * Prepare suggestion text for assistive editor display + insert.
 * Strips URL hints and [Source N] so the textarea stays LinkedIn-native prose.
 */
export function prepareAssistiveTextForEditor(text: string): string {
  if (!text) return "";
  const withoutUrls = stripAssistiveCitationHints(text);
  const cleaned = stripAssistiveSourceMarkers(withoutUrls);
  if (cleaned !== text.trim()) {
    console.log(`${LOG_PREFIX} stripped citations for assistive editor`, {
      rawLength: text.length,
      cleanedLength: cleaned.length,
    });
  }
  return cleaned;
}

/**
 * @deprecated Prefer prepareAssistiveTextForEditor for assistive mode.
 * Kept for publish-pipeline callers that still map URL hints → [Source N].
 */
export function normalizeAssistiveCitationHints(
  text: string,
  suggestionSources?: CitationSourceLike[] | null,
  researchSources?: CitationSourceLike[] | null,
): string {
  if (!text) return "";

  let replaced = 0;
  const result = text.replace(
    ASSISTIVE_URL_CITATION_RE,
    (_match, _author, url: string) => {
      replaced += 1;
      const sourceIndex = resolveAssistiveSourceIndex(
        url,
        suggestionSources,
        researchSources,
      );
      return sourceIndex ? ` [Source ${sourceIndex}]` : "";
    },
  );

  if (replaced > 0) {
    console.log(`${LOG_PREFIX} normalized citation hints`, {
      count: replaced,
      suggestionSourceCount: suggestionSources?.length ?? 0,
      researchSourceCount: researchSources?.length ?? 0,
    });
  }

  return cleanupCitationWhitespace(result);
}

/** Suggestion card body — never show raw URLs or [Source N] in assistive mode. */
export function formatAssistiveSuggestionText(
  text: string,
  _sources?: LinkedInAssistiveSource[] | null,
): string {
  return prepareAssistiveTextForEditor(text);
}
