import { ReactElement } from 'react';
import {
  LinkedIn,
  Facebook,
  Twitter,
  Instagram,
  YouTube,
  Podcasts,
  Article,
  Email,
} from '@mui/icons-material';

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
