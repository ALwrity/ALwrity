/**
 * Comment Assistant inbox API client (Issue #73).
 * Reply / load-more reuse postCommentsApi.
 */
import { aiApiClient } from '../api/client';
import type {
  CommentAssistantInboxResponse,
  CommentAssistantLikeResponse,
  CommentAssistantPriority,
} from '../components/LinkedInWriter/components/dashboard/commentAssistantTypes';

export {
  getPostCommentsErrorMessage as getCommentAssistantErrorMessage,
  getPostCommentsReplyErrorMessage as getCommentAssistantReplyErrorMessage,
  getPostCommentsErrorType as getCommentAssistantErrorType,
} from './postCommentsErrorUtils';

const BASE = '/api/linkedin/comment-assistant';

export const commentAssistantApi = {
  /** Aggregated comments on the user's posts, filtered by priority. */
  async fetchInbox(params?: {
    priority?: CommentAssistantPriority;
    refresh?: boolean;
  }): Promise<CommentAssistantInboxResponse> {
    const { data } = await aiApiClient.get<CommentAssistantInboxResponse>(
      `${BASE}/inbox`,
      {
        params: {
          priority: params?.priority ?? 'needs_reply',
          refresh: params?.refresh ?? false,
        },
      }
    );
    return data;
  },

  /** React to a comment via Unipile v1 (like / celebrate / support / love / …). */
  async likeComment(
    commentId: string,
    postSocialId: string,
    reactionType = 'like'
  ): Promise<CommentAssistantLikeResponse> {
    const { data } = await aiApiClient.post<CommentAssistantLikeResponse>(
      `${BASE}/comments/${encodeURIComponent(commentId)}/like`,
      {
        post_social_id: postSocialId,
        reaction_type: reactionType,
      }
    );
    return data;
  },

  /**
   * Reply with optional mentions + image (multipart).
   * Use when attaching an image; otherwise postCommentsApi.replyToComment is fine.
   */
  async replyToComment(
    socialId: string,
    payload: {
      comment_id: string;
      text: string;
      mentions?: Array<{ name: string; profile_id: string }>;
      imageFile?: File | null;
    }
  ): Promise<{ success: boolean; comment_id?: string | null }> {
    const form = new FormData();
    form.append('comment_id', payload.comment_id);
    form.append('text', payload.text);
    if (payload.mentions && payload.mentions.length > 0) {
      form.append('mentions', JSON.stringify(payload.mentions));
    }
    if (payload.imageFile) {
      form.append('attachment', payload.imageFile);
    }
    const { data } = await aiApiClient.post<{ success: boolean; comment_id?: string | null }>(
      `${BASE}/posts/${encodeURIComponent(socialId)}/comments/reply`,
      form
    );
    return data;
  },
};
