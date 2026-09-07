/**
 * Typed API error classification (Phase C #17/#43).
 *
 * Callers previously received plain `Error` objects with a message but no
 * classification, so they could not differentiate network / timeout / auth /
 * validation / rate-limit / server failures — and retry logic could not tell
 * which failures are transient. This module is the single source of truth for
 * that classification and for turning it into actionable user-facing copy.
 */

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'validation'
  | 'rate_limit'
  | 'server'
  | 'unknown';

const RETRYABLE_KINDS: ReadonlySet<ApiErrorKind> = new Set([
  'network',
  'timeout',
  'rate_limit',
  'server',
]);

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.retryable = RETRYABLE_KINDS.has(kind);
  }
}

const extractDetail = (data: any): string | undefined => {
  const detail = data?.detail ?? data?.message ?? data?.error;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object') {
    try {
      return JSON.stringify(detail);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

/**
 * Classify any thrown value (axios error, plain Error, unknown) into an
 * ApiError with a stable kind + retryability flag. The original message is
 * preserved whenever it exists.
 */
export function classifyApiError(error: any): ApiError {
  // Already classified — pass through.
  if (error instanceof ApiError) return error;

  const response = error?.response;
  const status: number | undefined = response?.status;

  if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message ?? '')) {
    return new ApiError(error?.message || 'Request timed out', 'timeout');
  }

  if (response) {
    const detail = extractDetail(response.data);
    if (status === 401 || status === 403) {
      return new ApiError(detail || 'Authentication required', 'auth', status);
    }
    if (status === 429) {
      return new ApiError(detail || 'Too many requests', 'rate_limit', status);
    }
    if (typeof status === 'number' && status >= 500) {
      return new ApiError(detail || 'Server error', 'server', status);
    }
    if (typeof status === 'number' && status >= 400) {
      return new ApiError(detail || error?.message || 'Invalid request', 'validation', status);
    }
  }

  if (error?.request) {
    return new ApiError(error?.message || 'No response from server', 'network');
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 'unknown');
  }

  return new ApiError(String(error ?? 'An unexpected error occurred'), 'unknown');
}

/**
 * Turn a classified error into actionable, human-facing copy. Falls back to
 * the provided default for `unknown` kinds (raw error text is too noisy for
 * end users).
 */
export function describeApiError(error: any, fallback: string): string {
  const apiErr = classifyApiError(error);
  switch (apiErr.kind) {
    case 'auth':
      return 'Your session expired. Please sign in again, then retry.';
    case 'network':
      return 'Connection problem. Check your internet connection, then retry.';
    case 'timeout':
      return 'The request timed out. Please retry.';
    case 'rate_limit':
      return 'Too many requests. Please wait a moment, then retry.';
    case 'validation':
      return `Invalid input: ${apiErr.message}`;
    case 'server':
      return `Server error: ${apiErr.message || 'please retry shortly.'}`;
    default:
      return fallback;
  }
}
