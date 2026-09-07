import { describe, expect, it } from 'vitest';
import {
  buildConnectStepSnapshot,
  getConnectPayloadForGuard,
  getProgressNavigationBlockMessage,
  hasUncommittedConnectChanges,
  shouldBlockProgressNavigation,
} from './wizardStepNavigationGuard';

describe('buildConnectStepSnapshot', () => {
  it('builds a website session key from website and analysis', () => {
    const snapshot = buildConnectStepSnapshot('website', {
      website: 'https://acme.com',
      analysis: { id: 42 },
    });
    expect(snapshot?.sessionKey).toContain('acme.com');
    expect(snapshot?.sessionKey).toContain('42');
  });

  it('builds a LinkedIn snapshot from integrations', () => {
    expect(
      buildConnectStepSnapshot('linkedin', {
        integrations: { connectedPlatforms: ['linkedin'] },
      })
    ).toEqual({ sessionKey: 'linkedin:connected' });
  });
});

describe('hasUncommittedConnectChanges', () => {
  it('returns false when connect step was never completed', () => {
    expect(
      hasUncommittedConnectChanges(
        { sessionKey: 'site-a.com:1' },
        { sessionKey: 'site-b.com:2' },
        -1
      )
    ).toBe(false);
  });

  it('returns true when the current website session differs from last committed', () => {
    expect(
      hasUncommittedConnectChanges(
        { sessionKey: 'site-a.com:1' },
        { sessionKey: 'site-b.com:2' },
        0
      )
    ).toBe(true);
  });

  it('returns false when the website session matches last committed', () => {
    expect(
      hasUncommittedConnectChanges(
        { sessionKey: 'site-a.com:1' },
        { sessionKey: 'site-a.com:1' },
        0
      )
    ).toBe(false);
  });
});

describe('shouldBlockProgressNavigation', () => {
  const baseInput = {
    onboardingType: 'website' as const,
    completedFrontier: 0,
    furthestAccessibleStep: 1,
    lastCommitted: { sessionKey: 'site-a.com:1' },
    currentConnectPayload: {
      website: 'https://site-b.com',
      analysis: { id: 2 },
    },
  };

  it('allows navigation back to connect platforms', () => {
    const result = shouldBlockProgressNavigation(0, baseInput);
    expect(result.blocked).toBe(false);
  });

  it('allows return to the unlocked in-progress step even when connect has live edits', () => {
    const result = shouldBlockProgressNavigation(1, baseInput);
    expect(result.blocked).toBe(false);
  });

  it('allows navigation among all backend-unlocked steps at 50% progress', () => {
    const input = {
      ...baseInput,
      completedFrontier: 1,
      furthestAccessibleStep: 2,
      currentConnectPayload: {
        website: 'https://site-b.com',
        analysis: { id: 2 },
      },
    };

    expect(shouldBlockProgressNavigation(0, input).blocked).toBe(false);
    expect(shouldBlockProgressNavigation(1, input).blocked).toBe(false);
    expect(shouldBlockProgressNavigation(2, input).blocked).toBe(false);
  });

  it('blocks steps beyond the backend-unlocked frontier', () => {
    const result = shouldBlockProgressNavigation(2, baseInput);
    expect(result.blocked).toBe(true);
    expect(result.message).toContain('Complete earlier steps');
  });

  it('does not require Continue for progress-bar hops among unlocked steps', () => {
    const result = shouldBlockProgressNavigation(1, {
      onboardingType: 'website',
      completedFrontier: 0,
      furthestAccessibleStep: 1,
      lastCommitted: { sessionKey: 'site-a.com:1' },
      currentConnectPayload: {
        website: 'https://site-a.com',
        analysis: { id: 1 },
      },
    });
    expect(result.blocked).toBe(false);
  });
});

describe('getConnectPayloadForGuard', () => {
  it('prefers the live collector payload', () => {
    const payload = getConnectPayloadForGuard(
      () => ({ website: 'https://live.com', analysis: { id: 9 } }),
      { website: 'https://stale.com', analysis: { id: 1 } }
    );
    expect(payload).toEqual({ website: 'https://live.com', analysis: { id: 9 } });
  });

  it('falls back to live website storage before stale stepData', () => {
    localStorage.setItem('website_url', 'https://live.com');
    localStorage.setItem('website_analysis_data', JSON.stringify({ id: 9 }));
    const payload = getConnectPayloadForGuard(null, {
      website: 'https://stale.com',
      analysis: { id: 1 },
    });
    expect(payload).toEqual({
      website: 'https://live.com',
      analysis: { id: 9 },
    });
  });

  it('falls back to stepData connect fields when collector and live storage are unavailable', () => {
    localStorage.clear();
    const payload = getConnectPayloadForGuard(null, {
      website: 'https://saved.com',
      analysis: { id: 3 },
      competitors: [{ url: 'x' }],
    });
    expect(payload).toEqual({
      website: 'https://saved.com',
      analysis: { id: 3 },
      integrations: undefined,
    });
  });
});

describe('getProgressNavigationBlockMessage', () => {
  it('returns a website-specific message', () => {
    expect(getProgressNavigationBlockMessage('website')).toContain('website analysis');
  });

  it('returns a LinkedIn-specific message', () => {
    expect(getProgressNavigationBlockMessage('linkedin')).toContain('LinkedIn');
  });
});
