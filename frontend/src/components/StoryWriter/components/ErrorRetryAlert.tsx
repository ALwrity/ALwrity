import React, { useEffect, useRef } from 'react';
import { Alert, Box, Button, Typography, IconButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import CloseIcon from '@mui/icons-material/Close';

export interface ErrorRetryAction {
  label: string;
  icon?: React.ReactNode;
  handler: () => void | Promise<void>;
  variant?: 'contained' | 'outlined';
  disabled?: boolean;
  loading?: boolean;
}

export type ErrorCategory = 'auth' | 'network' | 'api' | 'validation' | 'quota' | 'unknown';

export interface ClassifiedError {
  message: string;
  category: ErrorCategory;
  canRetry: boolean;
  details?: string;
  canDismiss?: boolean;
}

function classifyError(errorMessage: string | null): ClassifiedError {
  if (!errorMessage) {
    return { message: '', category: 'unknown', canRetry: false };
  }
  const lower = errorMessage.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('authentication') || lower.includes('login') || lower.includes('sign in')) {
    return { message: errorMessage, category: 'auth', canRetry: false, details: 'Your session may have expired. Please sign in again.' };
  }
  if (lower.includes('402') || lower.includes('quota') || lower.includes('limit') || lower.includes('subscription') || lower.includes('upgrade')) {
    return { message: errorMessage, category: 'quota', canRetry: false, details: 'You may have reached your usage limit or need to upgrade your plan.' };
  }
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('fetch') || lower.includes('connection') || lower.includes('econnrefused')) {
    return { message: errorMessage, category: 'network', canRetry: true, details: 'A network error occurred. Check your connection and try again.' };
  }
  if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('server error')) {
    return { message: errorMessage, category: 'api', canRetry: true, details: 'The server encountered an error. This is usually temporary.' };
  }
  if (lower.includes('required') || lower.includes('invalid') || lower.includes('please') || lower.includes('must') || lower.includes('missing')) {
    return { message: errorMessage, category: 'validation', canRetry: false };
  }

  return { message: errorMessage, category: 'unknown', canRetry: true };
}

interface ErrorRetryAlertProps {
  error: string | null;
  onDismiss?: () => void;
  retryActions?: ErrorRetryAction[];
  defaultRetry?: () => void | Promise<void>;
  severity?: 'error' | 'warning';
}

const ErrorRetryAlert: React.FC<ErrorRetryAlertProps> = ({
  error,
  onDismiss,
  retryActions,
  defaultRetry,
  severity,
}) => {
  const autoDismissedRef = useRef(false);

  useEffect(() => {
    autoDismissedRef.current = false;
  }, [error]);

  if (!error) return null;

  const classified = classifyError(error);
  const effectiveSeverity = severity || (classified.category === 'validation' ? 'warning' : 'error');

  return (
    <Alert
      severity={effectiveSeverity}
      sx={{ mb: 3, alignItems: 'flex-start' }}
      action={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {retryActions && retryActions.length > 0 ? (
            retryActions.map((action, idx) => (
              <Button
                key={idx}
                size="small"
                variant={action.variant || 'outlined'}
                startIcon={action.loading ? <RefreshIcon sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} /> : action.icon}
                onClick={action.handler}
                disabled={action.disabled || action.loading}
              >
                {action.label}
              </Button>
            ))
          ) : classified.category === 'auth' ? (
            <Button size="small" variant="outlined" startIcon={<LoginIcon />} onClick={() => window.location.reload()}>
              Sign In
            </Button>
          ) : classified.category === 'quota' ? (
            <Button size="small" variant="outlined" startIcon={<SettingsIcon />} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              View Plans
            </Button>
          ) : defaultRetry ? (
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={defaultRetry}>
              Try Again
            </Button>
          ) : null}
          {onDismiss && (
            <IconButton size="small" onClick={onDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      }
    >
      <Typography variant="body2" fontWeight={600}>{classified.message}</Typography>
      {classified.details && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {classified.details}
        </Typography>
      )}
    </Alert>
  );
};

export { classifyError };
export default ErrorRetryAlert;
