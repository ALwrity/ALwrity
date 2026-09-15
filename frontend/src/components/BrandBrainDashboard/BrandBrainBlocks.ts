/**
 * Brand Brain identity block registry (Phase 4).
 *
 * The ~20 top-level blocks built by
 * ``backend/.../onboarding/canonical_profile_builder.py`` become the Identity
 * Overview icon-card grid. Block metadata drives labels + icons; the renderer
 * skips whatever is absent from a profile and draws provenance from the
 * ``sources`` map (never a card itself).
 */

import React from 'react';
import StoreIcon from '@mui/icons-material/Store';
import PeopleIcon from '@mui/icons-material/People';
import StyleIcon from '@mui/icons-material/Style';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import SpeedIcon from '@mui/icons-material/Speed';
import BoltIcon from '@mui/icons-material/Bolt';
import CategoryIcon from '@mui/icons-material/Category';
import PaletteIcon from '@mui/icons-material/Palette';
import VerifiedIcon from '@mui/icons-material/Verified';
import BrushIcon from '@mui/icons-material/Brush';
import InsightsIcon from '@mui/icons-material/Insights';
import BarChartIcon from '@mui/icons-material/BarChart';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CloudIcon from '@mui/icons-material/Cloud';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import BusinessIcon from '@mui/icons-material/Business';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CampaignIcon from '@mui/icons-material/Campaign';

export interface BrandBrainBlockMeta {
  key: string;
  label: string;
  icon: React.ElementType;
}

/** Ordered registry of every renderable canonical block (metadata + icon). */
export const BLOCK_ORDER: BrandBrainBlockMeta[] = [
  { key: 'industry', label: 'Industry', icon: StoreIcon },
  { key: 'target_audience', label: 'Target Audience', icon: PeopleIcon },
  { key: 'writing_tone', label: 'Writing Tone', icon: StyleIcon },
  { key: 'writing_voice', label: 'Writing Voice', icon: RecordVoiceOverIcon },
  { key: 'writing_complexity', label: 'Writing Complexity', icon: SpeedIcon },
  { key: 'writing_engagement', label: 'Writing Engagement', icon: BoltIcon },
  { key: 'content_types', label: 'Content Types', icon: CategoryIcon },
  { key: 'brand_colors', label: 'Brand Colors', icon: PaletteIcon },
  { key: 'brand_values', label: 'Brand Values', icon: VerifiedIcon },
  { key: 'visual_style', label: 'Visual Style', icon: BrushIcon },
  { key: 'strategy_insights', label: 'Strategy Insights', icon: InsightsIcon },
  { key: 'seo_profile', label: 'SEO Profile', icon: BarChartIcon },
  {
    key: 'competitive_intelligence',
    label: 'Competitive Intelligence',
    icon: CompareArrowsIcon,
  },
  { key: 'platform_preferences', label: 'Platform Preferences', icon: CloudIcon },
  { key: 'research_depth', label: 'Research Depth', icon: TravelExploreIcon },
  { key: 'auto_research', label: 'Auto Research', icon: AutoAwesomeIcon },
  { key: 'factual_content', label: 'Factual Content', icon: FactCheckIcon },
  { key: 'business_info', label: 'Business Info', icon: BusinessIcon },
  { key: 'persona', label: 'Persona', icon: PsychologyIcon },
  { key: 'brand_voice', label: 'Brand Voice', icon: CampaignIcon },
];

/** Human label for a block key (falls back to the raw key, with a one-off
 *  humanization for ``sources`` so it reads as a section title in viewers). */
export const blockLabel = (key: string): string => {
  const block = BLOCK_ORDER.find((entry) => entry.key === key);
  if (block) return block.label;
  if (key === 'sources') return 'Sources';
  return key;
};