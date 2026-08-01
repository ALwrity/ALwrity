export const LINKEDIN_CONNECT_LOCKED_HINT =
  "Connect LinkedIn to unlock this feature";

export const LINKEDIN_RECONNECT_HINT =
  "Your LinkedIn session expired. Reconnect to restore publishing and analytics.";

export const LINKEDIN_CONNECT_CTA = "Connect LinkedIn\u26a1";
export const LINKEDIN_RECONNECT_CTA = "Reconnect LinkedIn\u26a1";

export function getLinkedInConnectCta(needsReconnect?: boolean): string {
  return needsReconnect ? LINKEDIN_RECONNECT_CTA : LINKEDIN_CONNECT_CTA;
}

export function getLinkedInConnectLockedHint(needsReconnect?: boolean): string {
  return needsReconnect ? LINKEDIN_RECONNECT_HINT : LINKEDIN_CONNECT_LOCKED_HINT;
}

export const LINKEDIN_COPILOT_COMING_SOON_HINT =
  "Launching Soon ✨ — Chat to brainstorm ideas, refine drafts in real time, and stay on-brand with your persona.";

/** Create wedge — frontend-only lock; backend carousel/video APIs stay available elsewhere. */
export const CREATE_WEDGE_LOCKED_CONTENT_TYPES = new Set([
  "carousel",
  "video_script",
]);

export type CreateWedgeLockedContentType =
  | "carousel"
  | "video_script";

export const CREATE_WEDGE_NOTIFY_KEYS: Record<
  CreateWedgeLockedContentType,
  string
> = {
  carousel: "linkedin_create_carousel_notify_requested",
  video_script: "linkedin_create_video_script_notify_requested",
};

export function isCreateWedgeContentTypeLocked(
  type: string,
): type is CreateWedgeLockedContentType {
  return CREATE_WEDGE_LOCKED_CONTENT_TYPES.has(type);
}

export const LINKEDIN_CONNECT_LOCKED_HINTS = {
  growth: "Connect LinkedIn to unlock today\u2019s growth tasks",
  optimiseProfile: "Connect LinkedIn to optimise your profile",
  search: "Connect LinkedIn to search people, companies, and posts",
  analytics: "Connect LinkedIn to view post analytics",
  workflow: (title: string) => `Connect LinkedIn to unlock ${title}`,
} as const;
