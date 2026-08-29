import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Typography,
  Stack,
  Chip,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import Warning from '@mui/icons-material/Warning';
import Info from '@mui/icons-material/Info';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import ImageIcon from '@mui/icons-material/Image';
import TextFields from '@mui/icons-material/TextFields';
import AttachMoney from '@mui/icons-material/AttachMoney';
import { PreflightValidationResult } from '../../hooks/useCampaignCreator';

interface PreflightValidationAlertProps {
  validationResult: PreflightValidationResult | null;
  isLoading?: boolean;
  onClose?: () => void;
}

export const PreflightValidationAlert: React.FC<PreflightValidationAlertProps> = ({
  validationResult,
  isLoading = false,
  onClose,
}) => {
  if (isLoading) {
    return (
      <Alert
        severity="info"
        icon={<CircularProgress size={20} />}
        sx={{
          mb: 3,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <AlertTitle>Validating Campaign...</AlertTitle>
        <Typography variant="body2" color="text.secondary">
          Checking subscription limits and estimating costs
        </Typography>
        <LinearProgress sx={{ mt: 1 }} />
      </Alert>
    );
  }

  if (!validationResult) {
    return null;
  }

  const { can_proceed, message, summary } = validationResult;
  const severity = can_proceed ? 'success' : 'warning';
  const icon = can_proceed ? <CheckCircle /> : <Warning />;
  const title = can_proceed ? 'Ready to Generate' : 'Action Required';

  return (
    <Alert
      severity={severity}
      icon={icon}
      onClose={onClose}
      sx={{
        mb: 3,
        background: can_proceed
          ? 'rgba(34, 197, 94, 0.1)'
          : 'rgba(245, 158, 11, 0.1)',
        border: can_proceed
          ? '1px solid rgba(34, 197, 94, 0.3)'
          : '1px solid rgba(245, 158, 11, 0.3)',
      }}
    >
      <AlertTitle sx={{ fontWeight: 700 }}>{title}</AlertTitle>
      
      {message && (
        <Typography variant="body2" sx={{ mb: summary ? 2 : 0 }}>
          {message}
        </Typography>
      )}

      {summary && (
        <Stack spacing={2} mt={summary ? 2 : 0}>
          {/* Summary Stats */}
          <Box
            display="flex"
            gap={2}
            flexWrap="wrap"
            sx={{
              p: 2,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <Chip
              icon={<AutoAwesome />}
              label={`${summary.total_assets} Total Assets`}
              color={can_proceed ? 'success' : 'default'}
              variant="outlined"
            />
            <Chip
              icon={<ImageIcon />}
              label={`${summary.image_count} Images`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<TextFields />}
              label={`${summary.text_count} Text Assets`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<AttachMoney />}
              label={`$${summary.estimated_cost.toFixed(2)} Est. Cost`}
              color={summary.estimated_cost > 0 ? 'warning' : 'default'}
              variant="outlined"
              sx={{
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            />
          </Box>

          {/* Additional Info */}
          {can_proceed && (
            <Typography variant="body2" color="text.secondary">
              <Info sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
              All subscription limits are sufficient. You can proceed with campaign creation.
            </Typography>
          )}

          {!can_proceed && (
            <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
              <ErrorIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
              Please upgrade your subscription or reduce the number of assets to continue.
            </Typography>
          )}
        </Stack>
      )}
    </Alert>
  );
};

