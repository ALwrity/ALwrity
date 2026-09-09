/**
 * The Strategy Intelligence view must present each section as an accordion:
 * single section open at a time, expanded IN PLACE (no grid-column jump), and
 * the card grid must carry no hover/focus full-width expansion heuristic
 * (`& > *:hover { zIndex: 10 }` on the grid wrapper).
 *
 * Card grid is vertically stacked: a strict single-column layout at every
 * breakpoint — each accordion card occupies the full row.
 *
 * Source-reading guard tests — same convention as the other tab tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tabSource = readFileSync(
  resolve(__dirname, '../StrategyIntelligenceTab.tsx'),
  'utf-8',
);

const CARDS = [
  'StrategicInsightsCard',
  'CompetitiveAnalysisCard',
  'PerformancePredictionsCard',
  'ImplementationRoadmapCard',
  'RiskAssessmentCard',
];

const cardSourceOf = (name: string): string =>
  readFileSync(resolve(__dirname, `../components/${name}.tsx`), 'utf-8');

describe('StrategyIntelligenceTab — single-open accordion sections', () => {
  it('tab source guard: card grid has no hover z-index heuristic', () => {
    expect(tabSource).not.toMatch(/'& > \*:hover'/);
  });

  it('tab owns an expandedSection accordion state wired to every card', () => {
    expect(tabSource).toMatch(/useState<string \| null>\(null\)/);
    expect(tabSource).toMatch(/expandedSection/);
    CARDS.forEach((card) => {
      expect(tabSource).toMatch(new RegExp(`<${card}`));
    });
    // One controlled expanded binding + one onToggle per section.
    const expandedBindings = tabSource.match(/expanded=\{expandedSection === /g) || [];
    const toggleBindings = tabSource.match(/onToggle=\{/g) || [];
    expect(expandedBindings.length).toBeGreaterThanOrEqual(5);
    expect(toggleBindings.length).toBeGreaterThanOrEqual(5);
  });

  it('no section card uses hover-triggered expansion', () => {
    CARDS.forEach((name) => {
      const cardSource = cardSourceOf(name);
      expect(cardSource, name).not.toMatch(/trigger="hover"/);
      expect(cardSource, name).not.toMatch(/autoCollapseDelay/);
    });
  });

  it('accordions stack full-width: card grid is single-column at every breakpoint', () => {
    // The wrapper holding the 5 section cards must never be a multi-column
    // grid (`repeat(2, 1fr)` / `repeat(3, 1fr)`); each accordion spans a full row.
    expect(tabSource).not.toMatch(/repeat\(2, 1fr\)/);
    expect(tabSource).not.toMatch(/repeat\(3, 1fr\)/);
    expect(tabSource).toMatch(/gridTemplateColumns:\s*'1fr'/);
  });
});