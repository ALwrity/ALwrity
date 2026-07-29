/**
 * Blog Writer Radial Workflow Hero — wedge configuration.
 *
 * Mirrors the pattern established by LinkedIn Studio's
 * `dashboard/dashboardWorkflowConfig.ts` (6 equal wedges around a hub), but is
 * a self-contained, Blog-Writer-specific config. It intentionally does not
 * import from the LinkedIn dashboard folder so the two studios can evolve
 * independently without regression risk to either.
 */
import type { SvgIconComponent } from "@mui/icons-material";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import EventNoteIcon from "@mui/icons-material/EventNote";
import PublishIcon from "@mui/icons-material/Publish";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

export type BlogWorkflowCardId =
  | "plan"
  | "create"
  | "publish"
  | "analysis"
  | "engagement"
  | "remarket";

export interface BlogWorkflowCard {
  id: BlogWorkflowCardId;
  title: string;
  description: string;
  icon: SvgIconComponent;
  accent: string;
  /** Wedge start angle (degrees, 0 = right, 90 = top, 180 = left) */
  startAngle: number;
  endAngle: number;
}

export const BLOG_WORKFLOW_ICONS: Record<BlogWorkflowCardId, SvgIconComponent> = {
  plan: EventNoteIcon,
  create: AutoAwesomeIcon,
  publish: PublishIcon,
  analysis: AnalyticsIcon,
  engagement: TrendingUpIcon,
  remarket: AutorenewIcon,
};

/** Uniform gap between adjacent wedges (degrees). */
export const WEDGE_PANEL_GAP_DEG = 2.4;

export const WORKFLOW_WEDGE_COUNT = 6;
export const WORKFLOW_ARC_SPAN_DEG = 360;
export const WORKFLOW_WEDGE_SLICE_DEG =
  WORKFLOW_ARC_SPAN_DEG / WORKFLOW_WEDGE_COUNT;

/** First wedge (Plan) centered at top; remaining cards follow clockwise. */
export const WORKFLOW_FIRST_WEDGE_CENTER_DEG = 90;

const CARD_DEFS: Array<Omit<BlogWorkflowCard, "startAngle" | "endAngle" | "icon">> = [
  {
    id: "plan",
    title: "Plan",
    description: "Research, keyword strategy, and topic ideas from Search Console",
    accent: "#6366f1",
  },
  {
    id: "create",
    title: "Create",
    description: "AI outline and section-by-section content drafting",
    accent: "#ec4899",
  },
  {
    id: "publish",
    title: "Publish",
    description: "Ship to WordPress or Wix and save to your asset library",
    accent: "#0ea5e9",
  },
  {
    id: "analysis",
    title: "Analysis",
    description: "SEO score, readability, and actionable recommendations",
    accent: "#8b5cf6",
  },
  {
    id: "engagement",
    title: "Engagement",
    description: "Search visibility and quick-win queries from Search Console",
    accent: "#10b981",
  },
  {
    id: "remarket",
    title: "Remarket",
    description: "Refresh and repurpose your best-performing posts",
    accent: "#f59e0b",
  },
];

export function wedgeAnglesForIndex(
  index: number,
): Pick<BlogWorkflowCard, "startAngle" | "endAngle"> {
  const center =
    WORKFLOW_FIRST_WEDGE_CENTER_DEG + index * WORKFLOW_WEDGE_SLICE_DEG;
  const half = WORKFLOW_WEDGE_SLICE_DEG / 2;
  return { startAngle: center + half, endAngle: center - half };
}

/** Six equal wedges forming a full 360° ring around the profile hub. */
export const BLOG_WORKFLOW_CARDS: BlogWorkflowCard[] = CARD_DEFS.map(
  (card, index) => ({
    ...card,
    icon: BLOG_WORKFLOW_ICONS[card.id],
    ...wedgeAnglesForIndex(index),
  }),
);

export const FRAME_COLOR = "#BCE0FD";

export const RECOMMENDED_WORKFLOW_CARD_ID: BlogWorkflowCardId = "plan";

/** Mobile landing: Plan + Create shown first (research-then-write journey). */
export const MOBILE_PRIMARY_WORKFLOW_IDS: readonly BlogWorkflowCardId[] = [
  "plan",
  "create",
];

/** Workflow cards that require a connected publishing platform (WordPress/Wix). */
export const CONNECT_GATED_WORKFLOW_IDS: readonly BlogWorkflowCardId[] = [
  "publish",
];

export const PLAN_PINNED_HINT_KEY = "blog_dashboard_plan_hint_dismissed";
