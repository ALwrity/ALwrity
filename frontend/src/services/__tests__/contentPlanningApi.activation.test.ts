/**
 * A4 (#2 + #3): activation wiring — the service must expose activateStrategy
 * that POSTs { strategy_id } to the mounted wizard route
 * /enhanced-strategies/strategy/activate. apiClient carries the
 * Authorization header, so auth passthrough is implied by using apiClient
 * (the clientChoice guard) rather than longRunningApiClient.
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

describe('contentPlanningApi — A4: activateStrategy', () => {
  it('declares async activateStrategy(strategyId: number)', () => {
    expect(apiSource).toMatch(
      /async\s+activateStrategy\(strategyId:\s*number\)\s*:\s*Promise<any>/,
    );
  });

  it('posts to the mounted wizard activate route', () => {
    expect(apiSource).toMatch(
      /enhanced-strategies\/strategy\/activate/,
    );
  });

  it('sends the strategy_id in the request body', () => {
    expect(apiSource).toMatch(/strategy_id:\s*strategyId/);
  });

  it('uses apiClient (auth header passthrough)', () => {
    expect(apiSource).toMatch(
      /apiClient\.post\(\s*`\$\{this\.baseURL\}\/enhanced-strategies\/strategy\/activate`,\s*\{\s*strategy_id:\s*strategyId\s*,?\s*\}\s*\)/,
    );
  });
});