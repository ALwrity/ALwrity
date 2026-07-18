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
    /** Analytics post headers only (progressive UI; no Unipile). */
    shell?: boolean;
  }): Promise<CommentAssistantInboxResponse> {
    const { data } = await aiApiClient.get<CommentAssistantInboxResponse>(
      `${BASE}/inbox`,
      {
        params: {
          priority: params?.priority ?? 'needs_reply',
          refresh: params?.refresh ?? false,
          shell: params?.shell ?? false,
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
   * Must override aiApiClient's default application/json Content-Type or FastAPI
   * returns 422 (form fields never parse).
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
      form.append('attachment', payload.imageFile, payload.imageFile.name);
    }
    const { data } = await aiApiClient.post<{ success: boolean; comment_id?: string | null }>(
      `${BASE}/posts/${encodeURIComponent(socialId)}/comments/reply`,
      form,
      {
        // aiApiClient defaults to application/json; that makes FastAPI return 422 for FormData.
        // Drop Content-Type so the runtime sets multipart/form-data with boundary.
        headers: { 'Content-Type': undefined as unknown as string },
        transformRequest: [
          (body, headers) => {
            if (body instanceof FormData && headers) {
              delete (headers as Record<string, unknown>)['Content-Type'];
            }
            return body;
          },
        ],
      }
    );
    return data;
  },
};
