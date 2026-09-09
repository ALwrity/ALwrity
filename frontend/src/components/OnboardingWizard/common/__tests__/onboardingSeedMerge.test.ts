import { describe, it, expect } from 'vitest';
import {
  hasConnectArtifactData,
  hasPersonaArtifactData,
  mergeArtifactAwareSeedIntoStepData,
} from '../onboardingSeedMerge';

describe('onboardingSeedMerge', () => {
  it('merges research when has_data is true without official Continue', () => {
    const { stepData, restoredSteps } = mergeArtifactAwareSeedIntoStepData(
      { website: 'https://www.alwrity.com', analysis: { id: 1 } },
      {
        connect: {
          data: { website: 'https://www.alwrity.com', analysis: { id: 1 } },
          hasData: true,
        },
        research: {
          data: { competitors: [{ url: 'https://rival.com' }] },
          hasData: true,
        },
        personalization: { data: null, hasData: false },
      },
      'https://www.alwrity.com',
      { id: 1 }
    );

    expect(stepData.competitors).toHaveLength(1);
    expect(restoredSteps).toContain('research');
  });

  it('does not merge empty research shell when has_data is false', () => {
    const { stepData, restoredSteps } = mergeArtifactAwareSeedIntoStepData(
      { website: 'https://www.alwrity.com' },
      {
        connect: {
          data: { website: 'https://www.alwrity.com' },
          hasData: true,
        },
        research: { data: { competitors: [] }, hasData: false },
        personalization: { data: null, hasData: false },
      },
      'https://www.alwrity.com',
      null
    );

    expect(stepData.competitors).toBeUndefined();
    expect(restoredSteps).not.toContain('research');
  });

  it('skips all backend seed during start-fresh with no live URL', () => {
    const { stepData, restoredSteps } = mergeArtifactAwareSeedIntoStepData(
      { email: 'user@example.com' },
      {
        connect: {
          data: { website: 'https://www.alwrity.com', analysis: { id: 1 } },
          hasData: true,
        },
        research: {
          data: { competitors: [{ url: 'https://rival.com' }] },
          hasData: true,
        },
        personalization: {
          data: { corePersona: { name: 'Voice' } },
          hasData: true,
        },
      },
      '',
      null,
      { suppressBackendConnectSeed: true }
    );

    expect(stepData.website).toBeUndefined();
    expect(stepData.competitors).toBeUndefined();
    expect(restoredSteps).toEqual([]);
  });

  it('detects connect and persona artifact payloads', () => {
    expect(hasConnectArtifactData({ website_url: 'https://a.com' })).toBe(true);
    expect(hasPersonaArtifactData({ platformPersonas: { linkedin: {} } })).toBe(true);
  });
});
