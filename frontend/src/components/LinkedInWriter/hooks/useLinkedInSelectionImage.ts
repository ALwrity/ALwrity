import { useState, useCallback, useRef, useEffect } from 'react';
import { showToastNotification } from '../../../utils/toastNotifications';
import {
  buildPromptFromSelection,
  generateLinkedInImage,
  fetchLinkedInImageBlobUrl,
  resolveLinkedInImageUrl,
} from '../../../services/linkedInImageService';
import type {
  LinkedInImageGenerationSettings,
  GeneratedLinkedInImagePreview,
} from '../components/LinkedInSelectionImageModal';

interface UseLinkedInSelectionImageOptions {
  topic?: string;
  industry?: string;
  onInsertImage?: (imageUrl: string) => void;
  /** Called after a successful generation (publish flow attaches without draft insert). */
  onImageGenerated?: (preview: GeneratedLinkedInImagePreview) => void;
}

export function useLinkedInSelectionImage({
  topic,
  industry,
  onInsertImage,
  onImageGenerated,
}: UseLinkedInSelectionImageOptions) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPreview, setGeneratedPreview] =
    useState<GeneratedLinkedInImagePreview | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const openForSelection = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      setSelectedText(trimmed);
      setInitialPrompt(buildPromptFromSelection(trimmed, topic, industry));
      setGeneratedPreview(null);
      setModalOpen(true);
    },
    [topic, industry]
  );

  const openForDraft = useCallback(
    (seedText: string, prompt?: string) => {
      const trimmed = seedText.trim();
      setSelectedText(trimmed);
      setInitialPrompt(prompt || buildPromptFromSelection(trimmed, topic, industry));
      setGeneratedPreview(null);
      setModalOpen(true);
    },
    [topic, industry]
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedText('');
    setInitialPrompt('');
  }, []);

  const closePreview = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setGeneratedPreview(null);
    closeModal();
  }, [closeModal]);

  const handleGenerate = useCallback(
    async (settings: LinkedInImageGenerationSettings) => {
      setIsGenerating(true);
      try {
        const result = await generateLinkedInImage({
          prompt: settings.prompt,
          selectedText,
          topic,
          industry,
          style: settings.style,
          aspectRatio: settings.aspectRatio,
          model: settings.model,
        });

        if (!result.success || !result.imageId) {
          showToastNotification(result.error || 'Image generation failed', 'error');
          return;
        }

        const imageUrl = result.imageUrl || resolveLinkedInImageUrl(result.imageId);
        console.log('[LinkedInSelectionImage] Generated image URL:', imageUrl);

        const blobUrl = await fetchLinkedInImageBlobUrl(result.imageId);
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = blobUrl;

        setGeneratedPreview({
          blobUrl,
          imageUrl,
          imageId: result.imageId,
        });

        const preview = {
          blobUrl,
          imageUrl,
          imageId: result.imageId,
        };

        if (onInsertImage) {
          onInsertImage(imageUrl);
        }

        onImageGenerated?.(preview);

        showToastNotification(
          onInsertImage ? 'Image added to your post' : 'Image generated successfully',
          'success',
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Image generation failed';
        showToastNotification(message, 'error');
      } finally {
        setIsGenerating(false);
      }
    },
    [selectedText, topic, industry, onInsertImage, onImageGenerated]
  );

  return {
    modalOpen,
    initialPrompt,
    isGenerating,
    generatedPreview,
    openForSelection,
    openForDraft,
    closeModal,
    closePreview,
    handleGenerate,
  };
}
