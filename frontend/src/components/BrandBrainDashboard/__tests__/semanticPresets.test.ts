/**
 * Phase 5: curated preset questions per Brand Brain semantic-search scope.
 *
 * SCOPE_PRESETS drives the clickable chips on the SemanticQuery panel so
 * the user has a launching point for "ask your Brand Brain". The map must
 * cover every scope (no scope left empty), so a missing preset would never
 * silently show an empty preset row.
 */
import { describe, it, expect } from 'vitest';
import { SCOPE_PRESETS } from '../semanticPresets';
import type { BrandBrainSearchScope } from '../../../services/brandBrainApi';

const SCOPES: BrandBrainSearchScope[] = ['all', 'onboarding', 'strategy', 'calendar'];

describe('semanticPresets — Phase 5: per-scope curated questions', () => {
  it('covers every brand-brain search scope with at least one preset', () => {
    for (const scope of SCOPES) {
      expect(Array.isArray(SCOPE_PRESETS[scope])).toBe(true);
      expect(SCOPE_PRESETS[scope].length).toBeGreaterThan(0);
    }
  });

  it('does not include empty-string presets', () => {
    for (const scope of SCOPES) {
      for (const preset of SCOPE_PRESETS[scope]) {
        expect(preset.trim().length).toBeGreaterThan(0);
      }
    }
  });
});