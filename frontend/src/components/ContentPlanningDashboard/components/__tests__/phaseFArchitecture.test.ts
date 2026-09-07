/**
 * Phase F — Component Architecture.
 *
 * #26: The three flow files (ActionButtons, ContentStrategyBuilder,
 * useModalManagement) printed 60+ bare console.* calls into production
 * browsers (the review's verification counted 31 in ActionButtons alone).
 * They now go through the dev-gated devLogger — log/warn/info only in
 * development, error always — the same util the rest of the app uses.
 *
 * #27: useModalManagement kept an empty "monitor aiGenerating for debugging"
 * useEffect whose body was deleted long ago — dead effect that still subscribed
 * to a dependency on every render.
 *
 * #28: the 300ms/200ms modal-transition delays were bare magic numbers with
 * no rationale. They are now ONE documented, named module constant.
 *
 * Source-reading guard test — same convention as the other builder tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const files: Record<string, string> = {
  buttons: readFileSync(resolve(__dirname, '../ContentStrategyBuilder/components/ActionButtons.tsx'), 'utf-8'),
  builder: readFileSync(resolve(__dirname, '../ContentStrategyBuilder.tsx'), 'utf-8'),
  modal: readFileSync(resolve(__dirname, '../ContentStrategyBuilder/hooks/useModalManagement.ts'), 'utf-8'),
};

describe('Phase F #26: flow files use devLogger (dev-gated log, always-on error)', () => {
  it('ActionButtons logs via devLogger', () => {
    expect(files.buttons).toMatch(/import \{ devLog \} from '[^']*utils\/devLogger'/);
  });

  it('not a single bare console.* call remains', () => {
    for (const [name, src] of Object.entries(files)) {
      const bare = src.match(/\bconsole\.(log|warn|info|debug|error)\(/g) || [];
      expect(bare, `${name} still has bare console calls`).toEqual([]);
    }
  });
});

describe('Phase F #27: no dead empty useEffect in useModalManagement', () => {
  it('removed the empty aiGenerating monitor effect', () => {
    expect(files.modal).not.toMatch(/Monitor aiGenerating state for debugging/);
    expect(files.modal).not.toMatch(/Removed verbose logging/);
  });

  it('keeps the real isMountedRef cleanup effect', () => {
    expect(files.modal).toMatch(/isMountedRef\.current = false/);
  });
});

describe('Phase F #28: modal transition delays are named config, not magic numbers', () => {
  it('uses one documented MODAL_TRANSITION_DELAY_MS constant', () => {
    expect(files.modal).toMatch(/MODAL_TRANSITION_DELAY_MS\s*=\s*300/);
    expect(files.modal).not.toMatch(/},\s*200\)/);
    expect(files.modal).not.toMatch(/},\s*300\)/);
    expect((files.modal.match(/MODAL_TRANSITION_DELAY_MS/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
