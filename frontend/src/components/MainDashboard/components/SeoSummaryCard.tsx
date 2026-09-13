import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Typography,
  CircularProgress,
  Link,
} from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import TrendUpIcon from '@mui/icons-material/TrendingUp';
import TrendDownIcon from '@mui/icons-material/TrendingDown';
import TrendFlatIcon from '@mui/icons-material/TrendingFlat';
import WebIcon from '@mui/icons-material/Web';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BugReportIcon from '@mui/icons-material/BugReport';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { apiClient } from '../../../api/client';

// Phase 6B (8G): unified SEO summary card for the Main Dashboard.
// ONE composed call — /api/seo-dashboard/seo-summary-card — the backend
// composer aggregates the same persisted, per-user aggregates the SEO
// dashboard stitches over 6 requests (platforms, overview, task health,
// guardian audit, strategic insights, benchmark). 60s polling = the
// dashboard's established realtime cadence.

interface SummaryCard {
  status: string;
  has_data: boolean;
  website_url?: string;
  platform_connections?: {
    gsc?: { connected?: boolean; sites?: unknown[] };
    bing?: { connected?: boolean };
  };
  health_score?: { score?: number | null; change_pct?: number | null; trend?: string; label?: string | null };
  pages?: { audited?: number; avg_score?: number | null; needs_fix?: number; last_audit_at?: string | null } | null;
  background_tasks?: {
    overall_status?: string;
    failing_count?: number;
    max_consecutive_failures?: number;
    next_execution?: string | null;
  } | null;
  last_guardian_audit?: { last_execution_time?: string } | null;
  benchmark_status?: { status?: string; last_run?: string | null } | null;
  errors?: Array<{ source: string; error: string }>;
  last_updated?: string;
}

const scoreColor = (score: number): string => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

const trendIcon = (trend?: string) => {
  if (trend === 'up') return <TrendUpIcon sx={{ fontSize: 18, color: '#22c55e' }} />;
  if (trend === 'down') return <TrendDownIcon sx={{ fontSize: 18, color: '#ef4444' }} />;
  return <TrendFlatIcon sx={{ fontSize: 18, color: '#9e9e9e' }} />;
};

const SeoSummaryCard: React.FC = () => {
  const [card, setCard] = React.useState<SummaryCard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const fetchSummaryCard = async () => {
      try {
        const resp = await apiClient.get('/api/seo-dashboard/seo-summary-card');
        setCard(resp.data);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchSummaryCard();
    // House cadence: same 60s polling the ContentGuardianCard/SIF chips use.
    const interval = setInterval(fetchSummaryCard, 60_000);
    return () => clearInterval(interval);
  }, []);

  const health = card?.health_score ?? {};
  const pages = card?.pages;
  const tasks = card?.background_tasks;
  const platforms = card?.platform_connections ?? {};
  const gscConnected = !!platforms.gsc?.connected;
  const bingConnected = !!platforms.bing?.connected;
  const tasksOverall = tasks?.overall_status ?? 'ok';
  const tasksColor = tasksOverall === 'failing' ? '#ef4444' : tasksOverall === 'degraded' ? '#f59e0b' : '#22c55e';

  return (
    <Paper
      elevation={0}
      sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
      data-testid="seo-summary-card"
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <InsightsIcon color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={700}>
            SEO Summary
          </Typography>
        </Box>
        <Link
          href="/seo-dashboard"
          data-testid="seo-summary-open"
          underline="hover"
          sx={{ fontSize: '0.8rem' }}
        >
          Open SEO Dashboard
        </Link>
      </Box>

      {loading && <CircularProgress size={20} sx={{ m: 1 }} />}

      {!loading && error && (
        <Typography variant="body2" color="text.secondary">
          Unable to load SEO summary.
        </Typography>
      )}

      {!loading && !error && card && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          {/* Health score + real delta */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(255,255,255,0.03)',
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <WebIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Site Health
              </Typography>
            </Box>
            {card.has_data && typeof health?.score === 'number' ? (
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h5" fontWeight={700} sx={{ color: scoreColor(health.score as number) }}>
                  {health.score}
                </Typography>
                {health.change_pct !== null && health.change_pct !== undefined && (
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={0.5}
                    data-testid="seo-summary-delta"
                    sx={{ color: health.change_pct >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {trendIcon(health.trend)}
                    <Typography variant="caption" fontWeight={700}>
                      {health.change_pct >= 0 ? '+' : ''}
                      {health.change_pct}%
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No SEO data yet — complete onboarding.
              </Typography>
            )}
            {pages?.last_audit_at && (
              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5} mt={0.5}>
                <ScheduleIcon sx={{ fontSize: 12 }} />
                {new Date(pages.last_audit_at).toLocaleDateString()}
              </Typography>
            )}
          </Box>

          {/* Pages + platform signals */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(255,255,255,0.03)',
            }}
            data-testid="seo-summary-pages"
          >
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Page Audits
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              <Typography variant="h5" fontWeight={700}>
                {pages?.audited ?? 0}
              </Typography>
              {pages && typeof pages.avg_score === 'number' && (
                <Chip
                  label={`avg ${pages.avg_score}`}
                  size="small"
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                />
              )}
              {pages && typeof pages.needs_fix === 'number' && pages.needs_fix > 0 && (
                <Chip
                  label={`${pages.needs_fix} need fix`}
                  size="small"
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: '#f59e0b22', color: '#f59e0b' }}
                />
              )}
            </Box>
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              mt={1}
              data-testid="seo-summary-platforms"
            >
              <Chip
                data-testid="seo-summary-gsc-connect"
                size="small"
                icon={gscConnected ? undefined : <LinkOffIcon sx={{ fontSize: 12 }} />}
                label={gscConnected ? 'GSC connected' : 'Connect GSC'}
                sx={{
                  height: 20,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: gscConnected ? '#22c55e22' : '#ef444422',
                  color: gscConnected ? '#22c55e' : '#ef4444',
                }}
              />
              <Chip
                size="small"
                label={bingConnected ? 'Bing connected' : 'Bing off'}
                sx={{
                  height: 20,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: bingConnected ? '#22c55e22' : 'rgba(0,0,0,0.06)',
                  color: bingConnected ? '#22c55e' : 'text.secondary',
                }}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Background task signal — failures must never be silent */}
      {!loading && !error && tasks && tasksOverall !== 'ok' && (
        <Alert
          severity={tasksOverall === 'failing' ? 'error' : 'warning'}
          sx={{ mt: 1.5, py: 0.5 }}
          data-testid="seo-summary-tasks-alert"
          icon={<BugReportIcon fontSize="small" />}
        >
          {tasksOverall === 'failing' ? 'Failing' : 'Degraded'} background tasks ({tasks.failing_count ?? 0});
          {tasks.max_consecutive_failures} consecutive failures. Next run: {tasks.next_execution ? new Date(tasks.next_execution).toLocaleString() : 'pending'}
        </Alert>
      )}

      {!loading && error && (
        <Button size="small" onClick={() => window.location.reload()} sx={{ mt: 1 }}>
          Retry
        </Button>
      )}
    </Paper>
  );
};

export default SeoSummaryCard;
