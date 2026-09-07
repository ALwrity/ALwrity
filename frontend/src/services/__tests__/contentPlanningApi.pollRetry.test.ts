/**
 * Phase C item 11 (#18/#43) — polling retry with exponential backoff.
 *
 * pollStrategyGeneration previously called onError and gave up on the FIRST
 * transport error (one flaky request killed a 6-minute generation). The fix
 * adds bounded retries with exponential backoff for retryable error kinds
 * (network/timeout/rate_limit/server), without burning the attempt budget on
 * transport failures.
 *
 * Source-reading guard test — same convention as pollCancellation tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiSource = readFileSync(
  resolve(__dirname, '../../services/contentPlanningApi.ts'),
  'utf-8',
);

describe('contentPlanningApi — Phase C #18/#43: polling retry with backoff', () => {
  it('accepts retry options (maxRetries, baseDelayMs) with sane defaults', () => {
    expect(apiSource).toMatch(/retryOptions\??:\s*\{\s*maxRetries\??:\s*number;\s*baseDelayMs\??:\s*number\s*\}/);
    expect(apiSource).toMatch(/maxRetries\s*\?\?\s*3/);
    expect(apiSource).toMatch(/baseDelayMs\s*\?\?\s*2000/);
  });

  it('tracks consecutive failures and resets on success', () => {
    expect(apiSource).toMatch(/consecutiveFailures/);
    expect(apiSource).toMatch(/consecutiveFailures\s*=\s*0;/);
  });

  it('backs off exponentially with a cap', () => {
    expect(apiSource).toMatch(/2\s*\*\*\s*\(?\s*consecutiveFailures/);
    expect(apiSource).toMatch(/30000/);
  });

  it('only retries retryable error kinds via classifyApiError', () => {
    expect(apiSource).toMatch(/classifyApiError/);
    expect(apiSource).toMatch(/apiErr\.retryable/);
  });

  it('does not burn the attempt budget on transport retries', () => {
    expect(apiSource).toMatch(/attempts--/);
  });
});
