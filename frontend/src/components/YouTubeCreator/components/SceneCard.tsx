/**
 * Scene Card Component
 *
 * Displays a YouTube scene with editing, generation, and media display capabilities.
 * Refactored for reusability and maintainability following React best practices.
 */

import React, { useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Box,
} from '@mui/material';
import { Scene } from '../../../services/youtubeApi';
import { AudioGenerationSettings } from '../../../components/shared/AudioSettingsModal';
import { YouTubeImageGenerationSettings } from '../shared/YouTubeImageGenerationModal';

// Custom hooks
import { useSceneMedia } from '../hooks/useSceneMedia';
import { useGenerationState } from '../hooks/useGenerationState';

// Sub-components
import { SceneHeader } from './SceneCard/SceneHeader';
import { SceneContent } from './SceneCard/SceneContent';
import { SceneEditForm } from './SceneCard/SceneEditForm';
import { GenerationButtons } from './SceneCard/GenerationButtons';
import { GenerationModals } from './SceneCard/GenerationModals';
import { InfoAlert } from './SceneCard/InfoAlert';

// Types
interface SceneCardProps {
  scene: Scene;
  isEditing: boolean;
  editedScene: Partial<Scene> | null;
  onToggle: (sceneNumber: number) => void;
  onEdit: (scene: Scene) => void;
  onSave: () => void;
  onCancel: () => void;
  onEditChange: (updates: Partial<Scene>) => void;
  onGenerateImage?: (scene: Scene, imageSettings?: YouTubeImageGenerationSettings) => Promise<void>;
  generatingImage?: boolean;
  onGenerateAudio?: (scene: Scene, audioSettings?: AudioGenerationSettings) => Promise<void>;
  generatingAudio?: boolean;
  loading: boolean;
  avatarUrl?: string | null;
  videoPlanIdea?: string;
}

interface SceneCardProps {
  scene: Scene;
  isEditing: boolean;
  editedScene: Partial<Scene> | null;
  onToggle: (sceneNumber: number) => void;
  onEdit: (scene: Scene) => void;
  onSave: () => void;
  onCancel: () => void;
  onEditChange: (updates: Partial<Scene>) => void;
  onGenerateImage?: (scene: Scene, imageSettings?: YouTubeImageGenerationSettings) => Promise<void>;
  generatingImage?: boolean;
  onGenerateAudio?: (scene: Scene, audioSettings?: AudioGenerationSettings) => Promise<void>;
  generatingAudio?: boolean;
  loading: boolean;
  avatarUrl?: string | null; // Base avatar URL for character consistency
  videoPlanIdea?: string; // Video plan idea for context
  language?: string; // Language code for language-aware voice selection
}

// Helper function to get border color based on scene emphasis
const getSceneBorderColor = (emphasisTags?: string[]): string => {
  if (!emphasisTags || emphasisTags.length === 0) return '#e5e7eb'; // Default gray

  const primaryTag = emphasisTags[0];
  switch (primaryTag) {
    case 'hook':
      return '#3b82f6'; // Blue for hook
    case 'cta':
      return '#8b5cf6'; // Purple for CTA
    case 'transition':
      return '#10b981'; // Green for transition
    case 'main_content':
    default:
      return '#e5e7eb'; // Gray for main content
  }
};


export const SceneCard: React.FC<SceneCardProps> = React.memo(({
  scene,
  isEditing,
  editedScene,
  onToggle,
  onEdit,
  onSave,
  onCancel,
  onEditChange,
  onGenerateImage,
  generatingImage = false,
  onGenerateAudio,
  generatingAudio = false,
  loading,
  avatarUrl,
  videoPlanIdea,
  language,
}) => {
  const sceneData = isEditing && editedScene ? { ...scene, ...editedScene } : scene;

  // Custom hooks
  const { imageBlobUrl, imageLoading, audioBlobUrl, audioLoading } = useSceneMedia({
    imageUrl: sceneData.imageUrl,
    audioUrl: sceneData.audioUrl,
  });

  // Debug logging
  React.useEffect(() => {
    console.log('[SceneCard] Render', {
      sceneNumber: scene.scene_number,
      imageUrl: scene.imageUrl,
      hasImageBlobUrl: !!imageBlobUrl,
      imageLoading,
      generatingImage,
    });
  });

  const {
    showAudioSettingsModal,
    setShowAudioSettingsModal,
    showImageSettingsModal,
    setShowImageSettingsModal,
    currentAudioSettings,
    setCurrentAudioSettings,
    imageGenerationProgress,
    setImageGenerationProgress,
    imageGenerationStatus,
    setImageGenerationStatus,
    audioGenerationProgress,
    setAudioGenerationProgress,
    audioGenerationStatus,
    setAudioGenerationStatus,
    resetImageGeneration,
    resetAudioGeneration,
  } = useGenerationState();

  // Sync local status with parent's generating state
  useEffect(() => {
    if (generatingImage && imageGenerationStatus === '') {
      setImageGenerationStatus('Generating image...');
      setImageGenerationProgress(50);
    } else if (!generatingImage && imageGenerationStatus.includes('Generating')) {
      // Generation process finished (either success or failure)
      if (sceneData.imageUrl) {
        // Generation completed successfully
        setImageGenerationStatus('Image generated successfully!');
        setImageGenerationProgress(100);
        setTimeout(() => resetImageGeneration(), 3000);
      } else {
        // Check if this is a new imageUrl that just arrived (race condition)
        const checkForImageUrl = () => {
          if (sceneData.imageUrl) {
            setImageGenerationStatus('Image generated successfully!');
            setImageGenerationProgress(100);
            setTimeout(() => resetImageGeneration(), 3000);
          } else {
            // Still no imageUrl, assume failure
            setImageGenerationStatus('Failed to generate image');
            setImageGenerationProgress(0);
            setTimeout(() => resetImageGeneration(), 3000);
          }
        };
        // Wait a moment for potential race condition resolution
        setTimeout(checkForImageUrl, 500);
      }
    }
  }, [generatingImage, imageGenerationStatus, sceneData.imageUrl, setImageGenerationStatus, setImageGenerationProgress, resetImageGeneration]);

  useEffect(() => {
    if (generatingAudio && audioGenerationStatus === '') {
      setAudioGenerationStatus('Generating audio...');
      setAudioGenerationProgress(50);
    } else if (!generatingAudio && audioGenerationStatus.includes('Generating')) {
      // Generation process finished (either success or failure)
      if (sceneData.audioUrl) {
        // Generation completed successfully
        setAudioGenerationStatus('Audio generated successfully!');
        setAudioGenerationProgress(100);
        setTimeout(() => resetAudioGeneration(), 2000);
      } else {
        // Check if this is a new audioUrl that just arrived (race condition)
        const checkForAudioUrl = () => {
          if (sceneData.audioUrl) {
            setAudioGenerationStatus('Audio generated successfully!');
            setAudioGenerationProgress(100);
            setTimeout(() => resetAudioGeneration(), 2000);
          } else {
            // Still no audioUrl, assume failure
            setAudioGenerationStatus('Failed to generate audio');
            setAudioGenerationProgress(0);
            setTimeout(() => resetAudioGeneration(), 2000);
          }
        };
        // Wait a moment for potential race condition resolution
        setTimeout(checkForAudioUrl, 500);
      }
    }
  }, [generatingAudio, audioGenerationStatus, sceneData.audioUrl, setAudioGenerationStatus, setAudioGenerationProgress, resetAudioGeneration]);

  console.log('[SceneCard] Render', {
    sceneNumber: scene.scene_number,
    imageUrl: scene.imageUrl,
    generatingImage,
    hasImageBlobUrl: !!imageBlobUrl,
    imageLoading
  });

  // Reset local generation state when parent indicates generation is complete
  useEffect(() => {
    if (!generatingImage) {
      resetImageGeneration();
    }
  }, [generatingImage, resetImageGeneration]);

  useEffect(() => {
    if (!generatingAudio) {
      resetAudioGeneration();
    }
  }, [generatingAudio, resetAudioGeneration]);

  // Border color based on scene emphasis
  const getSceneBorderColor = (emphasisTags?: string[]): string => {
    if (!emphasisTags || emphasisTags.length === 0) return '#e5e7eb';
    const primaryTag = emphasisTags[0];
    switch (primaryTag) {
      case 'hook': return '#3b82f6';
      case 'cta': return '#8b5cf6';
      case 'transition': return '#10b981';
      default: return '#e5e7eb';
    }
  };
  const borderColor = getSceneBorderColor(sceneData.emphasis_tags);

  // Event handlers
  const handleAudioModalOpen = useCallback(() => {
    if (!onGenerateAudio || generatingAudio || loading) return;
    console.log('[SceneCard] Opening audio settings modal for scene', scene.scene_number);
    setShowAudioSettingsModal(true);
  }, [onGenerateAudio, generatingAudio, loading, scene.scene_number, setShowAudioSettingsModal]);

  const handleImageModalOpen = useCallback(() => {
    if (!onGenerateImage || generatingImage || loading) return;
    console.log('[SceneCard] Opening image settings modal for scene', scene.scene_number);
    setShowImageSettingsModal(true);
  }, [onGenerateImage, generatingImage, loading, scene.scene_number, setShowImageSettingsModal]);

  const handleImageSettingsApply = useCallback(async (settings: YouTubeImageGenerationSettings) => {
    console.log('[SceneCard] Applying image settings for scene', scene.scene_number, 'with settings:', settings);

    if (!onGenerateImage) {
      console.error('[SceneCard] onGenerateImage handler is not provided');
      return;
    }

    if (generatingImage || loading) {
      console.warn('[SceneCard] Image generation already in progress, ignoring click');
      return;
    }

    setShowImageSettingsModal(false);

    try {
      setImageGenerationStatus('Starting image generation...');
      setImageGenerationProgress(5);

      console.log('[SceneCard] Calling onGenerateImage for scene', scene.scene_number, 'with settings');
      await onGenerateImage(scene, settings);
      console.log('[SceneCard] onGenerateImage task started for scene', scene.scene_number);

      // Don't assume success here - the parent component will handle polling
      // and update the generatingImage prop when the task actually completes
      setImageGenerationStatus('Image generation in progress...');
      setImageGenerationProgress(25);

    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail?.message
        || error?.response?.data?.detail?.error
        || error?.response?.data?.detail
        || error?.message
        || 'Failed to start image generation. Please try again.';

      setImageGenerationStatus(`Error: ${errorMessage}`);
      setImageGenerationProgress(0);

      setTimeout(() => resetImageGeneration(), 3000);
    }
  }, [onGenerateImage, generatingImage, loading, scene, setShowImageSettingsModal, setImageGenerationStatus, setImageGenerationProgress, resetImageGeneration]);

  const handleAudioSettingsApply = useCallback(async (settings: AudioGenerationSettings) => {
    console.log('[SceneCard] Applying audio settings for scene', scene.scene_number, 'with settings:', settings);

    setCurrentAudioSettings(settings);
    setShowAudioSettingsModal(false);

    const startTime = Date.now();
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      setAudioGenerationStatus('Submitting audio generation request...');
      setAudioGenerationProgress(10);

      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);

        if (seconds < 3) {
          setAudioGenerationStatus('Submitting request to AI service...');
          setAudioGenerationProgress(15);
        } else if (seconds < 10) {
          setAudioGenerationStatus('AI is generating your audio...');
          setAudioGenerationProgress(40);
        } else if (seconds < 20) {
          setAudioGenerationStatus('Synthesizing narration...');
          setAudioGenerationProgress(70);
        } else {
          setAudioGenerationStatus(`Processing... (${seconds}s elapsed)`);
          setAudioGenerationProgress(Math.min(90, 70 + (seconds - 20) / 2));
        }
      }, 1000);

      await onGenerateAudio!(scene, settings);
      console.log('[SceneCard] Audio generation completed for scene', scene.scene_number);

      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      setAudioGenerationStatus('Finalizing audio...');
      setAudioGenerationProgress(95);

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setAudioGenerationStatus(`Audio generated successfully in ${elapsed}s`);
      setAudioGenerationProgress(100);

      setTimeout(() => resetAudioGeneration(), 2000);
    } catch (error: any) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      const errorMessage = error?.response?.data?.detail?.message
        || error?.response?.data?.detail?.error
        || error?.response?.data?.detail
        || error?.message
        || 'Failed to generate audio. Please try again.';

      setAudioGenerationStatus(`Error: ${errorMessage}`);
      setAudioGenerationProgress(0);
    }
  }, [scene, setCurrentAudioSettings, setShowAudioSettingsModal, setAudioGenerationStatus, setAudioGenerationProgress, onGenerateAudio, resetAudioGeneration]);

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          opacity: sceneData.enabled === false ? 0.6 : 1,
          border: sceneData.enabled === false ? '1px dashed #e5e7eb' : `2px solid ${borderColor}`,
          borderRadius: 2,
          bgcolor: '#ffffff',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: sceneData.enabled !== false ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
          },
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <SceneHeader
            scene={scene}
            isEditing={isEditing}
            onToggle={onToggle}
            onEdit={onEdit}
          />

          {isEditing ? (
            <SceneEditForm
              scene={scene}
              editedScene={editedScene || {}}
              onEditChange={onEditChange}
              onSave={onSave}
              onCancel={onCancel}
              loading={loading}
            />
          ) : (
            <>
              <SceneContent
                scene={scene}
                imageBlobUrl={imageBlobUrl}
                imageLoading={imageLoading}
                audioBlobUrl={audioBlobUrl}
                audioLoading={audioLoading}
                avatarUrl={avatarUrl}
                videoPlanIdea={videoPlanIdea}
              />

              <GenerationButtons
                scene={scene}
                isEditing={isEditing}
                loading={loading}
                onGenerateImage={onGenerateImage}
                generatingImage={generatingImage}
                onGenerateAudio={onGenerateAudio}
                generatingAudio={generatingAudio}
                imageGenerationStatus={imageGenerationStatus}
                imageGenerationProgress={imageGenerationProgress}
                audioGenerationStatus={audioGenerationStatus}
                audioGenerationProgress={audioGenerationProgress}
                onAudioModalOpen={handleAudioModalOpen}
                onImageModalOpen={handleImageModalOpen}
              />

              <InfoAlert
                scene={scene}
                isEditing={isEditing}
                onGenerateImage={!!onGenerateImage}
                onGenerateAudio={!!onGenerateAudio}
              />
            </>
          )}
        </CardContent>
      </Card>

      <GenerationModals
        scene={scene}
        showAudioSettingsModal={showAudioSettingsModal}
        setShowAudioSettingsModal={setShowAudioSettingsModal}
        showImageSettingsModal={showImageSettingsModal}
        setShowImageSettingsModal={setShowImageSettingsModal}
        currentAudioSettings={currentAudioSettings}
        onAudioSettingsApply={handleAudioSettingsApply}
        onImageSettingsApply={handleImageSettingsApply}
        generatingAudio={generatingAudio}
        language={language}
      />
    </>
  );
});

SceneCard.displayName = 'SceneCard';

