import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import YouTubeIcon from '@mui/icons-material/YouTube';
import SystemStatusChip from '../../common/SystemStatusChip';

interface OnboardingTabBarProps {
  activeTab: 'website' | 'linkedin' | 'youtube';
  setActiveTab: (tab: 'website' | 'linkedin' | 'youtube') => void;
  hasWebsiteAnalysis: boolean;
  linkedinConnected: boolean;
  youtubeConnected: boolean;
  backgroundTasks: {
    tasks: Record<string, { status: string; started_at: string | null; progress_pct: number }>;
    total: number;
    completed_count: number;
    failed_count: number;
    all_done: boolean;
  } | null;
}

const OnboardingTabBar: React.FC<OnboardingTabBarProps> = ({
  activeTab,
  setActiveTab,
  hasWebsiteAnalysis,
  linkedinConnected,
  youtubeConnected,
  backgroundTasks,
}) => {
  // Selected state: white pill with blue border and soft glow
  const selectedStyle = {
    background: '#FFFFFF',
    border: '2px solid #3B82F6',
    color: '#0F172A',
    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.18), 0 0 0 1px rgba(59, 130, 246, 0.06)',
    '&:hover': {
      background: '#FFFFFF',
      border: '2px solid #3B82F6',
      boxShadow: '0 6px 20px rgba(59, 130, 246, 0.24), 0 0 0 1px rgba(59, 130, 246, 0.08)',
    },
  };

  // Status bulb style with size increased by 2px (from 10px to 12px)
  const statusBulb = (active: boolean) => ({
    width: 12,
    height: 12,
    borderRadius: '50%',
    bgcolor: active ? '#22c55e' : '#ef4444',
    boxShadow: active
      ? '0 0 6px rgba(34,197,94,0.6), 0 0 12px rgba(34,197,94,0.3)'
      : '0 0 6px rgba(239,68,68,0.6), 0 0 12px rgba(239,68,68,0.3)',
    transition: 'all 0.3s ease',
    flexShrink: 0,
  });

  const buttonBaseStyle = {
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.25,
    py: 1.25,
    px: 3.5,
    minHeight: 48,
    minWidth: 168,
    borderRadius: '999px',
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.9375rem',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    flexWrap: 'nowrap',
    transition: 'all 0.2s ease',
  };

  const buttonContentStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.25,
    whiteSpace: 'nowrap',
    flexWrap: 'nowrap',
    minWidth: 0,
  };

  const unselectedStyle = {
    bgcolor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#64748B',
    boxShadow: 'none',
    '&:hover': {
      bgcolor: '#FFFFFF',
      borderColor: '#CBD5E1',
    },
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center', width: '100%' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 1.5,
          flex: 1,
          minWidth: 0,
        }}
      >
        <Tooltip title="Connect Your Website" arrow placement="top">
          <Box component="span" sx={{ display: 'flex', minWidth: 0 }}>
            <Button
              onClick={() => setActiveTab('website')}
              sx={{
                ...buttonBaseStyle,
                ...(activeTab === 'website' ? selectedStyle : unselectedStyle),
              }}
            >
              <Box component="span" sx={buttonContentStyle}>
                <Box sx={statusBulb(hasWebsiteAnalysis)} />
                <AnalyticsIcon sx={{ fontSize: 20, flexShrink: 0, color: activeTab === 'website' ? '#3B82F6' : '#64748B' }} />
                Website Analysis
              </Box>
            </Button>
          </Box>
        </Tooltip>

        <Tooltip title="Connect Your LinkedIn profile for Professional content publishing" arrow placement="top">
          <Box component="span" sx={{ display: 'flex', minWidth: 0 }}>
            <Button
              onClick={() => setActiveTab('linkedin')}
              sx={{
                ...buttonBaseStyle,
                ...(activeTab === 'linkedin' ? selectedStyle : unselectedStyle),
              }}
            >
              <Box component="span" sx={buttonContentStyle}>
                <Box sx={statusBulb(linkedinConnected)} />
                <LinkedInIcon sx={{ fontSize: 20, flexShrink: 0, color: activeTab === 'linkedin' ? '#0A66C2' : '#64748B' }} />
                LinkedIn
              </Box>
            </Button>
          </Box>
        </Tooltip>

        <Tooltip title="Connect YouTube channel" arrow placement="top">
          <Box component="span" sx={{ display: 'flex', minWidth: 0 }}>
            <Button
              onClick={() => setActiveTab('youtube')}
              sx={{
                ...buttonBaseStyle,
                ...(activeTab === 'youtube' ? selectedStyle : unselectedStyle),
              }}
            >
              <Box component="span" sx={buttonContentStyle}>
                <Box sx={statusBulb(youtubeConnected)} />
                <YouTubeIcon sx={{ fontSize: 20, flexShrink: 0, color: activeTab === 'youtube' ? '#FF0000' : '#64748B' }} />
                YouTube
              </Box>
            </Button>
          </Box>
        </Tooltip>
      </Box>

      {/* Status chip — width fits text only */}
      {backgroundTasks && (
        <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <SystemStatusChip
            variant="compact"
            activeTasks={backgroundTasks.total - backgroundTasks.completed_count - backgroundTasks.failed_count}
            totalTasks={backgroundTasks.total}
            tasks={backgroundTasks.tasks}
          />
        </Box>
      )}
    </Box>
  );
};

export default OnboardingTabBar;
