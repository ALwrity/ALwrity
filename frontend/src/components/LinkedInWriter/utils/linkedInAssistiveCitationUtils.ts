/**
 * Normalize assistive-writing citation hints so raw URLs never enter the editor.
 * Converts `((Author, year)[https://…])` → `[Source N]` (studio citation style).
 */

import type { LinkedInAssistiveSource } from "../services/linkedInAssistiveWritingApi";

const LOG_PREFIX = "[linkedInAssistiveCitationUtils]";

/** `((Author, 2021)[https://example.com])` and close variants. */
const ASSISTIVE_URL_CITATION_RE =
  /\(\(\s*([^)\]]*?)\s*\)\[\s*(https?:\/\/[^\]\s]+)\s*\]\)/gi;

export interface CitationSourceLike {
  url?: string | null;
  title?: string | null;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
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

  // Fallback: first suggestion source when URL matching fails but sources exist.
  if (suggestionSources?.length) return 1;
  return null;
}

/**
 * Replace URL citation hints with `[Source N]` markers (citation preview style).
 * Removes the hint entirely when no source index can be resolved.
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

  return result
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[^\S\n]+([.,;:!?])/g, "$1")
    .trim();
}

/** Remove assistive URL citation hints without leaving markers (publish safety). */
export function stripAssistiveCitationHints(text: string): string {
  if (!text) return "";
  return text
    .replace(ASSISTIVE_URL_CITATION_RE, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[^\S\n]+([.,;:!?])/g, "$1")
    .trim();
}

/** Display helper for suggestion cards — never show raw citation URLs. */
export function formatAssistiveSuggestionText(
  text: string,
  sources?: LinkedInAssistiveSource[] | null,
): string {
  return normalizeAssistiveCitationHints(text, sources);
}
