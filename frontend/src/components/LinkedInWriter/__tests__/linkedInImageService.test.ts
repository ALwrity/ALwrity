import {
  buildPromptFromSelection,
  resolveLinkedInImageUrl,
  generateLinkedInImage,
  mapAspectRatioToLinkedIn,
} from '../../../services/linkedInImageService';
import { aiApiClient } from '../../../api/client';

jest.mock('../../../api/client', () => ({
  aiApiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('../../../utils/apiUrl', () => ({
  getApiBaseUrl: () => 'http://localhost:8000',
}));

describe('linkedInImageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildPromptFromSelection', () => {
    it('returns a short seed prompt with topic and industry', () => {
      const prompt = buildPromptFromSelection(
        'AI is transforming how teams collaborate.',
        'Future of Work',
        'Technology'
      );

      expect(prompt).toContain('AI is transforming how teams collaborate.');
      expect(prompt).toContain('Topic: Future of Work.');
      expect(prompt).toContain('Industry: Technology.');
      expect(prompt).toContain('Visual for LinkedIn post:');
      expect(prompt).not.toContain('Professional business aesthetic, mobile-optimized');
    });
  });

  describe('resolveLinkedInImageUrl', () => {
    it('builds correct path for image id', () => {
      expect(resolveLinkedInImageUrl('abc123')).toBe(
        'http://localhost:8000/api/linkedin/images/abc123'
      );
    });
  });

  describe('mapAspectRatioToLinkedIn', () => {
    it('maps 16:9 to LinkedIn 1.91:1 feed ratio', () => {
      expect(mapAspectRatioToLinkedIn('16:9')).toBe('1.91:1');
    });
  });

  describe('generateLinkedInImage', () => {
    it('sends model in POST body when provided', async () => {
      (aiApiClient.post as jest.Mock).mockResolvedValue({
        data: { success: true, image_id: 'model-test-id' },
      });

      await generateLinkedInImage({
        prompt: 'Professional LinkedIn visual',
        selectedText: 'Selected post excerpt.',
        topic: 'Leadership',
        industry: 'Business',
        model: 'flux-kontext-pro',
      });

      expect(aiApiClient.post).toHaveBeenCalledWith(
        '/api/linkedin/generate-image',
        expect.objectContaining({
          model: 'flux-kontext-pro',
          prompt: 'Professional LinkedIn visual',
        })
      );
    });

    it('logs URL on success', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      (aiApiClient.post as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          image_id: 'test-id-123',
        },
      });

      const result = await generateLinkedInImage({
        prompt: 'Professional LinkedIn visual',
        selectedText: 'Selected post excerpt for image context.',
        topic: 'Leadership',
        industry: 'Business',
      });

      expect(result.success).toBe(true);
      expect(result.imageId).toBe('test-id-123');
      expect(result.imageUrl).toContain('test-id-123');

      console.log('[LinkedInSelectionImage] Generated image URL:', result.imageUrl);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[LinkedInSelectionImage] Generated image URL:',
        expect.stringContaining('test-id-123')
      );

      consoleSpy.mockRestore();
    });

    it('returns error when API reports failure', async () => {
      (aiApiClient.post as jest.Mock).mockResolvedValue({
        data: {
          success: false,
          error: 'Provider unavailable',
        },
      });

      const result = await generateLinkedInImage({
        prompt: 'Test prompt',
        selectedText: 'Some selected text here.',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider unavailable');
    });
  });
});
