/**
 * LinkedIn Selection Image Modal
 *
 * Wrapper around the shared ImageGenerationModal with LinkedIn presets,
 * plus a result preview dialog after successful generation.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Link,
} from '@mui/material';
import {
  ImageGenerationModal,
  ImageGenerationSettings as SharedImageGenerationSettings,
} from '../../shared/ImageGenerationModal';
import type { LinkedInImageModel } from '../../shared/ImageGenerationModal.types';
import {
  LINKEDIN_PRESETS,
  LINKEDIN_THEME,
  LINKEDIN_RECOMMENDATIONS,
  LINKEDIN_IMAGE_MODELS,
} from '../../shared/ImageGenerationPresets';

export interface LinkedInImageGenerationSettings {
  prompt: string;
  style: 'Auto' | 'Fiction' | 'Realistic';
  renderingSpeed: 'Default' | 'Turbo' | 'Quality';
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  model: LinkedInImageModel;
}

export interface GeneratedLinkedInImagePreview {
  blobUrl: string;
  imageUrl: string;
  imageId?: string;
}

interface LinkedInSelectionImageModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (settings: LinkedInImageGenerationSettings) => void;
  initialPrompt: string;
  isGenerating?: boolean;
  generatedPreview?: GeneratedLinkedInImagePreview | null;
  onClosePreview?: () => void;
}

export const LinkedInSelectionImageModal: React.FC<LinkedInSelectionImageModalProps> = ({
  open,
  onClose,
  onGenerate,
  initialPrompt,
  isGenerating = false,
  generatedPreview,
  onClosePreview,
}) => {
  const toLinkedInModel = (model?: string): LinkedInImageModel => {
    if (
      model === 'flux-kontext-pro' ||
      model === 'ideogram-v3-turbo' ||
      model === 'qwen-image'
    ) {
      return model;
    }
    return 'flux-kontext-pro';
  };

  const handleGenerate = (settings: SharedImageGenerationSettings) => {
    onGenerate({
      prompt: settings.prompt,
      style: settings.style,
      renderingSpeed: settings.renderingSpeed,
      aspectRatio: settings.aspectRatio,
      model: toLinkedInModel(settings.model),
    });
  };

  if (generatedPreview) {
    return (
      <Dialog open={open} onClose={onClosePreview || onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#0A66C2', fontWeight: 600 }}>
          Image Generated Successfully
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Box
              component="img"
              src={generatedPreview.blobUrl}
              alt="Generated LinkedIn image"
              sx={{
                maxWidth: '100%',
                maxHeight: 360,
                borderRadius: 2,
                border: '1px solid #e0e0e0',
                mb: 2,
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Your LinkedIn-optimized image is ready.
            </Typography>
            <Link
              href={generatedPreview.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontSize: '0.85rem', wordBreak: 'break-all' }}
            >
              {generatedPreview.imageUrl}
            </Link>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClosePreview || onClose} variant="contained" color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <ImageGenerationModal
      open={open}
      onClose={onClose}
      onGenerate={handleGenerate}
      initialPrompt={initialPrompt}
      isGenerating={isGenerating}
      title="Generate LinkedIn Image"
      promptLabel="Visual Prompt"
      promptHelp="Describe the image you want for your LinkedIn post. The selected text is used as context — refine the prompt for best results."
      generateButtonLabel="Generate Image"
      presets={LINKEDIN_PRESETS}
      presetsLabel="LinkedIn-ready presets"
      presetsHelp="Quickly apply a LinkedIn-friendly look. Each preset adjusts style, composition, and aspect ratio."
      showModelSelection={true}
      availableModels={LINKEDIN_IMAGE_MODELS}
      defaultModel="flux-kontext-pro"
      defaultStyle="Realistic"
      defaultRenderingSpeed="Quality"
      defaultAspectRatio="1:1"
      theme={LINKEDIN_THEME}
      recommendations={LINKEDIN_RECOMMENDATIONS}
    />
  );
};
