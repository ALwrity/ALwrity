/**
 * MainDashboard — Brand Brain entry chip contract (Phase 3).
 *
 * The SIF health chip is repurposed as the "Brand Brain" navigation chip:
 * when the feature flag is on it keeps its health-state coloring/labels but
 * is renamed and, when clicked, routes to /brand-brain. Dave-field wiring
 * mirrors the ContentPlanningDashboard semanticChip contract — lightweight
 * source-reading, no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const dashboardSource = readFileSync(
  resolve(__dirname, '../MainDashboard.tsx'),
  'utf-8',
);
const typesSource = readFileSync(
  resolve(__dirname, '../../shared/types.ts'),
  'utf-8',
);

describe('MainDashboard — Brand Brain entry chip', () => {
  it('imports the Brand Brain feature-flag getter', () => {
    expect(dashboardSource).toMatch(/import\s*{\s*isBrandBrainDashboardEnabled\s*}\s*from\s*['"]\.\.\/\.\.\/config\/brandBrainConfig['"]/);
  });

  it('navigates to /brand-brain when the chip is clicked', () => {
    expect(dashboardSource).toMatch(/navigate\(['"]\/brand-brain['"]\)/);
  });

  it('renames the SIF chip prefix to "Brand Brain" when enabled', () => {
    expect(dashboardSource).toMatch(/Brand Brain/);
    expect(dashboardSource).toMatch(/sifPrefix\s*=\s*brandBrainEnabled\s*\?\s*'Brand Brain'\s*:\s*'SIF Index'/);
  });

  it('keeps the health-state coloring and Storage icon', () => {
    expect(dashboardSource).toMatch(/<Storage sx=\{\{ color: '#9e9e9e' \}\} \/>/);
    expect(dashboardSource).toMatch(/#22c55e/);
    expect(dashboardSource).toMatch(/#f59e0b/);
    expect(dashboardSource).toMatch(/#ef4444/);
  });

  it('tags the clickable chip for tests', () => {
    expect(dashboardSource).toMatch(/testId: 'brand-brain-chip'/);
  });

  it('supports clickable chips with a test id in the shared header contract', () => {
    expect(typesSource).toMatch(/onClick\?: \(\) => void/);
    expect(typesSource).toMatch(/testId\?: string/);
    expect(dashboardSource).toMatch(/openBrandBrain = useCallback\(\(\) => navigate\('\/brand-brain'\), \[navigate\]\)/);
  });

  it('reverts to an inert "SIF Index" chip when the flag is off', () => {
    expect(dashboardSource).toMatch(/brandBrainChipProps\s*=\s*brandBrainEnabled\s*\?\s*\{\s*onClick: openBrandBrain,\s*testId: 'brand-brain-chip'\s*\}\s*:\s*\{\}/);
  });

  it('gates the chip on the route feature entitlement as well (Phase 7 P0)', () => {
    // FeatureRoute /brand-brain requires the feature entitlement; a chip that
    // only checks the env flag would dead-end on a redirect in feature-only
    // deployments. The chip must combine both gates.
    expect(dashboardSource).toMatch(/import\s*{\s*FEATURE_KEYS,\s*isFeatureEnabled\s*}\s*from\s*['"]\.\.\/\.\.\/utils\/demoMode['"]/);
    expect(dashboardSource).toMatch(/brandBrainEnabled\s*=\s*isBrandBrainDashboardEnabled\(\)\s*&&\s*isFeatureEnabled\(FEATURE_KEYS\.BRAND_BRAIN\)/);
  });
});