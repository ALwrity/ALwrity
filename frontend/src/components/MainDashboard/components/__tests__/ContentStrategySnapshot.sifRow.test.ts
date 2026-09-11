/**
 * Phase 3 — ContentStrategySnapshot mount contract for the semantic-index
 * status row on the Main Dashboard.
 *
 * The row must be gated by the (off-by-default) snapshot feature flag and
 * only render for active/pending strategies (exactly the same gate the Phase 2
 * card uses on the Content Strategy tab). Source-reading test — lightweight,
 * no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const snapshotSource = readFileSync(
  resolve(__dirname, '../ContentStrategySnapshot.tsx'),
  'utf-8',
);

describe('ContentStrategySnapshot — Phase 3: semantic-index snapshot row', () => {
  it('imports SemanticIndexSnapshotRow', () => {
    expect(snapshotSource).toMatch(
      /import\s+SemanticIndexSnapshotRow\s+from\s+['"]\.\/SemanticIndexSnapshotRow['"]/,
    );
  });

  it('imports the snapshot feature-flag getter', () => {
    expect(snapshotSource).toMatch(
      /import\s*{\s*isStrategySifSnapshotEnabled\s*}\s*from\s*['"]\.\.\/\.\.\/\.\.\/config\/strategySifConfig['"]/,
    );
  });

  it('renders the row gated by the flag AND active/pending status', () => {
    expect(snapshotSource).toMatch(
      /isStrategySifSnapshotEnabled\(\)\s*&&\s*\(strategyStatus\s*===\s*'active'\s*\|\|\s*strategyStatus\s*===\s*'pending'\)\s*&&\s*\(\s*<SemanticIndexSnapshotRow\s*\/>\s*\)/,
    );
  });
});