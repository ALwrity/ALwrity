/**
 * The Brand Brain dashboard (full-page view) is gated by a feature flag that
 * must stay in parity with the backend predicate
 * ``services/intelligence/brand_brain_features.py``
 * (``BRAND_BRAIN_DASHBOARD_ENABLED``).
 *
 * Source-reading test — lightweight, no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const configSource = readFileSync(
  resolve(__dirname, '../../config/brandBrainConfig.ts'),
  'utf-8',
);

describe('brandBrainConfig — Phase 0: dashboard flag', () => {
  it('reads VITE_BRAND_BRAIN_DASHBOARD_ENABLED at module scope', () => {
    expect(configSource).toMatch(
      /import\.meta\.env\.VITE_BRAND_BRAIN_DASHBOARD_ENABLED/,
    );
  });

  it('defaults ON when the env var is unset', () => {
    expect(configSource).toMatch(/return true;/);
  });

  it('treats the same falsy values as the backend predicate', () => {
    expect(configSource).toMatch(/\["false",\s*"0",\s*"no",\s*"off"\]/);
  });

  it('exposes an isBrandBrainDashboardEnabled() getter', () => {
    expect(configSource).toMatch(/export function isBrandBrainDashboardEnabled\(\)/);
  });

  it('getter returns the flag constant', () => {
    expect(configSource).toMatch(/return\s+BRAND_BRAIN_DASHBOARD_ENABLED;\s*}/);
  });
});