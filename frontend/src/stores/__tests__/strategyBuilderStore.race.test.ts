/**
 * Verify autofill/regenerate concurrency control cannot enter a runaway
 * loop or permanent lock.
 *
 * History:
 * - Phase 5: isAutoPopulating was set BEFORE checking get().loading, so an
 *   early return under loading permanently locked autofill.
 * - Runaway-loop fix: store-level `loading` alone proved unreliable across
 *   re-renders (the check-then-set window let concurrent calls through and
 *   the console flooded). The shipped design uses dedicated module-level
 *   flags (autofillLoading / regenerateAILoading), set immediately before
 *   the async work and reset in `finally` — so concurrent calls are
 *   skipped and the flag can never leak on error paths.
 *
 * This test pins the CURRENT design: module-level flags + finally reset.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const storeSource = readFileSync(
  resolve(__dirname, '../strategyBuilderStore.ts'),
  'utf-8',
);

describe('strategyBuilderStore — autofill concurrency control', () => {
  it('does NOT use the old isAutoPopulating flag (permanent-lock pattern)', () => {
    expect(storeSource).not.toContain('let isAutoPopulating = false');
  });

  it('uses dedicated module-level flags for autofill and regenerate', () => {
    expect(storeSource).toContain('let autofillLoading = false');
    expect(storeSource).toContain('let regenerateAILoading = false');
  });

  it('checks the flag before starting work (skip concurrent calls)', () => {
    expect(storeSource).toMatch(/autofillStrategyFields[\s\S]*?if \(autofillLoading\)/);
    expect(storeSource).toMatch(/regenerateAIFields[\s\S]*?if \(regenerateAILoading\)/);
  });

  it('resets the flags in finally blocks (no permanent lock on error)', () => {
    expect(storeSource).toMatch(/finally\s*\{[\s\S]*?autofillLoading = false/);
    expect(storeSource).toMatch(/finally\s*\{[\s\S]*?regenerateAILoading = false/);
  });
});
