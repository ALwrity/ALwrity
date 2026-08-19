export interface YouTubeKnowledgeFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  action:
    | "studioGuide"
    | "channelBible"
    | "persona"
    | "bestPractices"
    | "quickStart"
    | "askAlwrity"
    | "multimodal";
}

export const YOUTUBE_KNOWLEDGE_CENTER_FEATURES: YouTubeKnowledgeFeature[] = [
  {
    id: "studio-guide",
    title: "Studio Guide",
    description: "Plan → Create → Publish → Analyse → Engage → Remarket in one cockpit.",
    icon: "🗺️",
    accent: "#6366f1",
    action: "studioGuide",
  },
  {
    id: "channel-bible",
    title: "Channel Bible",
    description: "Keep niche, audience, CTA, and tone consistent across every video.",
    icon: "📖",
    accent: "#0ea5e9",
    action: "channelBible",
  },
  {
    id: "persona",
    title: "YouTube Persona",
    description: "AI drafts in your voice — you review every public word (HITL).",
    icon: "👤",
    accent: "#ec4899",
    action: "persona",
  },
  {
    id: "best-practices",
    title: "Best Practices",
    description: "SME thought-leadership on YouTube: hooks, SEO, Shorts, CTAs.",
    icon: "📋",
    accent: "#057642",
    action: "bestPractices",
  },
  {
    id: "quick-start",
    title: "Quick Start",
    description: "Start with Plan, draft in Create, review, then Publish when it sounds like you.",
    icon: "🚀",
    accent: "#8b5cf6",
    action: "quickStart",
  },
  {
    id: "ask-alwrity",
    title: "Ask ALwrity",
    description: "YouTube Q&A with curated answers + your own free-text questions.",
    icon: "💬",
    accent: "#f97316",
    action: "askAlwrity",
  },
  {
    id: "multimodal",
    title: "Multimodal",
    description: "Scenes, images, narration, and rendered video in one HITL flow.",
    icon: "🎨",
    accent: "#10b981",
    action: "multimodal",
  },
];

export const YOUTUBE_ASK_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Where should I start each day?",
    a: "Open Studio Hub → Plan (START HERE), pick one idea, then Create. Review every title and scene before you spend render credits.",
  },
  {
    q: "What is HITL in YouTube Creator?",
    a: "Human-in-the-Loop: ALwrity proposes scripts, titles, SEO, and replies — you approve what goes public.",
  },
  {
    q: "How do I publish?",
    a: "Finish Render in Video Creator, then use Publish to YouTube (connect OAuth first). Confirm title, description, and privacy.",
  },
  {
    q: "How do I use Analysis?",
    a: "Open the Analysis wedge for Channel Pulse, video performance, SEO audit, content gaps, and retention. Connect YouTube OAuth for live channel data; plan-based tools work without OAuth.",
  },
];
