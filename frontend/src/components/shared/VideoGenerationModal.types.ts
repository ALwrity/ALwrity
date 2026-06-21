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



/** LinkedIn text-to-video model IDs (WaveSpeed) */

export type LinkedInVideoModel = 'hunyuan-video-1.5' | 'ltx-2-pro' | 'veo3.1';



export interface VideoGenerationSettings {

  prompt: string;

  aspectRatio: VideoAspectRatio;

  duration: VideoDuration;

  resolution: VideoResolution;

  motion: VideoMotionPreset;

  model?: LinkedInVideoModel;

}



export interface VideoPreset {

  key: string;

  title: string;

  subtitle: string;

  prompt?: string;

  aspectRatio: VideoAspectRatio;

  duration: VideoDuration;

  resolution: VideoResolution;

  motion: VideoMotionPreset;

}



export interface VideoModelOption {

  id: LinkedInVideoModel;

  name: string;

  description: string;

  costHint: string;

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

  model?: React.ReactNode;

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



  showModelSelection?: boolean;

  availableModels?: VideoModelOption[];

  defaultModel?: LinkedInVideoModel;



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



export const DEFAULT_LINKEDIN_VIDEO_MODELS: VideoModelOption[] = [

  {

    id: 'hunyuan-video-1.5',

    name: 'HunyuanVideo 1.5',

    description: 'Fast, affordable — best default for LinkedIn feed clips',

    costHint: 'from $0.02/s',

  },

  {

    id: 'ltx-2-pro',

    name: 'LTX-2 Pro',

    description: 'Cinematic 1080p with synchronized audio',

    costHint: 'from $0.06/s',

  },

  {

    id: 'veo3.1',

    name: 'Google Veo 3.1',

    description: 'High-quality flexible output with audio',

    costHint: 'premium',

  },

];


