/**
 * Phase B #7: pollStrategyGeneration must be cancellable — it accepts an
 * optional AbortSignal, guards each poll against a stopped state, and clears
 * the pending setTimeout when aborted. Without this, the recursive timer
 * keeps firing after the component unmounts mid-generation (setState-after-
 * unmount warnings + a leaked poll loop).
 *
 * Source-reading test — lightweight, no mocking required (matches the
 * clientChoice.userId guard pattern for this module).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiSource = readFileSync(
  resolve(__dirname, '../contentPlanningApi.ts'),
  'utf-8',
);

describe('contentPlanningApi — Phase B #7: polling cancellation', () => {
  it('pollStrategyGeneration accepts an optional AbortSignal', () => {
    expect(apiSource).toMatch(/signal\??:\s*AbortSignal/);
  });

  it('clears the pending poll timer when aborted', () => {
    expect(apiSource).toMatch(/clearTimeout\(pollTimer\)/);
  });

  it('skips startup when the signal is already aborted', () => {
    expect(apiSource).toMatch(/signal\.aborted/);
  });

  it('stops the poll loop once stopped', () => {
    expect(apiSource).toMatch(/if\s*\(\s*stopped\s*\)\s*return/);
  });
});