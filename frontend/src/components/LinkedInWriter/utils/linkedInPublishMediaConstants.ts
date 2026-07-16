/**
 * Feature flag for LinkedIn publish media UI (Phase 1–3).
 * Set REACT_APP_LINKEDIN_PUBLISH_MEDIA_ENABLED=false to hide media controls.
 * Backend media publish wiring lands in Phase 3; Phase 1 is UI-only.
 */
export const LINKEDIN_PUBLISH_MEDIA_ENABLED =
  process.env.REACT_APP_LINKEDIN_PUBLISH_MEDIA_ENABLED !== 'false';

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
