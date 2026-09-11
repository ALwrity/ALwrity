import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
} from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import CloseIcon from '@mui/icons-material/Close';

interface BackendUnavailableModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string | null;
  retrySeconds: number;
}

/**
 * Non-blocking status dialog shown when the backend goes down (event-driven:
 * fires from the cooldown circuit-breaker in api/client.ts, once per outage
 * episode). Lives beside SubscriptionExpiredModal but behaves differently —
 * it can be dismissed, and auto-closes as soon as the backend answers again.
 */
const BackendUnavailableModal: React.FC<BackendUnavailableModalProps> = ({
  open,
  onClose,
  reason,
  retrySeconds,
}) => {
  React.useEffect(() => {
    if (open) {
      console.log('BackendUnavailableModal: opened', { reason, retrySeconds });
    }
  }, [open, reason, retrySeconds]);

  const reasonLabel =
    reason === 'network_error' || reason === 'ECONNREFUSED'
      ? 'Connection refused'
      : reason && reason.toLowerCase().includes('timeout')
        ? 'Request timed out'
        : reason && reason.startsWith('http')
          ? `HTTP ${reason}`
          : reason || 'Unreachable';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 20px 60px -10px rgba(0,0,0,0.12)',
        },
      }}
    >
      {/* Brand header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
          pt: 3.5,
          pb: 2.5,
          px: 3,
          textAlign: 'center',
        }}
      >
        <WifiOffIcon sx={{ fontSize: 44, color: '#fff', mb: 1, opacity: 0.9 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
          ALwrity
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
          Backend Temporarily Unavailable
        </Typography>
      </Box>

      <DialogContent sx={{ px: 4, pt: 3, pb: 1, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.7 }}>
          We could not reach the ALwrity backend ({reasonLabel}). Your work is safe — requests will
          automatically retry once the backend is back online.
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          <Chip
            icon={<CircularProgress size={14} thickness={5} />}
            label={
              retrySeconds > 0
                ? `Retrying in ${retrySeconds}s`
                : 'Retrying…'
            }
            size="small"
            variant="outlined"
            color="warning"
          />
        </Box>

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', lineHeight: 1.6 }}>
          Tip: the backend prints “Backend is Ready to Serve the Frontend” when it is fully up again.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'center' }}>
        <Button
          variant="text"
          onClick={onClose}
          startIcon={<CloseIcon />}
          sx={{ color: 'text.secondary' }}
        >
          Dismiss
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BackendUnavailableModal;