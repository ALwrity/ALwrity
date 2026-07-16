import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeneratedLinkedInImagePreview } from '../components/LinkedInSelectionImageModal';
import {
  getLastDraftImageForPublish,
  validatePublishImageFile,
  type LinkedInPublishMediaAttachment,
} from '../utils/linkedInPublishMediaUtils';

export type LinkedInPublishMediaStatus = 'idle' | 'attached' | 'publishing';

interface UseLinkedInPublishMediaOptions {
  draft?: string;
  /** When true, auto-detect the last draft image on mount and when draft changes. */
  autoDetectFromDraft?: boolean;
}

export function useLinkedInPublishMedia({
  draft = '',
  autoDetectFromDraft = true,
}: UseLinkedInPublishMediaOptions = {}) {
  const [status, setStatus] = useState<LinkedInPublishMediaStatus>('idle');
  const [attachment, setAttachment] = useState<LinkedInPublishMediaAttachment | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const uploadPreviewUrlRef = useRef<string | null>(null);
  const userClearedRef = useRef(false);

  const revokeUploadPreview = useCallback(() => {
    if (uploadPreviewUrlRef.current) {
      URL.revokeObjectURL(uploadPreviewUrlRef.current);
      uploadPreviewUrlRef.current = null;
    }
  }, []);

  const clearAttachment = useCallback(() => {
    revokeUploadPreview();
    setAttachment(null);
    setValidationError(null);
    setStatus('idle');
    userClearedRef.current = true;
  }, [revokeUploadPreview]);

  const attachAiImage = useCallback(
    (preview: Pick<GeneratedLinkedInImagePreview, 'imageId' | 'imageUrl'> & { alt?: string }) => {
      if (!preview.imageId || !preview.imageUrl) return;

      revokeUploadPreview();
      setValidationError(null);
      setAttachment({
        source: 'ai',
        imageId: preview.imageId,
        imageUrl: preview.imageUrl,
        alt: preview.alt || 'Generated LinkedIn image',
      });
      setStatus('attached');
      userClearedRef.current = false;
    },
    [revokeUploadPreview],
  );

  const attachLocalFile = useCallback(
    (file: File) => {
      const validation = validatePublishImageFile(file);
      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid image file.');
        return false;
      }

      revokeUploadPreview();
      const previewUrl = URL.createObjectURL(file);
      uploadPreviewUrlRef.current = previewUrl;

      setValidationError(null);
      setAttachment({
        source: 'upload',
        localFile: file,
        previewUrl,
        fileName: file.name,
      });
      setStatus('attached');
      userClearedRef.current = false;
      return true;
    },
    [revokeUploadPreview],
  );

  const beginPublishing = useCallback(() => {
    setStatus('publishing');
  }, []);

  const endPublishing = useCallback(() => {
    setStatus(attachment ? 'attached' : 'idle');
  }, [attachment]);

  const reset = useCallback(() => {
    userClearedRef.current = false;
    revokeUploadPreview();
    setAttachment(null);
    setValidationError(null);
    setStatus('idle');
  }, [revokeUploadPreview]);

  useEffect(() => {
    if (!autoDetectFromDraft || userClearedRef.current) return;

    const detected = getLastDraftImageForPublish(draft);
    if (!detected) return;

    setAttachment((current) => {
      if (current?.source === 'upload') return current;
      if (
        current?.source === 'ai' &&
        current.imageId === detected.imageId
      ) {
        return current;
      }
      return detected;
    });
    setStatus('attached');
  }, [draft, autoDetectFromDraft]);

  useEffect(() => {
    return () => {
      revokeUploadPreview();
    };
  }, [revokeUploadPreview]);

  return {
    status,
    attachment,
    validationError,
    hasAttachment: attachment !== null,
    resolve: () => {
      if (!attachment) {
        return { source: 'none' as const };
      }
      if (attachment.source === 'ai') {
        return { source: 'ai' as const, imageId: attachment.imageId };
      }
      return { source: 'upload' as const, localFile: attachment.localFile };
    },
    attachAiImage,
    attachLocalFile,
    clearAttachment,
    beginPublishing,
    endPublishing,
    reset,
    setValidationError,
  };
}
