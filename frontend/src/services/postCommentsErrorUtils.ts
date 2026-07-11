import { ConnectionError, NetworkError, RequestTimeoutError } from '../api/client';

export const POST_COMMENTS_MISSING_SOCIAL_ID =
  'This post cannot load comments. Re-sync analytics.';

export const POST_COMMENTS_NOT_CONNECTED =
  'Could not load comments. Connect LinkedIn and try again.';

export const POST_COMMENTS_UNAVAILABLE =
  'Post comments are unavailable. Please try again later.';

export type PostCommentsErrorType = 'not_connected' | 'missing_social_id' | 'generic';

interface ApiErrorDetail {
  message: string;
  errorCode?: string;
}

function extractApiDetail(detail: unknown): ApiErrorDetail {
  if (typeof detail === 'string') {
    return { message: detail.trim() };
  }
  if (detail && typeof detail === 'object') {
    const record = detail as { message?: string; error_code?: string };
    return {
      message: (record.message || '').trim(),
      errorCode: record.error_code,
    };
  }
  return { message: '' };
}

/** Map post-comments API failures to user-friendly messages. */
export function getPostCommentsErrorMessage(err: unknown): string {
  if (err instanceof RequestTimeoutError) {
    return 'Loading comments is taking longer than expected. Please try again.';
  }

  if (err instanceof NetworkError) {
    return 'Cannot reach the ALwrity server. Check that the backend is running and try again.';
  }

  if (err instanceof ConnectionError) {
    return err.message || 'Backend server is experiencing issues. Please try again later.';
  }

  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: { status?: number; data?: { detail?: unknown } };
    };
    const status = axiosErr.response?.status;
    const { message: detailText, errorCode } = extractApiDetail(axiosErr.response?.data?.detail);
    const lowerDetail = detailText.toLowerCase();

    if (errorCode === 'NOT_CONNECTED' || status === 403) {
      return POST_COMMENTS_NOT_CONNECTED;
    }

    if (errorCode === 'RECONNECT_REQUIRED' || status === 401) {
      return 'Your LinkedIn session expired. Please reconnect and try again.';
    }

    if (errorCode === 'RATE_LIMITED' || status === 429) {
      return 'LinkedIn comment rate limit reached. Please try again shortly.';
    }

    if (errorCode === 'PROVIDER_NOT_AVAILABLE' || status === 503) {
      return POST_COMMENTS_UNAVAILABLE;
    }

    if (errorCode === 'POST_NOT_FOUND' || status === 404) {
      return 'Post or comments not found. Re-sync analytics and try again.';
    }

    if (errorCode === 'VALIDATION_ERROR' || status === 400) {
      return detailText || 'Invalid comment request. Please check your input and try again.';
    }

    if (status === 502) {
      return 'Unable to load comments from LinkedIn. Please try again.';
    }

    if (lowerDetail.includes('not connected')) {
      return POST_COMMENTS_NOT_CONNECTED;
    }

    if (lowerDetail.includes('disconnected') || lowerDetail.includes('reconnect')) {
      return 'Your LinkedIn session expired. Please reconnect and try again.';
    }

    if (detailText) return detailText;
  }

  if (err instanceof Error && err.message) return err.message;
  return POST_COMMENTS_NOT_CONNECTED;
}

/** Map reply failures — same rules, reply-specific default fallback. */
export function getPostCommentsReplyErrorMessage(err: unknown): string {
  const message = getPostCommentsErrorMessage(err);
  if (message === POST_COMMENTS_NOT_CONNECTED) {
    return 'Could not post reply. Connect LinkedIn and try again.';
  }
  return message;
}

/** Classify comment errors for UI treatment (connect CTA, re-sync hint, etc.). */
export function getPostCommentsErrorType(
  err: unknown,
  connected: boolean
): PostCommentsErrorType | null {
  if (!connected) return 'not_connected';

  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: { status?: number; data?: { detail?: unknown } };
    };
    const status = axiosErr.response?.status;
    const { errorCode, message } = extractApiDetail(axiosErr.response?.data?.detail);
    const lower = message.toLowerCase();

    if (
      errorCode === 'NOT_CONNECTED' ||
      status === 403 ||
      errorCode === 'RECONNECT_REQUIRED' ||
      status === 401
    ) {
      return 'not_connected';
    }

    if (lower.includes('not connected') || lower.includes('reconnect')) {
      return 'not_connected';
    }
  }

  return 'generic';
}
