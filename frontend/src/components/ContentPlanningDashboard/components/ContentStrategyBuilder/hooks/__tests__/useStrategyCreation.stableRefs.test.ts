/**
 * Phase B #29: useStrategyCreation previously wrapped the ActionButtons hook
 * functions in arrows on every return, giving a fresh function identity each
 * render. That broke downstream ref/effect deps (useModalManagement's
 * originalHandleCreateStrategyRef sync) and produced unstable refs.
 *
 * Also guards Phase B #10: the stale setShowEnterpriseModal debug setTimeout
 * must not live in ContentStrategyBuilder's handleCreateStrategy.
 *
 * Source-reading test — lightweight, no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const creationSource = readFileSync(
  resolve(__dirname, '../useStrategyCreation.ts'),
  'utf-8',
);
const builderSource = readFileSync(
  resolve(__dirname, '../../../ContentStrategyBuilder.tsx'),
  'utf-8',
);

describe('Phase B #29: stable function references', () => {
  it('returns originalHandleCreateStrategy directly, not arrow-wrapped', () => {
    expect(creationSource).toMatch(/return\s*\{[\s\S]*?originalHandleCreateStrategy\s*[,}]/);
    expect(creationSource).not.toMatch(/originalHandleCreateStrategy:\s*\(\s*\)\s*=>/);
  });

  it('returns handleSaveStrategy directly, not arrow-wrapped', () => {
    expect(creationSource).toMatch(/return\s*\{[\s\S]*?handleSaveStrategy\s*[,}]/);
    expect(creationSource).not.toMatch(/handleSaveStrategy:\s*\(\s*\)\s*=>/);
  });
});

describe('Phase B #10: no dead setTimeout logging', () => {
  it('does not debug-log the enterprise modal via a dead setTimeout', () => {
    expect(builderSource).not.toMatch(/setTimeout\([\s\S]*?Enterprise modal state after setShowEnterpriseModal/);
  });
});
