/**
 * LinkedIn publish API helpers (multipart + publish-specific errors).
 * Split from linkedinSocial.ts to keep files under 500 lines.
 */

import { apiClient, ConnectionError, NetworkError, RequestTimeoutError } from './client';
import type {
  LinkedInPublishPostRequest,
  LinkedInPublishPostResponse,
} from './linkedinSocial';

const BASE = '/api/linkedin-social';

/** Publish a LinkedIn post with a local image file (multipart/form-data). */
export async function publishLinkedInPostWithFile(
  payload: LinkedInPublishPostRequest,
  file: File,
): Promise<LinkedInPublishPostResponse> {
  const formData = new FormData();
  formData.append('content', payload.content);
  if (payload.account_id) {
    formData.append('account_id', payload.account_id);
  }
  formData.append('file', file);

  const response = await apiClient.post(`${BASE}/posts/publish`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180_000,
  });
  return response.data;
}

/** Map publish API failures (including media validation) to user-friendly messages. */
export function getLinkedInPublishErrorMessage(err: unknown): string {
  if (err instanceof RequestTimeoutError) {
    return 'Publishing is taking longer than expected. Please wait a moment and try again.';
  }

  if (err instanceof NetworkError) {
    return 'Cannot reach the ALwrity server. Check that the backend is running and try again.';
  }

  if (err instanceof ConnectionError) {
    return err.message || 'Backend server is experiencing issues. Please try again later.';
  }

  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: { status?: number; data?: { detail?: string | string[] } };
    };
    const status = axiosErr.response?.status;
    const detail = axiosErr.response?.data?.detail;
    const detailText = Array.isArray(detail)
      ? detail.join('; ')
      : typeof detail === 'string'
        ? detail
        : '';

    if (status === 401) {
      return 'LinkedIn is not connected. Connect your account in Settings and try again.';
    }

    if (status === 403) {
      return 'Insufficient permissions to publish to LinkedIn. Reconnect your account and try again.';
    }

    if (status === 409) {
      return detailText || 'This content matches a recent LinkedIn post. Edit before publishing.';
    }

    if (status === 501) {
      return 'LinkedIn publishing is not available for this provider. Contact support if this persists.';
    }

    if (status === 400 && detailText) {
      return mapMediaValidationDetail(detailText);
    }

    if (detailText) {
      return mapMediaValidationDetail(detailText);
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return 'Could not publish to LinkedIn. Please try again.';
}

function mapMediaValidationDetail(detail: string): string {
  const lower = detail.toLowerCase();

  if (lower.includes('duplicate') || lower.includes('recent linkedin post')) {
    return 'This content matches a recent LinkedIn post. Edit before publishing.';
  }

  if (lower.includes('not connected') || lower.includes('no linkedin account')) {
    return 'LinkedIn is not connected. Connect your account in Settings and try again.';
  }

  if (lower.includes('maximum 1 image') || lower.includes('either image_ids or an uploaded file')) {
    return 'Only one image can be published per post. Remove extra images and try again.';
  }

  if (lower.includes('invalid image id') || lower.includes('image not found')) {
    return 'The attached image could not be found. Regenerate or re-upload the image and try again.';
  }

  if (lower.includes('at least') && lower.includes('pixel')) {
    return 'Image is too small for LinkedIn. Use an image at least 552×276 pixels.';
  }

  if (lower.includes('under') && (lower.includes('mb') || lower.includes('8'))) {
    return 'Image must be under 8 MB. Choose a smaller file and try again.';
  }

  if (lower.includes('invalid image') || lower.includes('media validation')) {
    return 'Image format is not supported. Use PNG, JPEG, GIF, or WebP under 8 MB.';
  }

  if (lower.includes('empty')) {
    return 'Post content cannot be empty.';
  }

  return detail;
}
