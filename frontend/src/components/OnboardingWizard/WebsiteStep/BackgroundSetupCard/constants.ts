export interface TaskConfig {
  enabled: boolean;
  delay_mins: number;
  label: string;
  description: string;
}

export interface AdvertoolsTaskStatus {
  status: 'not_created' | 'scheduled' | 'running' | 'completed' | 'failed' | 'paused';
  last_executed: string | null;
  last_success: string | null;
  failure_reason: string | null;
}

export interface AdvertoolsStatusResponse {
  success: boolean;
  content_audit: AdvertoolsTaskStatus;
  site_health: AdvertoolsTaskStatus;
  has_results: boolean;
}

export const BACKGROUND_SETUP_TAG = '[BackgroundSetup]';

export const TASK_ICONS: Record<string, string> = {
  seo_audit: '🔍',
  sif_indexing: '🧠',
  market_trends: '📈',
  advertools_content: '📊',
  advertools_health: '🔧',
  website_analysis_tasks: '🔄',
};

export const TASK_DEFAULTS: Record<string, TaskConfig> = {
  deep_competitor: {
    enabled: true,
    delay_mins: 5,
    label: 'Deep Competitor Analysis',
    description: 'Full competitive intelligence scan with keyword and content gap analysis',
  },
  sif_indexing: {
    enabled: true,
    delay_mins: 10,
    label: 'SIF Indexing',
    description: 'Strategic Intelligence Framework — index your content for AI-driven insights',
  },
  market_trends: {
    enabled: true,
    delay_mins: 15,
    label: 'Market Trends',
    description: "Track your industry's shifting topics, keywords, and content opportunities",
  },
};

export const GRADIENT_BUTTON = {
  textTransform: 'none' as const,
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
  border: 'none',
  px: 1.5,
  py: 0.4,
  borderRadius: 2,
  boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
  '&:hover': { filter: 'brightness(1.08)', boxShadow: '0 3px 8px rgba(0,0,0,0.25)' },
  '&:disabled': { color: '#fff', opacity: 0.6 },
};

export const GRADIENTS: Record<string, { bg: string; outlineColor: string; outlineColor2: string }> = {
  seo: {
    bg: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    outlineColor: '#6366f1',
    outlineColor2: '#8b5cf6',
  },
  content: {
    bg: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
    outlineColor: '#0ea5e9',
    outlineColor2: '#6366f1',
  },
  health: {
    bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    outlineColor: '#10b981',
    outlineColor2: '#059669',
  },
};

export const OUTLINE_BUTTON = (color: string) => ({
  textTransform: 'none' as const,
  fontSize: 11,
  fontWeight: 600,
  color,
  border: `1px solid ${color}`,
  px: 1.25,
  py: 0.3,
  borderRadius: 2,
  bgcolor: 'transparent',
  '&:hover': { bgcolor: color + '14', borderColor: color },
});

export function formatDelay(mins: number): string {
  if (mins === 0) return 'Now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export function formatTimeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
