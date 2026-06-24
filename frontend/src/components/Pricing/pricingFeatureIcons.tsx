import React from 'react';
import { Box } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FacebookIcon from '@mui/icons-material/Facebook';
import BusinessIcon from '@mui/icons-material/Business';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedIcon from '@mui/icons-material/Verified';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import GoogleIcon from '@mui/icons-material/Google';
import LanguageIcon from '@mui/icons-material/Language';
import ArticleIcon from '@mui/icons-material/Article';
import ShareIcon from '@mui/icons-material/Share';
import GroupIcon from '@mui/icons-material/Group';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TimelineIcon from '@mui/icons-material/Timeline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import InsightsIcon from '@mui/icons-material/Insights';
import DescriptionIcon from '@mui/icons-material/Description';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BrushIcon from '@mui/icons-material/Brush';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SavingsIcon from '@mui/icons-material/Savings';
import CampaignIcon from '@mui/icons-material/Campaign';
import LoyaltyIcon from '@mui/icons-material/Loyalty';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import HandshakeIcon from '@mui/icons-material/Handshake';
import StorefrontIcon from '@mui/icons-material/Storefront';

const FEATURE_ICON_MAP: Record<string, SvgIconComponent> = {
  'blog-writer': MenuBookIcon,
  'facebook-writer': FacebookIcon,
  'linkedin-studio': BusinessIcon,
  'story-studio': AutoStoriesIcon,
  'podcast-studio': PodcastsIcon,
  'youtube-studio': VideoLibraryIcon,
  'image-studio': ImageIcon,
  'video-studio': VideoLibraryIcon,
  'audio-studio': AudiotrackIcon,
  'ai-research': SearchIcon,
  'ai-fact-check': VerifiedIcon,
  'content-enhancers': AutoFixHighIcon,
  'google-search-console': GoogleIcon,
  'wix-publishing': LanguageIcon,
  'wordpress-publishing': ArticleIcon,
  'professional-platform': BusinessIcon,
  'social-platforms': ShareIcon,
  'team-collaboration': GroupIcon,
  'custom-integrations': IntegrationInstructionsIcon,
  'ai-usage-statistics': AnalyticsIcon,
  'seo-dashboard': TimelineIcon,
  'content-planning': CalendarMonthIcon,
  'advanced-analytics': InsightsIcon,
  'white-label-reporting': DescriptionIcon,
  'scheduler-analytics': ScheduleIcon,
  'ai-text': PsychologyIcon,
  'ai-image': ImageIcon,
  'ai-image-edits': BrushIcon,
  'ai-video': VideoLibraryIcon,
  'ai-audio': AudiotrackIcon,
  'ai-search': SearchIcon,
  'ai-research-gen': ManageSearchIcon,
  'monthly-cost-cap': SavingsIcon,
  'campaign-creator': CampaignIcon,
  'brand-persona': PsychologyIcon,
  'engagement-reward': LoyaltyIcon,
  'community-support': SupportAgentIcon,
  'priority-email': EmailIcon,
  'account-manager': PersonIcon,
  'white-glove-onboarding': HandshakeIcon,
  'white-label': StorefrontIcon,
};

const DEFAULT_ICON = AutoFixHighIcon;

export function getFeatureIcon(rowId: string): SvgIconComponent {
  return FEATURE_ICON_MAP[rowId] ?? DEFAULT_ICON;
}

interface FeatureIconBadgeProps {
  rowId: string;
  size?: number;
}

export const FeatureIconBadge: React.FC<FeatureIconBadgeProps> = ({ rowId, size = 20 }) => {
  const Icon = getFeatureIcon(rowId);
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1.5,
        bgcolor: '#F0F4FF',
        border: '1px solid #E0E7FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#6366f1',
      }}
    >
      <Icon sx={{ fontSize: size }} aria-hidden />
    </Box>
  );
};
