import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";
import {
  dispatchLinkedInDraftUpdate,
  saveDraftContentType,
} from "../../utils/linkedInDraftContentTypeStorage";

/**
 * Open Studio diff preview (linkedinwriter:applyEdit) so the user can
 * accept or discard the optimised version — same pattern as Copilot edit actions.
 */
export function dispatchReviewOptimisedDraftInStudio(
  original: string,
  optimised: string,
  contentType: LinkedInDraftContentType,
): void {
  const src = original.trim();
  const target = optimised.trim();
  if (!src || !target) return;

  saveDraftContentType(contentType);
  dispatchLinkedInDraftUpdate(src, contentType);

  window.dispatchEvent(
    new CustomEvent("linkedinwriter:applyEdit", {
      detail: { src, target },
    }),
  );
}
