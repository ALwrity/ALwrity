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
  // Selected state: White background, black text, with Glassmorphism border/shadow and backdrop blur #3B82F6 (light blue)
  const selectedStyle = {
    background: '#FFFFFF',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '2px solid #3B82F6',
    color: '#000000', // Black text
    boxShadow: '0 8px 32px 0 rgba(59, 130, 246, 0.15), 0 0 10px rgba(59, 130, 246, 0.2)',
    '&:hover': {
      background: '#FFFFFF',
      border: '2px solid #3B82F6',
      boxShadow: '0 8px 32px 0 rgba(59, 130, 246, 0.25), 0 0 15px rgba(59, 130, 246, 0.3)',
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
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    py: 1.5,
    px: 2,
    borderRadius: 2,
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '1rem', // Increased by 2px (from 0.875rem to 1rem)
    transition: 'all 0.2s ease',
  };

  const unselectedStyle = {
    bgcolor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    color: '#475569',
    '&:hover': {
      bgcolor: '#F1F5F9',
      borderColor: '#CBD5E1',
    },
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
      <Tooltip title="Connect Your Website" arrow placement="top">
        <Button
          onClick={() => setActiveTab('website')}
          sx={{
            ...buttonBaseStyle,
            ...(activeTab === 'website' ? selectedStyle : unselectedStyle),
          }}
        >
          <Box sx={statusBulb(hasWebsiteAnalysis)} />
          <AnalyticsIcon sx={{ fontSize: 20, color: activeTab === 'website' ? '#3B82F6' : '#64748B' }} />
          Website Analysis
        </Button>
      </Tooltip>

      <Tooltip title="Connect Your LinkedIn profile for Professional content publishing" arrow placement="top">
        <Button
          onClick={() => setActiveTab('linkedin')}
          sx={{
            ...buttonBaseStyle,
            ...(activeTab === 'linkedin' ? selectedStyle : unselectedStyle),
          }}
        >
          <Box sx={statusBulb(linkedinConnected)} />
          <LinkedInIcon sx={{ fontSize: 20, color: activeTab === 'linkedin' ? '#0A66C2' : '#64748B' }} />
          LinkedIn
        </Button>
      </Tooltip>

      <Tooltip title="Connect YouTube channel" arrow placement="top">
        <Button
          onClick={() => setActiveTab('youtube')}
          sx={{
            ...buttonBaseStyle,
            ...(activeTab === 'youtube' ? selectedStyle : unselectedStyle),
          }}
        >
          <Box sx={statusBulb(youtubeConnected)} />
          <YouTubeIcon sx={{ fontSize: 20, color: activeTab === 'youtube' ? '#FF0000' : '#64748B' }} />
          YouTube
        </Button>
      </Tooltip>

      {/* Keeps the SystemStatusChip at the last position in the same row */}
      {backgroundTasks && (
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <SystemStatusChip
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
