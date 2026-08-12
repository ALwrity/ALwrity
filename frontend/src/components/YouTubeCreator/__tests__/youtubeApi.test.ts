import { youtubeApi } from '../../../services/youtubeApi';
import { longRunningApiClient } from '../../../api/client';

jest.mock('../../../api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
  aiApiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
  longRunningApiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe('youtubeApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPlan', () => {
    it('uses longRunningApiClient to post to /api/youtube/plan', async () => {
      const mockResponse = { data: { success: true, plan: { video_summary: 'Test summary' } } };
      jest.mocked(longRunningApiClient.post).mockResolvedValueOnce(mockResponse);

      const request = {
        user_idea: 'AI coding assistant',
        duration_type: 'shorts' as const,
      };

      const result = await youtubeApi.createPlan(request);
      expect(longRunningApiClient.post).toHaveBeenCalledWith('/api/youtube/plan', request);
      expect(result).toEqual(mockResponse.data);
    });

    it('handles timeout errors gracefully', async () => {
      const timeoutError = new Error('timeout of 60000ms exceeded');
      jest.mocked(longRunningApiClient.post).mockRejectedValueOnce(timeoutError);

      const request = {
        user_idea: 'AI coding assistant',
        duration_type: 'shorts' as const,
      };

      await expect(youtubeApi.createPlan(request)).rejects.toThrow(
        'Plan generation is taking longer than expected. Please check your internet connection and try again.'
      );
    });
  });

  describe('buildScenes', () => {
    it('uses longRunningApiClient to post to /api/youtube/scenes', async () => {
      const mockResponse = { data: { success: true, scenes: [] } };
      jest.mocked(longRunningApiClient.post).mockResolvedValueOnce(mockResponse);

      const videoPlan = {
        video_summary: 'Test summary',
        target_audience: 'Developers',
        content_outline: [],
        hook_strategy: 'Hook',
        visual_style: 'Realistic',
        seo_keywords: [],
        duration_type: 'shorts',
      };

      const result = await youtubeApi.buildScenes(videoPlan, 'Custom script');
      expect(longRunningApiClient.post).toHaveBeenCalledWith('/api/youtube/scenes', {
        video_plan: videoPlan,
        custom_script: 'Custom script',
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('handles timeout errors gracefully', async () => {
      const timeoutError = new Error('timeout of 60000ms exceeded');
      jest.mocked(longRunningApiClient.post).mockRejectedValueOnce(timeoutError);

      const videoPlan = {
        video_summary: 'Test summary',
        target_audience: 'Developers',
        content_outline: [],
        hook_strategy: 'Hook',
        visual_style: 'Realistic',
        seo_keywords: [],
        duration_type: 'shorts',
      };

      await expect(youtubeApi.buildScenes(videoPlan)).rejects.toThrow(
        'Scene generation is taking longer than expected. Please check your internet connection and try again.'
      );
    });
  });
});
