/**
 * Safe API error parsing for Engagement Since You Joined ALwrity (Phase 4).
 * Never render raw objects in the UI.
 */

import { EMPTY_COPY } from './engagementTrendsCopy';

export function extractEngagementTrendsErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: {
      status?: number;
      data?: { detail?: string | { message?: string; error_code?: string } };
    };
  };
  const detail = axiosErr.response?.data?.detail;
  const status = axiosErr.response?.status;
  let errorCode: string | undefined;
  let message: string | undefined;

  if (typeof detail === 'string' && detail.trim()) {
    message = detail;
  } else if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string' && detail.message.trim()) {
      message = detail.message;
    }
    if (typeof detail.error_code === 'string') {
      errorCode = detail.error_code;
    }
  } else if (err instanceof Error && err.message) {
    message = err.message;
  }

  if (status || errorCode) {
    // Safe debug trail only — no post bodies / PII.
    // eslint-disable-next-line no-console
    console.warn('[EngagementTrends]', { status, error_code: errorCode ?? null });
  }

  return message?.trim() || EMPTY_COPY.loadErrorFallback;
}
