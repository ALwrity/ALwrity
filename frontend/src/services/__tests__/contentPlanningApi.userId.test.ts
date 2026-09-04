/**
 * Phase 2: Verify the contentPlanningApi.ts userId=1 fallback is removed.
 *
 * This test reads the source file and asserts the dangerous pattern
 * `userId || 1` no longer appears.  This is a lightweight guard that
 * catches regressions without needing to mock the full API class.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiSource = readFileSync(
  resolve(__dirname, '../contentPlanningApi.ts'),
  'utf-8',
);

describe('contentPlanningApi — Phase 2: userId || 1 pattern removed', () => {
  it('does NOT contain "userId || 1" anywhere in the source', () => {
    expect(apiSource).not.toContain('userId || 1');
  });

  it('does NOT contain "userId ?? 1" anywhere in the source', () => {
    expect(apiSource).not.toContain('userId ?? 1');
  });

  it('does NOT contain "|| 1}" or "|| 1 )"', () => {
    // Catches variations like `{ user_id: userId || 1 }`
    expect(apiSource).not.toMatch(/\|\|\s*1\s*[})\]]/);
  });
});
