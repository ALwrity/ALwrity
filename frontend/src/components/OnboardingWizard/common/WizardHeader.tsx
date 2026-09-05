import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Fade
} from '@mui/material';
import HelpOutline from '@mui/icons-material/HelpOutline';
import Close from '@mui/icons-material/Close';
import UserBadge from '../../shared/UserBadge';
import { EmailBadgePopover } from './EmailBadgePopover';
import SystemStatusChip from './SystemStatusChip';

interface BackgroundTasksState {
  tasks: Record<string, {
    status: string;
    started_at?: string | null;
    progress_pct?: number;
    failure_reason?: string | null;
    recurring?: boolean;
    last_success?: string | null;
    next_execution?: string | null;
  }>;
  total: number;
  completed_count: number;
  failed_count: number;
  all_done?: boolean;
}

interface WizardHeaderProps {
  stepHeaderContent: {
    title: string;
    description: string;
  };
  showProgressMessage: boolean;
  progressMessage: string;
  showHelp: boolean;
  isMobile: boolean;
  onHelpToggle: () => void;
  email: string;
  onEmailChange: (email: string) => void;
  backgroundTasks?: BackgroundTasksState | null;
  onViewBackgroundResults?: (taskKey: string) => void;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({
  stepHeaderContent,
  showProgressMessage,
  progressMessage,
  showHelp,
  isMobile,
  onHelpToggle,
  email,
  onEmailChange,
  backgroundTasks,
  onViewBackgroundResults,
}) => {
  const showBackgroundTasks =
    !!backgroundTasks?.tasks && Object.keys(backgroundTasks.tasks).length > 0;

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
        color: 'white',
        p: { xs: 1.5, md: 2.24 },
        position: 'relative',
        overflow: 'visible',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        }
      }}
    >
      {/* Progress Message */}
      {showProgressMessage && (
        <Fade in={showProgressMessage}>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              background: 'rgba(16, 185, 129, 0.9)',
              color: 'white',
              p: 2,
              textAlign: 'center',
              zIndex: 10,
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {progressMessage}
            </Typography>
          </Box>
        </Fade>
      )}
      
      {/* Top Row - Title and Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6, position: 'relative', zIndex: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <UserBadge colorMode="dark" />
          <EmailBadgePopover email={email} onEmailChange={onEmailChange} />
        </Box>
        
        <Box sx={{ flex: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.025em', fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2.125rem' } }}>
            {stepHeaderContent.title}
          </Typography>
        </Box>
        
        {/* Right Action container: Background Tasks, Help & Skip */}
        <Box sx={{ display: 'flex', gap: 1.5, flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
          {showBackgroundTasks && backgroundTasks && (
            <SystemStatusChip
              variant="compact"
              activeTasks={
                backgroundTasks.total -
                backgroundTasks.completed_count -
                backgroundTasks.failed_count
              }
              totalTasks={backgroundTasks.total}
              tasks={backgroundTasks.tasks}
              onViewResults={onViewBackgroundResults}
            />
          )}
          <Tooltip title="Get Help" arrow>
            <IconButton
              onClick={onHelpToggle}
              aria-label="Get Help"
              sx={{
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                width: { xs: 26, sm: 30 },
                height: { xs: 26, sm: 30 },
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <HelpOutline sx={{ fontSize: { xs: 15, sm: 17 } }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Skip for now" arrow>
            <IconButton
              sx={{
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                width: { xs: 26, sm: 30 },
                height: { xs: 26, sm: 30 },
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <Close sx={{ fontSize: { xs: 15, sm: 17 } }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};
