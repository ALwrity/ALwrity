/**
 * Video Generation Presets
 *
 * Domain-specific presets and themes for the shared VideoGenerationModal.
 */

import React from 'react';
import type {
  VideoPreset,
  VideoModalTheme,
  VideoCustomRecommendations,
} from './VideoGenerationModal.types';

export const LINKEDIN_VIDEO_PRESETS: VideoPreset[] = [
  {
    key: 'professionalLandscape',
    title: 'Professional Landscape',
    subtitle: '16:9 format for LinkedIn feed video',
    aspectRatio: '16:9',
    duration: 5,
    resolution: '720p',
    motion: 'Medium',
  },
  {
    key: 'squareFeed',
    title: 'Square Feed',
    subtitle: '1:1 format for LinkedIn mobile feed',
    aspectRatio: '1:1',
    duration: 5,
    resolution: '720p',
    motion: 'Medium',
  },
  {
    key: 'portraitMobile',
    title: 'Portrait Mobile',
    subtitle: '9:16 vertical for mobile-first posts',
    aspectRatio: '9:16',
    duration: 5,
    resolution: '720p',
    motion: 'Medium',
  },
  {
    key: 'thoughtLeadership',
    title: 'Thought Leadership',
    subtitle: 'Executive tone with subtle motion',
    aspectRatio: '16:9',
    duration: 8,
    resolution: '1080p',
    motion: 'Subtle',
  },
];

export const LINKEDIN_VIDEO_THEME: VideoModalTheme = {
  dialogBackground: 'rgba(10, 30, 60, 0.96)',
  primaryAccent: '#0A66C2',
  secondaryAccent: '#057642',
  warningAccent: '#f59e0b',
};

export const LINKEDIN_VIDEO_RECOMMENDATIONS: VideoCustomRecommendations = {
  aspectRatio: (
    <>
      <strong>16:9 (Landscape):</strong> Standard LinkedIn feed video format<br />
      <strong>1:1 (Square):</strong> Mobile-friendly square feed posts<br />
      <strong>9:16 (Portrait):</strong> Vertical video for mobile-first audiences
    </>
  ),
  duration: (
    <>
      <strong>5s:</strong> Quick hooks and teaser clips (lowest cost)<br />
      <strong>8s:</strong> Balanced length for most LinkedIn posts<br />
      <strong>10s:</strong> Maximum length for richer storytelling
    </>
  ),
  resolution: (
    <>
      <strong>720p:</strong> Recommended balance of quality and cost<br />
      <strong>1080p:</strong> Premium quality for thought leadership content<br />
      <strong>480p:</strong> Fast previews while refining your prompt
    </>
  ),
  motion: (
    <>
      <strong>Subtle:</strong> Professional, minimal movement — best for executive content<br />
      <strong>Medium:</strong> Balanced motion for most LinkedIn posts<br />
      <strong>Dynamic:</strong> Energetic movement for attention-grabbing clips
    </>
  ),
  model: (
    <>
      <strong>HunyuanVideo 1.5:</strong> Best default for quick LinkedIn feed clips (5–10s)<br />
      <strong>LTX-2 Pro:</strong> Cinematic 1080p with synchronized audio<br />
      <strong>Google Veo 3.1:</strong> Premium quality with flexible resolution options
    </>
  ),
};
