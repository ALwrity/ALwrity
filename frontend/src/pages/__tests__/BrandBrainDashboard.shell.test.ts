/**
 * BrandBrainDashboard — page-shell contract (extended through Phase 6).
 *
 * The /brand-brain page is a terminal-themed scaffold (SchedulerDashboard
 * parity) that wires the aggregate data layer + every Phase 3–5 section
 * component (Identity Overview, Canonical Profile viewer, SIF health strip,
 * Semantic Query) and gates the whole surface on the Phase 6 feature flag.
 * Lightweight source-reading test — no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pageSource = readFileSync(
  resolve(__dirname, '../BrandBrainDashboard.tsx'),
  'utf-8',
);

describe('BrandBrainDashboard — page shell', () => {
  it('default-exports the dashboard component', () => {
    expect(pageSource).toMatch(/export default BrandBrainDashboard/);
  });

  it('uses the terminal theme scaffold (SchedulerDashboard parity)', () => {
    expect(pageSource).toMatch(/TerminalContainer/);
    expect(pageSource).toMatch(/TerminalHeader/);
    expect(pageSource).toMatch(/TerminalAlert/);
    expect(pageSource).toMatch(/HeaderControls/);
    expect(pageSource).toMatch(/fontFamily: '"Courier New", "Monaco", "Consolas", "Fira Code", monospace'/);
  });

  it('wires the aggregate data layer (hook)', () => {
    expect(pageSource).toMatch(/import\s*{\s*useBrandBrainDashboard\s*}\s*from\s*['"]\.\.\/hooks\/useBrandBrainDashboard['"]/);
  });

  it('gates the whole surface on the feature flag (Phase 6)', () => {
    expect(pageSource).toMatch(/import\s*{\s*isBrandBrainDashboardEnabled\s*}\s*from\s*['"]\.\.\/config\/brandBrainConfig['"]/);
    expect(pageSource).toMatch(/useBrandBrainDashboard\(enabled\)/);
    expect(pageSource).toMatch(/Brand Brain dashboard is currently disabled/);
  });

  it('wires every Brand Brain section component (Phases 3–5)', () => {
    expect(pageSource).toMatch(/IdentityOverview/);
    expect(pageSource).toMatch(/CanonicalProfileView/);
    expect(pageSource).toMatch(/SifIndexHealthStrip/);
    expect(pageSource).toMatch(/SemanticQuery/);
  });

  it('renders honest loading and error states', () => {
    expect(pageSource).toMatch(/CircularProgress/);
    expect(pageSource).toMatch(/TerminalAlert severity="error"/);
  });

  it('wraps every section in a component error boundary (Phase 7 P1)', () => {
    expect(pageSource).toMatch(/import ComponentErrorBoundary from ['"]\.\.\/components\/shared\/ComponentErrorBoundary['"]/);
    const names = [...pageSource.matchAll(/componentName="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual([
      'Identity Overview',
      'Canonical Profile View',
      'Sif Health Strip',
      'Semantic Query',
      'Coming Soon Strip',
    ]);
  });
});