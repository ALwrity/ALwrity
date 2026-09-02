/**
 * Rescue combined Video Creator output from listVideos() the same way scene clips are restored.
 * Combined library rows have no scene_number (scene clips always do).
 */
import type { VideoListItem } from "../../../services/youtubeApi";

function createdAtMs(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isYouTubeCombinedListItem(
  video: VideoListItem | null | undefined,
): boolean {
  if (!video || typeof video !== "object") return false;
  if (!video.video_url) return false;
  if (video.scene_number !== null && video.scene_number !== undefined) {
    return false;
  }
  if (typeof video.scene_count === "number") {
    return video.scene_count >= 2;
  }
  return true;
}

export function pickYouTubeCombinedVideoUrl(
  videos: VideoListItem[] | null | undefined,
): string | null {
  if (!videos?.length) return null;
  const combined = videos.filter(isYouTubeCombinedListItem);
  if (combined.length === 0) return null;
  combined.sort((a, b) => createdAtMs(b.created_at) - createdAtMs(a.created_at));
  return combined[0].video_url || null;
}

export function mapYouTubeSceneVideosByNumber(
  videos: VideoListItem[] | null | undefined,
): Map<number, string> {
  const videoMap = new Map<number, string>();
  if (!videos?.length) return videoMap;
  for (const video of videos) {
    if (!video || typeof video !== "object" || !video.video_url) continue;
    const sceneNum = video.scene_number;
    if (sceneNum === null || sceneNum === undefined) continue;
    if (!videoMap.has(sceneNum)) {
      videoMap.set(sceneNum, video.video_url);
    }
  }
  return videoMap;
}
