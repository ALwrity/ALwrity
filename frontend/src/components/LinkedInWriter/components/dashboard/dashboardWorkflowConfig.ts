export type DashboardWorkflowCardId =
  | 'plan'
  | 'create'
  | 'publish'
  | 'analysis'
  | 'engagement'
  | 'remarket';

export interface DashboardWorkflowCard {
  id: DashboardWorkflowCardId;
  title: string;
  description: string;
  icon: string;
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
    icon: '📅',
    accent: '#6366f1',
  },
  {
    id: 'create',
    title: 'Create',
    description: 'Post, article, video, and carousel content',
    icon: '✍️',
    accent: '#ec4899',
  },
  {
    id: 'publish',
    title: 'Publish',
    description: 'Save drafts and schedule on your content calendar',
    icon: '📤',
    accent: '#0ea5e9',
  },
  {
    id: 'analysis',
    title: 'Analysis',
    description: 'Profile, existing content, and SEO insights',
    icon: '📊',
    accent: '#8b5cf6',
  },
  {
    id: 'engagement',
    title: 'Engagement',
    description: 'Growth engine to enhance reach and interaction',
    icon: '📈',
    accent: '#10b981',
  },
  {
    id: 'remarket',
    title: 'Remarket',
    description: 'Refresh and improve high-performing content',
    icon: '♻️',
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

