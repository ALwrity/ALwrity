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

/**
 * Six wedges forming a 3/4 pie (270°) around the center profile.
 * Bottom ~90° is open for the avatar hub. Order: Plan (bottom-left) → Remarket (bottom-right).
 */
export const DASHBOARD_WORKFLOW_CARDS: DashboardWorkflowCard[] = [
  {
    id: 'plan',
    title: 'Plan',
    description: 'Brainstorming, industry watchdog, and content strategy',
    icon: '📅',
    accent: '#6366f1',
    startAngle: 225,
    endAngle: 180,
  },
  {
    id: 'create',
    title: 'Create',
    description: 'Post, article, video, and carousel content',
    icon: '✍️',
    accent: '#ec4899',
    startAngle: 180,
    endAngle: 135,
  },
  {
    id: 'publish',
    title: 'Publish',
    description: 'Save drafts and schedule on your content calendar',
    icon: '📤',
    accent: '#0ea5e9',
    startAngle: 135,
    endAngle: 87,
  },
  {
    id: 'analysis',
    title: 'Analysis',
    description: 'Profile, existing content, and SEO insights',
    icon: '📊',
    accent: '#8b5cf6',
    startAngle: 87,
    endAngle: 42,
  },
  {
    id: 'engagement',
    title: 'Engagement',
    description: 'Growth engine to enhance reach and interaction',
    icon: '📈',
    accent: '#10b981',
    startAngle: 42,
    endAngle: 10,
  },
  {
    id: 'remarket',
    title: 'Remarket',
    description: 'Refresh and improve high-performing content',
    icon: '♻️',
    accent: '#f59e0b',
    startAngle: 10,
    endAngle: -45,
  },
];

export const FRAME_COLOR = '#BCE0FD';

/** Total arc span in degrees (3/4 circle). */
export const WORKFLOW_ARC_SPAN_DEG = 270;

/** Bottom opening where the profile hub sits (degrees). */
export const WORKFLOW_BOTTOM_GAP_DEG = 90;
