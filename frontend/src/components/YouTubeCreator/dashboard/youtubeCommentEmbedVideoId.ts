/**
 * True only for IDs the IFrame Player API can cue (videos#id).
 */

const YOUTUBE_IFRAME_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYouTubeIframeVideoId(
  videoId: string | null | undefined,
): boolean {
  const raw = (videoId || "").trim();
  return YOUTUBE_IFRAME_VIDEO_ID.test(raw);
}
