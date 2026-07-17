import { useCallback, useState } from 'react';
import { uploadLinkedInImage } from '../../../services/linkedInImageService';
import { validatePublishImageFile } from '../utils/linkedInPublishMediaUtils';
import {
  createEditorImageBlock,
  type LinkedInEditorImageBlock,
} from '../utils/linkedInEditorDraftUtils';
import { showToastNotification } from '../../../utils/toastNotifications';

interface UseLinkedInEditorImageUploadResult {
  isUploading: boolean;
  uploadError: string | null;
  uploadImageFile: (file: File) => Promise<LinkedInEditorImageBlock | null>;
  clearUploadError: () => void;
}

/** Upload a local image for the LinkedIn assistive editor. */
export function useLinkedInEditorImageUpload(): UseLinkedInEditorImageUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const clearUploadError = useCallback(() => {
    setUploadError(null);
  }, []);

  const uploadImageFile = useCallback(async (file: File): Promise<LinkedInEditorImageBlock | null> => {
    const validation = validatePublishImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid image file.');
      return null;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await uploadLinkedInImage(file);
      if (!result.success || !result.imageId || !result.imageUrl) {
        const message = result.error || 'Image upload failed';
        setUploadError(message);
        showToastNotification(message, 'error');
        return null;
      }

      showToastNotification('Image added to your post', 'success');
      return createEditorImageBlock(result.imageUrl, result.imageId, 'Post image');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image upload failed';
      setUploadError(message);
      showToastNotification(message, 'error');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    isUploading,
    uploadError,
    uploadImageFile,
    clearUploadError,
  };
}
