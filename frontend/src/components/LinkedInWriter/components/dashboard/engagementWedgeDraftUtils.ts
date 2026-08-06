/**
 * Shared draft read/write for Engagement wedge modals.
 * Prefers live Studio session draft, then persisted localStorage copy.
 */
import { dispatchLinkedInDraftUpdate } from "../../utils/linkedInDraftContentTypeStorage";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";

const SESSION_DRAFT_KEY = "li_draft";
const LOCAL_DRAFT_KEY = "alwrity-copilot-draft-content";

/** Read the best available Studio draft (session first, localStorage fallback). */
export function readStudioDraft(): string {
  try {
    const sessionDraft = sessionStorage.getItem(SESSION_DRAFT_KEY)?.trim();
    if (sessionDraft) return sessionDraft;
  } catch {
    /* ignore quota / privacy errors */
  }
  try {
    return localStorage.getItem(LOCAL_DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Push optimised content into Studio and keep storage layers in sync. */
export function pushDraftToStudio(
  text: string,
  contentType: LinkedInDraftContentType = "post",
): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  dispatchLinkedInDraftUpdate(trimmed, contentType);

  try {
    sessionStorage.setItem(SESSION_DRAFT_KEY, trimmed);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, trimmed);
  } catch {
    /* ignore */
  }
}
