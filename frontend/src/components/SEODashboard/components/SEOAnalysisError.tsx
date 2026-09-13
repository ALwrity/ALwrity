import React from 'react';
import {
  Alert,
  Button,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SEOAnalysisErrorProps } from '../../shared/types';

const SEOAnalysisError: React.FC<SEOAnalysisErrorProps> = ({
  error,
  showError,
  onCloseError,
  onRetry
}) => {
  if (!error || !showError) return null;

  return (
    <Alert
      severity="error"
      sx={{ mb: 2 }}
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          )}
          <IconButton
            color="inherit"
            size="small"
            onClick={onCloseError}
            aria-label="Dismiss error"
          >
            <CloseIcon />
          </IconButton>
        </div>
      }
    >
      {error}
    </Alert>
  );
};

export default SEOAnalysisError; 