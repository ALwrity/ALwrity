import { aiApiClient } from '../api/client';
import type {
  PostCommentReplyRequest,
  PostCommentReplyResponse,
  PostCommentsListResponse,
} from '../components/LinkedInWriter/components/dashboard/postCommentsTypes';

export {
  getPostCommentsErrorMessage,
  getPostCommentsReplyErrorMessage,
  getPostCommentsErrorType,
  POST_COMMENTS_MISSING_SOCIAL_ID,
  POST_COMMENTS_NOT_CONNECTED,
  POST_COMMENTS_UNAVAILABLE,
} from './postCommentsErrorUtils';
export type { PostCommentsErrorType } from './postCommentsErrorUtils';

const BASE = '/api/linkedin/post-analytics';

export const postCommentsApi = {
  /** List comments for a post (Unipile social_id), or replies when commentId is set. */
  async fetchPostComments(
    socialId: string,
    params?: { cursor?: string; limit?: number; commentId?: string }
  ): Promise<PostCommentsListResponse> {
    const { commentId, ...rest } = params ?? {};
    const { data } = await aiApiClient.get<PostCommentsListResponse>(
      `${BASE}/posts/${encodeURIComponent(socialId)}/comments`,
      {
        params: {
          ...rest,
          ...(commentId ? { comment_id: commentId } : {}),
        },
      }
    );
    return data;
  },

  /** Reply to a comment on a post. */
  async replyToComment(
    socialId: string,
    request: PostCommentReplyRequest
  ): Promise<PostCommentReplyResponse> {
    const { data } = await aiApiClient.post<PostCommentReplyResponse>(
      `${BASE}/posts/${encodeURIComponent(socialId)}/comments/reply`,
      request
    );
    return data;
  },
};
