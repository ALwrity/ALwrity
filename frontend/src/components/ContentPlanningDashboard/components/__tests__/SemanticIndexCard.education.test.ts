/**
 * Phase 4 — SemanticIndexCard education-dialog mount contract.
 *
 * Tapping "Learn how the index works" (gated by the off-by-default education
 * feature flag) should open the SemanticIndexEducationDialog from the Semantic
 * Index card, handing it the live document kind names from the status payload.
 * Source-reading test — lightweight, no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const cardSource = readFileSync(
  resolve(__dirname, '../SemanticIndexCard.tsx'),
  'utf-8',
);

describe('SemanticIndexCard — Phase 4: education dialog trigger', () => {
  it('imports SemanticIndexEducationDialog', () => {
    expect(cardSource).toMatch(
      /import\s+SemanticIndexEducationDialog\s+from\s+['"]\.\/SemanticIndexEducationDialog['"]/,
    );
  });

  it('imports the education feature-flag getter', () => {
    expect(cardSource).toMatch(
      /import\s*{\s*isStrategySifEducationEnabled\s*}\s*from\s*['"]\.\.\/\.\.\/\.\.\/config\/strategySifConfig['"]/,
    );
  });

  it('renders a learn-more trigger gated by the education flag', () => {
    expect(cardSource).toMatch(/isStrategySifEducationEnabled\(\)\s*&&\s*\(\s*<Button/);
  });

  it('opens the dialog with the live document kind names', () => {
    expect(cardSource).toMatch(
      /<SemanticIndexEducationDialog[\s\S]*?documentKindNames=\{data\.document_kinds\?\.names\}/,
    );
  });
});