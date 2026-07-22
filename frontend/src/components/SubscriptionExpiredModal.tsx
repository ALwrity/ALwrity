import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CloseIcon from '@mui/icons-material/Close';
import UpgradeIcon from '@mui/icons-material/Upgrade';

interface SubscriptionExpiredModalProps {
  open: boolean;
  onClose: () => void;
  onRenewSubscription: () => void;
  subscriptionData?: {
    plan?: string;
    tier?: string;
    limits?: any;
  } | null;
  errorData?: {
    provider?: string;
    usage_info?: any;
    message?: string;
  } | null;
}

const SubscriptionExpiredModal: React.FC<SubscriptionExpiredModalProps> = ({
  open,
  onClose,
  onRenewSubscription,
  subscriptionData,
  errorData
}) => {
  React.useEffect(() => {
    if (open) {
      console.log('SubscriptionExpiredModal: opened', {
        hasUsageInfo: !!(errorData?.usage_info),
        provider: errorData?.provider,
      });
    }
  }, [open, errorData]);

  const handleDialogClose = (_event: object, reason?: string) => {
    if (reason === 'backdropClick') return;
    onClose();
  };

  const handleRenewClick = () => {
    onRenewSubscription();
    onClose();
  };

  const usageInfo = errorData?.usage_info || {};
  const provider = errorData?.provider;

  const hasUsageData = usageInfo.current_tokens !== undefined || usageInfo.current_calls !== undefined;

  const isUsageLimit = !!errorData?.usage_info;
  const planName = subscriptionData?.plan || 'Free';

  const title = isUsageLimit
    ? `${planName} Plan Limit Reached`
    : 'Subscription Expired';

  const subtitle = errorData?.message || (isUsageLimit
    ? `You've used all your ${planName} plan resources for this month. Upgrade to keep creating with ALwrity.`
    : 'Your ALwrity subscription has expired. Renew to continue creating.');

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 20px 60px -10px rgba(0,0,0,0.12)',
        }
      }}
    >
      {/* Brand header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          pt: 3.5,
          pb: 2.5,
          px: 3,
          textAlign: 'center',
        }}
      >
        <RocketLaunchIcon sx={{ fontSize: 44, color: '#fff', mb: 1, opacity: 0.9 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
          ALwrity
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
          {title}
        </Typography>
      </Box>

      <DialogContent sx={{ px: 4, pt: 3, pb: 1, textAlign: 'center' }}>
        {/* Message */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.7 }}>
          {subtitle}
        </Typography>

        {/* Plan + Provider chips */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: hasUsageData ? 2.5 : 2, flexWrap: 'wrap' }}>
          <Chip
            label={planName}
            size="small"
            sx={{
              fontWeight: 700,
              bgcolor: '#eef2ff',
              color: '#4338ca',
              border: '1px solid #c7d2fe',
              textTransform: 'capitalize',
            }}
          />
          {provider && (
            <Chip
              label={provider}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'capitalize' }}
            />
          )}
        </Box>

        {/* Usage data section */}
        {hasUsageData && (
          <Box sx={{ textAlign: 'left', mb: 2 }}>
            <Divider sx={{ mb: 2.5 }} />

            {usageInfo.current_tokens !== undefined && (
              <Box sx={{ mb: usageInfo.current_calls !== undefined ? 2.5 : 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Token Usage
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {usageInfo.current_tokens?.toLocaleString() || 0}
                    {' / '}
                    {usageInfo.limit?.toLocaleString() || '∞'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(() => {
                    if (!usageInfo.limit || usageInfo.limit === 0) return 100;
                    return Math.min(((usageInfo.current_tokens || 0) / usageInfo.limit) * 100, 100);
                  })()}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': { bgcolor: '#6366f1', borderRadius: 3 },
                  }}
                />
                {usageInfo.requested_tokens && usageInfo.limit > 0 && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {(usageInfo.current_tokens || 0) + usageInfo.requested_tokens > usageInfo.limit
                      ? `Requesting ${usageInfo.requested_tokens.toLocaleString()} more would exceed your limit.`
                      : `Requesting ${usageInfo.requested_tokens.toLocaleString()} additional tokens.`}
                  </Typography>
                )}
              </Box>
            )}

            {usageInfo.current_calls !== undefined && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    API Calls
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {usageInfo.current_calls?.toLocaleString() || 0}
                    {' / '}
                    {(usageInfo.limit || usageInfo.call_limit || 0)?.toLocaleString() || '∞'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(() => {
                    const limit = usageInfo.limit || usageInfo.call_limit || 0;
                    if (!limit) return 100;
                    return Math.min(((usageInfo.current_calls || 0) / limit) * 100, 100);
                  })()}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': { bgcolor: '#6366f1', borderRadius: 3 },
                  }}
                />
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 4, pb: 3.5, pt: 1, gap: 1.5, justifyContent: 'center' }}>
        <Button
          variant="outlined"
          onClick={onClose}
          startIcon={<CloseIcon />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            color: 'text.secondary',
            borderColor: 'divider',
          }}
        >
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleRenewClick}
          endIcon={<UpgradeIcon />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            px: 4,
            bgcolor: '#6366f1',
            '&:hover': { bgcolor: '#4f46e5' },
          }}
        >
          {isUsageLimit ? 'Upgrade Plan' : 'Renew'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SubscriptionExpiredModal;
