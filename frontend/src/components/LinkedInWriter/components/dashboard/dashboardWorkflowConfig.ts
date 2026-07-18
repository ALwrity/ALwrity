import type { SvgIconComponent } from '@mui/icons-material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PublishIcon from '@mui/icons-material/Publish';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export type DashboardWorkflowCardId =
  | 'plan'
  | 'create'
  | 'publish'
  | 'analysis'
  | 'engagement'
  | 'remarket';

export type DashboardWorkflowIconKey = DashboardWorkflowCardId;

export type DashboardWorkflowIcon = DashboardWorkflowIconKey | SvgIconComponent;

export const DASHBOARD_WORKFLOW_ICONS: Record<DashboardWorkflowIconKey, SvgIconComponent> = {
  plan: EventNoteIcon,
  create: AutoAwesomeIcon,
  publish: PublishIcon,
  analysis: AnalyticsIcon,
  engagement: TrendingUpIcon,
  remarket: AutorenewIcon,
};

export function resolveDashboardWorkflowIcon(icon: DashboardWorkflowIcon): SvgIconComponent {
  return typeof icon === 'string' ? DASHBOARD_WORKFLOW_ICONS[icon] : icon;
}

export interface DashboardWorkflowCard {
  id: DashboardWorkflowCardId;
  title: string;
  description: string;
  icon: DashboardWorkflowIcon;
  accent: string;
  /** Wedge start angle (degrees, 0 = right, 90 = top, 180 = left) */
  startAngle: number;
  endAngle: number;
}

/** Uniform gap between adjacent wedges (degrees). */
export const WEDGE_PANEL_GAP_DEG = 2.4;

export const WORKFLOW_WEDGE_COUNT = 6;
export const WORKFLOW_ARC_SPAN_DEG = 360;
export const WORKFLOW_WEDGE_SLICE_DEG = WORKFLOW_ARC_SPAN_DEG / WORKFLOW_WEDGE_COUNT;

/** First wedge (Plan) centered at bottom; remaining cards follow clockwise. */
export const WORKFLOW_FIRST_WEDGE_CENTER_DEG = 270;

const CARD_DEFS: Omit<DashboardWorkflowCard, 'startAngle' | 'endAngle'>[] = [
  {
    id: 'plan',
    title: 'Plan',
    description: 'Brainstorming, industry watchdog, and content strategy',
    icon: 'plan',
    accent: '#6366f1',
  },
  {
    id: 'create',
    title: 'Create',
    description: 'Post, article, video, and carousel content',
    icon: 'create',
    accent: '#ec4899',
  },
  {
    id: 'publish',
    title: 'Publish',
    description: 'Save drafts and schedule on your content calendar',
    icon: 'publish',
    accent: '#0ea5e9',
  },
  {
    id: 'analysis',
    title: 'Analysis',
    description: 'Profile, existing content, and SEO insights',
    icon: 'analysis',
    accent: '#8b5cf6',
  },
  {
    id: 'engagement',
    title: 'Engagement',
    description: 'Growth engine to enhance reach and interaction',
    icon: 'engagement',
    accent: '#10b981',
  },
  {
    id: 'remarket',
    title: 'Remarket',
    description: 'Refresh and improve high-performing content',
    icon: 'remarket',
    accent: '#f59e0b',
  },
];

export function wedgeAnglesForIndex(index: number): Pick<DashboardWorkflowCard, 'startAngle' | 'endAngle'> {
  const center = WORKFLOW_FIRST_WEDGE_CENTER_DEG - index * WORKFLOW_WEDGE_SLICE_DEG;
  const half = WORKFLOW_WEDGE_SLICE_DEG / 2;
  return { startAngle: center + half, endAngle: center - half };
}

/** Six equal wedges forming a full 360° ring around the profile hub. */
export const DASHBOARD_WORKFLOW_CARDS: DashboardWorkflowCard[] = CARD_DEFS.map((card, index) => ({
  ...card,
  ...wedgeAnglesForIndex(index),
}));

export const FRAME_COLOR = '#BCE0FD';

export const RECOMMENDED_WORKFLOW_CARD_ID: DashboardWorkflowCardId = 'plan';

/** Mobile landing: Plan + Create shown first (HITL journey). */
export const MOBILE_PRIMARY_WORKFLOW_IDS: readonly DashboardWorkflowCardId[] = ['plan', 'create'];

/** Workflow cards that require LinkedIn connection when disconnected. */
export const CONNECT_GATED_WORKFLOW_IDS: readonly DashboardWorkflowCardId[] = [
  'publish',
  'analysis',
  'engagement',
  'remarket',
];

export const PLAN_PINNED_HINT_KEY = 'linkedin_dashboard_plan_hint_dismissed';

