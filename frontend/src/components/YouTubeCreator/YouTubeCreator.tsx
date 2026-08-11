/**
 * YouTube Creator Studio Component
 * 
 * AI-first YouTube video creation tool with persona integration.
 * Three-phase workflow: Plan → Scenes → Render
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { youtubeApi, type VideoPlan, type Scene } from '../../services/youtubeApi';
import { STEPS, YT_RED, YT_BG, YT_BORDER, YT_TEXT, YOUTUBE_CONTENT_LANGUAGE_OPTIONS, type Resolution, type DurationType, type VideoType, type YouTubeContentLanguage } from './constants';
import { PlanStep } from './components/PlanStep';
import { ScenesStep } from './components/ScenesStep';
import { SceneGenerationStep } from './components/SceneGenerationStep';
import { RenderStep } from './components/RenderStep';
import { useRenderPolling } from './hooks/useRenderPolling';
import { useCostEstimate } from './hooks/useCostEstimate';
import { useImageGenerationPolling } from './hooks/useImageGenerationPolling';
import HeaderControls from '../shared/HeaderControls';
import { useYouTubeCreatorState } from '../../hooks/useYouTubeCreatorState';
import { ContentAsset } from '../../hooks/useContentAssets';
import { AudioGenerationSettings } from '../../components/shared/AudioSettingsModal';
import type { YouTubeImageGenerationSettings } from './shared';

const YouTubeCreator: React.FC = () => {
  const navigate = useNavigate();
  const { state, updateState } = useYouTubeCreatorState();
  
  // Extract state from hook
  const {
    userIdea,
    durationType,
    videoType,
    targetAudience,
    videoGoal,
    brandStyle,
    referenceImage,
    avatarUrl,
    language,
    languageBoost,
    videoPlan,
    scenes,
    editingSceneId,
    editedScene,
    renderTaskId,
    renderStatus,
    renderProgress,
    resolution,
    combineScenes,
    activeStep: persistedActiveStep,
  } = state;

  // Local UI state (not persisted)
  const [activeStep, setActiveStep] = useState(persistedActiveStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [makingPresentable, setMakingPresentable] = useState(false);
  const [regeneratingAvatar, setRegeneratingAvatar] = useState(false);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<number | null>(null);
  const [generatingAudioSceneId, setGeneratingAudioSceneId] = useState<number | null>(null);
  
  // Robust polling hook for image generation
  const { startPolling: startImagePolling, stopPolling: stopImagePolling } = useImageGenerationPolling();

  // Sync activeStep with persisted state on mount
  useEffect(() => {
    setActiveStep(persistedActiveStep);
  }, [persistedActiveStep]);

  // Update persisted activeStep when local activeStep changes
  useEffect(() => {
    updateState({ activeStep });
  }, [activeStep, updateState]);

  // Custom hooks
  const { renderStatus: polledStatus, renderProgress: polledProgress, error: pollingError } = useRenderPolling(
    renderTaskId,
    () => setSuccess('Video rendered successfully!'),
    (err) => setError(err)
  );

  // Update local state from polling hook and persist to localStorage
  React.useEffect(() => {
    const updates: any = {};
    if (polledStatus) {
      updates.renderStatus = polledStatus;
    }
    if (polledProgress !== undefined) {
      updates.renderProgress = polledProgress;
    }
    if (pollingError) {
      setError(pollingError);
    }
    if (Object.keys(updates).length > 0) {
      updateState(updates);
    }
  }, [polledStatus, polledProgress, pollingError, updateState]);

  const { costEstimate, loadingCostEstimate } = useCostEstimate({
    activeStep,
    scenes,
    resolution,
    renderTaskId,
    imageModel: 'ideogram-v3-turbo', // Default for now, can be made configurable later
  });

  // Memoized computed values
  const enabledScenesCount = useMemo(
    () => scenes.filter(s => s.enabled !== false).length,
    [scenes]
  );

  // Handlers
  const handleGeneratePlan = useCallback(async () => {
    if (!userIdea.trim()) {
      setError('Please enter your video idea');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await youtubeApi.createPlan({
        user_idea: userIdea,
        duration_type: durationType,
        video_type: videoType || undefined,
        target_audience: targetAudience || undefined,
        video_goal: videoGoal || undefined,
        brand_style: brandStyle || undefined,
        reference_image_description: referenceImage || undefined,
        avatar_url: avatarUrl || undefined,
      });

      if (response.success && response.plan) {
        const updates: any = { videoPlan: response.plan };
        if (response.plan.auto_generated_avatar_url) {
          updates.avatarUrl = response.plan.auto_generated_avatar_url;
          setSuccess('Video plan generated! Avatar auto-generated based on your plan.');
        } else {
          setSuccess('Video plan generated successfully!');
        }
        updateState(updates);
        setTimeout(() => {
          setActiveStep(1);
          setSuccess(null);
        }, 2000);
      } else {
        setError(response.message || 'Failed to generate plan');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate video plan');
    } finally {
      setLoading(false);
    }
  }, [userIdea, durationType, videoType, targetAudience, videoGoal, brandStyle, referenceImage, avatarUrl, updateState]);

  const handleAvatarUpload = useCallback(async (file: File) => {
    setUploadingAvatar(true);
    setError(null);
    try {
      // Note: avatarPreview is handled locally in PlanStep component
      // We only persist avatarUrl (server URL)
      const response = await youtubeApi.uploadAvatar(file);
      updateState({ avatarUrl: response.avatar_url });
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  }, [updateState]);

  const handleAvatarSelectFromLibrary = useCallback((asset: ContentAsset) => {
    if (!asset?.file_url) return;
    updateState({ avatarUrl: asset.file_url });
    setError(null);
    setSuccess('Avatar selected from Asset Library');
    setTimeout(() => setSuccess(null), 2000);
  }, [updateState]);

  const handleRemoveAvatar = useCallback(() => {
    updateState({ avatarUrl: null });
  }, [updateState]);

  const handleAvatarRegenerate = useCallback(async () => {
    if (!videoPlan) {
      setError('Please generate a plan first');
      return;
    }

    setRegeneratingAvatar(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await youtubeApi.regenerateCreatorAvatar(videoPlan);

      if (response.avatar_url) {
        updateState({
          avatarUrl: response.avatar_url,
        });
        // Update the video plan with the new avatar prompt if provided
        if (response.avatar_prompt && videoPlan) {
          const updatedPlan = { ...videoPlan, avatar_prompt: response.avatar_prompt };
          updateState({ videoPlan: updatedPlan });
        }
        setSuccess('Avatar regenerated successfully!');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(response.message || 'Failed to regenerate avatar');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate avatar');
    } finally {
      setRegeneratingAvatar(false);
    }
  }, [videoPlan, updateState]);

  const handleMakePresentable = useCallback(async () => {
    if (!avatarUrl || makingPresentable) return;
    setMakingPresentable(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await youtubeApi.makeAvatarPresentable(
        avatarUrl,
        undefined, // projectId
        videoType || undefined,
        targetAudience || undefined,
        videoGoal || undefined,
        brandStyle || undefined
      );
      
      // Update avatarUrl - PlanStep will handle loading blob URL for preview
      updateState({ avatarUrl: response.avatar_url });
      setSuccess('✨ Avatar transformed successfully! Your photo has been optimized for YouTube.');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to optimize avatar');
    } finally {
      setMakingPresentable(false);
    }
  }, [avatarUrl, makingPresentable, videoType, targetAudience, videoGoal, brandStyle, updateState]);

  const handleBuildScenes = useCallback(async () => {
    if (!videoPlan) {
      setError('Please generate a plan first');
      return;
    }

    // Guard: Prevent duplicate calls if scenes already exist
    // This prevents wasting AI calls during testing/development
    if (scenes.length > 0) {
      console.warn('[YouTubeCreator] Scenes already exist, skipping build to prevent duplicate AI calls');
      setError('Scenes have already been generated. Please refresh the page if you want to regenerate.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await youtubeApi.buildScenes(videoPlan);

      if (response.success && response.scenes) {
        const updatedScenes = response.scenes.map(s => ({ ...s, enabled: s.enabled !== false }));

        // Calculate enhanced statistics for success message
        const enabledScenes = updatedScenes.filter(s => s.enabled !== false);
        const totalDuration = enabledScenes.reduce((sum, scene) => sum + scene.duration_estimate, 0);

        // Group scenes by emphasis type
        const sceneBreakdown = updatedScenes.reduce((acc, scene) => {
          const type = scene.emphasis_tags?.[0] || 'main_content';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Format duration
        const formatDuration = (seconds: number): string => {
          if (seconds < 60) {
            return `${Math.round(seconds)}s`;
          }
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.round(seconds % 60);
          return `${minutes}m ${remainingSeconds}s`;
        };

        // Create enhanced success message
        const breakdownText = Object.entries(sceneBreakdown)
          .map(([type, count]) => {
            const typeLabel = type === 'hook' ? 'hook' : type === 'cta' ? 'CTA' : type === 'main_content' ? 'main content' : type;
            return `${count} ${typeLabel}`;
          })
          .join(' • ');

        const successMessage = `✅ Successfully built ${response.scenes.length} scenes\n⏱️ Total duration: ${formatDuration(totalDuration)}\n📊 Breakdown: ${breakdownText}`;

        updateState({ scenes: updatedScenes });
        setSuccess(successMessage);
        // Navigate to Scene Generation step (step 2) to generate assets
        setActiveStep(2);
        // Clear success message after a brief moment
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } else {
        setError(response.message || 'Failed to build scenes');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to build scenes');
    } finally {
      setLoading(false);
    }
  }, [videoPlan, scenes.length, updateState]);

  const handleEditScene = useCallback((scene: Scene) => {
    updateState({
      editingSceneId: scene.scene_number,
      editedScene: {
        narration: scene.narration,
        visual_prompt: scene.visual_prompt,
        duration_estimate: scene.duration_estimate,
        enabled: scene.enabled !== false,
      },
    });
  }, [updateState]);

  const handleSaveScene = useCallback(async () => {
    if (!editingSceneId || !editedScene) return;

    setLoading(true);
    setError(null);

    try {
      const response = await youtubeApi.updateScene(editingSceneId, {
        narration: editedScene.narration,
        visual_description: editedScene.visual_prompt,
        duration_estimate: editedScene.duration_estimate,
        enabled: editedScene.enabled,
      });

      if (response.success && response.scene) {
        const updatedScenes = scenes.map(s =>
          s.scene_number === editingSceneId ? { ...s, ...response.scene } : s
        );
        updateState({
          scenes: updatedScenes,
          editingSceneId: null,
          editedScene: null,
        });
        setSuccess('Scene updated successfully!');
      } else {
        setError(response.message || 'Failed to update scene');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update scene');
    } finally {
      setLoading(false);
    }
  }, [editingSceneId, editedScene, scenes, updateState]);

  const handleCancelEdit = useCallback(() => {
    updateState({ editingSceneId: null, editedScene: null });
  }, [updateState]);

  const handleEditChange = useCallback((updates: Partial<Scene>) => {
    if (editedScene) {
      updateState({ editedScene: { ...editedScene, ...updates } });
    }
  }, [editedScene, updateState]);

  const handleToggleScene = useCallback((sceneNumber: number) => {
    const updatedScenes = scenes.map(s =>
      s.scene_number === sceneNumber ? { ...s, enabled: !s.enabled } : s
    );
    updateState({ scenes: updatedScenes });
  }, [scenes, updateState]);

  const handleGenerateSceneImage = useCallback(async (scene: Scene, imageSettings?: YouTubeImageGenerationSettings) => {
    console.log('[YouTubeCreator] handleGenerateSceneImage called for scene', scene.scene_number);
    console.log('[YouTubeCreator] This should ONLY be called for image generation, NOT audio generation');
    
    // Guard: prevent if already generating image for this scene
    if (generatingImageSceneId === scene.scene_number) {
      console.warn('[YouTubeCreator] Image generation already in progress for this scene');
      return;
    }
    
    setGeneratingImageSceneId(scene.scene_number);
    setError(null);

    try {
      console.log('[YouTubeCreator] Starting image generation task for scene', scene.scene_number);

      const taskResponse = await youtubeApi.generateSceneImage({
        sceneId: `scene_${scene.scene_number}`,
        sceneTitle: scene.title,
        sceneContent: scene.narration,
        baseAvatarUrl: avatarUrl || undefined,
        idea: videoPlan?.video_summary || userIdea,
        width: 1024,
        height: 576,
        customPrompt: imageSettings?.prompt,
        style: imageSettings?.style,
        renderingSpeed: imageSettings?.renderingSpeed,
        aspectRatio: imageSettings?.aspectRatio,
        model: imageSettings?.model,
      });

      console.log('[YouTubeCreator] Image generation task started:', taskResponse);

      if (!taskResponse.success) {
        throw new Error(taskResponse.message || 'Failed to start image generation task');
      }

      const taskId = taskResponse.task_id;

      // Start robust polling
      startImagePolling({
        taskId,
        sceneNumber: scene.scene_number,
        getStatus: youtubeApi.getImageGenerationStatus,
        onComplete: (imageUrl) => {
          console.log('[YouTubeCreator] Image generation completed!', {
            sceneNumber: scene.scene_number,
            imageUrl,
          });

          // Update scene with image URL atomically
          const updatedScenes = scenes.map(s =>
            s.scene_number === scene.scene_number
              ? { ...s, imageUrl }
              : s
          );
          updateState({ scenes: updatedScenes });

          setSuccess(`Image generated for Scene ${scene.scene_number}!`);
          setTimeout(() => setSuccess(null), 3000);
          setGeneratingImageSceneId(null);
        },
        onError: (errorMsg) => {
          setError(errorMsg);
          setGeneratingImageSceneId(null);
        },
        onProgress: (progress, message) => {
          console.log(`[YouTubeCreator] Image generation in progress: ${progress}% - ${message}`);
        },
      });

    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail?.message
        || err?.response?.data?.detail?.error
        || err?.response?.data?.detail
        || err?.message
        || 'Failed to start image generation';
      setError(`Scene ${scene.scene_number}: ${errorMessage}`);
      setGeneratingImageSceneId(null);
      throw err; // Re-throw so SceneCard can handle it
    }
  }, [scenes, avatarUrl, videoPlan, userIdea, updateState, generatingImageSceneId, startImagePolling]);

  // Helper function to build enriched text for better audio generation
  const buildEnrichedSceneText = (scene: Scene): string => {
    // Start with the core narration text
    let enrichedText = scene.narration;

    // Add scene title for context (helps WaveSpeed understand the scene's purpose)
    if (scene.title && scene.title !== scene.narration.substring(0, scene.title.length)) {
      enrichedText = `${scene.title}. ${enrichedText}`;
    }

    // Add delivery style hints based on emphasis tags
    if (scene.emphasis_tags && scene.emphasis_tags.length > 0) {
      const deliveryHints = scene.emphasis_tags.map(tag => {
        switch (tag) {
          case 'hook': return 'speak with energy and excitement';
          case 'cta': return 'speak persuasively and confidently';
          case 'transition': return 'speak smoothly and clearly';
          default: return 'speak professionally and clearly';
        }
      });

      // Use the primary emphasis tag for the delivery hint
      const primaryHint = deliveryHints[0];
      enrichedText += ` [${primaryHint}]`;
    }

    // Add visual cues for emotional delivery guidance
    if (scene.visual_cues && scene.visual_cues.length > 0) {
      // Filter for cues that affect audio delivery
      const audioRelevantCues = scene.visual_cues.filter(cue =>
        cue.toLowerCase().includes('slow') ||
        cue.toLowerCase().includes('fast') ||
        cue.toLowerCase().includes('energetic') ||
        cue.toLowerCase().includes('calm') ||
        cue.toLowerCase().includes('dramatic') ||
        cue.toLowerCase().includes('intense')
      );

      if (audioRelevantCues.length > 0) {
        enrichedText += ` [Pacing: ${audioRelevantCues.join(', ')}]`;
      }
    }

    // Add duration estimate for natural pacing
    if (scene.duration_estimate && scene.duration_estimate > 0) {
      const wordsPerMinute = enrichedText.split(' ').length / (scene.duration_estimate / 60);
      if (wordsPerMinute > 200) {
        enrichedText += ` [Speak at a natural, conversational pace]`;
      } else if (wordsPerMinute < 120) {
        enrichedText += ` [Take time to articulate clearly]`;
      }
    }

    // Ensure we don't exceed WaveSpeed's 10,000 character limit
    if (enrichedText.length > 9500) {
      enrichedText = enrichedText.substring(0, 9500) + '...';
    }

    return enrichedText;
  };

  const handleLanguageChange = useCallback((value: YouTubeContentLanguage) => {
    const opt = YOUTUBE_CONTENT_LANGUAGE_OPTIONS.find((o) => o.value === value);
    updateState({
      language: value,
      languageBoost: opt?.languageBoost || 'auto',
    });
  }, [updateState]);

  const handleGenerateSceneAudio = useCallback(async (scene: Scene, audioSettings?: AudioGenerationSettings) => {
    console.log('[YouTubeCreator] handleGenerateSceneAudio called for scene', scene.scene_number);
    console.log('[YouTubeCreator] This should ONLY be called for audio generation, NOT image generation');

    // Guard: prevent if already generating audio for this scene
    if (generatingAudioSceneId === scene.scene_number) {
      console.warn('[YouTubeCreator] Audio generation already in progress for this scene');
      return;
    }

    setGeneratingAudioSceneId(scene.scene_number);
    setError(null);

    try {
      // Enhanced audio defaults optimized for YouTube content
      // Based on research into natural speech patterns and user feedback
      // Speed 1.08: Natural conversational pace (engaging but not rushed)
      // Voice: Auto-selected based on content analysis
      // Emotion: Auto-selected based on scene content
      // High quality settings for professional YouTube audio
      const settings: AudioGenerationSettings = audioSettings || {
        voiceId: "", // Empty string triggers auto-selection by backend
        speed: 1.08, // Natural conversational pace - engaging but comfortable
        volume: 1.0, // Standard volume
        pitch: 0.0, // Neutral pitch for natural sound
        emotion: "happy", // Default emotion (backend will auto-select based on content)
        englishNormalization: language === 'en', // Only applicable for English
        sampleRate: 44100, // CD quality audio
        bitrate: 256000, // Highest quality: 256kbps for professional audio
        channel: "2" as const, // Stereo for richer audio experience
        format: "mp3" as const, // Universal format
        languageBoost: languageBoost || 'auto',
        enableSyncMode: true, // Reliable delivery
      };

      // Build enriched text for better audio generation
      const enrichedText = buildEnrichedSceneText(scene);

      console.log('[YouTubeCreator] Calling youtubeApi.generateSceneAudio with enriched text:', {
        sceneId: `scene_${scene.scene_number}`,
        sceneTitle: scene.title,
        originalTextLength: scene.narration?.length,
        enrichedTextLength: enrichedText.length,
        voiceId: settings.voiceId || undefined, // Will auto-select if empty
        endpoint: '/api/youtube/audio',
        settings: settings,
        video_plan_context: {
          video_type: videoType,
          target_audience: targetAudience,
          tone: videoPlan?.tone,
          visual_style: videoPlan?.visual_style,
          video_goal: videoPlan?.video_goal,
        },
      });

      const result = await youtubeApi.generateSceneAudio({
        sceneId: `scene_${scene.scene_number}`,
        sceneTitle: scene.title,
        text: enrichedText, // Send enriched text instead of just narration
        voiceId: settings.voiceId || undefined, // Will auto-select if empty
        language,
        speed: settings.speed,
        volume: settings.volume,
        pitch: settings.pitch,
        emotion: settings.emotion,
        englishNormalization: settings.englishNormalization,
        sampleRate: settings.sampleRate,
        bitrate: settings.bitrate,
        channel: settings.channel,
        format: settings.format,
        languageBoost: settings.languageBoost,
        enableSyncMode: settings.enableSyncMode,
        videoPlanContext: {
          video_type: videoType,
          target_audience: targetAudience,
          tone: videoPlan?.tone,
          visual_style: videoPlan?.visual_style,
          video_goal: videoPlan?.video_goal,
        },
      });

      console.log('[YouTubeCreator] Audio generation result:', result);

      // Update scene with audio URL
      const updatedScenes = scenes.map(s =>
        s.scene_number === scene.scene_number
          ? { ...s, audioUrl: result.audio_url }
          : s
      );
      updateState({ scenes: updatedScenes });
      setSuccess(`Audio generated for Scene ${scene.scene_number}!`);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail?.message 
        || err?.response?.data?.detail?.error 
        || err?.response?.data?.detail 
        || err?.message 
        || 'Failed to generate audio';
      setError(errorMessage);
      throw err; // Re-throw so SceneCard can handle it
    } finally {
      setGeneratingAudioSceneId(null);
    }
  }, [generatingAudioSceneId, language, languageBoost, scenes, targetAudience, updateState, videoPlan, videoType]);

  const handleStartRender = useCallback(async () => {
    if (scenes.length === 0) {
      setError('Please build scenes first');
      return;
    }

    const enabledScenes = scenes.filter(s => s.enabled !== false);
    if (enabledScenes.length === 0) {
      setError('Please enable at least one scene to render');
      return;
    }

    if (!videoPlan) {
      setError('Video plan is missing');
      return;
    }

    // VALIDATION: Check that all enabled scenes have both image and audio
    const scenesMissingAssets = enabledScenes.filter(s => !s.imageUrl || !s.audioUrl);
    if (scenesMissingAssets.length > 0) {
      const missingList = scenesMissingAssets.map(s => {
        const missing = [];
        if (!s.imageUrl) missing.push('image');
        if (!s.audioUrl) missing.push('audio');
        return `Scene ${s.scene_number} (missing: ${missing.join(', ')})`;
      }).join(', ');
      setError(`Please generate images and audio for all enabled scenes before rendering. Missing: ${missingList}`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await youtubeApi.startRender({
        scenes: enabledScenes,
        video_plan: videoPlan,
        resolution,
        combine_scenes: combineScenes,
      });

      if (response.success && response.task_id) {
        updateState({
          renderTaskId: response.task_id,
          renderProgress: 0,
          renderStatus: null,
        });
        setSuccess('Video rendering started!');
      } else {
        setError(response.message || 'Failed to start render');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start render');
    } finally {
      setLoading(false);
    }
  }, [scenes, videoPlan, resolution, combineScenes, updateState]);

  const getVideoUrl = useCallback(() => {
    if (renderStatus?.result?.final_video_url) {
      return renderStatus.result.final_video_url;
    }
    if (renderStatus?.result?.scene_results?.[0]?.video_url) {
      return renderStatus.result.scene_results[0].video_url;
    }
    return null;
  }, [renderStatus]);

  const handleStepNavigation = useCallback((targetStep: number) => {
    if (targetStep === activeStep) return;

    // Always allow going back
    if (targetStep < activeStep) {
      setActiveStep(targetStep);
      return;
    }

    // Forward navigation with guards
    if (targetStep === 1) {
      if (!videoPlan) {
        setError('Please generate a plan first.');
        return;
      }
      setActiveStep(1);
      return;
    }

    if (targetStep === 2) {
      if (!videoPlan) {
        setError('Please generate a plan first.');
        return;
      }
      if (scenes.length === 0) {
        setError('Please build scenes first.');
        return;
      }
      setActiveStep(2);
      return;
    }

    if (targetStep === 3) {
      if (!videoPlan) {
        setError('Please generate a plan first.');
        return;
      }
      if (scenes.length === 0) {
        setError('Please build scenes first.');
        return;
      }
      if (enabledScenesCount === 0) {
        setError('Enable at least one scene to render.');
        return;
      }
      // Check if all enabled scenes have assets
      const enabledScenes = scenes.filter(s => s.enabled !== false);
      const allReady = enabledScenes.every(s => s.imageUrl && s.audioUrl);
      if (!allReady) {
        setError('Please generate images and audio for all enabled scenes first.');
        return;
      }
      setActiveStep(3);
      return;
    }
  }, [activeStep, videoPlan, scenes, enabledScenesCount]);

  const handleResetRender = useCallback(() => {
    updateState({
      renderTaskId: null,
      renderStatus: null,
      renderProgress: 0,
    });
    setError(null);
  }, [updateState]);

  const handleRetryFailedScenes = useCallback((failedScenes: any[]) => {
    if (failedScenes.length > 0) {
      const sceneNumbers = failedScenes.map((f: any) => f.scene_number);
      const updatedScenes = scenes.map(s =>
        sceneNumbers.includes(s.scene_number)
          ? { ...s, enabled: true }
          : s
      );
      updateState({ scenes: updatedScenes });
      handleResetRender();
    }
  }, [scenes, handleResetRender, updateState]);

  return (
    <Container
      maxWidth="lg"
      sx={{
        py: 4,
        backgroundColor: YT_BG,
        color: YT_TEXT,
        minHeight: '100vh',
        borderRadius: 2,
        border: `1px solid ${YT_BORDER}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          variant="outlined"
          sx={{ borderColor: YT_BORDER, color: YT_TEXT, backgroundColor: 'white' }}
        >
          Back to Dashboard
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1, fontWeight: 700 }}>
          🎥 YouTube Creator Studio
        </Typography>
        <HeaderControls colorMode="light" showAlerts={true} showUser={true} />
      </Box>

      {/* Stepper */}
      <Paper
        sx={{
          p: 3,
          mb: 4,
          backgroundColor: 'white',
          border: `1px solid ${YT_BORDER}`,
        }}
      >
        <Stepper
          activeStep={activeStep}
          sx={{
            '& .MuiStepIcon-root.Mui-active': { color: YT_RED },
            '& .MuiStepIcon-root.Mui-completed': { color: YT_RED },
          }}
        >
          {STEPS.map((label, idx) => (
            <Step key={label} completed={idx < activeStep}>
              <StepLabel
                onClick={() => handleStepNavigation(idx)}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Success Alert */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step Components */}
      {activeStep === 0 && (
        <PlanStep
          userIdea={userIdea}
          durationType={durationType}
          videoType={videoType || undefined}
          targetAudience={targetAudience}
          videoGoal={videoGoal}
          brandStyle={brandStyle}
          referenceImage={referenceImage}
          loading={loading}
          avatarPreview={avatarUrl}
          avatarUrl={avatarUrl}
          uploadingAvatar={uploadingAvatar}
          makingPresentable={makingPresentable}
          language={language}
          onIdeaChange={(value) => updateState({ userIdea: value })}
          onDurationChange={(value) => updateState({ durationType: value })}
          onVideoTypeChange={(value) => updateState({ videoType: value })}
          onTargetAudienceChange={(value) => updateState({ targetAudience: value })}
          onVideoGoalChange={(value) => updateState({ videoGoal: value })}
          onBrandStyleChange={(value) => updateState({ brandStyle: value })}
          onReferenceImageChange={(value) => updateState({ referenceImage: value })}
          onLanguageChange={handleLanguageChange}
          onGeneratePlan={handleGeneratePlan}
          onAvatarUpload={handleAvatarUpload}
          onRemoveAvatar={handleRemoveAvatar}
          onMakePresentable={handleMakePresentable}
          onAvatarSelectFromLibrary={handleAvatarSelectFromLibrary}
        />
      )}

      {activeStep === 1 && videoPlan && (
        <ScenesStep
          videoPlan={videoPlan}
          scenes={scenes}
          editingSceneId={editingSceneId}
          editedScene={editedScene}
          loading={loading}
          onBuildScenes={handleBuildScenes}
          onEditScene={handleEditScene}
          onSaveScene={handleSaveScene}
          onCancelEdit={handleCancelEdit}
          onEditChange={(value) => updateState({ editedScene: value })}
          onToggleScene={handleToggleScene}
          onBack={() => setActiveStep(0)}
          onNext={() => setActiveStep(2)}
          onAvatarRegenerate={handleAvatarRegenerate}
          regeneratingAvatar={regeneratingAvatar}
        />
      )}

      {activeStep === 2 && (
        <SceneGenerationStep
          scenes={scenes}
          videoPlan={videoPlan}
          editingSceneId={editingSceneId}
          editedScene={editedScene}
          onEditScene={handleEditScene}
          onSaveScene={handleSaveScene}
          onCancelEdit={handleCancelEdit}
          onEditChange={handleEditChange}
          onToggleScene={handleToggleScene}
          onGenerateImage={handleGenerateSceneImage}
          generatingImageSceneId={generatingImageSceneId}
          onGenerateAudio={handleGenerateSceneAudio}
          generatingAudioSceneId={generatingAudioSceneId}
          loading={loading}
          avatarUrl={avatarUrl}
          videoPlanIdea={videoPlan?.video_summary || userIdea}
          language={state.language}
          onBack={() => setActiveStep(1)}
          onNext={() => setActiveStep(3)}
        />
      )}

      {activeStep === 3 && (
        <RenderStep
          renderTaskId={renderTaskId}
          renderStatus={renderStatus}
          renderProgress={renderProgress}
          resolution={resolution}
          combineScenes={combineScenes}
          enabledScenesCount={enabledScenesCount}
          costEstimate={costEstimate}
          loadingCostEstimate={loadingCostEstimate}
          loading={loading}
          scenes={scenes}
          videoPlan={videoPlan}
          onResolutionChange={(value) => updateState({ resolution: value })}
          onCombineScenesChange={(value) => updateState({ combineScenes: value })}
          onStartRender={handleStartRender}
          onBack={() => setActiveStep(2)}
          onReset={handleResetRender}
          onRetryFailedScenes={handleRetryFailedScenes}
          onScenesUpdate={(updated) => updateState({ scenes: updated })}
          getVideoUrl={getVideoUrl}
        />
      )}
    </Container>
  );
};

export default YouTubeCreator;
