import { useCallback, useEffect, useState } from "react";
import {
  clearDraftContentTypeStorage,
  DEFAULT_DRAFT_CONTENT_TYPE,
  loadDraftContentType,
  saveDraftContentType,
  type LinkedInDraftContentType,
} from "../utils/linkedInDraftContentTypeStorage";

const LOG_PREFIX = "[LinkedInDraftContentType]";

export function useLinkedInDraftContentType() {
  const [draftContentType, setDraftContentTypeState] =
    useState<LinkedInDraftContentType>(() => {
      return loadDraftContentType() ?? DEFAULT_DRAFT_CONTENT_TYPE;
    });

  const setDraftContentType = useCallback(
    (type: LinkedInDraftContentType, source?: string) => {
      setDraftContentTypeState((prev) => {
        if (prev === type) return prev;
        console.debug(`${LOG_PREFIX} set`, {
          contentType: type,
          source: source ?? "unknown",
        });
        return type;
      });
      saveDraftContentType(type);
    },
    [],
  );

  const clearDraftContentType = useCallback(() => {
    setDraftContentTypeState(DEFAULT_DRAFT_CONTENT_TYPE);
    clearDraftContentTypeStorage();
    console.debug(`${LOG_PREFIX} reset to default`, {
      contentType: DEFAULT_DRAFT_CONTENT_TYPE,
    });
  }, []);

  useEffect(() => {
    if (draftContentType === DEFAULT_DRAFT_CONTENT_TYPE) {
      try {
        const hasDraft = Boolean(sessionStorage.getItem("li_draft")?.trim());
        if (!hasDraft) {
          clearDraftContentTypeStorage();
        }
      } catch {
        /* ignore */
      }
      return;
    }
    saveDraftContentType(draftContentType);
  }, [draftContentType]);

  return {
    draftContentType,
    setDraftContentType,
    clearDraftContentType,
  };
}
