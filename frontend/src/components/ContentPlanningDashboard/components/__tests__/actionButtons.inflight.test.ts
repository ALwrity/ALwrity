/**
 * Phase B #8: useActionButtonsBusinessLogic must refuse concurrent polling on
 * double-click. The wrapper aiGenerating state guard only covers the UI
 * layer; the hook itself needs a ref-based in-flight guard so two rapid
 * handleCreateStrategy calls can't start two polling loops.
 *
 * Source-reading test — lightweight, no mocking required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/components/ActionButtons.tsx'),
  'utf-8',
);

describe('ActionButtons — Phase B #8: in-flight polling guard', () => {
  it('uses a ref flag to prevent concurrent generation', () => {
    expect(source).toMatch(/isGeneratingRef\s*=\s*useRef/);
  });

  it('returns early when generation is already in flight', () => {
    const handleCreate = source.match(/const handleCreateStrategy[\s\S]*?finally\s*\{[\s\S]*?\};/)?.[0] ?? '';
    expect(handleCreate).toMatch(/if\s*\(\s*isGeneratingRef\.current\s*\)/);
  });

  it('sets and clears the in-flight ref around the polling flow', () => {
    expect(source).toMatch(/isGeneratingRef\.current\s*=\s*true/);
    expect(source).toMatch(/isGeneratingRef\.current\s*=\s*false/);
  });
});