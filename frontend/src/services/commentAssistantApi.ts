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

  /** Like a comment via Unipile v1 reaction (needs post social_id). */
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
};
