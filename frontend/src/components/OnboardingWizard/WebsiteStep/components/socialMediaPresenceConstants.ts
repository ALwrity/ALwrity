import type { SvgIconComponent } from '@mui/icons-material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import YouTubeIcon from '@mui/icons-material/YouTube';
import TwitterIcon from '@mui/icons-material/Twitter';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PinterestIcon from '@mui/icons-material/Pinterest';
import GitHubIcon from '@mui/icons-material/GitHub';

export const SOCIAL_MEDIA_PRESENCE_CAPTION =
  "Confirm or edit your brand's social profile URLs";

export const SOCIAL_MEDIA_PRESENCE_INFO_TOOLTIP =
  'Ensure ALwrity knows where a brand is active; this feeds personalization, channel strategy, and content opportunities';

export const INACTIVE_SOCIAL_ICON_COLOR = '#94a3b8';

export interface SocialPlatformConfig {
  key: string;
  label: string;
  Icon: SvgIconComponent;
  color: string;
}

export const ALL_SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon, color: '#1877F2' },
  { key: 'twitter', label: 'X', Icon: TwitterIcon, color: '#1DA1F2' },
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon, color: '#E4405F' },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedInIcon, color: '#0A66C2' },
  { key: 'youtube', label: 'YouTube', Icon: YouTubeIcon, color: '#FF0000' },
  { key: 'tiktok', label: 'TikTok', Icon: MusicNoteIcon, color: '#000000' },
  { key: 'pinterest', label: 'Pinterest', Icon: PinterestIcon, color: '#BD081C' },
  { key: 'github', label: 'GitHub', Icon: GitHubIcon, color: '#333333' },
];

export function resolveSocialUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.includes('.')) return `https://${value}`;
  }
  return null;
}

export function getPlatformTooltip(label: string, isConnected: boolean, socialUrl: string | null): string {
  if (isConnected && socialUrl) {
    return `${label} - ${socialUrl}`;
  }
  return `${label} - Click to add URL`;
}
