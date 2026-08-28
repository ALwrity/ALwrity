import React from 'react';
import {
  Box,
  Paper,
  Zoom,
  Typography,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Alert,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import Autorenew from '@mui/icons-material/Autorenew';

export interface ScheduledTask {
  task: string;
  error?: string;
}

export interface TaskSchedulingPanelProps {
  scheduledTasks: string[];
  failedTasks: ScheduledTask[];
  personaGenerated: boolean;
  completedAt: string | null;
}

const TASK_LABELS: Record<string, string> = {
  research_persona: 'Research Persona Generation',
  facebook_persona: 'Facebook Persona Generation',
  oauth_monitoring: 'OAuth Token Monitoring',
  website_analysis: 'Website Analysis',
  full_site_seo_audit: 'Full-Site SEO Audit',
  sif_indexing: 'SIF Indexing',
  market_trends: 'Market Trends',
  deep_competitor_analysis: 'Deep Competitor Analysis',
  market_trends_no_url: 'Market Trends (no website)',
  progressive_setup: 'User Environment Setup',
};

function getTaskLabel(key: string): string {
  return TASK_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getTaskType(key: string): 'oneshot' | 'recurring' | 'setup' | 'unknown' {
  if (['research_persona', 'facebook_persona', 'website_analysis'].includes(key)) return 'oneshot';
  if (['full_site_seo_audit', 'sif_indexing', 'market_trends', 'market_trends_no_url', 'deep_competitor_analysis', 'oauth_monitoring'].includes(key)) return 'recurring';
  if (key === 'progressive_setup') return 'setup';
  return 'unknown';
}

function getTaskTypeChip(type: 'oneshot' | 'recurring' | 'setup' | 'unknown') {
  const config = {
    oneshot: { label: 'One-time', color: '#3b82f6' as const },
    recurring: { label: 'Recurring', color: '#8b5cf6' as const },
    setup: { label: 'Setup', color: '#10b981' as const },
    unknown: { label: 'Task', color: '#6b7280' as const },
  };
  const c = config[type];
  return <Chip label={c.label} size="small" sx={{ bgcolor: `${c.color}18`, color: c.color, fontWeight: 600, fontSize: '0.7rem' }} />;
}

function formatCompletedAt(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export const TaskSchedulingPanel: React.FC<TaskSchedulingPanelProps> = ({
  scheduledTasks,
  failedTasks,
  personaGenerated,
  completedAt,
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const totalTasks = scheduledTasks.length + failedTasks.length;
  const successRate = totalTasks > 0 ? Math.round((scheduledTasks.length / totalTasks) * 100) : 100;

  return (
    <Zoom in={true} timeout={800}>
      <Paper elevation={0} sx={{
        p: 4,
        mb: 4,
        background: failedTasks.length > 0
          ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
          : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        border: failedTasks.length > 0
          ? '1px solid rgba(245, 158, 11, 0.3)'
          : '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {failedTasks.length > 0 ? (
              <Autorenew sx={{ color: 'warning.main', fontSize: 30 }} />
            ) : (
              <RocketLaunch sx={{ color: 'success.main', fontSize: 30 }} />
            )}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
                {failedTasks.length > 0 ? 'Setup Tasks Scheduled' : 'All Tasks Launched!'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569' }}>
                {completedAt ? `Completed at ${formatCompletedAt(completedAt)}` : 'Onboarding complete'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Chip
              icon={<CheckCircle sx={{ fontSize: 16 }} />}
              label={`${scheduledTasks.length} Scheduled`}
              color="success"
              variant="filled"
              size="small"
            />
            {failedTasks.length > 0 && (
              <Chip
                icon={<ErrorOutline sx={{ fontSize: 16 }} />}
                label={`${failedTasks.length} Failed`}
                color="warning"
                variant="filled"
                size="small"
              />
            )}
            <Chip
              label={`${successRate}% Success`}
              sx={{
                bgcolor: successRate === 100 ? '#ecfdf5' : '#fef3c7',
                color: successRate === 100 ? '#059669' : '#d97706',
                fontWeight: 600,
              }}
              size="small"
            />
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>Task Scheduling Progress</Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>{scheduledTasks.length}/{totalTasks}</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={successRate}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: successRate === 100 ? '#10b981' : '#f59e0b',
              },
            }}
          />
        </Box>

        {personaGenerated && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              AI Persona Generated
            </Typography>
            <Typography variant="body2">
              Your brand persona was generated during setup. Your agents will use this for personalized content.
            </Typography>
          </Alert>
        )}

        {!personaGenerated && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Persona Generation Scheduled
            </Typography>
            <Typography variant="body2">
              Your brand persona is being generated in the background. This typically takes 5-10 minutes after launch.
            </Typography>
          </Alert>
        )}

        {failedTasks.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Some Tasks Could Not Be Scheduled
            </Typography>
            <Typography variant="body2">
              {failedTasks.length} task(s) failed to schedule. These will be retried automatically by the scheduler. You can also retry from the Team Activity page.
            </Typography>
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <IconButton
            size="small"
            onClick={() => setShowDetails(!showDetails)}
            sx={{ color: '#475569' }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, mr: 0.5 }}>
              {showDetails ? 'Hide' : 'Show'} task details
            </Typography>
            {showDetails ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={showDetails}>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#0f172a' }}>
              Scheduled Tasks ({scheduledTasks.length})
            </Typography>
            {scheduledTasks.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic', pl: 2 }}>
                No tasks were scheduled.
              </Typography>
            ) : (
              <List dense sx={{ bgcolor: 'rgba(255,255,255,0.6)', borderRadius: 2, mb: 2 }}>
                {scheduledTasks.map((taskKey) => (
                  <ListItem key={taskKey} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckCircle sx={{ color: '#10b981', fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={getTaskLabel(taskKey)}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600, color: '#1e293b' }}
                    />
                    {getTaskTypeChip(getTaskType(taskKey))}
                  </ListItem>
                ))}
              </List>
            )}

            {failedTasks.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#92400e' }}>
                  Failed Tasks ({failedTasks.length})
                </Typography>
                <List dense sx={{ bgcolor: 'rgba(254,243,199,0.5)', borderRadius: 2 }}>
                  {failedTasks.map((ft, idx) => (
                    <ListItem key={idx} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <ErrorOutline sx={{ color: '#d97706', fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={getTaskLabel(ft.task)}
                        secondary={ft.error || 'Unknown error'}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600, color: '#92400e' }}
                        secondaryTypographyProps={{ variant: 'caption', color: '#78716c' }}
                      />
                      {getTaskTypeChip(getTaskType(ft.task))}
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Zoom>
  );
};

export default TaskSchedulingPanel;