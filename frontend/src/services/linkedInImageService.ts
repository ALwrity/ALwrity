import { aiApiClient } from '../api/client';
import { getApiBaseUrl } from '../utils/apiUrl';
import type { AspectRatio, ImageStyle } from '../components/shared/ImageGenerationModal.types';

export interface LinkedInImageGenerationParams {
  prompt: string;
  selectedText: string;
  topic?: string;
  industry?: string;
  style?: ImageStyle | string;
  aspectRatio?: AspectRatio | string;
  contentType?: string;
}

export interface LinkedInImageGenerationResult {
  success: boolean;
  imageId?: string;
  imageUrl?: string;
  style?: string;
  aspectRatio?: string;
  error?: string;
}

/** Build a LinkedIn-optimized visual prompt from selected post text. */
export function buildPromptFromSelection(
  selectedText: string,
  topic?: string,
  industry?: string
): string {
  const snippet = selectedText.trim().slice(0, 400);
  const topicLine = topic ? `Topic: ${topic}.` : '';
  const industryLine = industry ? `Industry: ${industry}.` : '';
  return [
    'Create a professional LinkedIn post image that visually supports this content:',
    snippet,
    topicLine,
    industryLine,
    'Professional business aesthetic, mobile-optimized, clear visual hierarchy, no cluttered text overlays.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Map modal aspect ratio to LinkedIn API aspect ratio values. */
export function mapAspectRatioToLinkedIn(ratio: AspectRatio | string): string {
  switch (ratio) {
    case '16:9':
      return '1.91:1';
    case '3:4':
      return '1:1.25';
    default:
      return ratio;
  }
}

/** Resolve a fetchable URL for a stored LinkedIn image. */
export function resolveLinkedInImageUrl(imageId: string, baseUrl?: string): string {
  const base = (baseUrl || getApiBaseUrl()).replace(/\/$/, '');
  return `${base}/api/linkedin/images/${imageId}`;
}

function normalizeImageId(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'image_id' in raw) {
    return String((raw as { image_id: string }).image_id);
  }
  return undefined;
}

/** Generate a LinkedIn image via the backend API. */
export async function generateLinkedInImage(
  params: LinkedInImageGenerationParams
): Promise<LinkedInImageGenerationResult> {
  const aspectRatio = mapAspectRatioToLinkedIn(params.aspectRatio || '1:1');

  const response = await aiApiClient.post('/api/linkedin/generate-image', {
    prompt: params.prompt,
    content_context: {
      topic: params.topic || 'LinkedIn post',
      industry: params.industry || 'Business',
      content_type: params.contentType || 'post',
      content: params.selectedText,
      style: params.style || 'Realistic',
    },
    aspect_ratio: aspectRatio,
  });

  const data = response.data;
  if (!data?.success) {
    return {
      success: false,
      error: data?.error || 'Image generation failed',
    };
  }

  const imageId = normalizeImageId(data.image_id);
  const imageUrl = data.image_url || (imageId ? resolveLinkedInImageUrl(imageId) : undefined);

  return {
    success: true,
    imageId,
    imageUrl,
    style: data.style,
    aspectRatio: data.aspect_ratio || aspectRatio,
  };
}

/** Fetch image bytes for authenticated preview (returns blob URL). */
export async function fetchLinkedInImageBlobUrl(imageId: string): Promise<string> {
  const response = await aiApiClient.get(`/api/linkedin/images/${imageId}`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(response.data);
}
