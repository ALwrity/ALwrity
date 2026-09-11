/**
 * ContentPlanningDashboard — "Semantic Dashboard" header chip contract.
 *
 * The Semantic Index card lives behind a chip in the Content Planning
 * Dashboard header (it no longer renders on the Content Strategy tab).
 * This source-reading test verifies the chip is wired to a right-side
 * drawer that renders SemanticIndexCard and is gated by the SIF card
 * feature flag. Lightweight — no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const dashboardSource = readFileSync(
  resolve(__dirname, '../ContentPlanningDashboard.tsx'),
  'utf-8',
);

describe('ContentPlanningDashboard — Semantic Dashboard chip', () => {
  it('imports the SemanticIndexCard component', () => {
    expect(dashboardSource).toMatch(/import\s+SemanticIndexCard\s+from\s+['"]\.\/components\/SemanticIndexCard['"]/);
  });

  it('imports the SIF card feature-flag getter', () => {
    expect(dashboardSource).toMatch(/import\s*{\s*isStrategySifCardEnabled\s*}\s*from\s*['"]\.\.\/\.\.\/config\/strategySifConfig['"]/);
  });

  it('renders a "Semantic Dashboard" chip in the header gated by the flag', () => {
    expect(dashboardSource).toMatch(/isStrategySifCardEnabled\(\)\s*&&\s*\(/);
    expect(dashboardSource).toMatch(/Semantic Dashboard/);
    expect(dashboardSource).toMatch(/data-testid="semantic-dashboard-chip"/);
  });

  it('opens a drawer that renders SemanticIndexCard', () => {
    expect(dashboardSource).toMatch(/semanticDrawerOpen/);
    expect(dashboardSource).toMatch(/<SemanticIndexCard\s*\/>/);
  });
});