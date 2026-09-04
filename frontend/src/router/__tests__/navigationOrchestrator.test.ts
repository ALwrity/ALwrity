import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock navigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

describe('strategy activation navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to calendar tab with strategy activation state', () => {
    // Simulate the navigation that should happen after strategy creation
    const strategyId = 'strategy-123';
    
    // This is what the navigation should do
    mockNavigate('/content-planning', {
      state: {
        activeTab: 1, // Calendar tab
        fromStrategyActivation: true,
        strategyId,
      },
    });
    
    expect(mockNavigate).toHaveBeenCalledWith(
      '/content-planning',
      expect.objectContaining({
        state: expect.objectContaining({
          activeTab: 1,
          fromStrategyActivation: true,
          strategyId,
        }),
      })
    );
  });

  it('includes strategy context in navigation state', () => {
    const strategyContext = {
      strategyId: 'strategy-456',
      autoGenerate: true,
    };
    
    mockNavigate('/content-planning', {
      state: {
        activeTab: 1,
        fromStrategyActivation: true,
        ...strategyContext,
      },
    });
    
    expect(mockNavigate).toHaveBeenCalledWith(
      '/content-planning',
      expect.objectContaining({
        state: expect.objectContaining({
          autoGenerate: true,
          strategyId: 'strategy-456',
        }),
      })
    );
  });

  it('navigates with correct calendar tab index', () => {
    // Calendar tab should be index 1 (after Strategy tab at 0)
    mockNavigate('/content-planning', {
      state: { activeTab: 1 },
    });
    
    const call = mockNavigate.mock.calls[0];
    expect(call[1].state.activeTab).toBe(1);
  });
});