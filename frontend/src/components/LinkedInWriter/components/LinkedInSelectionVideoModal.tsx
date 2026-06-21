/**
 * LinkedIn Selection Video Modal
 *
 * Wrapper around the shared VideoGenerationModal with LinkedIn presets,
 * generation loader, and result preview dialog after successful generation.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Link,
  Chip,
} from '@mui/material';
import {
  VideoGenerationModal,
  VideoGenerationSettings as SharedVideoGenerationSettings,
} from '../../shared/VideoGenerationModal';
import {
  LINKEDIN_VIDEO_PRESETS,
  LINKEDIN_VIDEO_THEME,
  LINKEDIN_VIDEO_RECOMMENDATIONS,
} from '../../shared/VideoGenerationPresets';
import { VideoGenerationLoader } from '../../shared/VideoGenerationLoader';
import { downloadLinkedInVideoBlob } from '../../../services/linkedInVideoService';
import type {
  VideoAspectRatio,
  VideoResolution,
  VideoDuration,
  VideoMotionPreset,
  LinkedInVideoModel,
} from '../../shared/VideoGenerationModal.types';

export interface LinkedInVideoGenerationSettings {
  prompt: string;
  aspectRatio: VideoAspectRatio;
  duration: VideoDuration;
  resolution: VideoResolution;
  motion: VideoMotionPreset;
  model: LinkedInVideoModel;
}

export interface GeneratedLinkedInVideoPreview {
  blobUrl: string;
  videoUrl: string;
  videoId?: string;
  assetId?: number;
  storagePath?: string;
  assetLibraryPath?: string;
}

interface LinkedInSelectionVideoModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (settings: LinkedInVideoGenerationSettings) => void;
  initialPrompt: string;
  isGenerating?: boolean;
  generatedPreview?: GeneratedLinkedInVideoPreview | null;
  onClosePreview?: () => void;
}

export const LinkedInSelectionVideoModal: React.FC<LinkedInSelectionVideoModalProps> = ({
  open,
  onClose,
  onGenerate,
  initialPrompt,
  isGenerating = false,
  generatedPreview,
  onClosePreview,
}) => {
  const navigate = useNavigate();

  const handleDownload = () => {
    if (!generatedPreview?.blobUrl) return;
    const filename = `linkedin_video_${generatedPreview.videoId || 'generated'}.mp4`;
    downloadLinkedInVideoBlob(generatedPreview.blobUrl, filename);
  };

  const toLinkedInVideoModel = (value?: string): LinkedInVideoModel => {
    if (
      value === 'hunyuan-video-1.5' ||
      value === 'ltx-2-pro' ||
      value === 'veo3.1'
    ) {
      return value;
    }
    return 'hunyuan-video-1.5';
  };

  const handleGenerate = (settings: SharedVideoGenerationSettings) => {
    onGenerate({
      prompt: settings.prompt,
      aspectRatio: settings.aspectRatio,
      duration: settings.duration,
      resolution: settings.resolution,
      motion: settings.motion,
      model: toLinkedInVideoModel(settings.model),
    });
  };

  if (generatedPreview) {
    return (
      <Dialog open={open} onClose={onClosePreview || onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#0A66C2', fontWeight: 600 }}>
          Video Generated Successfully
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Box
              component="video"
              src={generatedPreview.blobUrl}
              controls
              sx={{
                maxWidth: '100%',
                maxHeight: 360,
                borderRadius: 2,
                border: '1px solid #e0e0e0',
                mb: 2,
                backgroundColor: '#000',
              }}
            />
            <Chip
              label="Saved to asset library"
              color="success"
              size="small"
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your LinkedIn-optimized video is ready.
            </Typography>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleDownload}
              sx={{ mb: 2 }}
            >
              Download video
            </Button>
            <Box
              sx={{
                textAlign: 'left',
                mt: 1,
                p: 1.5,
                borderRadius: 1,
                backgroundColor: 'action.hover',
              }}
            >
              {generatedPreview.assetId != null && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  <strong>Asset library ID:</strong> {generatedPreview.assetId}
                </Typography>
              )}
              {generatedPreview.assetLibraryPath && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  <strong>Asset library:</strong>{' '}
                  <Link
                    component="button"
                    type="button"
                    onClick={() => navigate(generatedPreview.assetLibraryPath!)}
                    sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}
                  >
                    {generatedPreview.assetLibraryPath}
                  </Link>
                </Typography>
              )}
              {generatedPreview.storagePath && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ wordBreak: 'break-all', mb: 0.5 }}>
                  <strong>Storage path:</strong> {generatedPreview.storagePath}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ wordBreak: 'break-all' }}>
                <strong>API URL:</strong> {generatedPreview.videoUrl}
              </Typography>
            </Box>
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

  if (isGenerating) {
    return (
      <Dialog open={open} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#0A66C2', fontWeight: 600 }}>
          Generating LinkedIn Video
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <VideoGenerationLoader />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              Video generation may take 1–3 minutes. Please keep this window open.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <VideoGenerationModal
      open={open}
      onClose={onClose}
      onGenerate={handleGenerate}
      initialPrompt={initialPrompt}
      isGenerating={isGenerating}
      title="Generate LinkedIn Video"
      promptLabel="Video Prompt"
      promptHelp="Describe the video you want for your LinkedIn post. The selected text is used as context — refine the prompt for best results."
      generateButtonLabel="Generate Video"
      presets={LINKEDIN_VIDEO_PRESETS}
      presetsLabel="LinkedIn-ready presets"
      presetsHelp="Each preset adjusts format, duration, resolution, and motion only — not your prompt."
      showModelSelection={true}
      defaultModel="hunyuan-video-1.5"
      defaultAspectRatio="16:9"
      defaultDuration={5}
      defaultResolution="720p"
      defaultMotion="Medium"
      theme={LINKEDIN_VIDEO_THEME}
      recommendations={LINKEDIN_VIDEO_RECOMMENDATIONS}
    />
  );
};
