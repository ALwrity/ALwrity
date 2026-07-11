import { useCallback, useRef, useState } from 'react';

import {
  getPostCommentsErrorMessage,
  postCommentsApi,
} from '../../../../services/postCommentsApi';
import type { PostComment } from './postCommentsTypes';

export type CommentRepliesMap = Record<string, PostComment[]>;

export interface UsePostCommentRepliesOptions {
  socialId: string | null;
  connected: boolean;
}

/**
 * Lazy-load and cache nested replies for parent comments.
 */
export function usePostCommentReplies({ socialId, connected }: UsePostCommentRepliesOptions) {
  const [repliesByParent, setRepliesByParent] = useState<CommentRepliesMap>({});
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [loadingParents, setLoadingParents] = useState<Record<string, boolean>>({});
  const [errorsByParent, setErrorsByParent] = useState<Record<string, string>>({});
  const mountedRef = useRef(true);

  const resetReplies = useCallback(() => {
    setRepliesByParent({});
    setExpandedParents({});
    setLoadingParents({});
    setErrorsByParent({});
  }, []);

  const setMounted = useCallback((value: boolean) => {
    mountedRef.current = value;
  }, []);

  const fetchReplies = useCallback(
    async (parentCommentId: string, { force = false }: { force?: boolean } = {}) => {
      if (!socialId || !connected || !parentCommentId) return;

      if (!force && repliesByParent[parentCommentId] && !errorsByParent[parentCommentId]) {
        setExpandedParents((prev) => ({ ...prev, [parentCommentId]: true }));
        return;
      }

      setLoadingParents((prev) => ({ ...prev, [parentCommentId]: true }));
      setErrorsByParent((prev) => {
        const next = { ...prev };
        delete next[parentCommentId];
        return next;
      });

      try {
        const result = await postCommentsApi.fetchPostComments(socialId, {
          commentId: parentCommentId,
          limit: 50,
        });
        if (!mountedRef.current) return;
        setRepliesByParent((prev) => ({
          ...prev,
          [parentCommentId]: result.items ?? [],
        }));
        setExpandedParents((prev) => ({ ...prev, [parentCommentId]: true }));
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        setErrorsByParent((prev) => ({
          ...prev,
          [parentCommentId]: getPostCommentsErrorMessage(err),
        }));
        setExpandedParents((prev) => ({ ...prev, [parentCommentId]: true }));
      } finally {
        if (mountedRef.current) {
          setLoadingParents((prev) => ({ ...prev, [parentCommentId]: false }));
        }
      }
    },
    [socialId, connected, repliesByParent, errorsByParent]
  );

  const toggleReplies = useCallback(
    async (parentCommentId: string) => {
      if (expandedParents[parentCommentId]) {
        setExpandedParents((prev) => ({ ...prev, [parentCommentId]: false }));
        return;
      }
      await fetchReplies(parentCommentId);
    },
    [expandedParents, fetchReplies]
  );

  const refreshReplies = useCallback(
    async (parentCommentId: string) => {
      await fetchReplies(parentCommentId, { force: true });
    },
    [fetchReplies]
  );

  return {
    repliesByParent,
    expandedParents,
    loadingParents,
    errorsByParent,
    toggleReplies,
    refreshReplies,
    resetReplies,
    setMounted,
  };
}
