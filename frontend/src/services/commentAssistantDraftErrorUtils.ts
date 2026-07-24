import { ConnectionError, NetworkError, RequestTimeoutError } from '../api/client';

export const COMMENT_ASSISTANT_DRAFT_NOT_CONNECTED =
  'Connect LinkedIn to use Comment Assistant.';

export const COMMENT_ASSISTANT_DRAFT_SUBSCRIPTION_LIMIT =
  'You have reached your AI usage limit. Please upgrade your plan to continue.';

export type CommentAssistantDraftErrorType =
  | 'not_connected'
  | 'subscription_limit'
  | 'validation'
  | 'generic';

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

/** Map Comment Assistant draft-reply failures to user-friendly messages. */
export function getCommentAssistantDraftErrorMessage(err: unknown): string {
  if (err instanceof RequestTimeoutError) {
    return 'Drafting is taking longer than expected. Please try again.';
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
    const { message: detailText, errorCode } = extractApiDetail(
      axiosErr.response?.data?.detail
    );
    const lowerDetail = detailText.toLowerCase();

    if (errorCode === 'NOT_CONNECTED' || status === 403) {
      return COMMENT_ASSISTANT_DRAFT_NOT_CONNECTED;
    }

    if (errorCode === 'RECONNECT_REQUIRED' || status === 401) {
      return 'Your LinkedIn session expired. Please reconnect and try again.';
    }

    if (errorCode === 'SUBSCRIPTION_LIMIT' || status === 429) {
      return COMMENT_ASSISTANT_DRAFT_SUBSCRIPTION_LIMIT;
    }

    if (errorCode === 'VALIDATION_ERROR' || status === 400 || status === 422) {
      return (
        detailText || 'We need both your post and the comment to draft a reply.'
      );
    }

    if (errorCode === 'LLM_ERROR' || status === 502) {
      return 'ALwrity could not draft a reply right now. Please try again.';
    }

    if (lowerDetail.includes('not connected')) {
      return COMMENT_ASSISTANT_DRAFT_NOT_CONNECTED;
    }

    if (lowerDetail.includes('subscription') || lowerDetail.includes('rate limit')) {
      return COMMENT_ASSISTANT_DRAFT_SUBSCRIPTION_LIMIT;
    }

    if (detailText) return detailText;
  }

  if (err instanceof Error && err.message && !err.message.includes('[object Object]')) {
    return err.message;
  }

  return 'ALwrity could not draft a reply right now. Please try again.';
}

/** Classify draft errors for UI treatment (connect CTA, upgrade CTA, etc.). */
export function getCommentAssistantDraftErrorType(
  err: unknown
): CommentAssistantDraftErrorType | null {
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

    if (errorCode === 'SUBSCRIPTION_LIMIT' || status === 429) {
      return 'subscription_limit';
    }

    if (
      errorCode === 'VALIDATION_ERROR' ||
      status === 400 ||
      status === 422
    ) {
      return 'validation';
    }

    if (lower.includes('not connected') || lower.includes('reconnect')) {
      return 'not_connected';
    }
  }

  return 'generic';
}
