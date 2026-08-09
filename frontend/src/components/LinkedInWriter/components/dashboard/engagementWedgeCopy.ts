/**
 * Engagement wedge — ring, tile, and modal copy (thought-leader positioning).
 */

export const ENGAGEMENT_WEDGE_RING_DESCRIPTION =
  "Daily authority-building — reply, engage, and grow your network.";

export const ENGAGEMENT_WEDGE_MODAL_INTRO =
  "Your 15-minute thought-leader routine on LinkedIn.";

export const CONVERSATIONS_TO_JOIN_TILE = {
  title: "Conversations to Join",
  description: "Top 3 AI-identified conversations to engage with now",
  icon: "🎯",
  accent: "#059669",
} as const;

export const GROWTH_ENGINE_ENGAGEMENT_TILE = {
  title: "Growth Engine",
  description: "Weekly strategy & insights — see the full picture",
  icon: "🚀",
  accent: "#6366f1",
} as const;

export const CONVERSATIONS_TO_JOIN_MODAL = {
  title: "Conversations to Join",
  intro:
    "AI-identified conversations to engage with now — copy a comment, refine it, or create a post on the topic.",
  loadButton: "🚀 Load conversations",
  emptyTitle: "No conversations cached",
  emptyDesc:
    "Load AI analysis to find the top conversations to join in your industry.",
  moreInGrowthEngine: (count: number) =>
    `${count} more in Growth Engine — see all conversations →`,
} as const;

export const ENGAGEMENT_CARD_ALL_CONVERSATIONS = {
  title: "All Conversations to Join",
  subtitle:
    "Full list from your growth analysis. For your daily top 3, use the quick view.",
  dailyQuickViewCta: "Open daily quick view →",
} as const;
