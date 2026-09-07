import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WebsiteStep from '../WebsiteStep';
import { setCommittedStep1WebsiteUrl } from '../utils/onboardingWebsiteReset';

let capturedViewedTabs: Record<number, boolean> | null = null;

const mockAnalysis = {
  id: 1,
  brand_analysis: {},
  seo_audit: {},
};

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null }),
}));

vi.mock('../WebsiteStep/hooks/useWebsiteAnalysis', () => ({
  useWebsiteAnalysis: () => ({
    website: 'https://www.brand-a.com',
    setWebsite: vi.fn(),
    loading: false,
    analysis: mockAnalysis,
    setAnalysis: vi.fn(),
    crawlResult: null,
    existingAnalysis: null,
    domainName: 'brand-a.com',
    isProgressModalOpen: false,
    isHydratingAnalysis: false,
    progress: [],
    handleAnalyze: vi.fn(),
    handleLoadExistingConfirm: vi.fn(),
    handleStartFresh: vi.fn(),
  }),
}));

vi.mock('../WebsiteStep/hooks/useWebsiteStepEffects', () => ({
  useWebsiteStepEffects: () => ({
    linkedinProfile: null,
    setLinkedinProfile: vi.fn(),
    email: 'user@example.com',
    setEmail: vi.fn(),
  }),
}));

vi.mock('../WebsiteStep/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../WebsiteStep/components')>();
  return {
    ...actual,
    WebsiteAnalysisTabContent: (props: { viewedTabs: Record<number, boolean> }) => {
      capturedViewedTabs = props.viewedTabs;
      return <div data-testid="mock-tab-content" />;
    },
    OnboardingTabBar: () => <div data-testid="mock-tab-bar" />,
    WebsiteStepHeader: () => null,
    LinkedInIntegrationTab: () => null,
    YouTubeIntegrationTab: () => null,
    AnalysisProgressDisplay: () => null,
  };
});

const baseProps = {
  onContinue: vi.fn(),
  updateHeaderContent: vi.fn(),
  onValidationChange: vi.fn(),
  onDataReady: vi.fn(),
};

describe('WebsiteStep — folder tab unlock for returning users', () => {
  beforeEach(() => {
    capturedViewedTabs = null;
    localStorage.clear();
    setCommittedStep1WebsiteUrl('https://www.brand-a.com');
  });

  it('marks all folder tabs viewed when connect step is already completed', async () => {
    render(<WebsiteStep {...baseProps} isConnectStepCompleted={true} />);

    await waitFor(() => {
      expect(capturedViewedTabs).toEqual({ 0: true, 1: true, 2: true });
    });
  });

  it('keeps first-visit gating when connect step is not yet completed', async () => {
    render(<WebsiteStep {...baseProps} isConnectStepCompleted={false} />);

    await waitFor(() => {
      expect(capturedViewedTabs).toEqual({ 0: true, 1: false, 2: false });
    });
  });

  it('hides explore hint when connect step is completed (all tabs viewed)', async () => {
    render(<WebsiteStep {...baseProps} isConnectStepCompleted={true} />);

    await waitFor(() => {
      expect(capturedViewedTabs).not.toBeNull();
    });

    const { shouldShowFolderTabExploreHint } = await import(
      '../WebsiteStep/utils/websiteStepReturnExperience'
    );
    expect(shouldShowFolderTabExploreHint(capturedViewedTabs!)).toBe(false);
  });
});
