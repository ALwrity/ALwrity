/**
 * Phase 2: the service must expose getStrategySifStatus() that GETs the
 * Phase 1 read-only wizard route /enhanced-strategies/strategy/sif-status.
 * apiClient carries the Authorization header, so auth passthrough is implied
 * by using apiClient (the clientChoice guard) rather than longRunningApiClient.
 *
 * Source-reading test — lightweight, no mocking required (matches the
 * contentPlanningApi.activation.test.ts pattern for this module).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiSource = readFileSync(
  resolve(__dirname, '../contentPlanningApi.ts'),
  'utf-8',
);

describe('contentPlanningApi — Phase 2: getStrategySifStatus', () => {
  it('declares async getStrategySifStatus()', () => {
    expect(apiSource).toMatch(/async\s+getStrategySifStatus\(\)\s*:\s*Promise<any>/);
  });

  it('GETs the mounted wizard sif-status route', () => {
    expect(apiSource).toMatch(
      /enhanced-strategies\/strategy\/sif-status/,
    );
  });

  it('returns the data envelope (or null)', () => {
    expect(apiSource).toMatch(/response\.data\?\.data\s*\|\|\s*response\.data\s*\|\|\s*null/);
  });

  it('uses apiClient (auth header passthrough)', () => {
    expect(apiSource).toMatch(
      /apiClient\.get\(\s*`\$\{this\.baseURL\}\/enhanced-strategies\/strategy\/sif-status`\s*\)/,
    );
  });
});