/**
 * Phase C item 11 (#17/#43) — typed API error classification.
 *
 * handleRequest / pollStrategyGeneration previously threw plain Error objects
 * with a message but no classification, so callers could not differentiate
 * network / timeout / auth / validation / rate-limit / server failures — and
 * polling gave up on the first transport error instead of retrying the
 * retryable ones.
 *
 * These are REAL unit tests (the module is pure — no React, no axios import),
 * unlike the source-reading guard tests used for hook wiring.
 */
import { describe, it, expect } from 'vitest';
import { ApiError, classifyApiError, describeApiError } from '../apiError';

const axiosLike = (over: Record<string, any>) => ({ isAxiosError: true, ...over });

describe('classifyApiError', () => {
  it('classifies aborted/timeout requests as timeout (retryable)', () => {
    const err = classifyApiError(axiosLike({ code: 'ECONNABORTED', message: 'timeout of 5000ms exceeded' }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('timeout');
    expect(err.retryable).toBe(true);
  });

  it('classifies 401/403 as auth (not retryable)', () => {
    for (const status of [401, 403]) {
      const err = classifyApiError(axiosLike({
        response: { status, data: { detail: 'invalid token' } },
      }));
      expect(err.kind).toBe('auth');
      expect(err.retryable).toBe(false);
      expect(err.status).toBe(status);
      expect(err.message).toBe('invalid token');
    }
  });

  it('classifies 400/409/422 as validation (not retryable)', () => {
    for (const status of [400, 409, 422]) {
      const err = classifyApiError(axiosLike({
        response: { status, data: { detail: 'bad input' } },
      }));
      expect(err.kind).toBe('validation');
      expect(err.retryable).toBe(false);
    }
  });

  it('classifies 429 as rate_limit (retryable)', () => {
    const err = classifyApiError(axiosLike({ response: { status: 429, data: {} } }));
    expect(err.kind).toBe('rate_limit');
    expect(err.retryable).toBe(true);
  });

  it('classifies 5xx as server (retryable)', () => {
    for (const status of [500, 502, 503]) {
      const err = classifyApiError(axiosLike({ response: { status, data: {} } }));
      expect(err.kind).toBe('server');
      expect(err.retryable).toBe(true);
    }
  });

  it('classifies request-without-response as network (retryable)', () => {
    const err = classifyApiError(axiosLike({ request: {}, message: 'Network Error' }));
    expect(err.kind).toBe('network');
    expect(err.retryable).toBe(true);
  });

  it('classifies plain JS errors as unknown (not retryable)', () => {
    const err = classifyApiError(new Error('something else'));
    expect(err.kind).toBe('unknown');
    expect(err.retryable).toBe(false);
    expect(err.message).toBe('something else');
  });

  it('extracts detail from FastAPI-style error bodies', () => {
    const err = classifyApiError(axiosLike({
      response: { status: 422, data: { detail: 'Invalid strategy fields: team_size' } },
    }));
    expect(err.message).toContain('team_size');
  });
});

describe('describeApiError', () => {
  it('gives actionable copy per kind', () => {
    const auth = describeApiError(axiosLike({ response: { status: 401, data: {} } }), 'fallback');
    expect(auth).toMatch(/sign in/i);

    const network = describeApiError(axiosLike({ request: {} }), 'fallback');
    expect(network).toMatch(/connection/i);
  });

  it('falls back for unknown kinds', () => {
    expect(describeApiError(new Error('weird'), 'fallback message')).toBe('fallback message');
  });
});
