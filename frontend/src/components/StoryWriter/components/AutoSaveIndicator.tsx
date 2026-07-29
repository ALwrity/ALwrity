import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Tooltip, CircularProgress } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import CloudOffIcon from '@mui/icons-material/CloudOff';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
  errorMessage?: string | null;
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<SaveStatus, { icon: React.ReactNode; color: string; label: string }> = {
  idle: {
    icon: <CloudDoneIcon fontSize="small" />,
    color: '#9e9e9e',
    label: 'Not saved',
  },
  saving: {
    icon: <CircularProgress size={16} sx={{ color: '#8D6E63' }} />,
    color: '#8D6E63',
    label: 'Saving...',
  },
  saved: {
    icon: <CloudDoneIcon fontSize="small" />,
    color: '#22c55e',
    label: 'Saved',
  },
  error: {
    icon: <CloudOffIcon fontSize="small" />,
    color: '#ef4444',
    label: 'Save failed',
  },
  conflict: {
    icon: <CloudOffIcon fontSize="small" />,
    color: '#f59e0b',
    label: 'Conflict',
  },
};

const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  status,
  lastSavedAt,
  errorMessage,
  showLabel = false,
}) => {
  const config = STATUS_CONFIG[status];
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === 'saved') {
      setShowSaved(true);
      savedTimerRef.current = setTimeout(() => {
        setShowSaved(false);
      }, 2500);
    }
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, [status]);

  const timeAgo = lastSavedAt
    ? `${Math.round((Date.now() - lastSavedAt.getTime()) / 1000 / 60)}m ago`
    : null;

  const tooltipTitle = status === 'error' && errorMessage
    ? `Save failed: ${errorMessage}`
    : status === 'conflict'
    ? 'Another change was saved while you were editing. Please reload.'
    : status === 'saved'
    ? `Last saved${timeAgo ? ` ${timeAgo}` : ''}`
    : status === 'saving'
    ? 'Saving changes...'
    : 'Save your work';

  return (
    <Tooltip title={tooltipTitle} arrow>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          color: config.color,
          fontSize: '0.75rem',
          px: 0.5,
          cursor: 'default',
          opacity: status === 'idle' ? 0.5 : 1,
          transition: 'opacity 0.2s ease',
        }}
      >
        {config.icon}
        {(showLabel || status === 'saving' || status === 'error' || status === 'conflict') && (
          <Typography
            variant="caption"
            sx={{ color: 'inherit', fontWeight: 500, lineHeight: 1 }}
          >
            {config.label}
          </Typography>
        )}
        {status === 'saved' && showSaved && lastSavedAt && (
          <Typography
            variant="caption"
            sx={{ color: 'inherit', opacity: 0.7, fontSize: '0.65rem', lineHeight: 1 }}
          >
            {timeAgo}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default AutoSaveIndicator;
