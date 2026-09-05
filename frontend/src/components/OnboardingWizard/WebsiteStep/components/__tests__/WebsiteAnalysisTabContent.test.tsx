import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WebsiteAnalysisTabContent from '../WebsiteAnalysisTabContent';

// Mock child components to keep the test focused on tabs and viewed tracking logic
vi.mock('../UnifiedAnalysisContainer/index', () => ({
  default: () => <div data-testid="mock-unified-analysis">Mock Unified Analysis</div>,
}));

vi.mock('../WebsiteIntegrationsSection', () => ({
  default: () => <div data-testid="mock-integrations">Mock Integrations</div>,
}));

vi.mock('../../BackgroundSetupCard', () => ({
  BackgroundSetupCard: () => <div data-testid="mock-background-setup">Mock Background Setup</div>,
}));

vi.mock('../../../../shared/PlatformAnalytics', () => ({
  default: () => <div data-testid="mock-platform-analytics">Mock Platform Analytics</div>,
}));

const mockAnalysis = {
  id: 1,
  meta: { confidence: 0.9 },
  brand_analysis: {},
  seo_audit: {},
} as any;

const baseProps = {
  website: 'https://example.com',
  setWebsite: vi.fn(),
  loading: false,
  error: null,
  success: null,
  analysis: mockAnalysis,
  crawlResult: null,
  domainName: 'example.com',
  useAnalysisForGenAI: true,
  setUseAnalysisForGenAI: vi.fn(),
  analysisWarning: null,
  handleAnalyze: vi.fn(),
  handleAnalysisUpdate: vi.fn(),
  saveAnalysis: vi.fn().mockResolvedValue(true),
  handleIntegrationChange: vi.fn(),
  connectedPlatforms: [],
  setConnectedPlatforms: vi.fn(),
  existingAnalysis: null,
  handleLoadExistingConfirm: vi.fn(),
  handleStartFresh: vi.fn(),
};

describe('WebsiteAnalysisTabContent - Tab Layout & View Tracking', () => {
  it('renders the 3 horizontal sub-tabs when analysis is present', () => {
    const viewedTabs = { 0: true, 1: false, 2: false };
    const setViewedTabs = vi.fn();

    render(
      <WebsiteAnalysisTabContent
        {...baseProps}
        viewedTabs={viewedTabs}
        setViewedTabs={setViewedTabs}
      />
    );

    // Verify all 3 sub-tabs are displayed
    expect(screen.getByRole('tab', { name: /brand intelligence dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /connect website platforms/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /smart background setup/i })).toBeInTheDocument();
  });

  it('displays the hint alert when not all tabs have been viewed', () => {
    const viewedTabs = { 0: true, 1: false, 2: false };
    const setViewedTabs = vi.fn();

    render(
      <WebsiteAnalysisTabContent
        {...baseProps}
        viewedTabs={viewedTabs}
        setViewedTabs={setViewedTabs}
      />
    );

    // Verify hint alert is present
    expect(screen.getByText(/Explore all 3 tabs to unlock your brand's growth engine/i)).toBeInTheDocument();
  });

  it('hides the hint alert when all tabs have been viewed', () => {
    const viewedTabs = { 0: true, 1: true, 2: true };
    const setViewedTabs = vi.fn();

    render(
      <WebsiteAnalysisTabContent
        {...baseProps}
        viewedTabs={viewedTabs}
        setViewedTabs={setViewedTabs}
      />
    );

    // Verify hint alert is NOT present
    expect(screen.queryByText(/Explore all 3 tabs to unlock your brand's growth engine/i)).not.toBeInTheDocument();
  });

  it('hides inline URL bar in dashboard-first mode', () => {
    render(
      <WebsiteAnalysisTabContent
        {...baseProps}
        dashboardFirstMode={true}
        suppressDashboardScroll={true}
        viewedTabs={{ 0: true, 1: true, 2: true }}
        setViewedTabs={vi.fn()}
      />
    );

    expect(screen.queryByTestId('website-url-action-bar')).not.toBeInTheDocument();
    expect(screen.getByTestId('unified-folder-tab-dashboard')).toBeInTheDocument();
  });

  it('places the unified dashboard above setup controls in dashboard-first mode', () => {
    render(
      <WebsiteAnalysisTabContent
        {...baseProps}
        dashboardFirstMode={true}
        suppressDashboardScroll={true}
        viewedTabs={{ 0: true, 1: true, 2: true }}
        setViewedTabs={vi.fn()}
      />
    );

    const dashboard = screen.getByTestId('unified-folder-tab-dashboard');
    const setup = screen.getByTestId('website-setup-section');
    expect(dashboard.compareDocumentPosition(setup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows Analyze New Website in the URL bar when analysis is loaded', () => {
    render(
      <WebsiteAnalysisTabContent
        {...baseProps}
        viewedTabs={{ 0: true, 1: false, 2: false }}
        setViewedTabs={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /analyze new website/i })).toBeInTheDocument();
  });

  it('calls setViewedTabs when switching tabs', () => {
    const viewedTabs = { 0: true, 1: false, 2: false };
    const setViewedTabs = vi.fn();

    render(
      <WebsiteAnalysisTabContent
        {...baseProps}
        viewedTabs={viewedTabs}
        setViewedTabs={setViewedTabs}
      />
    );

    // Click the second tab "Connect Website Platforms"
    const connectTab = screen.getByRole('tab', { name: /connect website platforms/i });
    fireEvent.click(connectTab);

    // Verify setViewedTabs is called to mark tab 1 as viewed
    expect(setViewedTabs).toHaveBeenCalled();
  });
});
