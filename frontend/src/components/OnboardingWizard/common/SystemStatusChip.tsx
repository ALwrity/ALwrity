import React, { useState } from 'react';
import { Box, Typography, LinearProgress, Collapse, IconButton } from '@mui/material';
import { keyframes } from '@mui/system';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const pulse = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

interface TaskInfo {
  status: string;
  progress_pct?: number;
  recurring?: boolean;
  failure_reason?: string | null;
  last_success?: string | null;
  next_execution?: string | null;
}

interface SystemStatusChipProps {
  activeTasks: number;
  totalTasks: number;
  tasks?: Record<string, TaskInfo>;
  onViewResults?: (taskKey: string) => void;
}

const TASK_LABELS: Record<string, string> = {
  'full_site_seo_audit': 'SEO Audit',
  'deep_competitor_analysis': 'Competitor Analysis',
  'sif_indexing': 'SIF Indexing',
  'market_trends': 'Market Trends',
  'advertools': 'Advertools',
  'deep_website_crawl': 'Site Crawl',
};

// Task keys that have a corresponding "View Results" section in the
// Smart Background Setup card.
const HAS_RESULTS = new Set(['full_site_seo_audit', 'advertools', 'deep_competitor_analysis']);

// Order so in-progress work surfaces first, failures last.
const STATUS_ORDER: Record<string, number> = {
  running: 0,
  pending: 1,
  completed: 2,
  failed: 3,
};

function StatusBadge({ status, recurring }: { status: string; recurring?: boolean }) {
  if (status === 'running') {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#2563eb', fontWeight: 600, fontSize: '0.7rem', animation: `${pulse} 1.6s ease-in-out infinite` }}>
        <SyncIcon sx={{ fontSize: 13 }} />
        Running
      </Box>
    );
  }
  if (status === 'completed') {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#16a34a', fontWeight: 600, fontSize: '0.7rem' }}>
        <CheckCircleIcon sx={{ fontSize: 13 }} />
        Done{recurring ? ' ↻' : ''}
      </Box>
    );
  }
  if (status === 'failed') {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#dc2626', fontWeight: 600, fontSize: '0.7rem' }}>
        <ErrorIcon sx={{ fontSize: 13 }} />
        Failed
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontWeight: 600, fontSize: '0.7rem' }}>
      <ScheduleIcon sx={{ fontSize: 13 }} />
      Queued
    </Box>
  );
}

const SystemStatusChip: React.FC<SystemStatusChipProps> = ({ activeTasks, totalTasks, tasks, onViewResults }) => {
  const [expanded, setExpanded] = useState(false);

  if (!tasks) return null;

  const entries = Object.entries(tasks)
    .sort((a, b) => {
      const orderDiff = (STATUS_ORDER[a[1].status] ?? 9) - (STATUS_ORDER[b[1].status] ?? 9);
      if (orderDiff !== 0) return orderDiff;
      return (TASK_LABELS[a[0]] || a[0]).localeCompare(TASK_LABELS[b[0]] || b[0]);
    });

  const running = entries.filter(([, t]) => t.status === 'running').length;
  const pending = entries.filter(([, t]) => t.status === 'pending').length;
  const failed = entries.filter(([, t]) => t.status === 'failed').length;
  const completed = entries.filter(([, t]) => t.status === 'completed').length;

  const overallPct = totalTasks > 0
    ? Math.round((completed / totalTasks) * 100)
    : 0;

  const chipSummary = running + pending > 0
    ? `${running} running · ${completed} done`
    : failed > 0
      ? `${failed} failed · ${completed} done`
      : `All ${totalTasks} tasks complete`;

  const dotColor = failed > 0 ? '#ef4444' : running + pending > 0 ? '#2563eb' : '#10b981';

  return (
    <Box sx={{ mx: 2, mb: 1 }}>
      {/* Compact chip header — always visible */}
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          bgcolor: '#f8fafc',
          cursor: 'pointer',
          '&:hover': { bgcolor: '#f1f5f9' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: dotColor,
              display: 'inline-block',
              animation: `${pulse} 2s ease-in-out infinite`,
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#1e293b' }}>
            ⚙️ Background Tasks
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
            {chipSummary}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Expanded banner */}
      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 1,
            p: 1.75,
            borderRadius: 2,
            border: '1px solid #e2e8f0',
            bgcolor: '#f8fafc',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Background Tasks
            </Typography>
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
              {completed} of {totalTasks} done
            </Typography>
          </Box>

          {/* Overall progress bar */}
          <LinearProgress
            variant="determinate"
            value={overallPct}
            sx={{
              height: 6,
              borderRadius: 3,
              mb: 1.25,
              bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                bgcolor: failed > 0 && completed + failed >= totalTasks ? '#ef4444' : '#10b981',
                borderRadius: 3,
              },
            }}
          />

          {/* Per-task rows */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {entries.map(([key, t]) => {
              const pct = t.progress_pct ?? (t.status === 'completed' ? 100 : t.status === 'running' ? 50 : 0);
              const isRunning = t.status === 'running';
              const isFailed = t.status === 'failed';
              const showViewResults = onViewResults && HAS_RESULTS.has(key) && (t.status === 'completed' || t.status === 'failed' || t.status === 'running');
              return (
                <Box key={key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="caption" sx={{ color: '#334155', fontWeight: 600 }}>
                      {TASK_LABELS[key] || key}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {t.failure_reason && isFailed && (
                        <Typography variant="caption" sx={{ color: '#dc2626', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.failure_reason}
                        </Typography>
                      )}
                      <StatusBadge status={t.status} recurring={t.recurring} />
                      {showViewResults && (
                        <Box
                          component="button"
                          onClick={() => onViewResults(key)}
                          sx={{
                            border: '1px solid #2563eb',
                            color: '#2563eb',
                            bgcolor: 'transparent',
                            borderRadius: 1.5,
                            px: 1,
                            py: 0.25,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            lineHeight: 1.4,
                            '&:hover': { bgcolor: '#2563eb14' },
                          }}
                        >
                          View Results
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <LinearProgress
                    variant={isRunning ? 'indeterminate' : 'determinate'}
                    value={isRunning ? undefined : pct}
                    sx={{
                      height: 3,
                      borderRadius: 2,
                      bgcolor: '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: isFailed ? '#ef4444' : isRunning ? '#2563eb' : t.status === 'completed' ? '#10b981' : '#cbd5e1',
                        borderRadius: 2,
                      },
                    }}
                  />
                </Box>
              );
            })}
          </Box>

          {/* Non-blocking hint */}
          <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: '#64748b', lineHeight: 1.4 }}>
            These run in the background — you can continue onboarding now. Results appear here as each task finishes.
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

export default SystemStatusChip;
