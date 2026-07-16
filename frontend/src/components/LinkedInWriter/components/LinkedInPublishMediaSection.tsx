import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as GenerateIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { useLinkedInPublishMedia } from '../hooks/useLinkedInPublishMedia';
import { useLinkedInSelectionImage } from '../hooks/useLinkedInSelectionImage';
import { LinkedInPublishMediaPreview } from './LinkedInPublishMediaPreview';
import { LinkedInSelectionImageModal } from './LinkedInSelectionImageModal';
import { readPrefs } from '../utils/linkedInWriterUtils';
import { buildPromptFromSelection } from '../../../services/linkedInImageService';
import { LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS } from '../utils/linkedInPublishMediaConstants';
import { formatDraftForPublish } from '../utils/linkedInPublishFormatters';

interface LinkedInPublishMediaSectionProps {
  draft: string;
  topic?: string;
  compact?: boolean;
  /** Optional external media hook — share state with parent publish handler. */
  media?: ReturnType<typeof useLinkedInPublishMedia>;
}

export const LinkedInPublishMediaSection: React.FC<LinkedInPublishMediaSectionProps> = ({
  draft,
  topic,
  compact = false,
  media: externalMedia,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const prefs = readPrefs();

  const internalMedia = useLinkedInPublishMedia({ draft, autoDetectFromDraft: true });
  const publishMedia = externalMedia ?? internalMedia;

  const selectionImage = useLinkedInSelectionImage({
    topic,
    industry: prefs.industry,
    onImageGenerated: (preview) => {
      if (preview.imageId && preview.imageUrl) {
        publishMedia.attachAiImage({
          imageId: preview.imageId,
          imageUrl: preview.imageUrl,
        });
      }
    },
  });

  const openAiGenerator = useCallback(() => {
    const plainText = formatDraftForPublish(draft);
    const seedText = plainText.trim().slice(0, 200) || 'LinkedIn post visual';
    selectionImage.openForDraft(seedText, buildPromptFromSelection(seedText, topic, prefs.industry));
  }, [draft, topic, prefs.industry, selectionImage]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        publishMedia.attachLocalFile(file);
      }
      event.target.value = '';
    },
    [publishMedia],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) {
        publishMedia.attachLocalFile(file);
      }
    },
    [publishMedia],
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <Box sx={{ mb: compact ? 1 : 1.5 }}>
      <Typography
        variant="caption"
        sx={{
          color: '#64748b',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          display: 'block',
          mb: 1,
        }}
      >
        Post image
      </Typography>

      {publishMedia.attachment ? (
        <LinkedInPublishMediaPreview
          attachment={publishMedia.attachment}
          onRemove={publishMedia.clearAttachment}
          compact={compact}
        />
      ) : (
        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          sx={{
            p: compact ? 1.25 : 1.5,
            borderRadius: 2,
            border: `1.5px dashed ${isDragOver ? '#0A66C2' : '#cbd5e1'}`,
            bgcolor: isDragOver ? '#f0f7ff' : '#f8fafc',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1 }}>
            Attach an image to publish with your post text.
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1} justifyContent="center">
            <Button
              size="small"
              variant="outlined"
              startIcon={<GenerateIcon />}
              onClick={openAiGenerator}
              disabled={selectionImage.isGenerating}
              sx={{
                textTransform: 'none',
                borderColor: '#0A66C2',
                color: '#0A66C2',
                '&:hover': { borderColor: '#004182', bgcolor: '#f0f7ff' },
              }}
            >
              Generate with AI
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none' }}
            >
              Upload image
            </Button>
          </Box>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 1 }}>
            or drag and drop · PNG, JPEG, GIF, WebP · max 8 MB
          </Typography>
        </Box>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {publishMedia.validationError && (
        <Alert severity="error" sx={{ mt: 1, py: 0 }}>
          {publishMedia.validationError}
        </Alert>
      )}

      <LinkedInSelectionImageModal
        open={selectionImage.modalOpen}
        onClose={selectionImage.closeModal}
        onGenerate={selectionImage.handleGenerate}
        initialPrompt={selectionImage.initialPrompt}
        isGenerating={selectionImage.isGenerating}
        generatedPreview={selectionImage.generatedPreview}
        onClosePreview={selectionImage.closePreview}
      />
    </Box>
  );
};
