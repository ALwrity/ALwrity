import { ReactElement } from 'react';
import LinkedIn from '@mui/icons-material/LinkedIn';
import Facebook from '@mui/icons-material/Facebook';
import Twitter from '@mui/icons-material/Twitter';
import Instagram from '@mui/icons-material/Instagram';
import YouTube from '@mui/icons-material/YouTube';
import Podcasts from '@mui/icons-material/Podcasts';
import Article from '@mui/icons-material/Article';
import Email from '@mui/icons-material/Email';

/**
 * Frontend-only presentation metadata (icons/colors) keyed by platform id.
 * The canonical platform list (ids, names, descriptions, enabled/scheduled
 * flags) comes from the backend registry via GET /step4/persona-platforms.
 * Icons/colors are inherently frontend concerns, so they live here.
 */
export const PLATFORM_ICONS: Record<string, ReactElement> = {
  linkedin: <LinkedIn />,
  facebook: <Facebook />,
  twitter: <Twitter />,
  instagram: <Instagram />,
  youtube: <YouTube />,
  podcast: <Podcasts />,
  blog: <Article />,
  medium: <Article />,
  substack: <Email />,
};

export const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0077B5',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  instagram: '#E4405F',
  youtube: '#FF0000',
  podcast: '#7C3AED',
  blog: '#FF6B35',
  medium: '#000000',
  substack: '#FF6719',
};

export const DEFAULT_PLATFORM_ICON: ReactElement = <Article />;
export const DEFAULT_PLATFORM_COLOR = '#64748b';
