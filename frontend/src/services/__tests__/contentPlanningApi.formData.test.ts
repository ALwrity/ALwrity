/**
 * A1 (form_data end-to-end): the polling kickoff must accept and forward the
 * user's 30 strategy-builder fields so the backend threads them into the AI
 * generator context (see backend tests/api/test_polling_form_data.py).
 *
 * Source-reading test — lightweight, no mocking required (matches the
 * clientChoice.userId guard pattern for this module).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiSource = readFileSync(
  resolve(__dirname, '../contentPlanningApi.ts'),
  'utf-8',
);

describe('contentPlanningApi — A1: form_data forwarded to polling', () => {
  it('startStrategyGenerationPolling accepts a formData parameter', () => {
    expect(apiSource).toMatch(
      /async\s+startStrategyGenerationPolling\([^)]*\bformData\b[^)]*\)/,
    );
  });

  it('threads form_data into the POST request body', () => {
    expect(apiSource).toMatch(/form_data:\s*formData\s*\|\|\s*\{\}/);
  });

  it('sends the form_data to the polling endpoint', () => {
    const pollingCall = apiSource.match(
      /generate-comprehensive-strategy-polling[\s\S]{0,500}/,
    )?.[0];
    expect(pollingCall).toBeTruthy();
    expect(pollingCall!.includes('form_data')).toBe(true);
  });
});