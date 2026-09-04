import React from 'react';
import { Box, Button, Tooltip, SxProps, Theme } from '@mui/material';
import { keyframes } from '@mui/system';
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
  hasInput?: boolean;
  backgroundTasks: {
    tasks: Record<string, {
      status: string;
      started_at: string | null;
      progress_pct: number;
      failure_reason?: string | null;
      recurring?: boolean;
      last_success?: string | null;
      next_execution?: string | null;
    }>;
    total: number;
    completed_count: number;
    failed_count: number;
    all_done: boolean;
  } | null;
  onViewResults?: (taskKey: string) => void;
}

const selectedBlingGlow = keyframes`
  0% {
    transform: translateY(0) scale(1);
    border-color: #6366F1;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.18), 0 0 0 1px rgba(99, 102, 241, 0.06);
  }
  3.33% {
    transform: translateY(-8px) scale(1.04);
    border-color: #6366F1;
    box-shadow: 0 20px 35px rgba(99, 102, 241, 0.35), 0 0 25px rgba(99, 102, 241, 0.25), 0 0 10px rgba(139, 92, 246, 0.2);
  }
  30% {
    transform: translateY(-8px) scale(1.04);
    border-color: #6366F1;
    box-shadow: 0 20px 35px rgba(99, 102, 241, 0.35), 0 0 25px rgba(99, 102, 241, 0.25), 0 0 10px rgba(139, 92, 246, 0.2);
  }
  33.33% {
    transform: translateY(0) scale(1);
    border-color: #6366F1;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.18), 0 0 0 1px rgba(99, 102, 241, 0.06);
  }
  100% {
    transform: translateY(0) scale(1);
    border-color: #6366F1;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.18), 0 0 0 1px rgba(99, 102, 241, 0.06);
  }
`;

const unselectedBlingGlow = keyframes`
  0% {
    transform: translateY(0) scale(1);
    box-shadow: none;
    border-color: #E2E8F0;
  }
  3.33% {
    transform: translateY(-8px) scale(1.04);
    border-color: #6366F1;
    box-shadow: 0 20px 35px rgba(99, 102, 241, 0.35), 0 0 25px rgba(99, 102, 241, 0.25), 0 0 10px rgba(139, 92, 246, 0.2);
  }
  30% {
    transform: translateY(-8px) scale(1.04);
    border-color: #6366F1;
    box-shadow: 0 20px 35px rgba(99, 102, 241, 0.35), 0 0 25px rgba(99, 102, 241, 0.25), 0 0 10px rgba(139, 92, 246, 0.2);
  }
  33.33% {
    transform: translateY(0) scale(1);
    box-shadow: none;
    border-color: #E2E8F0;
  }
  100% {
    transform: translateY(0) scale(1);
    box-shadow: none;
    border-color: #E2E8F0;
  }
`;

const OnboardingTabBar: React.FC<OnboardingTabBarProps> = ({
  activeTab,
  setActiveTab,
  hasWebsiteAnalysis,
  linkedinConnected,
  youtubeConnected,
  hasInput = false,
  backgroundTasks,
  onViewResults,
}) => {
  const selectedStyle: SxProps<Theme> = {
    background: '#FFFFFF',
    border: '2px solid #6366F1',
    color: '#0F172A',
    boxShadow: '0 4px 16px rgba(99, 102, 241, 0.18), 0 0 0 1px rgba(99, 102, 241, 0.06)',
    '&:hover': {
      background: '#FFFFFF',
      border: '2px solid #6366F1',
      boxShadow: '0 6px 20px rgba(99, 102, 241, 0.24), 0 0 0 1px rgba(99, 102, 241, 0.08)',
    },
  };

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

  const buttonBaseStyle: SxProps<Theme> = {
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

  const unselectedStyle: SxProps<Theme> = {
    bgcolor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#64748B',
    boxShadow: 'none',
    '&:hover': {
      bgcolor: '#FFFFFF',
      borderColor: '#CBD5E1',
      animationPlayState: 'paused',
    },
  };

  const getAnimationStyle = (tab: 'website' | 'linkedin' | 'youtube'): SxProps<Theme> => {
    if (hasInput) return {};

    let delay = '0s';
    if (tab === 'linkedin') delay = '1.53s';
    if (tab === 'youtube') delay = '3.07s';

    const animationName = activeTab === tab ? selectedBlingGlow : unselectedBlingGlow;

    return {
      animation: `${animationName} 4.6s ease-in-out infinite`,
      animationDelay: delay,
    };
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
                ...getAnimationStyle('website'),
              }}
            >
              <Box component="span" sx={buttonContentStyle}>
                <Box sx={statusBulb(hasWebsiteAnalysis)} />
                <AnalyticsIcon sx={{ fontSize: 20, flexShrink: 0, color: activeTab === 'website' ? '#6366F1' : '#64748B' }} />
                Website
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
                ...getAnimationStyle('linkedin'),
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
                ...getAnimationStyle('youtube'),
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
    </Box>
  );
};

export default OnboardingTabBar;
