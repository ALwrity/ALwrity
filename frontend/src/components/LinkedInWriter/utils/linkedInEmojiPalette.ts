/**
 * Shared LinkedIn emoji palette (Comment Assistant + Assistive Editor).
 * No third-party emoji package — keep the set compact for LinkedIn posts/replies.
 */

export const LINKEDIN_EMOJI_PALETTE = [
  "👍",
  "👏",
  "🙏",
  "🎉",
  "🔥",
  "💯",
  "✨",
  "🚀",
  "😊",
  "😄",
  "😍",
  "🤔",
  "😂",
  "🙌",
  "💪",
  "❤️",
  "💡",
  "✅",
  "📌",
  "🌟",
  "🤝",
  "👀",
  "💬",
  "🎯",
] as const;

export type LinkedInEmoji = (typeof LINKEDIN_EMOJI_PALETTE)[number];
