/**
 * Build a Channel Bible context string for YouTube brainstorm.
 * Mirrors backend serialize_for_prompt identity fields; never invents a niche.
 */

import type { YouTubeChannelBible } from "../../../services/youtubeApi";
import type { YouTubeContentLanguage } from "../constants";
import type { YouTubeCreatorState } from "../../../hooks/useYouTubeCreatorState";

export function buildChannelBibleContext(
  bible: YouTubeChannelBible | null | undefined,
): string {
  if (!bible) return "";

  const niche = (bible.niche || "").trim();
  const audience = (bible.target_audience || "").trim();
  const style = (bible.brand_style || "").trim();
  const cta = (bible.default_cta || "").trim();
  if (!niche && !audience && !style && !cta) {
    return "";
  }

  const avatar = (bible.default_avatar_url || "").trim();
  const avatarSafe =
    avatar &&
    (avatar.startsWith("/") || avatar.startsWith("http")) &&
    !avatar.toLowerCase().includes("token=")
      ? avatar
      : "";

  const avatarLine = avatarSafe ? `- Default avatar path: ${avatarSafe}\n` : "";

  return (
    "<youtube_channel_bible>\n" +
    `- Channel: ${(bible.channel_name || "").trim() || "N/A"}\n` +
    `- Niche: ${niche || "N/A"}\n` +
    `- Audience: ${audience || "N/A"}\n` +
    `- Tone: ${(bible.tone || "").trim() || "N/A"}\n` +
    `- Brand / visual style: ${style || "N/A"}\n` +
    `- Visual guide: ${(bible.visual_style_guide || "").trim() || "N/A"}\n` +
    `- Default goal: ${(bible.default_video_goal || "").trim() || "N/A"}\n` +
    `- Default CTA: ${cta || "N/A"}\n` +
    avatarLine +
    "Use this as the channel's standing identity. Do not contradict it unless " +
    "the user's video idea clearly requires it.\n" +
    "</youtube_channel_bible>"
  );
}

export function hasChannelBibleIdentity(
  bible: YouTubeChannelBible | null | undefined,
): boolean {
  return Boolean(buildChannelBibleContext(bible));
}

/**
 * Map Channel Bible defaults onto Video Creator Plan fields.
 * Shared by Video Creator Apply and Studio Hub Plan wedge Apply.
 */
export function buildPlanFieldUpdatesFromChannelBible(
  bible: YouTubeChannelBible,
): Partial<YouTubeCreatorState> {
  const updates: Partial<YouTubeCreatorState> = {
    targetAudience: bible.target_audience || "",
    videoGoal: bible.default_video_goal || "",
    brandStyle: bible.brand_style || "",
    referenceImage: bible.visual_style_guide || "",
  };
  if (bible.default_language?.trim()) {
    updates.language = bible.default_language as YouTubeContentLanguage;
  }
  if (bible.default_avatar_url?.trim()) {
    updates.avatarUrl = bible.default_avatar_url;
  }
  return updates;
}
