import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  Collapse,
  IconButton,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { apiClient } from '../../api/client';
import { AgentAlertItem, AgentApprovalItem } from '../../hooks/useAgentHuddleFeed';

interface AlertBannerProps {
  alerts: AgentAlertItem[];
  approvals: AgentApprovalItem[];
}

const severityIcon = (sev?: string) => {
  if (sev === 'error' || sev === 'critical') return <ErrorIcon sx={{ fontSize: 18, color: '#f44336' }} />;
  if (sev === 'warning') return <WarningIcon sx={{ fontSize: 18, color: '#ff9800' }} />;
  return <InfoIcon sx={{ fontSize: 18, color: '#2196f3' }} />;
};

const severityBg = (sev?: string) => {
  if (sev === 'error' || sev === 'critical') return 'rgba(244,67,54,0.1)';
  if (sev === 'warning') return 'rgba(255,152,0,0.1)';
  return 'rgba(33,150,243,0.1)';
};

const severityBorder = (sev?: string) => {
  if (sev === 'error' || sev === 'critical') return 'rgba(244,67,54,0.25)';
  if (sev === 'warning') return 'rgba(255,152,0,0.25)';
  return 'rgba(33,150,243,0.25)';
};

const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, approvals }) => {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());
  const [approvalsOpen, setApprovalsOpen] = useState(false);

  const handleDismiss = async (alertId: number) => {
    if (dismissing.has(alertId)) return;
    setDismissing((s) => new Set(s).add(alertId));
    try {
      await apiClient.post(`/api/agents/alerts/${alertId}/mark-read`);
      setDismissed((s) => new Set(s).add(alertId));
    } catch {
      setDismissed((s) => new Set(s).add(alertId));
    } finally {
      setDismissing((s) => { const next = new Set(s); next.delete(alertId); return next; });
    }
  };

  const unreadAlerts = useMemo(
    () => alerts.filter((a) => a.id && !dismissed.has(a.id)),
    [alerts, dismissed],
  );

  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === 'pending'),
    [approvals],
  );

  if (unreadAlerts.length === 0 && pendingApprovals.length === 0) return null;

  return (
    <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Alerts */}
      {unreadAlerts.slice(0, 5).map((alert) => (
        <Box
          key={alert.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 2,
            bgcolor: severityBg(alert.severity),
            border: `1px solid ${severityBorder(alert.severity)}`,
          }}
        >
          {severityIcon(alert.severity)}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 13 }}>
              {alert.title || 'Alert'}
            </Typography>
            {alert.message && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                {alert.message}
              </Typography>
            )}
          </Box>
          <IconButton
            size="small"
            disabled={dismissing.has(alert.id!)}
            onClick={() => alert.id && handleDismiss(alert.id)}
            sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'rgba(255,255,255,0.6)' }, '&.Mui-disabled': { opacity: 0.3 } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      ))}

      {/* Pending approvals */}
      {pendingApprovals.length > 0 && (
        <Box
          sx={{
            borderRadius: 2,
            bgcolor: 'rgba(102,126,234,0.1)',
            border: '1px solid rgba(102,126,234,0.2)',
            overflow: 'hidden',
          }}
        >
          <Box
            onClick={() => setApprovalsOpen(!approvalsOpen)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 1.5,
              py: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 18, color: '#8b9cf7' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, flex: 1, fontSize: 13 }}>
              {pendingApprovals.length} approval{pendingApprovals.length > 1 ? 's' : ''} pending
            </Typography>
            <Chip
              label={pendingApprovals.length}
              size="small"
              sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(102,126,234,0.2)', color: '#8b9cf7' }}
            />
            {approvalsOpen ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />}
          </Box>
          <Collapse in={approvalsOpen}>
            <Box sx={{ px: 1.5, pb: 1, pt: 0.5 }}>
              {pendingApprovals.map((app) => (
                <Box key={app.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', flex: 1 }}>
                    {app.action_type || 'Action'} · {app.status}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                    {app.created_at ? new Date(app.created_at).toLocaleTimeString() : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
};

export default AlertBanner;
