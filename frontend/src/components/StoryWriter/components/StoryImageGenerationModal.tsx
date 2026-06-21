import React from 'react';
import {
  ImageGenerationModal,
  ImageGenerationSettings,
  DEFAULT_MODELS,
} from '../../shared/ImageGenerationModal';
import {
  ImageStyle,
  RenderingSpeed,
  AspectRatio,
  ImageModel,
} from '../../shared/ImageGenerationModal.types';

export interface StoryImageGenerationSettings {
  prompt: string;
  style: ImageStyle;
  renderingSpeed: RenderingSpeed;
  aspectRatio: AspectRatio;
  model: ImageModel;
}

interface StoryImageGenerationModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (settings: StoryImageGenerationSettings) => void;
  initialPrompt: string;
  sceneTitle?: string;
  storyMode?: 'marketing' | 'pure' | null;
  initialStyle?: ImageStyle;
  initialRenderingSpeed?: RenderingSpeed;
  initialAspectRatio?: AspectRatio;
  initialModel?: ImageModel;
  isGenerating?: boolean;
}

export const StoryImageGenerationModal: React.FC<StoryImageGenerationModalProps> = ({
  open,
  onClose,
  onGenerate,
  initialPrompt,
  sceneTitle,
  storyMode = 'marketing',
  initialStyle,
  initialRenderingSpeed,
  initialAspectRatio,
  initialModel,
  isGenerating = false,
}) => {
  const resolvedDefaultModel: ImageModel =
    initialModel ||
    (storyMode === 'marketing' ? 'ideogram-v3-turbo' : 'qwen-image');

  const resolvedStyle: ImageStyle =
    initialStyle || (storyMode === 'marketing' ? 'Realistic' : 'Fiction');

  const resolvedRenderingSpeed: RenderingSpeed =
    initialRenderingSpeed || 'Quality';

  const resolvedAspectRatio: AspectRatio =
    initialAspectRatio || '16:9';

  const toStoryModel = (model?: string): ImageModel => {
    if (model === 'ideogram-v3-turbo' || model === 'qwen-image') {
      return model;
    }
    return resolvedDefaultModel;
  };

  const handleGenerate = (settings: ImageGenerationSettings) => {
    const storySettings: StoryImageGenerationSettings = {
      prompt: settings.prompt,
      style: settings.style,
      renderingSpeed: settings.renderingSpeed,
      aspectRatio: settings.aspectRatio,
      model: toStoryModel(settings.model),
    };
    onGenerate(storySettings);
  };

  return (
    <ImageGenerationModal
      open={open}
      onClose={onClose}
      onGenerate={handleGenerate}
      initialPrompt={initialPrompt}
      isGenerating={isGenerating}
      title="Scene Illustration Settings"
      contextTitle={sceneTitle}
      promptLabel="Image Prompt"
      promptHelp="Describe the scene illustration. Include key visual elements, characters, mood, and style. The AI will use this along with your story context."
      generateButtonLabel="Regenerate Image"
      showModelSelection={true}
      availableModels={DEFAULT_MODELS}
      defaultModel={resolvedDefaultModel}
      defaultStyle={resolvedStyle}
      defaultRenderingSpeed={resolvedRenderingSpeed}
      defaultAspectRatio={resolvedAspectRatio}
    />
  );
};

export type { StoryImageGenerationModalProps };

