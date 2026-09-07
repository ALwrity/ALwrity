/**
 * Phase I (#30/#32): no user data in production logs.
 *
 * Two named leaks from the review:
 * #32 — ContentStrategyBuilder dumped the full completionStats map and the
 *       reviewedCategories set (user behaviour traces) and ActionButtons
 *       dumped the user's entire formData + submission payload.
 * #30 — contentPlanningApi.log(?!) still had 36 BARE console.* calls: the
 *       polling response dump includes the generated strategy itself, so
 *       it leaked straight into production browser consoles.
 *
 * Contract:
 *  - every log in the flow files AND the content planning API service goes
 *    through the dev-gated devLogger (log/warn/info dev-only, error always)
 *  - no bare console.* left in those files
 *  - full-payload dumps (formData / strategyData / polling response) are
 *    replaced by value-free summaries (counts, status, ids)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const files = {
  buttons: readFileSync(resolve(__dirname, './components/ContentStrategyBuilder/components/ActionButtons.tsx'), 'utf-8'),
  builder: readFileSync(resolve(__dirname, './components/ContentStrategyBuilder.tsx'), 'utf-8'),
  api: readFileSync(resolve(__dirname, '../../services/contentPlanningApi.ts'), 'utf-8'),
};

describe('Phase I #32: no full user-content dumps', () => {
  it('ActionButtons never logs the raw formData or the full submission payload', () => {
    expect(files.buttons).not.toMatch(/Current formData/);
    expect(files.buttons).not.toMatch(/Attempting to create strategy with data/);
    expect(files.buttons).not.toMatch(/devLog\.[a-z]+\([^)]*formData/);
  });

  it('the submission is logged as a count, not a dump', () => {
    expect(files.buttons).toMatch(/Creating strategy with \$\{Object\.keys\(strategyData\)\.length\} fields/);
  });

  it('builder no longer dumps the completion map or the reviewed set', () => {
    expect(files.builder).not.toMatch(/category_completion:', completionStats\.category_completion/);
    expect(files.builder).not.toMatch(/reviewedCategories:', reviewedCategories\)?\)?;?/);
    expect(files.builder).not.toMatch(/unreviewed categories:', unreviewed/);
  });
});

describe('Phase I #32: no bare console.* in the API service', () => {
  it('all logging goes through devLogger', () => {
    const src = files.api;
    const bare = src.match(/\bconsole\.(log|warn|info|debug|error)\(/g) || [];
    expect(bare).toEqual([]);
  });
});
