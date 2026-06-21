import { useState, useCallback, useRef, useEffect } from 'react';
import { usePolling } from '../../../hooks/usePolling';
import { showToastNotification } from '../../../utils/toastNotifications';
import {
  buildVideoPromptFromSelection,
  generateLinkedInVideo,
  pollLinkedInVideoTask,
  fetchLinkedInVideoBlobUrl,
  resolveLinkedInVideoUrl,
  buildLinkedInAssetLibraryUrl,
  type LinkedInVideoTaskResult,
} from '../../../services/linkedInVideoService';
import type {
  LinkedInVideoGenerationSettings,
  GeneratedLinkedInVideoPreview,
} from '../components/LinkedInSelectionVideoModal';

interface UseLinkedInSelectionVideoOptions {
  topic?: string;
  industry?: string;
}

export function useLinkedInSelectionVideo({
  topic,
  industry,
}: UseLinkedInSelectionVideoOptions) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPreview, setGeneratedPreview] =
    useState<GeneratedLinkedInVideoPreview | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const pendingSettingsRef = useRef<LinkedInVideoGenerationSettings | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const handlePollComplete = useCallback(
    async (result: LinkedInVideoTaskResult) => {
      try {
        const videoId = result.video_id;
        const videoUrl =
          result.video_url || (videoId ? resolveLinkedInVideoUrl(videoId) : undefined);

        if (!videoUrl) {
          showToastNotification('Video generated but URL was not returned', 'error');
          setIsGenerating(false);
          return;
        }

        const assetLibraryPath =
          result.asset_library_path || buildLinkedInAssetLibraryUrl();

        console.log('[LinkedInSelectionVideo] Generated video:', {
          videoId,
          videoUrl,
          assetId: result.asset_id,
          storagePath: result.storage_path,
          assetLibraryPath,
        });

        let blobUrl = videoUrl;
        if (videoId) {
          blobUrl = await fetchLinkedInVideoBlobUrl(videoId);
        }

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = blobUrl;

        setGeneratedPreview({
          blobUrl,
          videoUrl,
          videoId,
          assetId: result.asset_id,
          storagePath: result.storage_path,
          assetLibraryPath,
        });

        const assetMsg = result.asset_id
          ? ` Saved to asset library (ID: ${result.asset_id}).`
          : '';
        showToastNotification(`Video generated successfully.${assetMsg}`, 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load generated video';
        showToastNotification(message, 'error');
      } finally {
        setIsGenerating(false);
        pendingSettingsRef.current = null;
      }
    },
    []
  );

  const handlePollError = useCallback((error: string) => {
    showToastNotification(error || 'Video generation failed', 'error');
    setIsGenerating(false);
    pendingSettingsRef.current = null;
  }, []);

  const { startPolling, stopPolling } = usePolling(pollLinkedInVideoTask, {
    onComplete: handlePollComplete,
    onError: handlePollError,
  });

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const openForSelection = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      setSelectedText(trimmed);
      setInitialPrompt(buildVideoPromptFromSelection(trimmed, topic, industry));
      setGeneratedPreview(null);
      setModalOpen(true);
    },
    [topic, industry]
  );

  const closeModal = useCallback(() => {
    if (isGenerating) return;
    stopPolling();
    setModalOpen(false);
    setSelectedText('');
    setInitialPrompt('');
  }, [isGenerating, stopPolling]);

  const closePreview = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setGeneratedPreview(null);
    setModalOpen(false);
    setSelectedText('');
    setInitialPrompt('');
  }, []);

  const handleGenerate = useCallback(
    async (settings: LinkedInVideoGenerationSettings) => {
      setIsGenerating(true);
      pendingSettingsRef.current = settings;

      try {
        const result = await generateLinkedInVideo({
          prompt: settings.prompt,
          selectedText,
          topic,
          industry,
          aspectRatio: settings.aspectRatio,
          duration: settings.duration,
          resolution: settings.resolution,
          motion: settings.motion,
          model: settings.model,
        });

        if (!result.success || !result.taskId) {
          showToastNotification(result.error || 'Video generation failed to start', 'error');
          setIsGenerating(false);
          return;
        }

        startPolling(result.taskId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Video generation failed';
        showToastNotification(message, 'error');
        setIsGenerating(false);
      }
    },
    [selectedText, topic, industry, startPolling]
  );

  return {
    modalOpen,
    initialPrompt,
    isGenerating,
    generatedPreview,
    openForSelection,
    closeModal,
    closePreview,
    handleGenerate,
  };
}
