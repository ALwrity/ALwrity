import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WebsiteStep from '../WebsiteStep';
import { markWebsiteStartFreshUi } from '../utils/onboardingWebsiteReset';

const mockAnalysis = {
  id: 1,
  brand_analysis: {},
  seo_audit: {},
};

let mockWebsite = 'https://www.alwrity.com';
let mockAnalysisState: typeof mockAnalysis | null = mockAnalysis;
let capturedTabContentProps: Record<string, unknown> | null = null;

const handleStartFreshMock = vi.fn(() => {
  mockWebsite = '';
  mockAnalysisState = null;
  markWebsiteStartFreshUi();
});

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null }),
}));

vi.mock('../WebsiteStep/hooks/useWebsiteAnalysis', () => ({
  useWebsiteAnalysis: () => ({
    website: mockWebsite,
    setWebsite: vi.fn(),
    loading: false,
    analysis: mockAnalysisState,
    setAnalysis: vi.fn(),
    crawlResult: null,
    existingAnalysis: null,
    domainName: 'alwrity.com',
    isProgressModalOpen: false,
    isHydratingAnalysis: false,
    progress: [],
    handleAnalyze: vi.fn(),
    handleLoadExistingConfirm: vi.fn(),
    handleStartFresh: handleStartFreshMock,
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
    WebsiteAnalysisTabContent: (props: Record<string, unknown>) => {
      capturedTabContentProps = props;
      return (
        <div data-testid="mock-tab-content">
          <button type="button" onClick={props.handleStartFresh as () => void}>
            Analyze New Website
          </button>
        </div>
      );
    },
    OnboardingTabBar: () => <div data-testid="mock-tab-bar" />,
    WebsiteStepHeader: () => <h1>Where should I begin ?</h1>,
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

describe('WebsiteStep — Analyze New Website', () => {
  beforeEach(() => {
    localStorage.clear();
    capturedTabContentProps = null;
    mockWebsite = 'https://www.alwrity.com';
    mockAnalysisState = mockAnalysis;
    handleStartFreshMock.mockClear();
  });

  it('starts in dashboard-first mode when analysis exists', () => {
    render(<WebsiteStep {...baseProps} isConnectStepCompleted={true} />);

    expect(capturedTabContentProps?.dashboardFirstMode).toBe(true);
    expect(capturedTabContentProps?.showInlineUrlBar).toBe(false);
    expect(screen.queryByText(/where should i begin/i)).not.toBeInTheDocument();
  });

  it('returns to the URL input bar after Analyze New Website is clicked', async () => {
    const { rerender } = render(
      <WebsiteStep {...baseProps} isConnectStepCompleted={true} />
    );

    fireEvent.click(screen.getByRole('button', { name: /analyze new website/i }));
    expect(handleStartFreshMock).toHaveBeenCalled();

    rerender(<WebsiteStep {...baseProps} isConnectStepCompleted={true} />);

    await waitFor(() => {
      expect(capturedTabContentProps?.dashboardFirstMode).toBe(false);
      expect(capturedTabContentProps?.showInlineUrlBar).toBe(true);
      expect(screen.getByText(/where should i begin/i)).toBeInTheDocument();
    });
  });
});
