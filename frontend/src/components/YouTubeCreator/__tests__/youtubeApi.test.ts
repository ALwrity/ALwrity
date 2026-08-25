import { youtubeApi } from '../../../services/youtubeApi';
import { apiClient, longRunningApiClient } from '../../../api/client';

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
    it('keeps POST /api/youtube/plan available (Plan step UI no longer calls it)', async () => {
      const mockResponse = { data: { success: true, plan: { video_summary: 'Test summary' } } };
      jest.mocked(longRunningApiClient.post).mockResolvedValueOnce(mockResponse);

      const request = {
        user_idea: 'AI coding assistant',
        duration_type: 'shorts' as const,
        enable_research: false,
      };

      const result = await youtubeApi.createPlan(request);
      expect(longRunningApiClient.post).toHaveBeenCalledWith('/api/youtube/plan', request);
      expect(request.enable_research).toBe(false);
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

  describe('generatePitch and expandPitchToScript', () => {
    it('posts pitch requests to /api/youtube/plan/pitch', async () => {
      const mockResponse = {
        data: {
          success: true,
          pitch: { selected_title: 'Stop Overpacking', main_content_beats: ['A', 'B', 'C'] },
          message: 'Pitch generated successfully',
        },
      };
      jest.mocked(longRunningApiClient.post).mockResolvedValueOnce(mockResponse);

      const request = {
        user_idea: 'Budget travel',
        duration_type: 'shorts' as const,
        creative_angle: 'Contrarian',
        enable_research: false,
      };

      const result = await youtubeApi.generatePitch(request);
      expect(longRunningApiClient.post).toHaveBeenCalledWith('/api/youtube/plan/pitch', request);
      expect(result.success).toBe(true);
      expect(result.pitch?.selected_title).toBe('Stop Overpacking');
    });

    it('forwards language on pitch and expand requests', async () => {
      jest.mocked(longRunningApiClient.post).mockResolvedValue({
        data: { success: true, pitch: { selected_title: 'Title' }, expansion: {}, full_script: 'Script' },
      });

      await youtubeApi.generatePitch({
        user_idea: 'Budget travel',
        duration_type: 'shorts',
        creative_angle: 'Contrarian',
        language: 'hi',
      });
      expect(longRunningApiClient.post).toHaveBeenCalledWith(
        '/api/youtube/plan/pitch',
        expect.objectContaining({ language: 'hi' }),
      );

      await youtubeApi.expandPitchToScript({
        user_idea: 'Budget travel',
        duration_type: 'shorts',
        language: 'hi',
        approved_pitch: { selected_title: 'Stop Overpacking' },
      });
      expect(longRunningApiClient.post).toHaveBeenCalledWith(
        '/api/youtube/plan/expand',
        expect.objectContaining({ language: 'hi' }),
      );
    });

    it('posts expand requests to /api/youtube/plan/expand', async () => {
      const mockResponse = {
        data: {
          success: true,
          expansion: { full_script: 'Hook.\n\nBody.' },
          full_script: 'Hook.\n\nBody.',
          message: 'Pitch expanded to full script successfully',
        },
      };
      jest.mocked(longRunningApiClient.post).mockResolvedValueOnce(mockResponse);

      const request = {
        user_idea: 'Budget travel',
        duration_type: 'shorts' as const,
        approved_pitch: { selected_title: 'Stop Overpacking' },
      };

      const result = await youtubeApi.expandPitchToScript(request);
      expect(longRunningApiClient.post).toHaveBeenCalledWith('/api/youtube/plan/expand', request);
      expect(result.full_script).toBe('Hook.\n\nBody.');
    });

    it('maps timeout errors for pitch generation', async () => {
      const timeoutError = new Error('timeout of 60000ms exceeded');
      jest.mocked(longRunningApiClient.post).mockRejectedValueOnce(timeoutError);

      await expect(
        youtubeApi.generatePitch({
          user_idea: 'Budget travel',
          duration_type: 'shorts',
          creative_angle: 'Contrarian',
        }),
      ).rejects.toThrow(
        'Pitch generation is taking longer than expected. Please check your internet connection and try again.',
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

  describe('generateSceneImage and status polling', () => {
    it('posts image generation task request to /api/youtube/image', async () => {
      const mockResponse = { data: { success: true, task_id: 'task-123', message: 'Task started' } };
      jest.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const params = {
        sceneId: '1',
        sceneTitle: 'Scene Title',
        sceneContent: 'Scene Content',
        width: 1024,
        height: 576,
      };

      const result = await youtubeApi.generateSceneImage(params);
      expect(apiClient.post).toHaveBeenCalledWith('/api/youtube/image', expect.objectContaining({
        scene_id: '1',
        scene_title: 'Scene Title',
        scene_content: 'Scene Content',
      }));
      expect(result).toEqual(mockResponse.data);
    });

    it('fetches image generation status from /api/youtube/image/status/:taskId', async () => {
      const mockStatus = { status: 'completed', progress: 100, result: { image_url: '/api/youtube/images/scenes/1.png' } };
      jest.mocked(apiClient.get).mockResolvedValueOnce({ data: mockStatus });

      const result = await youtubeApi.getImageGenerationStatus('task-123');
      expect(apiClient.get).toHaveBeenCalledWith('/api/youtube/image/status/task-123');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('combineVideos and video URL helpers', () => {
    it('posts combine request with scene_video_urls to /api/youtube/render/combine', async () => {
      const mockResponse = {
        data: { success: true, task_id: 'combine-1', message: 'Combining 2 videos...' },
      };
      jest.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const params = {
        scene_video_urls: [
          '/api/youtube/videos/scene_1_user_abcd_11111111.mp4',
          '/api/youtube/videos/scene_2_user_abcd_22222222.mp4',
        ],
        resolution: '720p' as const,
        title: 'My YouTube Video',
      };

      const result = await youtubeApi.combineVideos(params);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/youtube/render/combine',
        expect.objectContaining({
          scene_video_urls: params.scene_video_urls,
          resolution: '720p',
          title: 'My YouTube Video',
        }),
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('builds video serve URLs under /api/youtube/videos', () => {
      expect(youtubeApi.getVideoUrl('scene_1_user_abcd_11111111.mp4')).toBe(
        '/api/youtube/videos/scene_1_user_abcd_11111111.mp4',
      );
    });
  });
});
