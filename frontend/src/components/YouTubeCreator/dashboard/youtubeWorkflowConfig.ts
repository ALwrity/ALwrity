/**
 * YouTube Creator Studio — Radial Workflow Hero wedge configuration.
 * Mirrors Blog/LinkedIn Studio lifecycle IDs; self-contained (no LinkedIn imports).
 */
import type { SvgIconComponent } from "@mui/icons-material";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import EventNoteIcon from "@mui/icons-material/EventNote";
import PublishIcon from "@mui/icons-material/Publish";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

export type YouTubeWorkflowCardId =
  | "plan"
  | "create"
  | "publish"
  | "analysis"
  | "engagement"
  | "remarket";

export interface YouTubeWorkflowCard {
  id: YouTubeWorkflowCardId;
  title: string;
  description: string;
  icon: SvgIconComponent;
  accent: string;
  startAngle: number;
  endAngle: number;
}

export const YOUTUBE_WORKFLOW_ICONS: Record<
  YouTubeWorkflowCardId,
  SvgIconComponent
> = {
  plan: EventNoteIcon,
  create: AutoAwesomeIcon,
  publish: PublishIcon,
  analysis: AnalyticsIcon,
  engagement: TrendingUpIcon,
  remarket: AutorenewIcon,
};

export const WEDGE_PANEL_GAP_DEG = 2.4;
export const WORKFLOW_WEDGE_COUNT = 6;
export const WORKFLOW_ARC_SPAN_DEG = 360;
export const WORKFLOW_WEDGE_SLICE_DEG =
  WORKFLOW_ARC_SPAN_DEG / WORKFLOW_WEDGE_COUNT;
export const WORKFLOW_FIRST_WEDGE_CENTER_DEG = 90;

const CARD_DEFS: Array<
  Omit<YouTubeWorkflowCard, "startAngle" | "endAngle" | "icon">
> = [
  {
    id: "plan",
    title: "Plan",
    description: "Niche ideas, Channel Bible, trends, and series strategy",
    accent: "#6366f1",
  },
  {
    id: "create",
    title: "Create",
    description: "Scripts, scenes, thumbnails, and SEO packs — you approve every word",
    accent: "#ec4899",
  },
  {
    id: "publish",
    title: "Publish",
    description: "Drafts, quality check, connect channel, ship or schedule",
    accent: "#0ea5e9",
  },
  {
    id: "analysis",
    title: "Analysis",
    description: "Channel health, video SEO, and what to make next",
    accent: "#8b5cf6",
  },
  {
    id: "engagement",
    title: "Engagement",
    description: "15-minute authority routine — reply, pin, community",
    accent: "#10b981",
  },
  {
    id: "remarket",
    title: "Remarket",
    description: "Refresh winners — Shorts, sequels, and cross-format authority",
    accent: "#f59e0b",
  },
];

export function wedgeAnglesForIndex(
  index: number,
): Pick<YouTubeWorkflowCard, "startAngle" | "endAngle"> {
  const center =
    WORKFLOW_FIRST_WEDGE_CENTER_DEG - index * WORKFLOW_WEDGE_SLICE_DEG;
  const half = WORKFLOW_WEDGE_SLICE_DEG / 2;
  return { startAngle: center + half, endAngle: center - half };
}

export const YOUTUBE_WORKFLOW_CARDS: YouTubeWorkflowCard[] = CARD_DEFS.map(
  (card, index) => ({
    ...card,
    icon: YOUTUBE_WORKFLOW_ICONS[card.id],
    ...wedgeAnglesForIndex(index),
  }),
);

export const FRAME_COLOR = "#FECACA";
export const RECOMMENDED_WORKFLOW_CARD_ID: YouTubeWorkflowCardId = "plan";

export const MOBILE_PRIMARY_WORKFLOW_IDS: readonly YouTubeWorkflowCardId[] = [
  "plan",
  "create",
];

/** When true, all Studio Hub wedges open without OAuth connect gates (testing mode). */
export const STUDIO_HUB_UNLOCK_ALL_FOR_TESTING = true;

const DEFAULT_CONNECT_GATED_WORKFLOW_IDS: readonly YouTubeWorkflowCardId[] = [
  "analysis",
  "engagement",
  "remarket",
];

/** Wedges that require YouTube OAuth when disconnected. Empty while testing unlock is on. */
export const CONNECT_GATED_WORKFLOW_IDS: readonly YouTubeWorkflowCardId[] =
  STUDIO_HUB_UNLOCK_ALL_FOR_TESTING ? [] : DEFAULT_CONNECT_GATED_WORKFLOW_IDS;

export const PLAN_PINNED_HINT_KEY = "youtube_dashboard_plan_hint_dismissed";

export const WEDGE_MODAL_INTROS: Record<YouTubeWorkflowCardId, string> = {
  plan: "AI suggests topics for your niche — you pick the one that sounds like your channel.",
  create:
    "Authority content for your niche — draft it like you’d say it on camera. HITL on every title and scene.",
  publish:
    "Nothing goes live until you confirm title, description, and privacy.",
  analysis:
    "Learn what worked, then feed winners back into Plan and Remarket.",
  engagement:
    "Your 15-minute thought-leader routine — ALwrity drafts replies; you send what you’d actually say.",
  remarket:
    "Extract more ROI from content that already worked — Shorts, sequels, and cross-format authority.",
};
