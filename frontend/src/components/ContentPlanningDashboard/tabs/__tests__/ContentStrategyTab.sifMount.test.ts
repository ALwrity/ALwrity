/**
 * ContentStrategyTab — Semantic Index mount contract (moved).
 *
 * The Semantic Index card no longer renders on the Content Strategy tab
 * where it was buried below the strategy cards. It now lives behind the
 * "Semantic Dashboard" chip in the Content Planning Dashboard header
 * (see ContentPlanningDashboard.semanticChip.test.ts). These source-reading
 * assertions guard against the card silently being re-embedded here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tabSource = readFileSync(
  resolve(__dirname, '../ContentStrategyTab.tsx'),
  'utf-8',
);

describe('ContentStrategyTab — Semantic Index no longer mounted here', () => {
  it('does not import SemanticIndexCard', () => {
    expect(tabSource).not.toMatch(/import\s+SemanticIndexCard\s+from/);
  });

  it('does not import the SIF card feature-flag getter', () => {
    expect(tabSource).not.toMatch(/isStrategySifCardEnabled/);
  });

  it('does not render the SemanticIndexCard component', () => {
    expect(tabSource).not.toMatch(/<SemanticIndexCard\s*\/?>/);
  });
});