import React from 'react';
import {
  Box,
  Typography,
  Switch,
  Paper,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';
import { SeoPreviewCard } from '../SeoPreviewCard';
import { ContentAuditSummaryCard } from '../ContentAuditSummaryCard';
import { SiteHealthSummaryCard } from '../SiteHealthSummaryCard';
import { SMART_BACKGROUND_SETUP_ELEMENT_ID } from '../backgroundSetupNavigation';
import {
  formatDelay,
  formatTimeAgo,
  GRADIENT_BUTTON,
  GRADIENTS,
  OUTLINE_BUTTON,
  TASK_ICONS,
} from './constants';
import { useBackgroundSetupState } from './useBackgroundSetupState';

function statusChip(status: string, failureReason?: string | null) {
  switch (status) {
    case 'running':
      return (
        <Chip
          size="small"
          label="Running..."
          color="secondary"
          variant="outlined"
          icon={<CircularProgress size={10} color="secondary" />}
          sx={{ height: 20, fontSize: '0.65rem', ml: 1 }}
        />
      );
    case 'completed':
      return (
        <Chip
          size="small"
          label="Completed"
          color="success"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.65rem', ml: 1 }}
        />
      );
    case 'failed':
      return (
        <Chip
          size="small"
          label={failureReason ? 'Failed' : 'Failed'}
          color="error"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.65rem', ml: 1 }}
        />
      );
    case 'scheduled':
      return (
        <Chip
          size="small"
          label="Scheduled"
          color="default"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.65rem', ml: 1 }}
        />
      );
    default:
      return null;
  }
}

interface BackgroundSetupCardProps {
  websiteUrl: string;
  websiteSessionKey: string;
  brandAnalysis?: any;
  seoAudit?: any;
  onConfigChange?: (prefs: Record<string, { enabled: boolean; delay_mins: number }>) => void;
  variant?: 'embedded' | 'standalone';
}

export const BackgroundSetupCard: React.FC<BackgroundSetupCardProps> = ({
  websiteUrl,
  websiteSessionKey,
  brandAnalysis,
  seoAudit,
  onConfigChange,
  variant = 'standalone',
}) => {
  const {
    prefs,
    saving,
    error,
    showSeoPreview,
    setShowSeoPreview,
    showSeoResults,
    setShowSeoResults,
    hasSeoResults,
    showContentAudit,
    setShowContentAudit,
    advStatus,
    runLoading,
    runError,
    lastRunResult,
    showSiteHealth,
    setShowSiteHealth,
    healthLoading,
    healthError,
    lastHealthRun,
    handleToggle,
    runContentAudit,
    runSiteHealth,
    mergedBrandAnalysis,
    mergedSeoAudit,
  } = useBackgroundSetupState({
    websiteUrl,
    websiteSessionKey,
    brandAnalysis,
    seoAudit,
    onConfigChange,
  });

  const isEmbedded = variant === 'embedded';
  const contentAuditStatus = advStatus?.content_audit;
  const hasAuditResults = advStatus?.has_results || false;

  if (error) {
    return (
      <Box id={SMART_BACKGROUND_SETUP_ELEMENT_ID} sx={{ p: isEmbedded ? 0 : 3, mt: isEmbedded ? 0 : 2 }}>
        {!isEmbedded && (
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Smart Background Setup
          </Typography>
        )}
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  const taskIds = Object.keys(prefs || {});
  const enabledCount = taskIds.filter((id) => prefs[id].enabled).length;

  const content = (
    <>
      {!isEmbedded && (
        <Box
          sx={{
            px: 3,
            py: 2,
            bgcolor: '#fafafa',
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b' }}>
              ⚙️ Smart Background Setup
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              {enabledCount} of {taskIds.length} tasks enabled — these run in the background after you
              continue to keep your brand intelligence fresh.
            </Typography>
          </Box>
          {saving && <CircularProgress size={16} sx={{ flexShrink: 0 }} />}
        </Box>
      )}

      {taskIds.map((taskId) => {
        const task = prefs[taskId];
        const isContentAudit = taskId === 'advertools_content';
        const isSeoAudit = taskId === 'seo_audit';
        const isHealth = taskId === 'advertools_health';
        const taskStatus = isContentAudit
          ? contentAuditStatus?.status
          : isHealth
            ? advStatus?.site_health?.status
            : null;

        return (
          <Box
            key={taskId}
            sx={{
              px: 3,
              py: 2,
              borderBottom: '1px solid #f0f0f0',
              bgcolor: '#fff',
              '&:last-child': { borderBottom: 'none' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <Typography sx={{ fontSize: 18, mt: 0.2 }}>{TASK_ICONS[taskId] || '📋'}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                    {task.label}
                  </Typography>
                  {isContentAudit && statusChip(taskStatus || '', contentAuditStatus?.failure_reason)}
                  {isHealth && statusChip(taskStatus || '', advStatus?.site_health?.failure_reason)}
                  {isContentAudit && contentAuditStatus?.last_success && (
                    <Chip
                      size="small"
                      label={formatTimeAgo(contentAuditStatus.last_success)}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.65rem', ml: 0.5 }}
                    />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b', lineHeight: 1.5 }}>
                  {task.description}
                </Typography>
                <Chip
                  size="small"
                  label={`⏱️ ~${formatDelay(task.delay_mins)}`}
                  variant="outlined"
                  sx={{ fontSize: 10, mt: 0.5 }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, pt: 0.3 }}>
                {isSeoAudit && task.enabled && (
                  <Button
                    size="small"
                    sx={{ ...GRADIENT_BUTTON, background: GRADIENTS.seo.bg }}
                    onClick={() => {
                      setShowSeoPreview(true);
                      setShowSeoResults(false);
                    }}
                  >
                    Run Preview
                  </Button>
                )}
                {isSeoAudit && task.enabled && hasSeoResults && !showSeoPreview && (
                  <Button
                    size="small"
                    sx={OUTLINE_BUTTON(GRADIENTS.seo.outlineColor)}
                    onClick={() => {
                      setShowSeoResults(true);
                      setShowSeoPreview(false);
                    }}
                  >
                    View Results
                  </Button>
                )}
                {isSeoAudit && (showSeoPreview || showSeoResults) && (
                  <Button
                    size="small"
                    sx={OUTLINE_BUTTON('#64748b')}
                    onClick={() => {
                      setShowSeoPreview(false);
                      setShowSeoResults(false);
                    }}
                  >
                    Hide
                  </Button>
                )}
                {isContentAudit && task.enabled && (
                  <Button
                    size="small"
                    disabled={runLoading}
                    startIcon={
                      runLoading ? <CircularProgress size={10} sx={{ color: '#fff' }} /> : undefined
                    }
                    sx={{ ...GRADIENT_BUTTON, background: GRADIENTS.content.bg }}
                    onClick={() => void runContentAudit()}
                  >
                    {runLoading ? 'Running...' : 'Run Content Audit'}
                  </Button>
                )}
                {isContentAudit && !runLoading && (hasAuditResults || lastRunResult) && (
                  <Button
                    size="small"
                    sx={OUTLINE_BUTTON(GRADIENTS.content.outlineColor)}
                    onClick={() => setShowContentAudit(!showContentAudit)}
                  >
                    {showContentAudit ? 'Hide Results' : 'View Results'}
                  </Button>
                )}
                {isHealth && task.enabled && (
                  <Button
                    size="small"
                    disabled={healthLoading}
                    startIcon={
                      healthLoading ? (
                        <CircularProgress size={10} sx={{ color: '#fff' }} />
                      ) : undefined
                    }
                    sx={{ ...GRADIENT_BUTTON, background: GRADIENTS.health.bg }}
                    onClick={() => void runSiteHealth()}
                  >
                    {healthLoading ? 'Running...' : 'Run Site Health'}
                  </Button>
                )}
                {isHealth &&
                  !healthLoading &&
                  (lastHealthRun ||
                    (advStatus?.site_health?.status &&
                      advStatus.site_health.status !== 'not_created')) && (
                    <Button
                      size="small"
                      sx={OUTLINE_BUTTON(GRADIENTS.health.outlineColor)}
                      onClick={() => setShowSiteHealth(!showSiteHealth)}
                    >
                      {showSiteHealth ? 'Hide Results' : 'View Results'}
                    </Button>
                  )}
                <Switch
                  size="small"
                  checked={task.enabled}
                  onChange={() => handleToggle(taskId)}
                  color="primary"
                />
              </Box>
            </Box>

            {runError && isContentAudit && (
              <Typography variant="caption" sx={{ color: '#ef4444', display: 'block', mt: 1 }}>
                {runError}
              </Typography>
            )}
            {healthError && isHealth && (
              <Typography variant="caption" sx={{ color: '#ef4444', display: 'block', mt: 1 }}>
                {healthError}
              </Typography>
            )}

            {isSeoAudit && showSeoPreview && task.enabled && (
              <Box sx={{ mt: 2 }}>
                <SeoPreviewCard
                  websiteUrl={websiteUrl}
                  websiteSessionKey={websiteSessionKey}
                  autoRun
                  onResultsAvailable={() => setHasSeoResults(true)}
                />
              </Box>
            )}
            {isSeoAudit && showSeoResults && task.enabled && (
              <Box sx={{ mt: 2 }}>
                <SeoPreviewCard
                  websiteUrl={websiteUrl}
                  websiteSessionKey={websiteSessionKey}
                  autoRun={false}
                  onResultsAvailable={() => setHasSeoResults(true)}
                />
              </Box>
            )}
            {isContentAudit && showContentAudit && task.enabled && (
              <Box sx={{ mt: 2 }}>
                {runLoading ? (
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CircularProgress size={16} color="secondary" />
                      <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500 }}>
                        Running content audit — this may take a minute while we crawl your site...
                      </Typography>
                    </Box>
                  </Paper>
                ) : hasAuditResults || lastRunResult ? (
                  <ContentAuditSummaryCard brandAnalysis={mergedBrandAnalysis} />
                ) : (
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500 }}>
                      📊 No content audit results yet. Click &quot;Run Content Audit&quot; to analyze your
                      site now, or it will run automatically as a scheduled background task.
                    </Typography>
                  </Paper>
                )}
              </Box>
            )}
            {isHealth && showSiteHealth && task.enabled && (
              <Box sx={{ mt: 2 }}>
                {healthLoading ? (
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CircularProgress size={16} color="success" />
                      <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500 }}>
                        Analyzing site health — checking your sitemap for freshness and structure...
                      </Typography>
                    </Box>
                  </Paper>
                ) : lastHealthRun?.site_health || mergedSeoAudit?.site_health?.total_urls ? (
                  <SiteHealthSummaryCard seoAudit={mergedSeoAudit} />
                ) : (
                  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500 }}>
                      🩺 No site health results yet. Click &quot;Run Site Health&quot; to analyze your site
                      now, or it will run automatically as a scheduled background task.
                    </Typography>
                  </Paper>
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </>
  );

  if (isEmbedded) {
    return (
      <Box id={SMART_BACKGROUND_SETUP_ELEMENT_ID} sx={{ p: 3, overflow: 'hidden' }}>
        {content}
      </Box>
    );
  }

  return (
    <Paper
      id={SMART_BACKGROUND_SETUP_ELEMENT_ID}
      sx={{
        p: 0,
        mt: 3,
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {content}
    </Paper>
  );
};
