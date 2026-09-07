/**
 * Phase E item 17 (#21/#22): the modal derived "Step X of 8" from
 * Math.ceil(progress / 10) — it mislabels phases because the 0-100 progress
 * number is NOT the step number. The backend streams its real numeric `step`
 * (1..8) on every poll; the modal must render THAT as the single source of
 * progress truth, and must not fabricate content before the first poll.
 *
 * Also #21: the completion CTA ("Next: Review Strategy and Create Calendar")
 * appears without explanation — the modal must say what the button will do,
 * and #23: the modal is the single progress surface (the Create button must
 * not race it with its own "Creating..." copy).
 *
 * Source-reading guard test — same convention as the other builder tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const modalSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/components/EducationalModal.tsx'),
  'utf-8',
);
const buttonsSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/components/ActionButtons.tsx'),
  'utf-8',
);
const storeSource = readFileSync(
  resolve(__dirname, '../../../../stores/enhancedStrategyStore.ts'),
  'utf-8',
);

describe('Phase E #22: step derived from the backend step field', () => {
  it('modal derives the step label from currentStep, not progress/10', () => {
    expect(modalSource).toMatch(/currentStep/);
    expect(modalSource).not.toMatch(/Math\.ceil\(generationProgress\s*\/\s*10\)/);
  });

  it('exposes the backend step in the store (generationStep — NOT the progressive-disclosure currentStep)', () => {
    expect(storeSource).toMatch(/generationStep:\s*number/);
    expect(storeSource).toMatch(/setGenerationStep:\s*\(step:\s*number\)\s*=>\s*void/);
    expect(storeSource).toMatch(/setGenerationStep:\s*\(step:\s*number\)\s*=>\s*set\(\{\s*generationStep:\s*step/);
  });

  it('ActionButtons tracks the backend step on every poll', () => {
    expect(buttonsSource).toMatch(/setCurrentStep\?\.\(/);
  });
});

describe('Phase E #22b: no fabricated content before the first poll', () => {
  it('drops the hardcoded detail checklist / time estimate', () => {
    expect(buttonsSource).not.toMatch(/🔧 Setting up AI services/);
    expect(buttonsSource).not.toMatch(/estimated_time: '2-3 minutes total'/);
  });
});

describe('Phase E #21: the completion CTA is explained', () => {
  it('says what Next will do when generation is complete', () => {
    expect(modalSource).toMatch(/Your strategy is ready/);
    expect(modalSource).toMatch(/review it and create your content calendar/i);
  });
});

describe('Phase E #23: the modal is the single progress surface', () => {
  it('button no longer claims "Creating..." while the modal owns progress', () => {
    expect(buttonsSource).not.toMatch(/'Creating\.\.\.'/);
    expect(buttonsSource).toMatch(/Generating…/);
  });
});
