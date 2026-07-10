import { useCallback, useEffect, useRef, useState } from 'react';

import type { PostDelta } from '../../../../services/postAnalyticsApi';
import {
  getPostCommentsErrorMessage,
  getPostCommentsReplyErrorMessage,
  POST_COMMENTS_MISSING_SOCIAL_ID,
  POST_COMMENTS_NOT_CONNECTED,
  postCommentsApi,
} from '../../../../services/postCommentsApi';
import type { PostComment } from './postCommentsTypes';
import { UNIPILE_MAX_COMMENT_LENGTH } from './postCommentsTypes';
import { usePostCommentReplies } from './usePostCommentReplies';

export function resolvePostSocialId(post: PostDelta | null): string | null {
  const id = post?.social_id?.trim();
  return id || null;
}

export interface UsePostCommentsModalOptions {
  open: boolean;
  post: PostDelta | null;
  connected?: boolean;
}

export function usePostCommentsModal({ open, post, connected = true }: UsePostCommentsModalOptions) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [replySuccess, setReplySuccess] = useState(false);
  const mountedRef = useRef(true);
  const cursorRef = useRef<string | null>(null);

  const socialId = resolvePostSocialId(post);
  const {
    repliesByParent,
    expandedParents,
    loadingParents,
    errorsByParent,
    toggleReplies,
    refreshReplies,
    resetReplies,
    setMounted: setRepliesMounted,
  } = usePostCommentReplies({ socialId, connected });

  const resetState = useCallback(() => {
    setComments([]);
    setCursor(null);
    cursorRef.current = null;
    setHasMore(false);
    setError('');
    setReplyText('');
    setSelectedCommentId(null);
    setReplyError('');
    setReplySuccess(false);
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
    setReplying(false);
    resetReplies();
  }, [resetReplies]);

  const fetchComments = useCallback(
    async (mode: 'initial' | 'more' | 'refresh') => {
      if (!socialId) {
        setError(POST_COMMENTS_MISSING_SOCIAL_ID);
        setComments([]);
        setCursor(null);
        setHasMore(false);
        return;
      }
      if (!connected) {
        setError(POST_COMMENTS_NOT_CONNECTED);
        setComments([]);
        return;
      }

      if (mode === 'more' && !cursorRef.current) return;

      if (mode === 'initial') {
        setLoading(true);
        setError('');
        setReplySuccess(false);
        cursorRef.current = null;
        setCursor(null);
        resetReplies();
      } else if (mode === 'more') {
        setLoadingMore(true);
      } else {
        setRefreshing(true);
        setReplyError('');
        cursorRef.current = null;
        setCursor(null);
      }

      try {
        const result = await postCommentsApi.fetchPostComments(socialId, {
          cursor: mode === 'more' ? cursorRef.current ?? undefined : undefined,
        });
        if (!mountedRef.current) return;

        const nextItems = result.items ?? [];
        setComments((prev) => (mode === 'more' ? [...prev, ...nextItems] : nextItems));
        const nextCursor = result.cursor ?? null;
        cursorRef.current = nextCursor;
        setCursor(nextCursor);
        setHasMore(Boolean(result.has_more));
        if (mode !== 'more') setError('');
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        const message = getPostCommentsErrorMessage(err);
        if (mode === 'more') {
          setReplyError(message);
        } else {
          setError(message);
          setComments([]);
          cursorRef.current = null;
          setCursor(null);
          setHasMore(false);
        }
      } finally {
        if (!mountedRef.current) return;
        if (mode === 'initial') setLoading(false);
        if (mode === 'more') setLoadingMore(false);
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [socialId, connected, resetReplies]
  );

  const loadComments = useCallback(() => fetchComments('initial'), [fetchComments]);
  const loadMoreComments = useCallback(() => fetchComments('more'), [fetchComments]);
  const refreshComments = useCallback(() => fetchComments('refresh'), [fetchComments]);

  useEffect(() => {
    mountedRef.current = true;
    setRepliesMounted(true);
    if (!open || !post) {
      resetState();
      return;
    }
    void fetchComments('initial');
    return () => {
      mountedRef.current = false;
      setRepliesMounted(false);
    };
  }, [open, post?.post_id, socialId, connected, fetchComments, resetState, setRepliesMounted]);

  const handleReply = useCallback(async () => {
    if (!socialId || !selectedCommentId) return;

    const trimmed = replyText.trim();
    if (!trimmed) {
      setReplyError('Enter a reply before sending.');
      return;
    }
    if (trimmed.length > UNIPILE_MAX_COMMENT_LENGTH) {
      setReplyError(`Reply must be ${UNIPILE_MAX_COMMENT_LENGTH} characters or fewer.`);
      return;
    }

    const parentId = selectedCommentId;
    setReplying(true);
    setReplyError('');
    setReplySuccess(false);
    try {
      await postCommentsApi.replyToComment(socialId, {
        comment_id: parentId,
        text: trimmed,
      });
      if (!mountedRef.current) return;
      setReplySuccess(true);
      setReplyText('');
      setSelectedCommentId(null);
      await fetchComments('refresh');
      await refreshReplies(parentId);
    } catch (err: unknown) {
      if (mountedRef.current) {
        setReplyError(getPostCommentsReplyErrorMessage(err));
      }
    } finally {
      if (mountedRef.current) setReplying(false);
    }
  }, [socialId, selectedCommentId, replyText, fetchComments, refreshReplies]);

  const selectedComment = selectedCommentId
    ? comments.find((c) => c.id === selectedCommentId) ?? null
    : null;

  const selectCommentForReply = useCallback((commentId: string) => {
    setSelectedCommentId(commentId);
    setReplyText('');
    setReplyError('');
    setReplySuccess(false);
  }, []);

  const cancelReply = useCallback(() => {
    setSelectedCommentId(null);
    setReplyText('');
    setReplyError('');
  }, []);

  const canReply =
    connected &&
    !!socialId &&
    !!selectedCommentId &&
    replyText.trim().length > 0 &&
    replyText.length <= UNIPILE_MAX_COMMENT_LENGTH &&
    !replying &&
    !loading &&
    !refreshing;

  return {
    socialId,
    comments,
    cursor,
    hasMore,
    loading,
    loadingMore,
    refreshing,
    error,
    replyText,
    setReplyText,
    selectedCommentId,
    setSelectedCommentId,
    selectCommentForReply,
    cancelReply,
    selectedComment,
    replying,
    replyError,
    replySuccess,
    canReply,
    loadComments,
    loadMoreComments,
    refreshComments,
    handleReply,
    repliesByParent,
    expandedParents,
    loadingParents,
    errorsByParent,
    toggleReplies,
    refreshReplies,
  };
}
