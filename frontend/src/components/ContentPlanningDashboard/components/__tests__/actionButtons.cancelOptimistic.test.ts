/**
 * Phase E item 18 (#41/#42) + item 19 (#25).
 *
 * #41: polling was unstoppable — the user had to ride out a 6-minute timeout
 * or close the modal (which left the poll running). Phase B #7 added
 * AbortSignal support to pollStrategyGeneration; this wires a real
 * AbortController into the polling call and a Cancel button in the modal,
 * so cancelling STOPS the loop, closes the modal, and leaves no error
 * banner (a cancel is not an error).
 *
 * #42: optimistic UI — the form fields must disable while generation runs
 * (modal opening + button gating already happen optimistically before the
 * POST). The disable threads: builder → CategoryDetailView →
 * StrategicInputField (one interaction gate on the field container).
 *
 * #25: the Save Draft button gated only on reviewProgressPercentage < 10 —
 * it never checked that the REQUIRED fields are filled. It now requires
 * both (reactive boolean selector on the builder store).
 *
 * Source-reading guard test — same convention as the other builder tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const buttonsSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/components/ActionButtons.tsx'),
  'utf-8',
);
const creationSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/hooks/useStrategyCreation.ts'),
  'utf-8',
);
const builderSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder.tsx'),
  'utf-8',
);
const detailSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/components/CategoryDetailView.tsx'),
  'utf-8',
);
const fieldSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/StrategicInputField.tsx'),
  'utf-8',
);

describe('Phase E #41: cancel stops the polling loop', () => {
  it('creates an AbortController and passes its signal to the poll', () => {
    expect(buttonsSource).toMatch(/pollAbortRef/);
    expect(buttonsSource).toMatch(/new AbortController\(\)/);
    expect(buttonsSource).toMatch(/pollAbortRef\.current\?\.signal/);
  });

  it('exposes cancelGeneration (abort + close modal + reset flags, no error)', () => {
    expect(buttonsSource).toMatch(/const cancelGeneration = \(\)/);
    expect(buttonsSource).toMatch(/pollAbortRef\.current\?\.abort\(\)/);
    expect(buttonsSource).toMatch(/cancelGeneration/);
  });

  it('plumbs cancelGeneration through useStrategyCreation', () => {
    expect(creationSource).toMatch(/cancelGeneration/);
  });
});

describe('Phase E #41: the modal offers Cancel', () => {
  it('shows a Cancel Generation action while generation runs', () => {
    expect(buttonsSource).toMatch(/onGenerationError/); // sanity anchor
    const modalSource = require('fs').readFileSync(
      resolve(__dirname, '../ContentStrategyBuilder/components/EducationalModal.tsx'),
      'utf-8',
    );
    expect(modalSource).toMatch(/Cancel Generation/);
    expect(modalSource).toMatch(/onCancel/);
  });
});

describe('Phase E #42: form fields disable during generation', () => {
  it('builder passes the disabling flag into the category detail view', () => {
    expect(builderSource).toMatch(/disabledInputs=\{/);
  });

  it('CategoryDetailView forwards it to every StrategicInputField', () => {
    expect(detailSource).toMatch(/disabledInputs/);
    expect(detailSource).toMatch(/disabled=\{disabledInputs\}/);
  });

  it('StrategicInputField gates interaction when disabled', () => {
    expect(fieldSource).toMatch(/disabled\?:\s*boolean/);
    expect(fieldSource).toMatch(/pointerEvents: disabled \? 'none' : 'auto'/);
  });
});

describe('Phase E #25: Save gated on required fields, not just progress', () => {
  it('Save also requires all required fields filled (reactively)', () => {
    expect(buttonsSource).toMatch(
      /disabled=\{saving \|\| reviewProgressPercentage < 10 \|\| !allRequiredFieldsComplete\}/,
    );
    expect(buttonsSource).toMatch(/allRequiredFieldsComplete/);
  });
});
