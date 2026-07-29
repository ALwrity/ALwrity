/**
 * Draft-with-ALwrity action for Comment Assistant inbox.
 * Extracted so useCommentAssistantInbox stays under the 500-line limit.
 */
import { useCallback } from "react";
import {
  commentAssistantApi,
  getCommentAssistantDraftErrorMessage,
} from "../../../../services/commentAssistantApi";
import {
  clearSessionDraft,
  getSessionDraft,
  setSessionDraft,
} from "./commentAssistantDraftCache";
import type { CommentAssistantPostGroupView } from "./commentAssistantTypes";

type UpdateComment = (
  postId: string,
  commentId: string,
  patch: { draftBusy?: boolean; draftText?: string },
) => void;

export type DraftAlwrityOptions = {
  /** Bypass session + workspace draft cache (Regenerate). */
  refresh?: boolean;
};

function resolveCommentContext(
  groups: CommentAssistantPostGroupView[],
  postId: string,
  commentId: string,
): { postText: string; commentText: string; parentCommentText?: string } {
  const group = groups.find((g) => g.postId === postId);
  const postText = group?.postText || group?.postSnippet || "";
  let commentText = "";
  let parentCommentText: string | undefined;

  const topLevel = group?.comments?.find((c) => c.id === commentId);
  if (topLevel) {
    return { postText, commentText: topLevel.text };
  }

  for (const c of group?.comments || []) {
    const nested =
      c.myReplies?.find((r) => r.id === commentId) ||
      c.threadReplies?.find((r) => r.id === commentId);
    if (nested) {
      commentText = nested.text;
      parentCommentText = c.text;
      break;
    }
  }
  return { postText, commentText, parentCommentText };
}

export function useCommentAssistantDraftAction(options: {
  getGroups: () => CommentAssistantPostGroupView[];
  updateComment: UpdateComment;
  setActionError: (message: string) => void;
}) {
  const { getGroups, updateComment, setActionError } = options;

  const handleDraftAlwrity = useCallback(
    async (
      postId: string,
      socialId: string,
      commentId: string,
      draftOptions?: DraftAlwrityOptions,
    ) => {
      setActionError("");
      const refresh = Boolean(draftOptions?.refresh);
      const { postText, commentText, parentCommentText } = resolveCommentContext(
        getGroups(),
        postId,
        commentId,
      );

      if (!commentText) {
        console.error("[CommentAssistantDraft] comment not found for draft", {
          postId,
          commentId,
        });
        setActionError(
          "Draft — Could not find the comment to draft a reply.",
        );
        return;
      }

      if (refresh) {
        clearSessionDraft(commentId);
      } else {
        const sessionHit = getSessionDraft(commentId);
        if (sessionHit) {
          console.info(
            "[CommentAssistantDraft] session cache hit",
            commentId.slice(-12),
          );
          updateComment(postId, commentId, {
            draftBusy: false,
            draftText: sessionHit,
          });
          return;
        }
      }

      updateComment(postId, commentId, { draftBusy: true });
      try {
        const res = await commentAssistantApi.draftReply({
          social_id: socialId,
          comment_id: commentId,
          post_text: postText,
          comment_text: commentText,
          parent_comment_text: parentCommentText || null,
          tone: "professional",
          include_question: false,
          refresh,
        });
        if (!res.success || !res.reply) {
          throw new Error(res.error || "Draft generation failed");
        }
        setSessionDraft(commentId, res.reply);
        updateComment(postId, commentId, {
          draftBusy: false,
          draftText: res.reply,
        });
        console.info("[CommentAssistantDraft] ok", {
          from_cache: Boolean(res.from_cache),
          reply_length: res.reply.length,
          refresh,
        });
      } catch (err) {
        updateComment(postId, commentId, { draftBusy: false });
        console.error("[CommentAssistantDraft] failed", err);
        // Prefix so the shared action banner is distinct from reply/like errors.
        setActionError(
          `Draft — ${getCommentAssistantDraftErrorMessage(err)}`,
        );
      }
    },
    [getGroups, updateComment, setActionError],
  );

  return { handleDraftAlwrity };
}
