/**
 * Session persistence for structured LinkedIn article draft state.
 */

import type { LinkedInArticleDraftState } from "./linkedInArticleDraftUtils";
import { normalizeArticleDraftState } from "./linkedInArticleIntroUtils";
import { normalizeArticleImages } from "./linkedInArticleImageUtils";

export const ARTICLE_DRAFT_STATE_SESSION_KEY = "li_article_draft_state";

const LOG_PREFIX = "[LinkedInArticleDraftStorage]";

export function saveArticleDraftState(state: LinkedInArticleDraftState): void {
  try {
    sessionStorage.setItem(
      ARTICLE_DRAFT_STATE_SESSION_KEY,
      JSON.stringify(state),
    );
    console.debug(`${LOG_PREFIX} saved structured article state`, {
      title: state.title,
      sectionCount: state.sections.length,
    });
  } catch (error) {
    console.warn(`${LOG_PREFIX} failed to save article state`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function loadArticleDraftState(): LinkedInArticleDraftState | null {
  try {
    const raw = sessionStorage.getItem(ARTICLE_DRAFT_STATE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LinkedInArticleDraftState;
    if (!parsed || typeof parsed.title !== "string" || !Array.isArray(parsed.sections)) {
      console.warn(`${LOG_PREFIX} invalid stored article state, ignoring`);
      return null;
    }
    console.debug(`${LOG_PREFIX} restored structured article state`, {
      title: parsed.title,
      sectionCount: parsed.sections.length,
    });
    return normalizeArticleImages(normalizeArticleDraftState(parsed));
  } catch (error) {
    console.warn(`${LOG_PREFIX} failed to load article state`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function clearArticleDraftStateStorage(): void {
  try {
    sessionStorage.removeItem(ARTICLE_DRAFT_STATE_SESSION_KEY);
    console.debug(`${LOG_PREFIX} cleared structured article state`);
  } catch (error) {
    console.warn(`${LOG_PREFIX} failed to clear article state`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
