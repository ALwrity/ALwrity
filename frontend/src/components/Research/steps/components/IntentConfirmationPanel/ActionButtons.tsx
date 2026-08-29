/**
 * ActionButtons Component
 * 
 * Action buttons section (More details toggle and Start Research).
 */

import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';

interface ActionButtonsProps {
  showDetails: boolean;
  onToggleDetails: () => void;
  onExecute: () => void;
  isExecuting: boolean;
  canExecute: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  showDetails,
  onToggleDetails,
  onExecute,
  isExecuting,
  canExecute,
}) => {
  return (
    <Box mt={2}>
      {/* Guidance Message */}
      {canExecute && !isExecuting && (
        <Alert
          severity="info"
          icon={<InfoIcon />}
          sx={{
            mb: 2,
            backgroundColor: '#e0f2fe',
            border: '1px solid #bae6fd',
            '& .MuiAlert-icon': {
              color: '#0ea5e9',
            },
            '& .MuiAlert-message': {
              color: '#0c4a6e',
            },
          }}
        >
          <Typography variant="body2" fontWeight={500} gutterBottom>
            Ready to start research!
          </Typography>
          <Typography variant="caption" display="block">
            Review the research question and parameters above. Click "Start Research" to begin gathering information. You can edit any field before starting.
          </Typography>
        </Alert>
      )}
      
      {!canExecute && !isExecuting && (
        <Alert
          severity="warning"
          sx={{
            mb: 2,
            backgroundColor: '#fff7ed',
            border: '1px solid #fed7aa',
            '& .MuiAlert-icon': {
              color: '#f59e0b',
            },
            '& .MuiAlert-message': {
              color: '#92400e',
            },
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            Please select at least one research query to proceed.
          </Typography>
        </Alert>
      )}

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        pt={2}
        borderTop="1px solid #e5e7eb"
      >
        <Button
          size="small"
          onClick={onToggleDetails}
          endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{
            color: '#666',
            '&:hover': { backgroundColor: '#f3f4f6' },
          }}
        >
          {showDetails ? 'Less details' : 'More details'}
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={isExecuting ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
          onClick={onExecute}
          disabled={isExecuting || !canExecute}
          sx={{
            backgroundColor: '#0ea5e9',
            '&:hover': { backgroundColor: '#0284c7' },
            '&:disabled': { backgroundColor: '#d1d5db', color: '#9ca3af' },
            fontWeight: 600,
            px: 3,
          }}
        >
          {isExecuting ? 'Researching...' : 'Start Research'}
        </Button>
      </Box>
    </Box>
  );
};
