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
  model?: string;
}

export interface LinkedInImageGenerationResult {
  success: boolean;
  imageId?: string;
  imageUrl?: string;
  style?: string;
  aspectRatio?: string;
  error?: string;
}

/** Max post body chars for the modal seed (backend may use full content_context). */
export const LINKEDIN_IMAGE_SEED_MAX_CHARS = 1200;

/** Fallback when draft/selection text is empty before image generation. */
export const LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK = 'LinkedIn post visual';

/**
 * Normalize raw post text into an image-generation seed (toolbar + selection parity).
 * Does not truncate — `buildPromptFromSelection` applies LINKEDIN_IMAGE_SEED_MAX_CHARS.
 */
export function resolveLinkedInImageSeedText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    console.debug(
      '[LinkedInImageService] resolveLinkedInImageSeedText: empty input, using fallback',
    );
    return LINKEDIN_IMAGE_EMPTY_SEED_FALLBACK;
  }
  console.debug('[LinkedInImageService] resolveLinkedInImageSeedText', {
    length: trimmed.length,
  });
  return trimmed;
}

/**
 * Build a LinkedIn cover-oriented seed prompt from post text.
 * Keeps enough post body for conceptual covers (esp. Gemini); backend applies model-specific constraints.
 */
export function buildPromptFromSelection(
  selectedText: string,
  topic?: string,
  industry?: string
): string {
  const body = selectedText.trim().slice(0, LINKEDIN_IMAGE_SEED_MAX_CHARS);
  const topicPart = topic ? `Topic: ${topic}.` : '';
  const industryPart = industry ? `Industry: ${industry}.` : '';
  return [
    'Create LinkedIn post cover image for below LinkedIn post -',
    body,
    topicPart,
    industryPart,
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();
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
    model: params.model,
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

/**
 * Trigger a browser download from an existing blob URL (mirrors downloadLinkedInVideoBlob).
 * Does not re-fetch when blobUrl is already available from generation preview.
 */
export function downloadLinkedInImageBlob(blobUrl: string, filename: string): void {
  if (!blobUrl) {
    console.error('[LinkedInImageService] download skipped: empty blobUrl');
    throw new Error('Image download failed: missing blob URL');
  }
  if (!filename.trim()) {
    console.error('[LinkedInImageService] download skipped: empty filename');
    throw new Error('Image download failed: missing filename');
  }

  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('[LinkedInImageService] image download triggered', { filename });
  } catch (err) {
    console.error('[LinkedInImageService] image download failed', {
      filename,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export interface LinkedInImageUploadResult {
  success: boolean;
  imageId?: string;
  imageUrl?: string;
  error?: string;
}

/** Upload a local image for LinkedIn Studio editor / publish flows. */
export async function uploadLinkedInImage(file: File): Promise<LinkedInImageUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await aiApiClient.post('/api/linkedin/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const data = response.data;
  if (!data?.success) {
    return {
      success: false,
      error: data?.error || 'Image upload failed',
    };
  }

  const imageId = normalizeImageId(data.image_id);
  const imageUrl = data.image_url || (imageId ? resolveLinkedInImageUrl(imageId) : undefined);

  return {
    success: true,
    imageId,
    imageUrl,
  };
}
