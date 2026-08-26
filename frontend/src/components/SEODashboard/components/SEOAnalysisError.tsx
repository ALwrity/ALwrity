import React from 'react';
import { 
  Alert, 
  IconButton 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SEOAnalysisErrorProps } from '../../shared/types';

const SEOAnalysisError: React.FC<SEOAnalysisErrorProps> = ({ 
  error, 
  showError, 
  onCloseError 
}) => {
  if (!error || !showError) return null;

  return (
    <Alert 
      severity="error" 
      sx={{ mb: 2 }}
      action={
        <IconButton
          color="inherit"
          size="small"
          onClick={onCloseError}
        >
          <CloseIcon />
        </IconButton>
      }
    >
      {error}
    </Alert>
  );
};

export default SEOAnalysisError; 