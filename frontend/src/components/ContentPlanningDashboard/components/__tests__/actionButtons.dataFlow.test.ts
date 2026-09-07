/**
 * Phase D items 14/15/16 (#12 #15 #13 #16): data-flow consistency.
 *
 * #12: Create (polling) sent raw `formData` while Save sent an enriched
 * spread — two different payloads for the same form. Now ONE
 * `buildStrategyPayload()` builder is shared by both paths.
 * #15: autofill/personalization metadata (autoPopulatedFields, dataSources,
 * inputDataPoints, personalizationData, confidenceScores) was never sent —
 * it now rides along as `data_source_transparency`.
 * #13: `formData.id` is the form-state id (NOT a backend strategy id); it is
 * stripped from payloads and its misleading console.log removed.
 * #16: after Save the create response lacks backend-populated fields
 * (comprehensive_ai_analysis, ai_recommendations) — the saved strategy is
 * re-read via getEnhancedStrategy before being surfaced.
 *
 * Source-reading guard test — same convention as actionButtons.inflight tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const buttonsSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/components/ActionButtons.tsx'),
  'utf-8',
);

describe('Phase D item 14 (#12/#15): one shared payload builder', () => {
  it('defines buildStrategyPayload and uses it in both paths', () => {
    expect(buttonsSource).toMatch(/const buildStrategyPayload = \(\)/);
    // Create path
    expect(buttonsSource).toMatch(/const strategyData = buildStrategyPayload\(\);/);
  });

  it('includes the autofill/personalization metadata (#15)', () => {
    expect(buttonsSource).toMatch(/data_source_transparency:\s*\{/);
    expect(buttonsSource).toMatch(/auto_populated_fields:/);
    expect(buttonsSource).toMatch(/personalization_data:/);
  });
});

describe('Phase D item 15 (#13): strip the form-state id', () => {
  it('destructures the id out of the payload', () => {
    expect(buttonsSource).toMatch(/id:\s*_formStateId/);
  });

  it('no longer logs the misleading FormData ID', () => {
    expect(buttonsSource).not.toMatch(/FormData ID/);
  });
});

describe('Phase D item 16 (#16): reload after save', () => {
  it('re-reads the saved strategy to get backend-populated fields', () => {
    expect(buttonsSource).toMatch(/getEnhancedStrategy\(/);
  });
});
