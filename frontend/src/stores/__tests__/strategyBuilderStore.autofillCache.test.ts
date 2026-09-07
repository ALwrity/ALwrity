/**
 * Autofill must be cache-first, persisted, and fire-once-per-session:
 * - mount triggers `ensureAutofillForSession` (DB-snapshot hydrate on hit,
 *   full LLM autofill only on miss), NOT a bare autofill POST
 * - `getLatestAutofill` fetches the persisted snapshot from the backend
 * - the sessionStorage bootstrap guard runs BEFORE any await so React
 *   StrictMode's double-effect cannot fire the POST twice
 * - the concurrency flag is set BEFORE the artificial delay (the double-POST
 *   from the logs happened because `await 500ms` sat before the flag)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const storeSource = readFileSync(
  resolve(__dirname, '../strategyBuilderStore.ts'),
  'utf-8',
);
const apiSource = readFileSync(
  resolve(__dirname, '../../services/contentPlanningApi.ts'),
  'utf-8',
);
const populationSource = readFileSync(
  resolve(__dirname, '../../components/ContentPlanningDashboard/components/ContentStrategyBuilder/hooks/useAutoPopulation.ts'),
  'utf-8',
);

describe('strategyBuilderStore — autofill cache-first bootstrapping', () => {
  it('fetches the persisted snapshot before ever calling the autofill generate endpoint', () => {
    expect(storeSource).toMatch(/loadCachedAutofill/);
    expect(storeSource).toMatch(/getLatestAutofill\(\)/);
    expect(storeSource.indexOf('getLatestAutofill')).toBeGreaterThan(-1);
  });

  it('ensureAutofillForSession: once per browser session, hydrate on hit, generate on miss', () => {
    expect(storeSource).toMatch(/ensureAutofillForSession/);
    expect(storeSource).toMatch(/strategy_autofill_bootstrapped/);
    expect(storeSource).toMatch(/loadCachedAutofill/);
    expect(storeSource).toMatch(/autofillStrategyFields\(\)/);
  });

  it('the concurrency flag is taken BEFORE any await (no more double POST)', () => {
    const start = storeSource.indexOf('autofillStrategyFields: async');
    const action = storeSource.slice(
      start,
      storeSource.indexOf('loadCachedAutofill', start),
    );
    const flagIdx = action.indexOf('autofillLoading = true;');
    const awaitIdx = action.indexOf('await new Promise');
    expect(flagIdx).toBeGreaterThan(-1);
    expect(awaitIdx).toBeGreaterThan(flagIdx);
  });
});

describe('contentPlanningApi — autofill snapshot fetch', () => {
  it('exposes getLatestAutofill hitting /autofill/latest', () => {
    expect(apiSource).toMatch(/async getLatestAutofill/);
    expect(apiSource).toMatch(/strategies\/autofill\/latest/);
  });
});

describe('useAutoPopulation — hydrate-or-generate hook', () => {
  it('triggers the session bootstrap, not a direct autofill run', () => {
    expect(populationSource).toMatch(/ensureStrategyFieldsForSession/);
    expect(populationSource).not.toMatch(/autoPopulateFromOnboarding\(\)/);
  });
});
