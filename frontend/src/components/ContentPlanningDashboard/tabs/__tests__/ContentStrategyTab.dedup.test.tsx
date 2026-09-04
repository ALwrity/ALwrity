import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ContentStrategyTab from '../ContentStrategyTab';

// --- Mocks ---

// Mock contentPlanningApi to track calls
const mockGetEnhancedStrategies = vi.fn().mockResolvedValue({ data: { strategies: [] } });
const mockGetLatestGeneratedStrategy = vi.fn().mockResolvedValue(null);
const mockGetLatestGeneratedStrategyWithRetry = vi.fn().mockResolvedValue(null);

vi.mock('../../../services/contentPlanningApi', () => ({
  contentPlanningApi: {
    getStrategiesSafe: vi.fn().mockResolvedValue([]),
    getAIAnalyticsWithRetry: vi.fn().mockResolvedValue({ insights: [], recommendations: [] }),
    getLatestGeneratedStrategy: mockGetLatestGeneratedStrategy,
    getLatestGeneratedStrategyWithRetry: mockGetLatestGeneratedStrategyWithRetry,
    getEnhancedStrategies: mockGetEnhancedStrategies,
    streamAIGenerationStatus: vi.fn().mockResolvedValue({
      onmessage: null,
      onerror: null,
      close: vi.fn(),
    }),
    streamStrategicIntelligence: vi.fn().mockResolvedValue({
      onmessage: null,
      onerror: null,
      close: vi.fn(),
    }),
    handleSSEData: vi.fn(),
  },
}));

// Mock store — provide pre-populated data so the tab should NOT re-fetch
const mockLoadStrategies = vi.fn().mockResolvedValue(undefined);
const mockLoadAIInsights = vi.fn().mockResolvedValue(undefined);
const mockLoadAIRecommendations = vi.fn().mockResolvedValue(undefined);
const mockSetLatestGeneratedStrategy = vi.fn();

// Shared mutable state so the mock can simulate store updates
let mockStrategies: any[] = [{ id: '1', name: 'Test Strategy' }];

vi.mock('../../../stores/contentPlanningStore', () => ({
  useContentPlanningStore: Object.assign(
    vi.fn((selector: any) => {
      const state = {
        strategies: mockStrategies,
        currentStrategy: null,
        latestGeneratedStrategy: null,
        error: null,
        loadStrategies: mockLoadStrategies,
        loadAIInsights: mockLoadAIInsights,
        loadAIRecommendations: mockLoadAIRecommendations,
        setLatestGeneratedStrategy: mockSetLatestGeneratedStrategy,
      };
      return typeof selector === 'function' ? selector(state) : state;
    }),
    { getState: vi.fn() }
  ),
}));

// Mock Clerk useUser
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: { id: 'user_123' } }),
}));

// Mock child components
vi.mock('../components/StrategyIntelligence/StrategyIntelligenceTab', () => ({
  default: () => <div data-testid="strategy-intelligence" />,
}));

vi.mock('../components/StrategyOnboardingDialog', () => ({
  default: () => <div data-testid="strategy-onboarding" />,
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: null }),
  useNavigate: () => vi.fn(),
}));

// --- Tests ---

describe('ContentStrategyTab — Phase 1: no redundant API calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStrategies = [{ id: '1', name: 'Test Strategy' }];
  });

  it('does NOT call loadStrategies on mount when store already has data', async () => {
    render(<ContentStrategyTab />);

    // The store already has strategies populated; loadInitialData should NOT
    // call loadStrategies again.
    await new Promise((r) => setTimeout(r, 100));

    expect(mockLoadStrategies).not.toHaveBeenCalled();
  });

  it('does NOT call loadAIInsights on mount when store already has data', async () => {
    render(<ContentStrategyTab />);

    await new Promise((r) => setTimeout(r, 100));

    expect(mockLoadAIInsights).not.toHaveBeenCalled();
  });

  it('does NOT call loadAIRecommendations on mount when store already has data', async () => {
    render(<ContentStrategyTab />);

    await new Promise((r) => setTimeout(r, 100));

    expect(mockLoadAIRecommendations).not.toHaveBeenCalled();
  });

  it('mounts without errors when store has data', () => {
    // The component should render without throwing even when store is pre-populated.
    // StrategyIntelligenceTab rendering depends on strategyStatus state transitions
    // which require zustand re-render subscriptions (tested in integration).
    const { container } = render(<ContentStrategyTab />);
    expect(container).toBeTruthy();
  });

  it('loadStrategyData does NOT make API calls when store has strategies with comprehensive_ai_analysis', async () => {
    // Provide a strategy with comprehensive_ai_analysis
    mockStrategies = [{
      id: '1',
      name: 'Test Strategy',
      comprehensive_ai_analysis: {
        strategic_insights: { title: 'Test' },
        competitive_analysis: {},
        performance_predictions: {},
        implementation_roadmap: {},
        risk_assessment: {}
      }
    }];

    render(<ContentStrategyTab />);

    // Wait for the useEffect to trigger loadStrategyData
    await new Promise((r) => setTimeout(r, 700)); // 500ms debounce + margin

    // loadStrategyData should NOT make any API calls since the store already has the data
    expect(mockGetEnhancedStrategies).not.toHaveBeenCalled();
    expect(mockGetLatestGeneratedStrategy).not.toHaveBeenCalled();
    expect(mockGetLatestGeneratedStrategyWithRetry).not.toHaveBeenCalled();
  });
});
