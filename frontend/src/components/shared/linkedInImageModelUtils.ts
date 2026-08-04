/**
 * LinkedIn image model defaults and validation helpers.
 */

import type { LinkedInImageModel } from './ImageGenerationModal.types';
import { LINKEDIN_IMAGE_MODELS } from './ImageGenerationPresets';

/** Default model for LinkedIn Studio image generation (toolbar + text selection). */
export const LINKEDIN_DEFAULT_IMAGE_MODEL: LinkedInImageModel =
  'gemini-3-pro-image';

const VALID_LINKEDIN_IMAGE_MODEL_IDS = new Set(
  LINKEDIN_IMAGE_MODELS.map((model) => model.id),
);

/**
 * Resolve a user/API model id to a supported LinkedIn image model.
 * Falls back to LINKEDIN_DEFAULT_IMAGE_MODEL when missing or unknown.
 */
export function coerceLinkedInImageModel(model?: string): LinkedInImageModel {
  if (
    model &&
    VALID_LINKEDIN_IMAGE_MODEL_IDS.has(model as LinkedInImageModel)
  ) {
    return model as LinkedInImageModel;
  }

  if (model) {
    console.debug('[LinkedInImageModels] unknown model, using default', {
      model,
      default: LINKEDIN_DEFAULT_IMAGE_MODEL,
    });
  }

  return LINKEDIN_DEFAULT_IMAGE_MODEL;
}
