export type GrowNetworkScrollTarget = "ai-advisor" | "live-linkedin";

export const GROW_NETWORK_MODAL_TITLE = "Grow Network";

export const GROW_NETWORK_INTRO =
  "Daily relationship-building — discover who to connect with using grounded AI outreach and live LinkedIn suggestions.";

export const GROW_NETWORK_AI_SECTION = {
  title: "Network Advisor",
  sourceLabel: "Grounded AI",
  sourceDetail: "Profile + industry research · anti-hallucination",
  accent: "#dc2626",
} as const;

export const GROW_NETWORK_PYMK_SECTION = {
  title: "People You May Know",
  sourceLabel: "Live LinkedIn",
  sourceDetail: "Real suggestions from your LinkedIn account",
  accent: "#10b981",
} as const;

export const GROW_NETWORK_TILE = {
  title: "Grow Network",
  description: "AI outreach suggestions + live LinkedIn connections",
  icon: "🌐",
  accent: "#0a66c2",
} as const;

/** Copy for the Growth Engine teaser card (P5 dedup). */
export const GROW_NETWORK_ENGINE_LINK = {
  title: "Grow Network",
  description:
    "Grounded AI outreach + live LinkedIn connections in one workspace.",
  cta: "Open Grow Network →",
} as const;

export const GROW_NETWORK_CROSS_LINKS = {
  aiToLinkedIn: {
    message: "No grounded AI matches right now.",
    linkLabel: "Try live LinkedIn suggestions →",
    target: "live-linkedin" as const,
  },
  linkedInToAi: {
    message: "Nothing in this cohort?",
    linkLabel: "See Network Advisor →",
    target: "ai-advisor" as const,
  },
} as const;
