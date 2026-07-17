/**
 * LinkedIn publish media constants (aligned with backend LinkedInMediaValidator).
 */

/** Max image size aligned with backend LinkedInMediaValidator (8 MB). */
export const LINKEDIN_PUBLISH_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Accepted MIME types for local image upload. */
export const LINKEDIN_PUBLISH_ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
] as const;

export const LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp';
