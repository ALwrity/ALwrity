import { describe, it, expect } from 'vitest';
import { buildResearchStepDataPatch } from '../onboardingResearchSessionChange';

describe('onboardingResearchSessionChange', () => {
  it('builds a wizard stepData patch from research session payload', () => {
    const patch = buildResearchStepDataPatch({
      competitors: [{ url: 'https://rival.com' }],
      research_summary: { total_competitors: 1 },
      content_pillars: { status: 'complete' },
      userUrl: 'https://www.alwrity.com',
    });

    expect(patch.competitors).toHaveLength(1);
    expect(patch.researchSummary).toEqual({ total_competitors: 1 });
    expect(patch.content_pillars).toEqual({ status: 'complete' });
    expect(patch.website).toBe('https://www.alwrity.com');
  });
});
