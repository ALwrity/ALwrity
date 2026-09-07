/**
 * Phase C item 11 (#17/#19/#43) — typed errors + retry CTA on generation failure.
 *
 * handleCreateStrategy caught everything as "Error generating AI
 * recommendations: <raw>" with no recovery path. Now: errors are classified
 * (auth/network/validation/server) into actionable copy, generation failures
 * are reported through onGenerationError so the builder can offer a Retry
 * that re-runs generation (not autofill), and the taskId-undefined path gets
 * the same treatment.
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
const creationSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder/hooks/useStrategyCreation.ts'),
  'utf-8',
);
const builderSource = readFileSync(
  resolve(__dirname, '../ContentStrategyBuilder.tsx'),
  'utf-8',
);

describe('Phase C #17: differentiated error types in ActionButtons', () => {
  it('classifies errors with describeApiError', () => {
    expect(buttonsSource).toMatch(/describeApiError/);
  });

  it('keeps a fallback message instead of dumping raw errors', () => {
    expect(buttonsSource).toMatch(
      /describeApiError\(\s*err,\s*['"]Error generating AI recommendations['"]\s*\)/,
    );
  });
});

describe('Phase C #19/#43: retry CTA on generation failure', () => {
  it('reports generation failures through onGenerationError', () => {
    expect(buttonsSource).toMatch(/onGenerationError\?\.\(/);
  });

  it('covers the missing-task-id path with a retryable message', () => {
    expect(buttonsSource).toMatch(/No task ID received[^'"]*retry/i);
  });

  it('plumbs onGenerationError through useStrategyCreation', () => {
    expect(creationSource).toMatch(/onGenerationError/);
  });

  it('builder offers a generation-specific retry path', () => {
    expect(builderSource).toMatch(/retryGeneration/);
    expect(builderSource).toMatch(/errorSource\s*===\s*'generation'/);
  });
});
