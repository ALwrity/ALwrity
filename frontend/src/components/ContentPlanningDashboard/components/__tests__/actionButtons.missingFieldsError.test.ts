/**
 * Phase C item 13 (#24): the validation error was generic —
 * 'Please fill in all required fields before generating AI insights.' —
 * without telling the user WHICH fields were missing. The store already
 * computes per-field errors (formErrors), but the banner ignored them.
 *
 * Fix: the store exposes getMissingRequiredFields() (labels of the missing
 * required fields) and ActionButtons appends 'Missing: ...' to the message.
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
const storeSource = readFileSync(
  resolve(__dirname, '../../../../stores/strategyBuilderStore.ts'),
  'utf-8',
);

describe('Phase C #24: name the missing required fields', () => {
  it('store exposes getMissingRequiredFields returning labels', () => {
    expect(storeSource).toMatch(/getMissingRequiredFields:\s*\(\)\s*=>/);
    expect(storeSource).toMatch(/field\.required\s*&&\s*\(!formData\[field\.id\]/);
  });

  it('validation failure appends the missing field names', () => {
    expect(buttonsSource).toMatch(/Missing: \$\{missing\.join\(', '\)\}/);
  });

  it('gets the missing list from the strategy builder store', () => {
    expect(buttonsSource).toMatch(/useStrategyBuilderStore\.getState\(\)\.getMissingRequiredFields\(\)/);
  });
});
