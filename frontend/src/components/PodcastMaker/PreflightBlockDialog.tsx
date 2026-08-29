import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Alert,
  Stack,
  alpha,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import InfoIcon from '@mui/icons-material/Info';
import { PreflightCheckResponse } from '../../services/billingService';
import { useNavigate } from 'react-router-dom';
import { saveNavigationState } from '../../utils/navigationState';

interface PreflightBlockDialogProps {
  open: boolean;
  onClose: () => void;
  response: PreflightCheckResponse | null;
  operationName?: string;
}

export const PreflightBlockDialog: React.FC<PreflightBlockDialogProps> = ({
  open,
  onClose,
  response,
  operationName = 'This operation',
}) => {
  const navigate = useNavigate();

  if (!response) return null;

  const blockedOperation = response.operations.find((op) => !op.allowed);
  const message = blockedOperation?.message || 'Operation blocked by subscription limits';
  const limitInfo = blockedOperation?.limit_info;

  const handleUpgrade = () => {
    saveNavigationState(window.location.pathname);
    navigate('/pricing');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: alpha('#0f172a', 0.95),
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4,
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <BlockIcon sx={{ color: '#ef4444', fontSize: 32 }} />
          <Box>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              Operation Blocked
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {operationName} cannot proceed
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="error" sx={{ background: alpha('#ef4444', 0.1), border: '1px solid rgba(239,68,68,0.3)' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {message}
            </Typography>
          </Alert>

          {limitInfo && (
            <Box sx={{ p: 2, background: alpha('#667eea', 0.1), borderRadius: 2, border: '1px solid rgba(102,126,234,0.3)' }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoIcon fontSize="small" />
                  Usage Limits
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current: {limitInfo.current_usage.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Limit: {limitInfo.limit.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Remaining: {limitInfo.remaining.toLocaleString()}
                </Typography>
              </Stack>
            </Box>
          )}

          {response.estimated_cost > 0 && (
            <Box sx={{ p: 2, background: alpha('#f59e0b', 0.1), borderRadius: 2, border: '1px solid rgba(245,158,11,0.3)' }}>
              <Typography variant="body2" color="text.secondary">
                Estimated Cost: ${response.estimated_cost.toFixed(4)}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button
          onClick={handleUpgrade}
          variant="contained"
          startIcon={<UpgradeIcon />}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
            },
          }}
        >
          Upgrade Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
};

