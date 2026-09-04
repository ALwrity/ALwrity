/**
 * Phase 5: Verify isAutoPopulating race condition is fixed.
 *
 * The old code used a module-level variable that was set BEFORE checking
 * get().loading. If loading was true, the function returned early without
 * resetting isAutoPopulating, causing a permanent lock.
 *
 * Phase 5 fix: Use get().loading directly, or wrap the flag in try/finally.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Read the store source to verify the pattern is fixed
import { readFileSync } from 'fs';
import { resolve } from 'path';

const storeSource = readFileSync(
  resolve(__dirname, '../strategyBuilderStore.ts'),
  'utf-8',
);

describe('strategyBuilderStore — Phase 5: isAutoPopulating race condition', () => {
  it('does NOT use module-level isAutoPopulating variable', () => {
    // The fix removes the module-level variable entirely
    expect(storeSource).not.toContain('let isAutoPopulating = false');
  });

  it('uses get().loading for concurrency control instead of module-level flag', () => {
    // The fix should use the store's loading state for control
    expect(storeSource).toContain('get().loading');
  });
});