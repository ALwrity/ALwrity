/**
 * Comment Assistant inbox data + actions (Phase 3).
 * Keeps CommentAssistantInboxModal under the 500-line limit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  commentAssistantApi,
  getCommentAssistantErrorMessage,
  getCommentAssistantReplyErrorMessage,
} from '../../../../services/commentAssistantApi';
import { linkedInWriterApi } from '../../../../services/linkedInWriterApi';
import { postCommentsApi } from '../../../../services/postCommentsApi';
import { formatTimeLabel, mapGroupToView } from './commentAssistantMappers';
import type {
  CommentAssistantCommentView,
  CommentAssistantPostGroupView,
  CommentAssistantReplyView,
  CommentAssistantTab,
} from './commentAssistantTypes';

const SYNC_COOLDOWN_MS = 30_000;

type InboxLoadState = 'idle' | 'loading' | 'ready';

function isPriorityTab(
  tab: CommentAssistantTab
): tab is Exclude<CommentAssistantTab, 'manual'> {
  return tab !== 'manual';
}

export function useCommentAssistantInbox(open: boolean, connected: boolean) {
  const [tab, setTab] = useState<CommentAssistantTab>('needs_reply');
  const [loadState, setLoadState] = useState<InboxLoadState>('idle');
  const [groups, setGroups] = useState<CommentAssistantPostGroupView[]>([]);
  const [counts, setCounts] = useState<
    Partial<Record<'needs_reply' | 'active' | 'older', number>>
  >({});
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const requestIdRef = useRef(0);

  const resetInboxShell = useCallback(() => {
    setTab('needs_reply');
    setGroups([]);
    setCounts({});
    setLoadState('idle');
    setError('');
    setActionError('');
  }, []);

  const loadInbox = useCallback(
    async (priority: Exclude<CommentAssistantTab, 'manual'>, refresh = false) => {
      if (!connected) {
        setGroups([]);
        setLoadState('ready');
        setError('');
        return;
      }

      const reqId = ++requestIdRef.current;
      setLoadState('loading');
      setError('');
      setActionError('');

      try {
        const data = await commentAssistantApi.fetchInbox({ priority, refresh });
        if (reqId !== requestIdRef.current) return;
        setGroups((data.groups || []).map(mapGroupToView));
        setCounts({
          needs_reply: data.counts?.needs_reply ?? 0,
          active: data.counts?.active ?? 0,
          older: data.counts?.older ?? 0,
        });
        setLoadState('ready');
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        setGroups([]);
        setCounts({});
        setError(getCommentAssistantErrorMessage(err));
        setLoadState('ready');
      }
    },
    [connected]
  );

  useEffect(() => {
    if (!open) {
      resetInboxShell();
      return;
    }
    if (!connected) {
      setLoadState('ready');
      setGroups([]);
      setError('');
      return;
    }
    if (isPriorityTab(tab)) {
      void loadInbox(tab, false);
    }
  }, [open, connected, tab, loadInbox, resetInboxShell]);

  useEffect(() => {
    if (!open || cooldownUntil <= 0) {
      setCooldownLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left <= 0) setCooldownUntil(0);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [open, cooldownUntil]);

  const handleSync = useCallback(() => {
    if (!connected || loadState === 'loading' || !isPriorityTab(tab)) return;
    if (Date.now() < cooldownUntil) return;
    setCooldownUntil(Date.now() + SYNC_COOLDOWN_MS);
    void loadInbox(tab, true);
  }, [connected, loadState, tab, cooldownUntil, loadInbox]);

  const retryPost = useCallback(() => {
    if (!isPriorityTab(tab)) return;
    void loadInbox(tab, false);
  }, [tab, loadInbox]);

  const updateComment = useCallback(
    (postId: string, commentId: string, patch: Partial<CommentAssistantCommentView>) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.postId !== postId || !g.comments) return g;
          return {
            ...g,
            comments: g.comments.map((c) =>
              c.id === commentId ? { ...c, ...patch } : c
            ),
          };
        })
      );
    },
    []
  );

  const handleLike = useCallback(
    async (postId: string, socialId: string, commentId: string) => {
      setActionError('');
      updateComment(postId, commentId, { liked: true, likeBusy: true });
      try {
        await commentAssistantApi.likeComment(commentId, socialId);
        updateComment(postId, commentId, { liked: true, likeBusy: false });
      } catch (err) {
        updateComment(postId, commentId, { liked: false, likeBusy: false });
        setActionError(getCommentAssistantErrorMessage(err));
      }
    },
    [updateComment]
  );

  const handleSendReply = useCallback(
    async (postId: string, socialId: string, commentId: string, text: string) => {
      setActionError('');
      updateComment(postId, commentId, { replyBusy: true });
      try {
        await postCommentsApi.replyToComment(socialId, {
          comment_id: commentId,
          text,
        });
        updateComment(postId, commentId, { replyBusy: false, draftText: '' });
        if (isPriorityTab(tab)) {
          await loadInbox(tab, false);
        }
      } catch (err) {
        updateComment(postId, commentId, { replyBusy: false });
        setActionError(getCommentAssistantReplyErrorMessage(err));
      }
    },
    [tab, loadInbox, updateComment]
  );

  const handleDraftAi = useCallback(
    async (
      postId: string,
      postText: string,
      commentId: string,
      commentText: string
    ) => {
      setActionError('');
      updateComment(postId, commentId, { draftBusy: true });
      try {
        const res = await linkedInWriterApi.generateCommentResponse({
          original_post: postText,
          comment: commentText,
          response_type: 'professional',
          include_question: false,
        });
        updateComment(postId, commentId, {
          draftBusy: false,
          draftText: res.response ?? '',
        });
      } catch {
        updateComment(postId, commentId, { draftBusy: false });
        setActionError('Could not draft a reply. Please try again.');
      }
    },
    [updateComment]
  );

  const handleLoadMore = useCallback(
    async (postId: string, socialId: string, cursor: string) => {
      setActionError('');
      try {
        const page = await postCommentsApi.fetchPostComments(socialId, {
          cursor,
          limit: 15,
        });
        setGroups((prev) =>
          prev.map((g) => {
            if (g.postId !== postId || !g.comments) return g;
            const existing = new Set(g.comments.map((c) => c.id));
            const extras: CommentAssistantCommentView[] = (page.items || [])
              .filter((item) => item.id && !existing.has(item.id))
              .map((item) => ({
                id: item.id,
                authorName: item.author?.name || 'Unknown',
                headline: item.author?.headline || null,
                avatarUrl: item.author?.avatar_url || null,
                text: item.text || '',
                timeLabel: formatTimeLabel(item.created_at),
                liked: Boolean(item.user_reacted),
                replyCount: item.reply_count ?? 0,
              }));
            return {
              ...g,
              comments: [...g.comments, ...extras],
              hasMoreComments: Boolean(page.has_more),
              commentsCursor: page.cursor || null,
            };
          })
        );
      } catch (err) {
        setActionError(getCommentAssistantErrorMessage(err));
      }
    },
    []
  );

  /** Lazy-load full thread (same Unipile path as Engagement Trends). */
  const handleShowThreadReplies = useCallback(
    async (postId: string, socialId: string, commentId: string) => {
      setActionError('');
      try {
        const page = await postCommentsApi.fetchPostComments(socialId, {
          commentId,
          limit: 50,
        });
        const threadReplies: CommentAssistantReplyView[] = (page.items || []).map((item) => ({
          id: item.id,
          text: item.text || '',
          authorName: item.author?.name || 'Someone',
          timeLabel: formatTimeLabel(item.created_at),
          isMine: false,
        }));
        updateComment(postId, commentId, { threadReplies });
      } catch (err) {
        setActionError(getCommentAssistantErrorMessage(err));
      }
    },
    [updateComment]
  );

  return {
    tab,
    setTab,
    loadState,
    groups,
    counts,
    error,
    actionError,
    cooldownLeft,
    syncDisabled:
      !connected || loadState === 'loading' || cooldownLeft > 0 || tab === 'manual',
    handleSync,
    retryPost,
    handleLike,
    handleSendReply,
    handleDraftAi,
    handleLoadMore,
    handleShowThreadReplies,
  };
}
