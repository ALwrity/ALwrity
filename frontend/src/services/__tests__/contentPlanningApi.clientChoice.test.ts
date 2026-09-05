/**
 * Regression guard: the /content-planning route must use apiClient (which
 * has the /content-planning 401 guard in client.ts:448-479), NOT
 * longRunningApiClient (which would sign the user out on any 401 and
 * cause the "Create Content Strategy → landing → dashboard → CTA → 401
 * → landing" loop).
 *
 * Source-reading test — lightweight, no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiSource = readFileSync(
  resolve(__dirname, '../contentPlanningApi.ts'),
  'utf-8',
);

describe('contentPlanningApi — client choice regression', () => {
  it('does NOT import longRunningApiClient', () => {
    // Switching this client breaks the /content-planning 401 guard and
    // creates a sign-out redirect loop.
    expect(apiSource).not.toMatch(/import\s*\{[^}]*\blongRunningApiClient\b/);
  });

  it('does NOT call longRunningApiClient.get/post/put/delete', () => {
    expect(apiSource).not.toMatch(/longRunningApiClient\.(get|post|put|delete)/);
  });

  it('imports apiClient', () => {
    expect(apiSource).toMatch(/import\s*\{[^}]*\bapiClient\b[^}]*\}\s*from/);
  });
});
