/**
 * Phase SIF-Search: the service must expose searchStrategySif() that GETs
 * the wizard route /enhanced-strategies/strategy/sif-search with the
 * query + limit as params. apiClient carries the Authorization header, so
 * auth passthrough is implied (the clientChoice guard), matching the
 * getStrategySifStatus pattern.
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

describe('contentPlanningApi — Phase SIF-Search: searchStrategySif', () => {
  it('declares async searchStrategySif(query, limit)', () => {
    expect(apiSource).toMatch(
      /async\s+searchStrategySif\(\s*query:\s*string,\s*limit:\s*number\s*=\s*4\s*\)\s*:\s*Promise<any>/,
    );
  });

  it('GETs the mounted wizard sif-search route', () => {
    expect(apiSource).toMatch(
      /enhanced-strategies\/strategy\/sif-search/,
    );
  });

  it('passes query + limit as query params', () => {
    expect(apiSource).toMatch(
      /params:\s*\{\s*query,\s*limit\s*\}/,
    );
  });

  it('returns the data envelope (or null)', () => {
    expect(apiSource).toMatch(
      /response\.data\?\.data\s*\|\|\s*response\.data\s*\|\|\s*null/,
    );
  });
});