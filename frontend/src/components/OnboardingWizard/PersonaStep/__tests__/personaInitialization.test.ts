import { describe, it, expect } from 'vitest';
import { hasRestorablePersonaStepData } from '../personaInitialization';

describe('hasRestorablePersonaStepData', () => {
  it('returns true when corePersona exists', () => {
    expect(hasRestorablePersonaStepData({ corePersona: { name: 'Brand' } })).toBe(true);
  });

  it('returns true when only platformPersonas exist', () => {
    expect(
      hasRestorablePersonaStepData({
        platformPersonas: { linkedin: { tone: 'professional' } },
      })
    ).toBe(true);
  });

  it('returns false for empty step data', () => {
    expect(hasRestorablePersonaStepData({})).toBe(false);
    expect(hasRestorablePersonaStepData(undefined)).toBe(false);
  });
});
