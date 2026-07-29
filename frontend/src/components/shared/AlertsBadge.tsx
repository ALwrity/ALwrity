import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Badge, IconButton, Menu, Typography, Box, Divider, Chip, Tooltip, List, ListItem, ListItemText, ListItemIcon, Button } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { billingService } from '../../services/billingService';
import { useAuth } from '@clerk/clerk-react';
import { getTasksNeedingIntervention, TaskNeedingIntervention } from '../../api/schedulerDashboard';
import { isFeatureOnlyMode } from '../../utils/demoMode';
import {
  apiClient,
  isBackendCooldownActive,
  logBackendCooldownSkipOnce,
} from '../../api/client';

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  priority: 'high' | 'medium' | 'low';
  is_read: boolean;
  created_at: string;
  source: 'billing' | 'scheduler' | 'agents' | 'task';
  metadata?: Record<string, any>;
  groupKey?: string;
}

interface AlertGroup {
  id: string;
  title: string;
  source: Alert['source'];
  severity: Alert['severity'];
  priority: 'high' | 'medium' | 'low';
  summary: string;
  count: number;
  latestTimestamp: string;
  alerts: Alert[];
  metadata?: Record<string, any>;
  actionLabel?: string;
  actionHref?: string;
}

interface AlertsBadgeProps {
  colorMode?: 'light' | 'dark';
  /** When true, uses LinkedIn brand blue for the notification icon. */
  linkedInTheme?: boolean;
}

const LINKEDIN_BLUE = '#0a66c2';

const AlertsBadge: React.FC<AlertsBadgeProps> = ({ colorMode = 'light', linkedInTheme = false }) => {
  const { userId } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertGroups, setAlertGroups] = useState<AlertGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const open = Boolean(anchorEl);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const schedulerDismissedRef = useRef<Set<string>>(new Set());

  const getSchedulerStorageKey = (uid: string) => `scheduler_alerts_dismissed_${uid}`;

  const loadSchedulerDismissed = useCallback((uid: string) => {
    if (!uid) return new Set<string>();
    try {
      const stored = localStorage.getItem(getSchedulerStorageKey(uid));
      if (!stored) return new Set<string>();
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
      return new Set<string>();
    } catch {
      return new Set<string>();
    }
  }, []);

  const persistSchedulerDismissed = (uid: string, dismissed: Set<string>) => {
    if (!uid) return;
    try {
      localStorage.setItem(getSchedulerStorageKey(uid), JSON.stringify(Array.from(dismissed)));
    } catch {
      // ignore storage errors
    }
  };

  const dismissSchedulerAlert = (alertId: string) => {
    if (!userId) return;
    const updated = new Set(schedulerDismissedRef.current);
    updated.add(alertId);
    schedulerDismissedRef.current = updated;
    persistSchedulerDismissed(userId, updated);
  };

  useEffect(() => {
    if (!userId) return;
    schedulerDismissedRef.current = loadSchedulerDismissed(userId);
  }, [userId, loadSchedulerDismissed]);

  // Fetch all alerts
  const rebuildGroups = (alertList: Alert[]) => {
    const groups = buildAlertGroups(alertList);
    setAlertGroups(groups);
    const unreadGroups = groups.filter(group => group.alerts.some(alert => !alert.is_read)).length;
    setUnreadCount(unreadGroups);
  };

  const fetchAlerts = async () => {
    if (!userId || isPollingRef.current) return;

    // Skip alerts fetching in feature-limited mode (endpoints not available)
    if (isFeatureOnlyMode()) {
      setLoading(false);
      return;
    }

    if (isBackendCooldownActive()) {
      logBackendCooldownSkipOnce('AlertsBadge');
      return;
    }

    try {
      isPollingRef.current = true;
      setLoading(true);

      const allAlerts: Alert[] = [];

      // Phase 1: Fetch billing alerts
      try {
        const billingAlerts = await billingService.getUsageAlerts(userId, true);
        const formattedBillingAlerts: Alert[] = billingAlerts.map((alert: any) => ({
          id: `billing-${alert.id}`,
          type: alert.type,
          title: alert.title || 'Billing Alert',
          message: alert.message,
          severity: alert.severity || 'warning',
          priority: mapSeverityToPriority(alert.severity || 'warning'),
          is_read: alert.is_read || false,
          created_at: alert.created_at,
          source: 'billing' as const,
          groupKey: `billing-${alert.type}-${alert.title || 'alert'}`
        }));
        allAlerts.push(...formattedBillingAlerts);
      } catch (error) {
        console.error('Error fetching billing alerts:', error);
      }

      // Phase 2: Fetch scheduler/task alerts
      try {
        const taskAlerts = await getTasksNeedingIntervention(userId);
        const formattedSchedulerAlerts: Alert[] = taskAlerts.map((task: TaskNeedingIntervention) => {
          const alertId = `scheduler-${task.task_type}-${task.task_id}`;
          const failureReason = task.failure_pattern?.failure_reason || 'unknown';
          const reasonInfo = failureReasonDetails[failureReason] || failureReasonDetails.unknown;
          const taskLabel = formatTaskDisplayName(task);
          const message = buildSchedulerAlertMessage(task);
          const timestamp = task.failure_pattern?.last_failure_time || task.last_failure || new Date().toISOString();
          
          return {
            id: alertId,
            type: 'scheduler_task_failure',
            title: `Task needs attention: ${taskLabel}`,
            message,
            severity: reasonInfo.severity,
             priority: mapSchedulerReasonToPriority(failureReason),
            is_read: schedulerDismissedRef.current.has(alertId),
            created_at: timestamp,
            source: 'scheduler' as const,
            metadata: {
              taskId: task.task_id,
              taskType: task.task_type,
              failureReason,
              occurrences: task.failure_pattern?.consecutive_failures ?? 0,
              lastFailure: timestamp,
            },
            groupKey: `scheduler-${task.task_type}-${task.task_id}`
          };
        });
        allAlerts.push(...formattedSchedulerAlerts);
      } catch (error) {
        console.error('Error fetching scheduler alerts:', error);
      }

      // Phase 3: Fetch agents team alerts
      try {
        const resp = await apiClient.get('/api/agents/alerts', {
          params: { unread_only: true, limit: 50 }
        });
        const agentAlerts = resp?.data?.data?.alerts || [];
        const formattedAgentAlerts: Alert[] = agentAlerts.map((a: any) => ({
          id: `agents-${a.id}`,
          type: a.type || 'agent_alert',
          title: a.title || 'Agents Alert',
          message: a.message || '',
          severity: (a.severity as any) || 'info',
          priority: mapSeverityToPriority(a.severity || 'info'),
          is_read: Boolean(a.read_at),
          created_at: a.created_at || new Date().toISOString(),
          source: 'agents' as const,
          metadata: {
            ctaPath: a.cta_path,
            payload: a.payload,
          },
          groupKey: `agents-${a.type || 'agent_alert'}-${a.title || 'alert'}`
        }));
        allAlerts.push(...formattedAgentAlerts);
      } catch (error) {
        console.error('Error fetching agent alerts:', error);
      }

      // Sort alerts by created_at (newest first)
      allAlerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAlerts(allAlerts);
      rebuildGroups(allAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
      isPollingRef.current = false;
    }
  };

  // Poll for alerts
  useEffect(() => {
    // Skip alerts polling entirely in feature-limited mode
    if (isFeatureOnlyMode()) {
      return;
    }

    if (!userId) return;

    // Delay initial fetch slightly to ensure auth token getter is installed
    const timeoutId = setTimeout(() => {
      fetchAlerts();
    }, 1000);

    // Poll every 5 minutes (300 seconds) instead of 1 minute to reduce API call frequency
    intervalRef.current = setInterval(() => {
      fetchAlerts();
    }, 300000);

    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    // Refresh alerts when menu opens
    fetchAlerts();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (alert: Alert) => {
    try {
      if (alert.source === 'billing') {
        const numericId = Number(alert.id.replace('billing-', ''));
        if (!Number.isNaN(numericId)) {
          await billingService.markAlertRead(numericId);
        }
      } else if (alert.source === 'scheduler') {
        dismissSchedulerAlert(alert.id);
      } else if (alert.source === 'agents') {
        const numericId = Number(alert.id.replace('agents-', ''));
        if (!Number.isNaN(numericId)) {
          await apiClient.post(`/api/agents/alerts/${numericId}/mark-read`);
        }
      }
      // Update local state
      const updated = alerts.map(a => (a.id === alert.id ? { ...a, is_read: true } : a));
      setAlerts(updated);
      rebuildGroups(updated);
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleGroupClick = async (group: AlertGroup) => {
    for (const alert of group.alerts.filter(a => !a.is_read)) {
      await handleMarkAsRead(alert);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      for (const alert of alerts.filter(a => !a.is_read)) {
        await handleMarkAsRead(alert);
      }
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <ErrorIcon sx={{ color: '#f44336', fontSize: 20 }} />;
      case 'warning':
        return <WarningIcon sx={{ color: '#ff9800', fontSize: 20 }} />;
      case 'info':
        return <InfoIcon sx={{ color: '#2196f3', fontSize: 20 }} />;
      default:
        return <InfoIcon sx={{ color: '#757575', fontSize: 20 }} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      case 'info':
        return '#2196f3';
      default:
        return '#757575';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!userId) return null;

  const iconColor = linkedInTheme
    ? LINKEDIN_BLUE
    : unreadCount > 0
      ? '#ff9800'
      : colorMode === 'dark'
        ? 'white'
        : 'inherit';

  return (
    <>
      <Tooltip title={unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'No alerts'}>
        <IconButton
          onClick={handleOpen}
          sx={{
            color: linkedInTheme ? LINKEDIN_BLUE : colorMode === 'dark' ? 'white' : 'inherit',
            position: 'relative',
            '&:hover': linkedInTheme ? { bgcolor: 'rgba(10, 102, 194, 0.08)' } : undefined,
          }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            {unreadCount > 0 ? (
              <NotificationsActiveIcon sx={{ color: iconColor }} />
            ) : (
              <NotificationsIcon sx={{ color: iconColor }} />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            minWidth: 360,
            maxWidth: 450,
            maxHeight: '80vh',
            overflow: 'auto',
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Alerts
            </Typography>
            {unreadCount > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllAsRead}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                Mark all as read
              </Button>
            )}
          </Box>
        </Box>

        {loading && alertGroups.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Loading alerts...
            </Typography>
          </Box>
        ) : alertGroups.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: '#4caf50', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No alerts
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {alertGroups.map((group, index) => (
              <React.Fragment key={group.id}>
                <ListItem
                  sx={{
                    bgcolor: group.alerts.every(a => a.is_read) ? 'transparent' : 'rgba(255, 152, 0, 0.05)',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.04)',
                    },
                    cursor: 'pointer',
                  }}
                  onClick={() => handleGroupClick(group)}
                >
                  <ListItemIcon>
                    {getSeverityIcon(group.severity)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: group.alerts.every(a => a.is_read) ? 400 : 700 }}>
                          {group.title}
                        </Typography>
                        <Chip
                          label={group.source === 'agents' ? 'Agents Team' : group.source === 'scheduler' ? 'Scheduler' : group.source === 'billing' ? 'Billing' : group.source}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: `${getSeverityColor(group.severity)}20`,
                            color: getSeverityColor(group.severity),
                            fontWeight: 600,
                          }}
                        />
                        <Chip
                          label={`${group.count} occurrence${group.count > 1 ? 's' : ''}`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: 'rgba(0,0,0,0.08)',
                            color: colorMode === 'dark' ? 'white' : 'inherit',
                          }}
                        />
                        <Chip
                          label={`${group.priority.toUpperCase()} priority`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: priorityStyles[group.priority].bg,
                            color: priorityStyles[group.priority].color,
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {group.summary}
                        </Typography>
                        {group.alerts.slice(0, 2).map((alert, idx) => (
                          <Typography key={alert.id} variant="caption" color="text.secondary" sx={{ display: 'block', mt: idx === 0 ? 0.5 : 0 }}>
                            • {alert.message}
                          </Typography>
                        ))}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Last alert: {formatDate(group.latestTimestamp)}
                        </Typography>
                        {group.actionHref && (
                          <Button
                            size="small"
                            sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem' }}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (group.actionHref?.startsWith('http')) {
                                window.open(group.actionHref, '_blank');
                              } else {
                                window.location.href = group.actionHref!;
                              }
                            }}
                          >
                            {group.actionLabel || 'View Details'}
                          </Button>
                        )}
                      </>
                    }
                  />
                </ListItem>
                {index < alertGroups.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}

        {alertGroups.length > 0 && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1, textAlign: 'center' }}>
              <Button
                size="small"
                onClick={() => {
                  handleClose();
                  window.location.href = '/billing';
                }}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                View All Alerts
              </Button>
            </Box>
          </>
        )}
      </Menu>
    </>
  );
};

const failureReasonDetails: Record<string, { label: string; severity: 'error' | 'warning' | 'info'; guidance: string }> = {
  api_limit: {
    label: 'API limit exceeded',
    severity: 'error',
    guidance: 'Usage quota exceeded. Consider upgrading or waiting for quota reset.',
  },
  auth_error: {
    label: 'Authentication error',
    severity: 'error',
    guidance: 'Refresh your platform credentials and retry the task.',
  },
  network_error: {
    label: 'Network error',
    severity: 'warning',
    guidance: 'Network instability detected. Retry once connectivity is restored.',
  },
  config_error: {
    label: 'Configuration issue',
    severity: 'warning',
    guidance: 'Review task configuration and ensure required inputs are set.',
  },
  unknown: {
    label: 'Unknown failure',
    severity: 'info',
    guidance: 'Check task logs for more details.',
  },
};

const formatTaskDisplayName = (task: TaskNeedingIntervention): string => {
  if (task.task_type === 'oauth_token_monitoring') {
    return `OAuth ${task.platform?.toUpperCase() || 'Token'}`;
  }
  if (task.task_type === 'website_analysis') {
    if (task.website_url) {
      return `Website Analysis (${task.website_url})`;
    }
    return 'Website Analysis';
  }
  if (task.task_type.includes('_insights')) {
    return `${task.platform?.toUpperCase() || 'Platform'} Insights`;
  }
  return task.task_type.replace(/_/g, ' ');
};

const buildSchedulerAlertMessage = (task: TaskNeedingIntervention): string => {
  const reasonKey = task.failure_pattern?.failure_reason || 'unknown';
  const reasonInfo = failureReasonDetails[reasonKey] || failureReasonDetails.unknown;
  const consecutive = task.failure_pattern?.consecutive_failures ?? 0;
  const recent = task.failure_pattern?.recent_failures ?? 0;
  return `${reasonInfo.label}. ${consecutive} consecutive failures, ${recent} in the last 7 days. ${reasonInfo.guidance}`;
};

const getAlertAction = (alert: Alert): { label?: string; href?: string } => {
  if (alert.source === 'billing') {
    return {
      label: 'Open Billing',
      href: '/billing',
    };
  }
  if (alert.source === 'scheduler') {
    const taskId = alert.metadata?.taskId;
    if (taskId) {
      return {
        label: `Review Task #${taskId}`,
        href: `/scheduler?taskId=${taskId}`,
      };
    }
    return {
      label: 'View Scheduler',
      href: '/scheduler#tasks',
    };
  }
  if (alert.source === 'agents') {
    const ctaPath = alert.metadata?.ctaPath;
    if (typeof ctaPath === 'string' && ctaPath.trim()) {
      return { label: 'Open', href: ctaPath };
    }
    return { label: 'View Agents', href: '/content-planning' };
  }
  if (alert.source === 'task') {
    return {
      label: 'View Tasks',
      href: '/tasks',
    };
  }
  return {};
};

const mapSeverityToPriority = (severity: string): 'high' | 'medium' | 'low' => {
  if (severity === 'error') return 'high';
  if (severity === 'warning') return 'medium';
  return 'low';
};

const mapSchedulerReasonToPriority = (reason: string): 'high' | 'medium' | 'low' => {
  switch (reason) {
    case 'api_limit':
    case 'auth_error':
      return 'high';
    case 'network_error':
      return 'medium';
    default:
      return 'low';
  }
};

const priorityRank: Record<'high' | 'medium' | 'low', number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const priorityStyles: Record<'high' | 'medium' | 'low', { bg: string; color: string }> = {
  high: { bg: 'rgba(244,67,54,0.15)', color: '#f44336' },
  medium: { bg: 'rgba(255,152,0,0.2)', color: '#ff9800' },
  low: { bg: 'rgba(33,150,243,0.15)', color: '#2196f3' },
};

const buildAlertGroups = (alertList: Alert[]): AlertGroup[] => {
  const map = new Map<string, AlertGroup>();

  for (const alert of alertList) {
    const key = alert.groupKey || `${alert.source}-${alert.type}-${alert.title}`;
    const existing = map.get(key);
    const timestamp = alert.created_at;

    if (existing) {
      existing.count += 1;
      existing.alerts.push(alert);
      if (new Date(timestamp).getTime() > new Date(existing.latestTimestamp).getTime()) {
        existing.latestTimestamp = timestamp;
        existing.summary = alert.message;
      }
      if (priorityRank[alert.priority] < priorityRank[existing.priority]) {
        existing.priority = alert.priority;
        existing.severity = alert.severity;
      }
    } else {
      const action = getAlertAction(alert);
      map.set(key, {
        id: key,
        title: alert.title,
        source: alert.source,
        severity: alert.severity,
        priority: alert.priority,
        summary: alert.message,
        count: 1,
        latestTimestamp: timestamp,
        alerts: [alert],
        metadata: alert.metadata,
        actionLabel: action.label,
        actionHref: action.href,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const priorityCompare = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityCompare !== 0) return priorityCompare;
    return new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime();
  });
};

export default AlertsBadge;
