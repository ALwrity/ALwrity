import type { OnboardingScheduledTaskHealthItem } from '../../../api/seoDashboard';

export interface TaskPreferences {
  enabled: boolean;
  delay_mins: number;
  label: string;
  description: string;
}

export interface TaskPreferencesResponse {
  success: boolean;
  tasks: Record<string, TaskPreferences>;
}

export const ORDERED_TASK_KEYS = [
  'DeepCompetitorAnalysisTask',
  'SIFIndexingTask',
  'MarketTrendsTask',
] as const;

export const HEALTH_TO_PREFS: Record<string, string> = {
  DeepCompetitorAnalysisTask: 'deep_competitor_analysis',
  SIFIndexingTask: 'sif_indexing',
  MarketTrendsTask: 'market_trends',
};

export const TASK_ICONS: Record<string, string> = {
  deep_competitor_analysis: '🔎',
  sif_indexing: '🧠',
  market_trends: '📈',
};

export interface StatusUi {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const STATUS_UI_MAP: Record<string, StatusUi> = {
  active: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
  running: { label: 'Running', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)' },
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
  paused: { label: 'Paused', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  needs_intervention: { label: 'Needs intervention', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)' },
  not_scheduled: { label: 'Not scheduled', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.4)' },
  scheduled: { label: 'Scheduled', color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.4)' },
};

export const POLL_MAX_ATTEMPTS = 20;
export const POLL_INITIAL_INTERVAL = 3000;

export const BACKGROUND_SETUP_SEO_DASHBOARD_NOTE =
  'Full results for these tasks appear in the SEO Dashboard once you finish onboarding.';

export interface BackgroundSetupTaskSummaryLines {
  line1: string;
  line2: string;
}

export function getBackgroundSetupTaskSummaryLines(
  prefs: TaskPreferencesResponse | null
): BackgroundSetupTaskSummaryLines {
  if (!prefs?.tasks) {
    return { line1: 'Loading tasks…', line2: '' };
  }
  const ourKeys = Object.values(HEALTH_TO_PREFS);
  const relevant = Object.entries(prefs.tasks).filter(([k]) => ourKeys.includes(k));
  const enabled = relevant.filter(([, t]) => t.enabled).length;
  return {
    line1: `${enabled} of ${relevant.length} tasks enabled — these run in the background so ALwrity keeps learning while you finish setup.`,
    line2: 'Run any task now to test immediately under Smart Background Setup.',
  };
}

export function getBackgroundSetupTaskSummary(prefs: TaskPreferencesResponse | null): string {
  const { line1, line2 } = getBackgroundSetupTaskSummaryLines(prefs);
  return line2 ? `${line1} ${line2}` : line1;
}

export type BackgroundSetupTaskContext = {
  task?: OnboardingScheduledTaskHealthItem;
  prefKey: string;
  pref?: TaskPreferences;
  status: string;
};
