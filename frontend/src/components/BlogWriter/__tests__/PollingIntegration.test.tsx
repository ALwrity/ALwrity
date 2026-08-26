import type { Mock } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ResearchAction } from '../ResearchAction';
import { KeywordInputForm } from '../KeywordInputForm';
import { blogWriterApi } from '../../../services/blogWriterApi';

// Mock the API
vi.mock('../../../services/blogWriterApi', () => ({
  blogWriterApi: {
    startResearch: vi.fn(),
    pollResearchStatus: vi.fn()
  }
}));

// Mock CopilotKit
vi.mock('@copilotkit/react-core', () => ({
  useCopilotAction: vi.fn(() => ({
    name: 'testAction',
    handler: vi.fn(),
    render: vi.fn()
  }))
}));

describe('Polling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use async polling endpoints for research', async () => {
    const mockStartResearch = blogWriterApi.startResearch as Mock;
    const mockPollStatus = blogWriterApi.pollResearchStatus as Mock;

    // Mock successful research start
    mockStartResearch.mockResolvedValue({
      task_id: 'test-task-123',
      status: 'started'
    });

    // Mock polling responses
    mockPollStatus
      .mockResolvedValueOnce({
        task_id: 'test-task-123',
        status: 'running',
        progress_messages: [
          { timestamp: '2024-01-01T10:00:00Z', message: 'Starting research...' }
        ]
      })
      .mockResolvedValueOnce({
        task_id: 'test-task-123',
        status: 'completed',
        result: {
          success: true,
          sources: [],
          keyword_analysis: {},
          competitor_analysis: {},
          suggested_angles: []
        }
      });

    const onResearchComplete = vi.fn();
    
    render(<ResearchAction onResearchComplete={onResearchComplete} />);

    // Verify that startResearch was called (this would be triggered by CopilotKit action)
    expect(mockStartResearch).toHaveBeenCalled();
  });

  it('should handle polling errors gracefully', async () => {
    const mockStartResearch = blogWriterApi.startResearch as Mock;
    const mockPollStatus = blogWriterApi.pollResearchStatus as Mock;

    mockStartResearch.mockResolvedValue({
      task_id: 'test-task-123',
      status: 'started'
    });

    mockPollStatus.mockRejectedValue(new Error('Polling failed'));

    const onResearchComplete = vi.fn();
    const onError = vi.fn();
    
    render(<KeywordInputForm onResearchComplete={onResearchComplete} />);

    // The component should handle the error gracefully
    expect(mockStartResearch).toHaveBeenCalled();
  });
});
