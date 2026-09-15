/**
 * App.tsx — /brand-brain route contract (Phase 3).
 *
 * The Brand Brain dashboard is a lazy-loaded protected page gated behind the
 * "brand-brain" feature key, mirroring the scheduler dashboard route pattern.
 * Lightweight source-reading test — no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const appSource = readFileSync(
  resolve(__dirname, '../App.tsx'),
  'utf-8',
);

describe('App — Brand Brain route', () => {
  it('lazy-loads the BrandBrainDashboard page', () => {
    expect(appSource).toMatch(/const BrandBrainDashboard = React\.lazy\(\(\) => import\(['"]\.\/pages\/BrandBrainDashboard['"]\)\)/);
  });

  it('registers /brand-brain behind ProtectedRoute + FeatureRoute', () => {
    expect(appSource).toMatch(/path="\/brand-brain"/);
    expect(appSource).toMatch(/<ProtectedRoute><FeatureRoute feature="brand-brain"><BrandBrainDashboard \/><\/FeatureRoute><\/ProtectedRoute>/);
  });
});