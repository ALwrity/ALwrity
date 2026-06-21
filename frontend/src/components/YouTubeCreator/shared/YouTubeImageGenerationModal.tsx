/**
 * YouTube Image Generation Modal
 * 
 * A YouTube-specific wrapper around the shared ImageGenerationModal.
 * Provides YouTube-optimized presets, recommendations, and branding.
 * 
 * This maintains backward compatibility with existing usage while
 * leveraging the shared component infrastructure.
 */

import React from "react";
import {
  ImageGenerationModal,
  ImageGenerationSettings,
  DEFAULT_MODELS,
} from '../../shared/ImageGenerationModal';
import {
  YOUTUBE_PRESETS,
  YOUTUBE_THEME,
  YOUTUBE_RECOMMENDATIONS,
} from '../../shared/ImageGenerationPresets';

// Re-export settings type for backward compatibility
// Note: This extends the shared type to include the required 'model' field
export interface YouTubeImageGenerationSettings {
  prompt: string;
  style: "Auto" | "Fiction" | "Realistic";
  renderingSpeed: "Default" | "Turbo" | "Quality";
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  model: "ideogram-v3-turbo" | "qwen-image";
}

interface YouTubeImageGenerationModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (settings: YouTubeImageGenerationSettings) => void;
  initialPrompt: string;
  initialStyle?: "Auto" | "Fiction" | "Realistic";
  initialRenderingSpeed?: "Default" | "Turbo" | "Quality";
  initialAspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  initialModel?: "ideogram-v3-turbo" | "qwen-image";
  isGenerating?: boolean;
  sceneTitle?: string;
}

export const YouTubeImageGenerationModal: React.FC<YouTubeImageGenerationModalProps> = ({
  open,
  onClose,
  onGenerate,
  initialPrompt,
  initialStyle = "Realistic",
  initialRenderingSpeed = "Quality",
  initialAspectRatio = "16:9",
  initialModel = "ideogram-v3-turbo",
  isGenerating = false,
  sceneTitle,
}) => {
  const toYouTubeModel = (
    model?: string
  ): YouTubeImageGenerationSettings['model'] => {
    if (model === 'ideogram-v3-turbo' || model === 'qwen-image') {
      return model;
    }
    return 'ideogram-v3-turbo';
  };

  const handleGenerate = (settings: ImageGenerationSettings) => {
    const youtubeSettings: YouTubeImageGenerationSettings = {
      prompt: settings.prompt,
      style: settings.style,
      renderingSpeed: settings.renderingSpeed,
      aspectRatio: settings.aspectRatio,
      model: toYouTubeModel(settings.model),
    };
    onGenerate(youtubeSettings);
  };

  return (
    <ImageGenerationModal
      // Core props
      open={open}
      onClose={onClose}
      onGenerate={handleGenerate}
      initialPrompt={initialPrompt}
      isGenerating={isGenerating}
      
      // YouTube-specific context
      title="Generate Scene Image"
      contextTitle={sceneTitle}
      promptLabel="Visual Prompt"
      promptHelp="Describe what you want to see in the generated image. Include scene context, visual elements, mood, and style preferences. The AI will use this along with your base avatar to create a consistent character in the YouTube scene."
      generateButtonLabel="Generate Image"
      
      // YouTube presets
      presets={YOUTUBE_PRESETS}
      presetsLabel="YouTube-ready presets"
      presetsHelp="Quickly apply a YouTube-optimized look. Each preset adjusts lighting, composition, and style while keeping your avatar consistent."
      
      // Model selection enabled for YouTube
      showModelSelection={true}
      availableModels={DEFAULT_MODELS}
      defaultModel={initialModel}
      
      // Default values
      defaultStyle={initialStyle}
      defaultRenderingSpeed={initialRenderingSpeed}
      defaultAspectRatio={initialAspectRatio}
      
      // YouTube theming
      theme={YOUTUBE_THEME}
      
      // YouTube-specific recommendations
      recommendations={YOUTUBE_RECOMMENDATIONS}
    />
  );
};
