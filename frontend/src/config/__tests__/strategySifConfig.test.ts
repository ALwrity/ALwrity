/**
 * The Semantic Index status surfaces (Phase 2 card, Phase 3 dashboard row,
 * Phase 4 education dialog) are gated by feature flags.
 *
 * Currently ALL default to ON while the app is in the testing/debug phase so
 * the surfaces can be exercised manually end-to-end. Before production rollout
 * the flags should be turned back OFF until the read path is verified live.
 *
 * Source-reading test — lightweight, no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const configSource = readFileSync(
  resolve(__dirname, '../../config/strategySifConfig.ts'),
  'utf-8',
);

describe('strategySifConfig — Phase 2: feature flag', () => {
  it('exports a STRATEGY_SIF_CARD_ENABLED boolean defaulting to true (testing/debug)', () => {
    expect(configSource).toMatch(/STRATEGY_SIF_CARD_ENABLED:\s*boolean\s*=\s*true/);
  });

  it('defaults ON so the card is visible during the testing/debug phase', () => {
    expect(configSource).toContain('= true');
  });

  it('exposes an isStrategySifCardEnabled() getter', () => {
    expect(configSource).toMatch(/export function isStrategySifCardEnabled\(\)/);
  });

  it('getter returns the flag constant', () => {
    expect(configSource).toMatch(/return\s+STRATEGY_SIF_CARD_ENABLED;\s*}/);
  });
});

describe('strategySifConfig — Phase 3: dashboard snapshot flag', () => {
  it('exports a STRATEGY_SIF_SNAPSHOT_ENABLED boolean defaulting to true (testing/debug)', () => {
    expect(configSource).toMatch(/STRATEGY_SIF_SNAPSHOT_ENABLED:\s*boolean\s*=\s*true/);
  });

  it('defaults ON so the dashboard row is visible during the testing/debug phase', () => {
    expect(configSource).toContain('= true');
  });

  it('exposes an isStrategySifSnapshotEnabled() getter', () => {
    expect(configSource).toMatch(/export function isStrategySifSnapshotEnabled\(\)/);
  });

  it('getter returns the snapshot flag constant', () => {
    expect(configSource).toMatch(/return\s+STRATEGY_SIF_SNAPSHOT_ENABLED;\s*}/);
  });
});

describe('strategySifConfig — Phase 4: education dialog flag', () => {
  it('exports a STRATEGY_SIF_EDUCATION_ENABLED boolean defaulting to true (testing/debug)', () => {
    expect(configSource).toMatch(/STRATEGY_SIF_EDUCATION_ENABLED:\s*boolean\s*=\s*true/);
  });

  it('defaults ON so the education dialog trigger is visible during the testing/debug phase', () => {
    expect(configSource).toContain('= true');
  });

  it('exposes an isStrategySifEducationEnabled() getter', () => {
    expect(configSource).toMatch(/export function isStrategySifEducationEnabled\(\)/);
  });

  it('getter returns the education flag constant', () => {
    expect(configSource).toMatch(/return\s+STRATEGY_SIF_EDUCATION_ENABLED;\s*}/);
  });
});