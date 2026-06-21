/**
 * Shared Video Generation Modal Types
 *
 * Enables hyper-personalization for different use cases (LinkedIn Writer, Video Studio, etc.)
 * while maintaining a consistent API.
 */

export type VideoAspectRatio = '9:16' | '1:1' | '16:9';
export type VideoResolution = '480p' | '720p' | '1080p';
export type VideoDuration = 5 | 8 | 10;
export type VideoMotionPreset = 'Subtle' | 'Medium' | 'Dynamic';

export interface VideoGenerationSettings {
  prompt: string;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  resolution: VideoResolution;
  motion: VideoMotionPreset;
}

export interface VideoPreset {
  key: string;
  title: string;
  subtitle: string;
  prompt: string;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  resolution: VideoResolution;
  motion: VideoMotionPreset;
}

export interface VideoModalTheme {
  dialogBackground: string;
  primaryAccent: string;
  secondaryAccent: string;
  warningAccent: string;
}

export interface VideoCustomRecommendations {
  aspectRatio?: React.ReactNode;
  duration?: React.ReactNode;
  resolution?: React.ReactNode;
  motion?: React.ReactNode;
}

export interface VideoGenerationModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (settings: VideoGenerationSettings) => void;
  initialPrompt: string;
  isGenerating?: boolean;

  title?: string;
  contextTitle?: string;
  promptLabel?: string;
  promptHelp?: string;
  generateButtonLabel?: string;

  presets?: VideoPreset[];
  presetsLabel?: string;
  presetsHelp?: string;

  defaultAspectRatio?: VideoAspectRatio;
  defaultDuration?: VideoDuration;
  defaultResolution?: VideoResolution;
  defaultMotion?: VideoMotionPreset;

  theme?: VideoModalTheme;
  recommendations?: VideoCustomRecommendations;
}

export const DEFAULT_VIDEO_THEME: VideoModalTheme = {
  dialogBackground: 'rgba(15, 23, 42, 0.95)',
  primaryAccent: '#667eea',
  secondaryAccent: '#10b981',
  warningAccent: '#f59e0b',
};
