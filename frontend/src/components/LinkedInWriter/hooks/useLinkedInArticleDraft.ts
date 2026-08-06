/**
 * Structured LinkedIn article draft state — syncs with markdown draft string.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArticleContent } from "../../../services/linkedInWriterApi";
import type { LinkedInDraftContentType } from "../utils/linkedInDraftLibraryUtils";
import {
  articleStateToMarkdown,
  buildArticleDraftUpdate,
  parseMarkdownToArticleDraft,
  type LinkedInArticleDraftState,
} from "../utils/linkedInArticleDraftUtils";
import {
  clearArticleDraftStateStorage,
  loadArticleDraftState,
  saveArticleDraftState,
} from "../utils/linkedInArticleDraftStorage";
import { normalizeArticleDraftState } from "../utils/linkedInArticleIntroUtils";

const LOG_PREFIX = "[useLinkedInArticleDraft]";

interface UseLinkedInArticleDraftOptions {
  draft: string;
  draftContentType: LinkedInDraftContentType;
  setDraft: (value: string) => void;
}

export function useLinkedInArticleDraft({
  draft,
  draftContentType,
  setDraft,
}: UseLinkedInArticleDraftOptions) {
  const [articleDraftState, setArticleDraftState] =
    useState<LinkedInArticleDraftState | null>(() => loadArticleDraftState());
  const skipHydrateRef = useRef(false);

  const applyGenerationResult = useCallback(
    (data: ArticleContent): string => {
      const { state } = buildArticleDraftUpdate(data);
      const normalized = normalizeArticleDraftState(state);
      const markdown = articleStateToMarkdown(normalized);
      skipHydrateRef.current = true;
      setArticleDraftState(normalized);
      saveArticleDraftState(normalized);
      setDraft(markdown);
      console.log(`${LOG_PREFIX} applied generation result`, {
        title: normalized.title,
        sectionCount: normalized.sections.length,
      });
      return markdown;
    },
    [setDraft],
  );

  const updateArticleDraftState = useCallback(
    (
      updater:
        | LinkedInArticleDraftState
        | ((prev: LinkedInArticleDraftState) => LinkedInArticleDraftState),
    ) => {
      setArticleDraftState((prev) => {
        const base =
          prev ??
          parseMarkdownToArticleDraft(draft) ??
          parseMarkdownToArticleDraft("");
        const next =
          typeof updater === "function"
            ? (updater as (p: LinkedInArticleDraftState) => LinkedInArticleDraftState)(base)
            : updater;
        const normalized = normalizeArticleDraftState(next);
        const markdown = articleStateToMarkdown(normalized);
        skipHydrateRef.current = true;
        saveArticleDraftState(normalized);
        setDraft(markdown);
        return normalized;
      });
    },
    [draft, setDraft],
  );

  const hydrateFromMarkdown = useCallback(
    (markdown: string) => {
      const state = parseMarkdownToArticleDraft(markdown);
      setArticleDraftState(state);
      saveArticleDraftState(state);
      console.log(`${LOG_PREFIX} hydrated from markdown`, {
        title: state.title,
        sectionCount: state.sections.length,
      });
    },
    [],
  );

  const getArticleMarkdown = useCallback((): string => {
    if (articleDraftState) {
      return articleStateToMarkdown(articleDraftState);
    }
    return draft;
  }, [articleDraftState, draft]);

  const clearArticleDraft = useCallback(() => {
    setArticleDraftState(null);
    clearArticleDraftStateStorage();
    console.log(`${LOG_PREFIX} cleared article draft state`);
  }, []);

  useEffect(() => {
    const handleArticleDraftUpdate = (event: CustomEvent) => {
      const state = event.detail as LinkedInArticleDraftState;
      if (!state?.title || !Array.isArray(state.sections)) {
        console.warn(`${LOG_PREFIX} ignored invalid updateArticleDraft event`);
        return;
      }
      const normalized = normalizeArticleDraftState(state);
      skipHydrateRef.current = true;
      setArticleDraftState(normalized);
      saveArticleDraftState(normalized);
    };

    window.addEventListener(
      "linkedinwriter:updateArticleDraft",
      handleArticleDraftUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "linkedinwriter:updateArticleDraft",
        handleArticleDraftUpdate as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (draftContentType !== "article") return;
    if (skipHydrateRef.current) {
      skipHydrateRef.current = false;
      return;
    }
    if (!draft?.trim()) {
      setArticleDraftState(null);
      return;
    }
    if (articleDraftState) return;

    const stored = loadArticleDraftState();
    if (stored) {
      setArticleDraftState(stored);
      return;
    }
    hydrateFromMarkdown(draft);
  }, [draft, draftContentType, articleDraftState, hydrateFromMarkdown]);

  return {
    articleDraftState,
    applyGenerationResult,
    updateArticleDraftState,
    hydrateFromMarkdown,
    getArticleMarkdown,
    clearArticleDraft,
  };
}
