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
import type { CommentAssistantReplyPayload } from './commentAssistantReplyComposer';
import type { CommentAssistantReactionType } from './commentAssistantReactions';
import type {
  CommentAssistantCommentView,
  CommentAssistantPostGroupView,
  CommentAssistantReplyView,
  CommentAssistantTab,
} from './commentAssistantTypes';

/** Client spam guard; server cache TTL is 5 minutes. */
const SYNC_COOLDOWN_MS = 60_000;

type InboxLoadState = 'idle' | 'loading' | 'ready';

function isPriorityTab(
  tab: CommentAssistantTab
): tab is Exclude<CommentAssistantTab, 'manual'> {
  return tab !== 'manual';
}

type CommentActionState = {
  userReacted?: string | null;
  reactionCount?: number;
};

/** Find a top-level comment or nested reply by id (for react/reply optimistic UI). */
function findCommentOrReply(
  groups: CommentAssistantPostGroupView[],
  postId: string,
  commentId: string
): CommentActionState | null {
  const group = groups.find((g) => g.postId === postId);
  if (!group?.comments) return null;
  for (const c of group.comments) {
    if (c.id === commentId) return c;
    for (const list of [c.myReplies, c.threadReplies]) {
      const hit = list?.find((r) => r.id === commentId);
      if (hit) return hit;
    }
  }
  return null;
}

type CommentOrReplyPatch = Partial<CommentAssistantCommentView> &
  Partial<CommentAssistantReplyView>;

export function useCommentAssistantInbox(open: boolean, connected: boolean) {
  const [tab, setTab] = useState<CommentAssistantTab>('needs_reply');
  const [loadState, setLoadState] = useState<InboxLoadState>('idle');
  const [groups, setGroups] = useState<CommentAssistantPostGroupView[]>([]);
  const [counts, setCounts] = useState<
    Partial<Record<'needs_reply' | 'active' | 'older', number>>
  >({});
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    tone: 'info' | 'success';
    text: string;
  } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const statusTimerRef = useRef<number | null>(null);

  const clearStatusTimer = useCallback(() => {
    if (statusTimerRef.current != null) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  }, []);

  const showStatus = useCallback(
    (tone: 'info' | 'success', text: string, autoClearMs?: number) => {
      clearStatusTimer();
      setStatusMessage({ tone, text });
      if (autoClearMs && autoClearMs > 0) {
        statusTimerRef.current = window.setTimeout(() => {
          setStatusMessage(null);
          statusTimerRef.current = null;
        }, autoClearMs);
      }
    },
    [clearStatusTimer]
  );

  const resetInboxShell = useCallback(() => {
    clearStatusTimer();
    setTab('needs_reply');
    setGroups([]);
    setCounts({});
    setLoadState('idle');
    setError('');
    setActionError('');
    setStatusMessage(null);
    setLastSyncedAt(null);
  }, [clearStatusTimer]);

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
        setLastSyncedAt(data.last_synced_at || null);
        setLoadState('ready');
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        setGroups([]);
        setCounts({});
        setLastSyncedAt(null);
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

  /** Patch a top-level comment or a nested reply (my_replies / threadReplies). */
  const updateComment = useCallback(
    (postId: string, commentId: string, patch: CommentOrReplyPatch) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.postId !== postId || !g.comments) return g;
          return {
            ...g,
            comments: g.comments.map((c) => {
              if (c.id === commentId) {
                return { ...c, ...patch };
              }
              const patchReplies = (
                replies?: CommentAssistantReplyView[]
              ): CommentAssistantReplyView[] | undefined => {
                if (!replies) return replies;
                return replies.map((r) =>
                  r.id === commentId ? { ...r, ...patch } : r
                );
              };
              return {
                ...c,
                myReplies: patchReplies(c.myReplies),
                threadReplies: patchReplies(c.threadReplies),
              };
            }),
          };
        })
      );
    },
    []
  );

  const handleReact = useCallback(
    async (
      postId: string,
      socialId: string,
      commentId: string,
      reactionType: CommentAssistantReactionType
    ) => {
      setActionError('');
      const prev = findCommentOrReply(groups, postId, commentId);
      updateComment(postId, commentId, {
        liked: true,
        userReacted: reactionType,
        likeBusy: true,
        reactionCount: Math.max((prev?.reactionCount ?? 0), 0) + (prev?.userReacted ? 0 : 1),
      });
      try {
        // Same Unipile like path as top-level comments (works for nested reply ids).
        await commentAssistantApi.likeComment(commentId, socialId, reactionType);
        updateComment(postId, commentId, {
          liked: true,
          userReacted: reactionType,
          likeBusy: false,
        });
      } catch (err) {
        updateComment(postId, commentId, {
          liked: Boolean(prev?.userReacted),
          userReacted: prev?.userReacted ?? null,
          reactionCount: prev?.reactionCount ?? 0,
          likeBusy: false,
        });
        setActionError(getCommentAssistantErrorMessage(err));
      }
    },
    [groups, updateComment]
  );

  const handleSendReply = useCallback(
    async (
      postId: string,
      socialId: string,
      commentId: string,
      payload: CommentAssistantReplyPayload
    ) => {
      setActionError('');
      showStatus('info', 'Sending your reply…');
      updateComment(postId, commentId, { replyBusy: true });
      try {
        // Same multipart reply path; commentId may be a nested reply id.
        await commentAssistantApi.replyToComment(socialId, {
          comment_id: commentId,
          text: payload.text,
          mentions: payload.mentions,
          imageFile: payload.imageFile,
        });
        updateComment(postId, commentId, { replyBusy: false, draftText: '' });
        showStatus('success', 'Reply posted successfully.', 4500);
        if (isPriorityTab(tab)) {
          await loadInbox(tab, false);
        }
      } catch (err) {
        updateComment(postId, commentId, { replyBusy: false });
        setStatusMessage(null);
        setActionError(getCommentAssistantReplyErrorMessage(err));
      }
    },
    [tab, loadInbox, updateComment, showStatus]
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
                authorId: item.author_id || null,
                headline: item.author?.headline || null,
                avatarUrl: item.author?.avatar_url || null,
                text: item.text || '',
                timeLabel: formatTimeLabel(item.created_at),
                liked: Boolean(item.user_reacted),
                userReacted: item.user_reacted || null,
                reactionCount: item.reaction_count ?? 0,
                replyCount: item.reply_count ?? 0,
                imageUrl: item.image_url || null,
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
          authorId: item.author_id || null,
          timeLabel: formatTimeLabel(item.created_at),
          isMine: false,
          imageUrl: item.image_url || null,
          liked: Boolean(item.user_reacted),
          userReacted: item.user_reacted || null,
          reactionCount: item.reaction_count ?? 0,
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
    statusMessage,
    cooldownLeft,
    lastSyncedAt,
    syncDisabled:
      !connected || loadState === 'loading' || cooldownLeft > 0 || tab === 'manual',
    handleSync,
    retryPost,
    handleReact,
    handleSendReply,
    handleDraftAi,
    handleLoadMore,
    handleShowThreadReplies,
  };
}
