/**
 * Shared Image Generation Modal Types
 * 
 * These types enable hyper-personalization for different use cases
 * (YouTube Creator, Podcast Maker, etc.) while maintaining a consistent API.
 */

// Core image generation settings that get passed to the backend
export interface ImageGenerationSettings {
  prompt: string;
  style: ImageStyle;
  renderingSpeed: RenderingSpeed;
  aspectRatio: AspectRatio;
  model?: ImageModel | LinkedInImageModel;
}

// Style options for image generation
export type ImageStyle = 'Auto' | 'Fiction' | 'Realistic';

// Rendering speed/quality options
export type RenderingSpeed = 'Turbo' | 'Default' | 'Quality';

// Aspect ratio options
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

// Available AI models for image generation (YouTube, Story Writer, Brand Avatar, etc.)
export type ImageModel = 'ideogram-v3-turbo' | 'qwen-image';

/** LinkedIn-only model union; not part of shared ImageModel */
export type LinkedInImageModel = 'flux-kontext-pro' | 'ideogram-v3-turbo' | 'qwen-image';

// Preset configuration for quick-apply presets
export interface ImagePreset {
  key: string;
  title: string;
  subtitle: string;
  prompt: string;
  style: ImageStyle;
  renderingSpeed: RenderingSpeed;
  aspectRatio: AspectRatio;
  model?: ImageModel;
  image?: string; // Path to example image
}

export interface LinkedInModelOption {
  id: LinkedInImageModel;
  name: string;
  description: string;
  costPerImage: string;
}

// Model option for the model selector
export interface ModelOption {
  id: ImageModel;
  name: string;
  description: string;
  costPerImage: string;
}

// Theme configuration for branding
export interface ImageModalTheme {
  // Background colors
  dialogBackground: string;
  // Accent colors for info panels
  primaryAccent: string;
  secondaryAccent: string;
  warningAccent: string;
}

// Custom recommendation text for context-specific help
export interface CustomRecommendations {
  style?: React.ReactNode;
  speed?: React.ReactNode;
  aspectRatio?: React.ReactNode;
  model?: React.ReactNode;
}

// Main modal props with hyper-personalization options
export interface ImageGenerationModalProps {
  // Core functionality
  open: boolean;
  onClose: () => void;
  onGenerate: (settings: ImageGenerationSettings) => void;
  initialPrompt: string;
  isGenerating?: boolean;
  
  // Context
  title?: string;
  contextTitle?: string; // e.g., scene title, section name
  promptLabel?: string;
  promptHelp?: string;
  generateButtonLabel?: string;
  
  // Hyper-personalization
  presets?: ImagePreset[];
  presetsLabel?: string;
  presetsHelp?: string;
  
  // Model selection
  showModelSelection?: boolean;
  availableModels?: Array<ModelOption | LinkedInModelOption>;
  defaultModel?: ImageModel | LinkedInImageModel;
  
  // Default values
  defaultStyle?: ImageStyle;
  defaultRenderingSpeed?: RenderingSpeed;
  defaultAspectRatio?: AspectRatio;
  
  // Theming
  theme?: ImageModalTheme;
  
  // Custom recommendations for info panels
  recommendations?: CustomRecommendations;
}

// Default theme (neutral dark theme)
export const DEFAULT_THEME: ImageModalTheme = {
  dialogBackground: 'rgba(15, 23, 42, 0.95)',
  primaryAccent: '#667eea',
  secondaryAccent: '#10b981',
  warningAccent: '#f59e0b',
};

// Default models available
export const DEFAULT_MODELS: ModelOption[] = [
  {
    id: 'ideogram-v3-turbo',
    name: 'Ideogram V3 Turbo ✨',
    description: 'Photorealistic • Superior text rendering • $0.10/image',
    costPerImage: '$0.10',
  },
  {
    id: 'qwen-image',
    name: 'Qwen Image ⚡',
    description: 'Fast generation • High quality • $0.05/image',
    costPerImage: '$0.05',
  },
];

