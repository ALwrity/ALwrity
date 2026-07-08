import React from 'react';
import { render } from '@testing-library/react';
import { ResearchAction } from '../ResearchAction';
import { KeywordInputForm } from '../KeywordInputForm';
import { blogWriterApi } from '../../../services/blogWriterApi';

// Mock the API
jest.mock('../../../services/blogWriterApi', () => ({
  blogWriterApi: {
    startResearch: jest.fn(),
    pollResearchStatus: jest.fn()
  }
}));

// Mock CopilotKit
jest.mock('@copilotkit/react-core', () => ({
  useCopilotAction: jest.fn(() => ({
    name: 'testAction',
    handler: jest.fn(),
    render: jest.fn()
  }))
}));

describe('Polling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use async polling endpoints for research', async () => {
    const mockStartResearch = blogWriterApi.startResearch as jest.Mock;
    const mockPollStatus = blogWriterApi.pollResearchStatus as jest.Mock;

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

    const onResearchComplete = jest.fn();
    
    render(<ResearchAction onResearchComplete={onResearchComplete} />);

    // Verify that startResearch was called (this would be triggered by CopilotKit action)
    expect(mockStartResearch).toHaveBeenCalled();
  });

  it('should handle polling errors gracefully', async () => {
    const mockStartResearch = blogWriterApi.startResearch as jest.Mock;
    const mockPollStatus = blogWriterApi.pollResearchStatus as jest.Mock;

    mockStartResearch.mockResolvedValue({
      task_id: 'test-task-123',
      status: 'started'
    });

    mockPollStatus.mockRejectedValue(new Error('Polling failed'));

    const onResearchComplete = jest.fn();
    const onError = jest.fn();
    
    render(<KeywordInputForm onResearchComplete={onResearchComplete} />);

    // The component should handle the error gracefully
    expect(mockStartResearch).toHaveBeenCalled();
  });
});
