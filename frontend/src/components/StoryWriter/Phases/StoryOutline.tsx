import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Alert,
  Button,
  Snackbar,
  Dialog,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GlobalStyles from '@mui/material/GlobalStyles';
import { motion } from 'framer-motion';
import { useStoryWriterState, SceneAnimationResume } from '../../../hooks/useStoryWriterState';
import { storyWriterApi } from '../../../services/storyWriterApi';
import { triggerSubscriptionError } from '../../../api/client';
import { fetchMediaBlobUrl } from '../../../utils/fetchMediaBlobUrl';
import { useMediaBlobLoader } from '../../../hooks/useMediaBlobLoader';
import EditSectionModal from './StoryOutlineParts/EditSectionModal';
import BookPages from './StoryOutlineParts/BookPages';
import OutlineActionsBar from './StoryOutlineParts/OutlineActionsBar';
import ImageEditModal from './StoryOutlineParts/ImageEditModal';
import AudioScriptModal from './StoryOutlineParts/AudioScriptModal';
import CharactersModal from './StoryOutlineParts/CharactersModal';
import KeyEventsModal from './StoryOutlineParts/KeyEventsModal';
import TitleEditModal from './StoryOutlineParts/TitleEditModal';
import { SceneImagesProgressModal } from './StorySetup/SceneImagesProgressModal';
import { SceneImageGenerationProgressModal } from './StorySetup/SceneImageGenerationProgressModal';
import { AudioGenerationProgressModal } from './StorySetup/AudioGenerationProgressModal';
import {
  StoryImageGenerationModal,
  StoryImageGenerationSettings,
} from '../components/StoryImageGenerationModal';
import ErrorRetryAlert from '../components/ErrorRetryAlert';
import FailedMediaList, { FailedSceneMedia } from '../components/FailedMediaList';
import GenerationStatusBar from '../components/GenerationStatusBar';
import { useSceneImageGenerator } from '../../../hooks/useSceneImageGenerator';
import { useUndoRedo } from '../../../hooks/useUndoRedo';

// styles imported

interface StoryOutlineProps {
  state: ReturnType<typeof useStoryWriterState>;
  onNext: () => void;
}

const StoryOutline: React.FC<StoryOutlineProps> = ({ state, onNext }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState(0);
  const [imageLoadError, setImageLoadError] = useState<Set<number>>(new Set());
  const [audioBlobUrls, setAudioBlobUrls] = useState<Map<number, string>>(new Map());
  const [videoBlobUrls, setVideoBlobUrls] = useState<Map<number, string>>(new Map());
  const [audioLoadError, setAudioLoadError] = useState<Set<number>>(new Set());
  const [hasVideoLoadError, setVideoLoadError] = useState<Set<number>>(new Set());
  const [outlineToastOpen, setOutlineToastOpen] = useState(false);
  const lastToastSceneCount = useRef<number | null>(null);
  const lastSavedSceneCount = useRef<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editText, setEditText] = useState<string>('');
  const outlineUndoRedo = useUndoRedo('', { limit: 30 });
  const handleOutlineEditTextChange = (text: string) => {
    setEditText(text);
    outlineUndoRedo.setValue(text);
  };
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [isRegeneratingSceneImage, setIsRegeneratingSceneImage] = useState<boolean>(false);
  const [isRegeneratingSceneAudio, setIsRegeneratingSceneAudio] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePromptDraft, setImagePromptDraft] = useState('');
  const [isImageSettingsModalOpen, setIsImageSettingsModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [audioScriptDraft, setAudioScriptDraft] = useState('');
  const [isCharactersModalOpen, setIsCharactersModalOpen] = useState(false);
  const [isKeyEventsModalOpen, setIsKeyEventsModalOpen] = useState(false);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [animatingSceneNumber, setAnimatingSceneNumber] = useState<number | null>(null);
  const [isRefiningAnimeScene, setIsRefiningAnimeScene] = useState(false);
  const [isImageFullscreenOpen, setIsImageFullscreenOpen] = useState(false);
  const [failedImageScenes, setFailedImageScenes] = useState<Set<number>>(new Set());
  const [failedAudioScenes, setFailedAudioScenes] = useState<Set<number>>(new Set());
  const [bulkImageProgress, setBulkImageProgress] = useState<{ total: number; completed: number; failed: number; currentTitle: string | null }>({
    total: 0, completed: 0, failed: 0, currentTitle: null,
  });
  
  // Use state from hook instead of local state
  const sceneImages = state.sceneImages || new Map<number, string>();
  const sceneAudio = state.sceneAudio || new Map<number, string>();
  const sceneAnimatedVideos = React.useMemo(() => state.sceneAnimatedVideos || new Map<number, string>(), [state.sceneAnimatedVideos]);
  const sceneAnimationResumables = state.sceneAnimationResumables || new Map<number, SceneAnimationResume>();

  const updateSceneAnimatedVideo = (sceneNumber: number, videoUrl: string) => {
    const nextMap = new Map(state.sceneAnimatedVideos || []);
    nextMap.set(sceneNumber, videoUrl);
    state.setSceneAnimatedVideos(nextMap);
    // Clear the blob URL for this scene so it reloads with the new video
    setVideoBlobUrls((prev) => {
      const next = new Map(prev);
      const oldBlobUrl = next.get(sceneNumber);
      if (oldBlobUrl) {
        URL.revokeObjectURL(oldBlobUrl);
      }
      next.delete(sceneNumber);
      return next;
    });
    // Clear any error state for this scene
    setVideoLoadError((prev) => {
      const next = new Set(prev);
      next.delete(sceneNumber);
      return next;
    });
  };

  const handleAnimateSceneWithVoiceover = async () => {
    if (!hasScenes || !currentScene) {
      setError('Please generate your outline before animating scenes.');
      return;
    }

    const sceneNumber = currentScene.scene_number || currentSceneIndex + 1;
    const sceneImageRelativeUrl = state.sceneImages?.get(sceneNumber);
    const sceneAudioRelativeUrl = state.sceneAudio?.get(sceneNumber);

    if (!sceneImageRelativeUrl) {
      setError('Please generate an image for this scene before animating it.');
      return;
    }

    if (!sceneAudioRelativeUrl) {
      setError('Please generate narration audio for this scene before animating with voiceover.');
      return;
    }

    setAnimatingSceneNumber(sceneNumber);
    setError(null);
    updateSceneAnimationResume(sceneNumber, undefined);

    const storyContextPayload = createStoryContextPayload();

    try {
      console.info('[Outline] Animate scene with voiceover requested', {
        sceneNumber,
        image: sceneImageRelativeUrl,
        audio: sceneAudioRelativeUrl,
      });

      // Start async task
      const startResponse = await storyWriterApi.animateSceneVoiceover({
        scene_number: sceneNumber,
        scene_data: currentScene,
        story_context: storyContextPayload,
        image_url: sceneImageRelativeUrl,
        audio_url: sceneAudioRelativeUrl,
        resolution: '720p',
      });

      // Poll for completion (InfiniteTalk can take up to 10 minutes)
      const taskId = startResponse.task_id;
      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 2000)); // Poll every 2 seconds
        const status = await storyWriterApi.getTaskStatus(taskId);
        if (status.status === 'completed') {
          done = true;
          const result = await storyWriterApi.getTaskResult(taskId);
          // Extract AnimateSceneResponse from result
          // The result can be either the AnimateSceneResponse directly or wrapped in a result field
          const animationResult = (result as any).result || result;
          const videoUrl = animationResult.video_url;
          const cost = animationResult.cost || 0;
          if (videoUrl) {
            updateSceneAnimatedVideo(sceneNumber, videoUrl);
            console.info('[Outline] Animate with voiceover completed', {
              sceneNumber,
              video: videoUrl,
              cost: cost,
            });
          } else {
            throw new Error('Video URL not found in result');
          }
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'InfiniteTalk animation failed');
        }
        // Continue polling if status is 'pending' or 'processing'
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const handled = await triggerSubscriptionError(err);
      const message = extractDetailMessage(detail, err.message || 'Failed to animate scene with voiceover.');
      setError(message);
      if (!handled) {
        console.error('[Outline] Animate scene with voiceover failed', err);
      }
    } finally {
      setAnimatingSceneNumber(null);
    }
  };

  const updateSceneAnimationResume = (sceneNumber: number, info?: SceneAnimationResume) => {
    const prevMap = state.sceneAnimationResumables || new Map<number, SceneAnimationResume>();
    const nextMap = new Map(prevMap);
    if (info) {
      nextMap.set(sceneNumber, info);
    } else {
      nextMap.delete(sceneNumber);
    }
    state.setSceneAnimationResumables(nextMap.size > 0 ? nextMap : null);
  };

  const extractDetailMessage = (detail: any, fallback: string): string => {
    if (!detail) return fallback;
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object') {
      if (typeof detail.message === 'string') return detail.message;
      if (typeof detail.error === 'string') return detail.error;
      if (typeof detail.detail === 'string') return detail.detail;
    }
    return fallback;
  };

  const captureResumeOpportunity = (
    sceneNumber: number,
    duration: 5 | 10,
    detail: any
  ): string | null => {
    if (!detail || typeof detail !== 'object') {
      return null;
    }
    if (!detail.resume_available || !detail.prediction_id) {
      return null;
    }
    const message =
      typeof detail.message === 'string'
        ? detail.message
        : typeof detail.error === 'string'
        ? detail.error
        : 'WaveSpeed is still finalizing this animation. Click Resume to download without extra cost.';

    updateSceneAnimationResume(sceneNumber, {
      predictionId: detail.prediction_id,
      duration,
      message,
      createdAt: new Date().toISOString(),
    });
    return message;
  };

  const scenes = state.outlineScenes || [];
  const sceneCount = scenes.length;
  const hasScenes = state.isOutlineStructured && scenes.length > 0;
  const hasOutlineScenes = Boolean(state.outlineScenes && state.outlineScenes.length > 0);
  const hasAnimeBible = Boolean(state.animeBible);
  const resumableScenesArray = Array.from(sceneAnimationResumables.entries());
  const resumableSummaryMessage =
    resumableScenesArray.length === 0
      ? null
      : resumableScenesArray.length === 1
      ? resumableScenesArray[0][1]?.message ||
        `Scene ${resumableScenesArray[0][0]} animation is ready to resume without extra cost.`
      : `Scenes ${resumableScenesArray.map(([scene]) => scene).join(', ')} have WaveSpeed animations ready to resume without extra cost. Open each scene and click Resume Animation.`;

  // removed old accordion renderer (unused)

  useEffect(() => {
    if (state.isOutlineStructured && sceneCount > 0 && sceneCount !== lastToastSceneCount.current) {
      setOutlineToastOpen(true);
      lastToastSceneCount.current = sceneCount;
    }
  }, [state.isOutlineStructured, sceneCount]);

  useEffect(() => {
    if (!state.projectId) {
      return;
    }
    if (!state.isOutlineStructured || sceneCount <= 0) {
      return;
    }
    if (lastSavedSceneCount.current === sceneCount) {
      return;
    }
    lastSavedSceneCount.current = sceneCount;
    state.saveProjectToDb();
  }, [state.projectId, state.isOutlineStructured, sceneCount, state.saveProjectToDb, state]);

  useEffect(() => {
    if (hasScenes) {
      setCurrentSceneIndex(0);
      setPageDirection(0);
    }
  }, [hasScenes]);

  const currentScene = hasScenes ? scenes[currentSceneIndex] : null;
  const canGoPrev = currentSceneIndex > 0;
  const canGoNext = hasScenes ? currentSceneIndex < scenes.length - 1 : false;
  
  // Get the current scene's image URL
  const currentSceneNumber = currentScene?.scene_number || currentSceneIndex + 1;
  const currentSceneResumeInfo = sceneAnimationResumables.get(currentSceneNumber) || null;
  const canAnimateCurrentScene = !animatingSceneNumber && !currentSceneResumeInfo;
  const isCurrentSceneAnimating = animatingSceneNumber === currentSceneNumber;
  const { generateSceneImage, isGenerating: isGeneratingSceneImageReal } = useSceneImageGenerator(state);
  const currentSceneImageUrl = sceneImages.get(currentSceneNumber);
  const hasImageLoadError = imageLoadError.has(currentSceneNumber);
  const currentSceneAudioUrl = sceneAudio.get(currentSceneNumber);
  const hasAudioLoadError = audioLoadError.has(currentSceneNumber);
  const hasAudioForScene = Boolean(currentSceneAudioUrl);
   
  // Fetch video as blob with authentication
  useEffect(() => {
    const animatedVideoRelativeUrl = sceneAnimatedVideos.get(currentSceneNumber);
    if (!animatedVideoRelativeUrl || hasVideoLoadError.has(currentSceneNumber) || videoBlobUrls.has(currentSceneNumber)) {
      return;
    }
    
    let cancelled = false;
    
    const loadVideo = async () => {
      try {
        const blobUrl = await fetchMediaBlobUrl(animatedVideoRelativeUrl);
        if (cancelled || !blobUrl) {
          if (!blobUrl) {
            setVideoLoadError((prev) => new Set(prev).add(currentSceneNumber));
          }
          return;
        }
        setVideoBlobUrls((prev) => {
          const next = new Map(prev);
          const existing = next.get(currentSceneNumber);
          if (existing) {
            URL.revokeObjectURL(existing);
          }
          next.set(currentSceneNumber, blobUrl);
          return next;
        });
      } catch (err: any) {
        console.error('Failed to load video:', err);
        setVideoLoadError((prev) => new Set(prev).add(currentSceneNumber));
      }
    };
    
    loadVideo();
    return () => { cancelled = true; };
  }, [currentSceneNumber, sceneAnimatedVideos, hasVideoLoadError, videoBlobUrls]);

  const handleRetryFailedImages = async (specificScenes?: Set<number>) => {
    const targets = specificScenes || failedImageScenes;
    if (targets.size === 0) return;
    setIsGeneratingImages(true);
    setError(null);
    const stillFailed = new Set<number>();
    try {
      for (const sceneNum of targets) {
        const scene = scenes.find((s: any) => (s.scene_number || 0) === sceneNum);
        if (!scene) continue;
        try {
          const resp = await storyWriterApi.regenerateSceneImage({
            scene_number: sceneNum,
            scene_title: scene.title || `Scene ${sceneNum}`,
            prompt: scene.image_prompt || '',
            provider: state.imageProvider || undefined,
            width: state.imageWidth,
            height: state.imageHeight,
            model: state.imageModel || undefined,
          });
          if (resp.success && resp.image_url) {
            const nextMap = new Map(state.sceneImages || []);
            nextMap.set(sceneNum, resp.image_url);
            state.setSceneImages(nextMap);
          } else {
            stillFailed.add(sceneNum);
          }
        } catch {
          stillFailed.add(sceneNum);
        }
      }
      setFailedImageScenes(stillFailed);
      if (stillFailed.size > 0) {
        setError(`${failedImageScenes.size - stillFailed.size} retried successfully, ${stillFailed.size} still failed.`);
      } else {
        setError(null);
        state.setError(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Retry failed');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleRetryFailedAudio = async (specificScenes?: Set<number>) => {
    const targets = specificScenes || failedAudioScenes;
    if (targets.size === 0) return;
    setIsGeneratingAudio(true);
    setError(null);
    const stillFailed = new Set<number>();
    try {
      for (const sceneNum of targets) {
        const scene = scenes.find((s: any) => (s.scene_number || 0) === sceneNum);
        if (!scene) continue;
        try {
          const resp = await storyWriterApi.generateFreeAudio({
            scene_number: sceneNum,
            scene_title: scene.title || `Scene ${sceneNum}`,
            text: scene.audio_narration || '',
            provider: state.audioProvider || undefined,
            lang: state.audioLang || undefined,
            slow: state.audioSlow || false,
            rate: state.audioRate || undefined,
          });
          if (resp.success && resp.audio_url) {
            const nextMap = new Map(state.sceneAudio || []);
            nextMap.set(sceneNum, resp.audio_url);
            state.setSceneAudio(nextMap);
          } else {
            stillFailed.add(sceneNum);
          }
        } catch {
          stillFailed.add(sceneNum);
        }
      }
      setFailedAudioScenes(stillFailed);
      if (stillFailed.size > 0) {
        setError(`${failedAudioScenes.size - stillFailed.size} retried successfully, ${stillFailed.size} still failed.`);
      } else {
        setError(null);
        state.setError(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Retry failed');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Cleanup blob URLs when component unmounts or scenes change
  useEffect(() => {
    return () => {
      // Revoke all blob URLs on unmount
      audioBlobUrls.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
      videoBlobUrls.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
    };
  }, []);
  
  // Image blob loaded via useMediaBlobLoader hook below
  const { blobUrl: currentSceneImageFullUrl } = useMediaBlobLoader(currentSceneImageUrl);
  const currentSceneAudioFullUrl = audioBlobUrls.get(currentSceneNumber) || null;
  const resolvedSceneAudioUrl =
    currentSceneAudioFullUrl ||
    (currentSceneAudioUrl ? storyWriterApi.getAudioUrl(currentSceneAudioUrl) : null);
  const currentSceneAnimatedVideoUrl = videoBlobUrls.get(currentSceneNumber) || null;
  
  const createStoryContextPayload = () => ({
    persona: state.persona,
    story_setting: state.storySetting,
    characters: state.characters,
    plot_elements: state.plotElements,
    writing_style: state.writingStyle,
    story_tone: state.storyTone,
    narrative_pov: state.narrativePOV,
    audience_age_group: state.audienceAgeGroup,
    content_rating: state.contentRating,
    story_length: state.storyLength,
    premise: state.premise,
    outline: state.outline,
    story_content: state.storyContent,
    anime_bible: state.animeBible,
  });

  // Reset image/audio/video load errors when scene changes (to allow retry for new scene)
  useEffect(() => {
    setImageLoadError((prev) => {
      const next = new Set(prev);
      next.delete(currentSceneNumber);
      return next;
    });
    setAudioLoadError((prev) => {
      const next = new Set(prev);
      next.delete(currentSceneNumber);
      return next;
    });
    setVideoLoadError((prev) => {
      const next = new Set(prev);
      next.delete(currentSceneNumber);
      return next;
    });
  }, [currentSceneNumber]);

  useEffect(() => {
    if (state.enableNarration) {
      return;
    }
    setAudioBlobUrls((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return new Map();
    });
    setAudioLoadError(new Set());
  }, [state.enableNarration]);

  // Fetch audio as blob for current scene
  useEffect(() => {
    if (!state.enableNarration) {
      return;
    }
    if (!currentSceneAudioUrl || !sceneAudio.has(currentSceneNumber)) {
      return;
    }
    if (currentSceneAudioFullUrl || hasAudioLoadError) {
      return;
    }

    let cancelled = false;

    const loadAudio = async () => {
      try {
        let audioPath = currentSceneAudioUrl;
        if (!audioPath.includes('/api/story/audio/')) {
          const cleanUrl = audioPath.split('?')[0];
          const filename = cleanUrl.split('/').pop() || cleanUrl;
          audioPath = `/api/story/audio/${filename}`;
        }
        
        const blobUrl = await fetchMediaBlobUrl(audioPath);
        if (cancelled || !blobUrl) {
          if (!blobUrl) {
            setAudioLoadError((prev) => new Set(prev).add(currentSceneNumber));
          }
          return;
        }

        setAudioBlobUrls((prev) => {
          const next = new Map(prev);
          const existing = next.get(currentSceneNumber);
          if (existing) {
            URL.revokeObjectURL(existing);
          }
          next.set(currentSceneNumber, blobUrl);
          return next;
        });
      } catch (err: any) {
        if (err?.response?.status !== 404) {
          console.error(`Failed to load audio for scene ${currentSceneNumber}:`, err);
        }
        setAudioLoadError((prev) => new Set(prev).add(currentSceneNumber));
      }
    };

    loadAudio();
    return () => { cancelled = true; };
  }, [currentSceneAudioUrl, currentSceneNumber, currentSceneAudioFullUrl, hasAudioLoadError, sceneAudio, state.enableNarration]);

  const handlePrevScene = () => {
    if (canGoPrev) {
      setPageDirection(-1);
      setCurrentSceneIndex((prev) => prev - 1);
    }
  };

  const handleNextScene = () => {
    if (canGoNext) {
      setPageDirection(1);
      setCurrentSceneIndex((prev) => prev + 1);
    }
  };

  const openEditModal = () => {
    const desc = currentScene?.description || '';
    setEditText(desc);
    outlineUndoRedo.reset(desc);
    setAiFeedback('');
    setAiSuggestions([]);
    setIsEditModalOpen(true);
  };

  const openImageModal = () => {
    setImagePromptDraft(currentScene?.image_prompt || '');
    setIsImageModalOpen(true);
  };

  const handleOpenAdvancedImageSettings = (prompt: string) => {
    setImagePromptDraft(prompt);
    setIsImageSettingsModalOpen(true);
  };

  const openAudioModal = () => {
    setAudioScriptDraft(currentScene?.audio_narration || '');
    setIsAudioModalOpen(true);
  };
  const openCharactersModal = () => {
    setIsCharactersModalOpen(true);
  };
  const openKeyEventsModal = () => {
    setIsKeyEventsModalOpen(true);
  };
  const openTitleModal = () => {
    setTitleDraft(currentScene?.title || '');
    setIsTitleModalOpen(true);
  };

  const handleSaveUpdatedSection = () => {
    if (!hasScenes || !currentScene) {
      setIsEditModalOpen(false);
      return;
    }
    const updatedScenes = [...scenes];
    const idx = currentSceneIndex;
    const original = updatedScenes[idx];
    updatedScenes[idx] = {
      ...original,
      description: editText,
    };
    (state.setOutlineScenes as (s: any[] | null) => void)(updatedScenes);
    const formattedOutline = updatedScenes
      .map((scene, idx2) => `Scene ${scene.scene_number || idx2 + 1}: ${scene.title}\n${scene.description}`)
      .join('\n\n');
    state.setOutline(formattedOutline);
    setIsEditModalOpen(false);
  };

  const handleGenerateAISuggestions = async () => {
    setAiLoading(true);
    try {
      const base = (editText || currentScene?.description || '').trim();
      const suggestion1 = `${base}\n\n[Variant A] Improved pacing and clarity, preserving key events.`;
      const suggestion2 = `${base}\n\n[Variant B] Richer sensory details and stronger character emotion.`;
      setAiSuggestions([suggestion1, suggestion2]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateImageWithSettings = async (
    settings: StoryImageGenerationSettings,
  ) => {
    if (!hasScenes || !currentScene) return;
    const sceneNum = currentScene.scene_number || currentSceneIndex + 1;
    const ok = await generateSceneImage(
      sceneNum,
      currentScene.title || `Scene ${sceneNum}`,
      settings.prompt.trim(),
      () => {
        const updated = [...scenes];
        updated[currentSceneIndex] = { ...updated[currentSceneIndex], image_prompt: settings.prompt.trim() };
        (state.setOutlineScenes as any)(updated);
        setImagePromptDraft(settings.prompt.trim());
        setIsImageSettingsModalOpen(false);
        setIsImageModalOpen(false);
      },
      (msg) => setError(msg),
      settings.model || null,
    );
    if (!ok) {
      console.error('Failed to regenerate scene image with settings');
    }
  };

  const applySuggestion = (index: number) => {
    const chosen = aiSuggestions[index];
    if (chosen) {
      setEditText(chosen);
    }
  };

  const handleGenerateCurrentSceneImage = async () => {
    if (!hasScenes || !currentScene) return;
    const prompt = currentScene?.image_prompt || '';
    if (!prompt.trim()) return;
    const sceneNum = currentScene.scene_number || currentSceneIndex + 1;
    await generateSceneImage(
      sceneNum,
      currentScene.title || `Scene ${sceneNum}`,
      prompt.trim(),
      () => setImageLoadError((prev) => { const s = new Set(prev); s.delete(sceneNum); return s; }),
      (msg) => setError(msg),
    );
  };

  const handleOutlineToastClose = (_?: unknown, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOutlineToastOpen(false);
  };

  const handleGenerateOutline = async () => {
    if (!state.premise) {
      setError('Please generate a premise first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const request = state.getRequest();
      const response = await storyWriterApi.generateOutline(state.premise, request);

      if (response.anime_bible) {
        state.setAnimeBible(response.anime_bible);
      }
      
      if (response.success && response.outline) {
        // Handle structured outline (scenes) or plain text outline
        if (response.is_structured && Array.isArray(response.outline) && response.outline.length > 0) {
          // Structured outline with scenes
          const scenes = response.outline as any[]; // Assuming StoryScene is any[]
          // setOutlineScenes auto-derives isOutlineStructured; do not override
          // it here so an empty array is never falsely marked "structured".
          state.setOutlineScenes(scenes);
          // Also store as formatted text for backward compatibility
          const formattedOutline = scenes.map((scene, idx) =>
            `Scene ${scene.scene_number || idx + 1}: ${scene.title}\n${scene.description}`
          ).join('\n\n');
          state.setOutline(formattedOutline);
        } else if (Array.isArray(response.outline) && response.outline.length === 0) {
          // Backend returned an empty scene array — surface an error instead
          // of silently leaving a stale outline in the UI.
          throw new Error('AI returned no scenes for this outline. Please try again or refine your premise.');
        } else {
          // Plain text outline
          state.setOutline(typeof response.outline === 'string' ? response.outline : String(response.outline));
          state.setOutlineScenes(null);
        }
        state.setError(null);
      } else {
        throw new Error(typeof response.outline === 'string' ? response.outline : 'Failed to generate outline');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate outline';
      setError(errorMessage);
      state.setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContinue = async () => {
    if (!state.premise || (!state.outline && !state.outlineScenes)) {
      setError('Please generate a premise and outline first');
      return;
    }

    if (state.outline || state.outlineScenes) {
      state.setAutoGenerateOnWriting(true);
      onNext();
    }
  };

  const handleGenerateImages = async () => {
    if (!state.outlineScenes || state.outlineScenes.length === 0) {
      setError('Please generate a structured outline first');
      return;
    }
    if (!state.enableIllustration) {
      setError('Illustration feature is disabled in Story Setup.');
      return;
    }

    setIsGeneratingImages(true);
    setError(null);
    const scenes = state.outlineScenes;
    const total = scenes.length;
    setBulkImageProgress({ total, completed: 0, failed: 0, currentTitle: scenes[0]?.title || null });

    let completed = 0;
    let failed = 0;
    const imagesMap = new Map<number, string>(state.sceneImages || []);
    const failedSet = new Set<number>();

    try {
      for (const scene of scenes) {
        const sceneNum = scene.scene_number || scenes.indexOf(scene) + 1;
        const sceneTitle = scene.title || `Scene ${sceneNum}`;
        setBulkImageProgress({ total, completed, failed, currentTitle: sceneTitle });

        try {
          const resp = await storyWriterApi.regenerateSceneImage({
            scene_number: sceneNum,
            scene_title: sceneTitle,
            prompt: scene.image_prompt || '',
            provider: state.imageProvider || undefined,
            width: state.imageWidth,
            height: state.imageHeight,
            model: state.imageModel || undefined,
          });

          if (resp.success && resp.image_url) {
            imagesMap.set(sceneNum, resp.image_url);
            state.setSceneImages(new Map(imagesMap));
            completed++;
          } else {
            failed++;
            failedSet.add(sceneNum);
          }
        } catch {
          failed++;
          failedSet.add(sceneNum);
        }
        setBulkImageProgress({ total, completed, failed, currentTitle: sceneTitle });
      }

      setFailedImageScenes(failedSet);
      if (failed > 0) {
        setError(`${completed} scene${completed !== 1 ? 's' : ''} generated, ${failed} failed. You can retry failed scenes individually.`);
      } else {
        setError(null);
        state.setError(null);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate images';
      setError(errorMessage);
      state.setError(errorMessage);
    } finally {
      setIsGeneratingImages(false);
      setBulkImageProgress((prev) => ({ ...prev, currentTitle: null }));
    }
  };

  const handleGenerateAudio = async () => {
    if (!state.outlineScenes || state.outlineScenes.length === 0) {
      setError('Please generate a structured outline first');
      return;
    }
    if (!state.enableNarration) {
      setError('Narration feature is disabled in Story Setup.');
      return;
    }

    setIsGeneratingAudio(true);
    setError(null);

    try {
      const response = await storyWriterApi.generateSceneAudio({
        scenes: state.outlineScenes,
        provider: state.audioProvider,
        lang: state.audioLang,
        slow: state.audioSlow,
        rate: state.audioRate,
      });
      
      if (response.success && response.audio_files) {
        const audioMap = new Map<number, string>();
        const failed = new Set<number>();
        response.audio_files.forEach((audio) => {
          if (audio.audio_url && !audio.error) {
            audioMap.set(audio.scene_number, audio.audio_url);
          } else if (audio.error) {
            failed.add(audio.scene_number);
          }
        });
        state.setSceneAudio(audioMap);
        setFailedAudioScenes(failed);
        if (failed.size > 0) {
          setError(`${audioMap.size} scene${audioMap.size !== 1 ? 's' : ''} generated, ${failed.size} failed. You can retry failed scenes individually.`);
        } else {
          setError(null);
        }
        state.setError(null);
      } else {
        throw new Error('Failed to generate audio');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate audio';
      setError(errorMessage);
      state.setError(errorMessage);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleRefineCurrentSceneAnime = async () => {
    if (!hasScenes || !currentScene) {
      setError('Please generate your outline before refining scenes.');
      return;
    }
    if (!state.animeBible) {
      setError('Anime story bible is not available. Generate an anime outline first.');
      return;
    }

    setIsRefiningAnimeScene(true);
    setError(null);

    try {
      const storyRequest = state.getRequest();
      const response = await storyWriterApi.refineAnimeSceneText({
        scene: currentScene,
        persona: storyRequest.persona,
        story_setting: storyRequest.story_setting,
        character_input: storyRequest.character_input,
        plot_elements: storyRequest.plot_elements,
        writing_style: storyRequest.writing_style,
        story_tone: storyRequest.story_tone,
        narrative_pov: storyRequest.narrative_pov,
        audience_age_group: storyRequest.audience_age_group,
        content_rating: storyRequest.content_rating,
        anime_bible: state.animeBible || null,
      });

      if (response.success && response.scene) {
        const refinedScene = response.scene;
        const nextScenes = [...scenes];
        if (currentSceneIndex >= 0 && currentSceneIndex < nextScenes.length) {
          nextScenes[currentSceneIndex] = refinedScene;
        }
        state.setOutlineScenes(nextScenes);

        const formattedOutline = nextScenes
          .map((scene, idx2) =>
            `Scene ${scene.scene_number || idx2 + 1}: ${scene.title}\n${scene.description}`
          )
          .join('\n\n');
        state.setOutline(formattedOutline);
      } else {
        throw new Error('Failed to refine scene with anime bible');
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail || err.message || 'Failed to refine scene with anime bible';
      setError(errorMessage);
      state.setError(errorMessage);
    } finally {
      setIsRefiningAnimeScene(false);
    }
  };

  const handleAnimateScene = async () => {
    if (!hasScenes || !currentScene) {
      setError('Please generate your outline before animating scenes.');
      return;
    }

    const sceneNumber = currentScene.scene_number || currentSceneIndex + 1;
    const sceneImageRelativeUrl = state.sceneImages?.get(sceneNumber);
    if (!sceneImageRelativeUrl) {
      setError('Please generate an image for this scene before animating it.');
      return;
    }

    setAnimatingSceneNumber(sceneNumber);
    setError(null);
    updateSceneAnimationResume(sceneNumber, undefined);

    const storyContextPayload = createStoryContextPayload();

    const animationDuration: 5 | 10 = 5;

    try {
      console.info(
        `[Outline] Animate scene requested`,
        { sceneNumber, duration: 5, image: sceneImageRelativeUrl }
      );
      const response = await storyWriterApi.animateScene({
        scene_number: sceneNumber,
        scene_data: currentScene,
        story_context: storyContextPayload,
        image_url: sceneImageRelativeUrl,
        duration: animationDuration,
      });

      updateSceneAnimatedVideo(sceneNumber, response.video_url);
      updateSceneAnimationResume(sceneNumber, undefined);
      console.info(
        `[Outline] Animate scene completed`,
        {
          sceneNumber,
          video: response.video_url,
          cost: response.cost,
          prediction: response.prediction_id || 'n/a',
        }
      );
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const resumeMessage = captureResumeOpportunity(sceneNumber, animationDuration, detail);
      const handled = await triggerSubscriptionError(err);
      const message = resumeMessage || extractDetailMessage(detail, err.message || 'Failed to animate scene.');
      setError(message);
      if (!resumeMessage || !handled) {
        console.error('[Outline] Animate scene failed', err);
      }
    } finally {
      setAnimatingSceneNumber(null);
    }
  };

  const handleResumeSceneAnimation = async (
    sceneNumber: number,
    resumeInfo: SceneAnimationResume
  ) => {
    setAnimatingSceneNumber(sceneNumber);
    setError(null);

    try {
      console.info('[Outline] Resume scene requested', {
        sceneNumber,
        prediction: resumeInfo.predictionId,
      });

      const response = await storyWriterApi.resumeAnimateScene({
        prediction_id: resumeInfo.predictionId,
        scene_number: sceneNumber,
        duration: resumeInfo.duration,
      });

      updateSceneAnimatedVideo(sceneNumber, response.video_url);
      updateSceneAnimationResume(sceneNumber, undefined);

      console.info('[Outline] Resume scene completed', {
        sceneNumber,
        video: response.video_url,
        cost: response.cost,
        prediction: response.prediction_id || resumeInfo.predictionId,
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = extractDetailMessage(detail, err.message || 'Failed to resume animation.');
      setError(message);
      await triggerSubscriptionError(err);
      console.error('[Outline] Resume scene failed', err);
    } finally {
      setAnimatingSceneNumber(null);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <GlobalStyles
        styles={{
          '.tw-shadow-book': {
            boxShadow: '0 36px 80px rgba(45, 30, 15, 0.35)',
          },
          '.tw-rounded-book': {
            borderRadius: '20px',
          },
          '.tw-page-accent': {
            background: 'linear-gradient(120deg, #f9e6c8, #f2d8b4)',
          },
          '.rendered-content p': { marginBottom: '0.75rem', lineHeight: 1.9 },
          '.rendered-content h1, .rendered-content h2, .rendered-content h3': {
            color: '#2C2416', marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600,
          },
          '.rendered-content h1': { fontSize: '1.5rem' },
          '.rendered-content h2': { fontSize: '1.3rem', borderBottom: '1px solid rgba(120,90,60,0.2)', paddingBottom: '0.25rem' },
          '.rendered-content h3': { fontSize: '1.15rem' },
          '.rendered-content strong': { fontWeight: 700 },
          '.rendered-content em': { fontStyle: 'italic' },
          '.rendered-content ul, .rendered-content ol': { paddingLeft: '1.5rem', marginBottom: '0.75rem' },
          '.rendered-content li': { marginBottom: '0.25rem' },
          '.rendered-content blockquote': {
            borderLeft: '3px solid #8D6E63', paddingLeft: '1rem', color: '#5D4037',
            fontStyle: 'italic', margin: '0.75rem 0',
          },
          '.rendered-content code': {
            background: 'rgba(141,110,99,0.12)', padding: '2px 6px', borderRadius: 4,
            fontFamily: 'monospace', fontSize: '0.9em',
          },
          '.rendered-content hr': { border: 'none', borderTop: '1px solid rgba(120,90,60,0.2)', margin: '1rem 0' },
          '.rendered-content a': { color: '#5D4037', textDecoration: 'underline' },
          '.rendered-content img': { maxWidth: '100%', height: 'auto', borderRadius: '4px', margin: '0.5rem 0' },
        }}
      />
      <Snackbar
        open={outlineToastOpen}
        autoHideDuration={4500}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={handleOutlineToastClose}
      >
        <Alert
          severity="success"
          variant="filled"
          sx={{ width: '100%', boxShadow: '0 8px 24px rgba(26, 22, 17, 0.25)' }}
          onClose={handleOutlineToastClose}
        >
          Structured outline with {sceneCount} scenes generated. Each scene includes image prompts and audio narration.
        </Alert>
      </Snackbar>

      {(failedImageScenes.size > 0 || failedAudioScenes.size > 0) && (
        <FailedMediaList
          failedScenes={Array.from(new Set([...failedImageScenes, ...failedAudioScenes])).map((sceneNum) => ({
            sceneNumber: sceneNum,
            sceneTitle: scenes.find((s: any) => (s.scene_number || 0) === sceneNum)?.title,
            hasImage: failedImageScenes.has(sceneNum),
            hasAudio: failedAudioScenes.has(sceneNum),
          }))}
          onRetryAllImages={failedImageScenes.size > 0 ? () => handleRetryFailedImages() : undefined}
          onRetryAllAudio={failedAudioScenes.size > 0 ? () => handleRetryFailedAudio() : undefined}
          onRetryScene={(sceneNum, type) => {
            if (type === 'image') {
              handleRetryFailedImages(new Set([sceneNum]));
            }
          }}
          isRetryingImages={isGeneratingImages}
          isRetryingAudio={isGeneratingAudio}
          onClear={() => { setFailedImageScenes(new Set()); setFailedAudioScenes(new Set()); }}
        />
      )}
      {error && !(failedImageScenes.size > 0 || failedAudioScenes.size > 0) && (
        <ErrorRetryAlert
          error={error}
          onDismiss={() => setError(null)}
          defaultRetry={error.includes('Failed to generate') ? handleGenerateOutline : undefined}
        />
      )}

      <GenerationStatusBar
        type="images"
        isActive={isGeneratingImages}
        total={bulkImageProgress.total}
        completed={bulkImageProgress.completed}
        failed={bulkImageProgress.failed}
        currentLabel={bulkImageProgress.currentTitle}
      />
      <GenerationStatusBar
        type="audio"
        isActive={isGeneratingAudio}
        total={scenes.length}
        completed={0}
        failed={0}
        currentLabel="Generating audio for all scenes..."
      />

      {resumableSummaryMessage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {resumableSummaryMessage}
        </Alert>
      )}

      {!state.premise && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please generate a premise first in the Setup phase.
        </Alert>
      )}

      {hasScenes ? (
        <Box component="div">
          <BookPages
            currentScene={currentScene}
            currentSceneIndex={currentSceneIndex}
            scenesLength={scenes.length}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            pageDirection={pageDirection}
            onPrev={handlePrevScene}
            onNext={handleNextScene}
            imageUrl={currentSceneImageFullUrl}
            onImageError={() => setImageLoadError((prev) => new Set(prev).add(currentSceneNumber))}
            onGenerateImage={handleGenerateCurrentSceneImage}
            isGeneratingImage={isGeneratingSceneImageReal}
            narrationEnabled={!!state.enableNarration}
            audioUrl={resolvedSceneAudioUrl || null}
            hasAudio={hasAudioForScene}
            onOpenImageModal={openImageModal}
            onOpenImageFullscreen={() => setIsImageFullscreenOpen(true)}
            onOpenAudioModal={openAudioModal}
            onOpenCharactersModal={openCharactersModal}
            onOpenKeyEventsModal={openKeyEventsModal}
            onOpenTitleModal={openTitleModal}
            onOpenEditModal={openEditModal}
            onAnimateScene={canAnimateCurrentScene ? handleAnimateScene : undefined}
            onAnimateWithVoiceover={hasAudioForScene ? handleAnimateSceneWithVoiceover : undefined}
            onResumeScene={
              currentSceneResumeInfo && !animatingSceneNumber
                ? () => handleResumeSceneAnimation(currentSceneNumber, currentSceneResumeInfo)
                : undefined
            }
            resumeInfo={currentSceneResumeInfo}
            isAnimatingScene={isCurrentSceneAnimating}
            animatedVideoUrl={currentSceneAnimatedVideoUrl}
            onRefineAnimeScene={handleRefineCurrentSceneAnime}
            isRefiningAnimeScene={isRefiningAnimeScene}
            hasAnimeBible={hasAnimeBible}
          />
          <OutlineActionsBar
            isGenerating={isGenerating}
            canRegenerateOutline={!!state.premise}
            onRegenerateOutline={handleGenerateOutline}
            showMediaActions={!!(state.isOutlineStructured && state.outlineScenes)}
            isGeneratingImages={isGeneratingImages}
            isGeneratingAudio={isGeneratingAudio}
            illustrationEnabled={!!state.enableIllustration && !!hasOutlineScenes}
            narrationEnabled={!!state.enableNarration && !!hasOutlineScenes}
            onGenerateImages={handleGenerateImages}
            onGenerateAudio={handleGenerateAudio}
            canContinue={!!(state.outline || state.outlineScenes) && !isGenerating && !isGeneratingImages && !isGeneratingAudio}
            onContinue={handleContinue}
          />
        </Box>
          ) : (
            <TextField
              fullWidth
              multiline
              rows={12}
              value={state.outline || ''}
              onChange={(e) => state.setOutline(e.target.value)}
              label="Story Outline"
              helperText="Paste or edit your story outline here. Click Generate Outline above to have Alwrity AI build a structured scene-by-scene outline from your premise."
              sx={{ mb: 3 }}
            />
          )}
      <Dialog
        open={isImageFullscreenOpen}
        onClose={() => setIsImageFullscreenOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'black', borderRadius: 2 } }}
      >
        <IconButton
          onClick={() => setIsImageFullscreenOpen(false)}
          sx={{
            position: 'absolute', top: 8, right: 8, zIndex: 10,
            color: 'white', bgcolor: 'rgba(0,0,0,0.5)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          <CloseIcon />
        </IconButton>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 3,
            minHeight: '60vh',
          }}
        >
          {currentSceneImageFullUrl ? (
            <Box
              component="img"
              src={currentSceneImageFullUrl}
              alt={currentScene?.title || `Scene ${currentSceneNumber} illustration`}
              sx={{
                width: '100%',
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'white' }}>
              No image is available for this scene yet.
            </Typography>
          )}
        </Box>
      </Dialog>

      <EditSectionModal
        open={isEditModalOpen}
        sceneNumber={currentSceneNumber}
        editText={editText}
        onChangeEditText={handleOutlineEditTextChange}
        aiFeedback={aiFeedback}
        onChangeAiFeedback={setAiFeedback}
        aiLoading={aiLoading}
        onGenerateSuggestions={handleGenerateAISuggestions}
        suggestions={aiSuggestions}
        onPickSuggestion={applySuggestion}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveUpdatedSection}
        canUndo={outlineUndoRedo.canUndo}
        canRedo={outlineUndoRedo.canRedo}
        onUndo={outlineUndoRedo.undo}
        onRedo={outlineUndoRedo.redo}
      />
      <ImageEditModal
        open={isImageModalOpen}
        sceneNumber={currentSceneNumber}
        value={imagePromptDraft}
        onChange={setImagePromptDraft}
        onClose={() => setIsImageModalOpen(false)}
        onSave={() => {
          if (!hasScenes || !currentScene) { setIsImageModalOpen(false); return; }
          const updated = [...scenes];
          updated[currentSceneIndex] = { ...updated[currentSceneIndex], image_prompt: imagePromptDraft };
          (state.setOutlineScenes as any)(updated);
          setIsImageModalOpen(false);
        }}
        onRegenerate={async (prompt: string) => {
          if (!hasScenes || !currentScene) return;
          setIsRegeneratingSceneImage(true);
          try {
            const sceneNum = currentScene.scene_number || currentSceneIndex + 1;
            const sceneTitle = currentScene.title || `Scene ${sceneNum}`;

            const resp = await storyWriterApi.regenerateSceneImage({
              scene_number: sceneNum,
              scene_title: sceneTitle,
              prompt: prompt.trim(),
              provider: state.imageProvider || undefined,
              width: state.imageWidth,
              height: state.imageHeight,
              model: state.imageModel || undefined,
            });

            if (resp.success && resp.image_url) {
              const nextMap = new Map(state.sceneImages || []);
              nextMap.set(sceneNum, resp.image_url);
              state.setSceneImages(nextMap);

              const updated = [...scenes];
              updated[currentSceneIndex] = { ...updated[currentSceneIndex], image_prompt: prompt.trim() };
              (state.setOutlineScenes as any)(updated);
              setImagePromptDraft(prompt.trim());
              setIsImageModalOpen(false);
            } else {
              throw new Error(resp.error || 'Failed to regenerate image');
            }
          } catch (err: any) {
            console.error('Failed to regenerate scene image:', err);
            throw err;
          } finally {
            setIsRegeneratingSceneImage(false);
          }
        }}
        imageProvider={state.imageProvider}
        imageWidth={state.imageWidth}
        imageHeight={state.imageHeight}
        imageModel={state.imageModel}
        onOpenAdvancedSettings={handleOpenAdvancedImageSettings}
      />
      <StoryImageGenerationModal
        open={isImageSettingsModalOpen}
        onClose={() => setIsImageSettingsModalOpen(false)}
        onGenerate={handleGenerateImageWithSettings}
        initialPrompt={imagePromptDraft}
        sceneTitle={currentScene?.title || undefined}
        storyMode={state.storyMode}
        isGenerating={isGeneratingSceneImageReal}
      />
      <AudioScriptModal
        open={isAudioModalOpen}
        sceneNumber={currentSceneNumber}
        value={audioScriptDraft}
        onChange={setAudioScriptDraft}
        onClose={() => setIsAudioModalOpen(false)}
        onSave={() => {
          if (!hasScenes || !currentScene) { setIsAudioModalOpen(false); return; }
          const updated = [...scenes];
          updated[currentSceneIndex] = { ...updated[currentSceneIndex], audio_narration: audioScriptDraft };
          (state.setOutlineScenes as any)(updated);
          setIsAudioModalOpen(false);
        }}
        audioProvider={state.audioProvider}
        audioLang={state.audioLang}
        audioSlow={state.audioSlow}
        audioRate={state.audioRate}
        onChangeProvider={state.setAudioProvider}
        onChangeLang={state.setAudioLang}
        onChangeSlow={state.setAudioSlow}
        onChangeRate={state.setAudioRate}
        audioUrl={
          (state.sceneAudio && state.sceneAudio.get(currentSceneNumber)
            ? storyWriterApi.getAudioUrl(state.sceneAudio.get(currentSceneNumber) || '')
            : currentSceneAudioFullUrl) || null
        }
        onGenerateAI={async (params: {
          text: string;
          voice_id?: string;
          speed?: number;
          volume?: number;
          pitch?: number;
          emotion?: string;
        }) => {
          if (!hasScenes || !currentScene) return;
          setIsRegeneratingSceneAudio(true);
          try {
            const sceneNum = currentScene.scene_number || currentSceneIndex + 1;
            const sceneTitle = currentScene.title || `Scene ${sceneNum}`;
            
            const resp = await storyWriterApi.generateAIAudio({
              scene_number: sceneNum,
              scene_title: sceneTitle,
              text: params.text.trim(),
              voice_id: params.voice_id || 'Wise_Woman',
              speed: params.speed !== undefined ? params.speed : 1.0,
              volume: params.volume !== undefined ? params.volume : 1.0,
              pitch: params.pitch !== undefined ? params.pitch : 0.0,
              emotion: params.emotion || 'happy',
            });
            
            if (resp.success && resp.audio_url) {
              const nextMap = new Map(state.sceneAudio || []);
              nextMap.set(sceneNum, resp.audio_url);
              state.setSceneAudio(nextMap);
              
              // Update the scene with the new audio_narration if generation was successful
              const updated = [...scenes];
              updated[currentSceneIndex] = { ...updated[currentSceneIndex], audio_narration: params.text.trim() };
              (state.setOutlineScenes as any)(updated);
              setAudioScriptDraft(params.text.trim());
              
              // Close the modal after successful generation
              setIsAudioModalOpen(false);
            } else {
              throw new Error(resp.error || 'Failed to generate AI audio');
            }
          } catch (err: any) {
            console.error('Failed to generate AI audio:', err);
            throw err; // Re-throw to be handled by modal
          } finally {
            setIsRegeneratingSceneAudio(false);
          }
        }}
        onGenerateFree={async (text: string) => {
          if (!hasScenes || !currentScene) return;
          setIsRegeneratingSceneAudio(true);
          try {
            const sceneNum = currentScene.scene_number || currentSceneIndex + 1;
            const sceneTitle = currentScene.title || `Scene ${sceneNum}`;
            
            const resp = await storyWriterApi.generateFreeAudio({
              scene_number: sceneNum,
              scene_title: sceneTitle,
              text: text.trim(),
              provider: state.audioProvider || 'gtts',
              lang: state.audioLang || 'en',
              slow: state.audioSlow || false,
              rate: state.audioRate || 150,
            });
            
            if (resp.success && resp.audio_url) {
              const nextMap = new Map(state.sceneAudio || []);
              nextMap.set(sceneNum, resp.audio_url);
              state.setSceneAudio(nextMap);
              
              // Update the scene with the new audio_narration if generation was successful
              const updated = [...scenes];
              updated[currentSceneIndex] = { ...updated[currentSceneIndex], audio_narration: text.trim() };
              (state.setOutlineScenes as any)(updated);
              setAudioScriptDraft(text.trim());
              
              // Close the modal after successful generation
              setIsAudioModalOpen(false);
            } else {
              throw new Error(resp.error || 'Failed to generate free audio');
            }
          } catch (err: any) {
            console.error('Failed to generate free audio:', err);
            throw err; // Re-throw to be handled by modal
          } finally {
            setIsRegeneratingSceneAudio(false);
          }
        }}
      />
      <CharactersModal
        open={isCharactersModalOpen}
        sceneNumber={currentSceneNumber}
        characters={currentScene?.character_descriptions || []}
        onClose={() => setIsCharactersModalOpen(false)}
      />
      <KeyEventsModal
        open={isKeyEventsModalOpen}
        sceneNumber={currentSceneNumber}
        events={currentScene?.key_events || []}
        onClose={() => setIsKeyEventsModalOpen(false)}
      />
      <TitleEditModal
        open={isTitleModalOpen}
        sceneNumber={currentSceneNumber}
        value={titleDraft}
        onChange={setTitleDraft}
        onClose={() => setIsTitleModalOpen(false)}
        onSave={() => {
          if (!hasScenes || !currentScene) { setIsTitleModalOpen(false); return; }
          const updated = [...scenes];
          updated[currentSceneIndex] = { ...updated[currentSceneIndex], title: titleDraft };
          (state.setOutlineScenes as any)(updated);
          setIsTitleModalOpen(false);
        }}
      />
      <SceneImagesProgressModal
        open={isGeneratingImages}
        totalScenes={bulkImageProgress.total || undefined}
        completedScenes={bulkImageProgress.completed}
        failedScenes={bulkImageProgress.failed}
        currentSceneTitle={bulkImageProgress.currentTitle}
      />
      <SceneImageGenerationProgressModal
        open={isGeneratingSceneImageReal}
        sceneTitle={currentScene?.title}
      />
      <AudioGenerationProgressModal
        open={isGeneratingAudio}
        isBulk
      />
      </Box>
  );
};

export default StoryOutline;
