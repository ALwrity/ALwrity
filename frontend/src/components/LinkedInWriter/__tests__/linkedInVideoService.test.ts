import {
  buildVideoPromptFromSelection,
  resolveLinkedInVideoUrl,
  generateLinkedInVideo,
  pollLinkedInVideoTask,
  mapMotionToApi,
} from '../../../services/linkedInVideoService';
import { aiApiClient } from '../../../api/client';
import { checkPreflight } from '../../../services/billingService';

jest.mock('../../../api/client', () => ({
  aiApiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('../../../services/billingService', () => ({
  checkPreflight: jest.fn(),
}));

jest.mock('../../../utils/apiUrl', () => ({
  getApiBaseUrl: () => 'http://localhost:8000',
}));

describe('linkedInVideoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(checkPreflight).mockResolvedValue({ can_proceed: true, operations: [] });
  });

  describe('buildVideoPromptFromSelection', () => {
    it('returns a short seed prompt with topic and industry', () => {
      const prompt = buildVideoPromptFromSelection(
        'AI is transforming how teams collaborate.',
        'Future of Work',
        'Technology'
      );

      expect(prompt).toContain('AI is transforming how teams collaborate.');
      expect(prompt).toContain('Topic: Future of Work.');
      expect(prompt).toContain('Industry: Technology.');
      expect(prompt).toContain('Video for LinkedIn post:');
      expect(prompt).not.toContain('Professional business aesthetic');
    });
  });

  describe('resolveLinkedInVideoUrl', () => {
    it('builds correct path for video id', () => {
      expect(resolveLinkedInVideoUrl('abc123')).toBe(
        'http://localhost:8000/api/linkedin/videos/abc123'
      );
    });
  });

  describe('mapMotionToApi', () => {
    it('maps motion preset to lowercase API value', () => {
      expect(mapMotionToApi('Medium')).toBe('medium');
      expect(mapMotionToApi('Subtle')).toBe('subtle');
    });
  });

  describe('generateLinkedInVideo', () => {
    it('sends model in POST body when provided', async () => {
      jest.mocked(aiApiClient.post).mockResolvedValue({
        data: { task_id: 'task-model', status: 'pending', message: 'Started' },
      });

      await generateLinkedInVideo({
        prompt: 'Professional business video',
        selectedText: 'Leadership insights',
        topic: 'Leadership',
        industry: 'Business',
        model: 'ltx-2-pro',
      });

      expect(aiApiClient.post).toHaveBeenCalledWith(
        '/api/linkedin/generate-video',
        expect.objectContaining({ model: 'ltx-2-pro' })
      );
    });

    it('returns task_id on success', async () => {
      jest.mocked(aiApiClient.post).mockResolvedValue({
        data: {
          task_id: 'task-123',
          status: 'pending',
          message: 'Started',
        },
      });

      const result = await generateLinkedInVideo({
        prompt: 'Professional business video',
        selectedText: 'Leadership insights',
        topic: 'Leadership',
        industry: 'Business',
        aspectRatio: '16:9',
        duration: 5,
        resolution: '720p',
        motion: 'Medium',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-123');
      expect(aiApiClient.post).toHaveBeenCalledWith('/api/linkedin/generate-video', expect.objectContaining({
        aspect_ratio: '16:9',
        duration: 5,
        motion_preset: 'medium',
      }));
    });
  });

  describe('pollLinkedInVideoTask', () => {
    it('maps completed status and video_url', async () => {
      jest.mocked(aiApiClient.get).mockResolvedValue({
        data: {
          task_id: 'task-123',
          status: 'completed',
          result: {
            video_id: 'vid-456',
            video_url: 'http://localhost:8000/api/linkedin/videos/vid-456',
            asset_id: 99,
          },
        },
      });

      const result = await pollLinkedInVideoTask('task-123');

      expect(result.status).toBe('completed');
      expect(result.result?.video_url).toContain('vid-456');
      expect(result.result?.asset_id).toBe(99);
    });

    it('maps processing status to running', async () => {
      jest.mocked(aiApiClient.get).mockResolvedValue({
        data: {
          task_id: 'task-123',
          status: 'processing',
          message: 'Generating video...',
        },
      });

      const result = await pollLinkedInVideoTask('task-123');

      expect(result.status).toBe('running');
    });
  });
});
