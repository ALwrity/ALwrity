/**
 * Scene Preview Modal
 *
 * Shows a preview of scene video, image, and audio with playback controls.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Stack,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Pause from '@mui/icons-material/Pause';
import VolumeUp from '@mui/icons-material/VolumeUp';
import { fetchMediaBlobUrl } from '../../../utils/fetchMediaBlobUrl';
import { useAuthenticatedMediaSrc } from '../hooks/useAuthenticatedMediaSrc';

interface ScenePreviewModalProps {
  open: boolean;
  onClose: () => void;
  sceneTitle: string;
  sceneNumber: number;
  imageUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
}

export const ScenePreviewModal: React.FC<ScenePreviewModalProps> = ({
  open,
  onClose,
  sceneTitle,
  sceneNumber,
  imageUrl,
  audioUrl,
  videoUrl,
}) => {
  const {
    src: videoSrc,
    loading: videoLoading,
    error: videoError,
  } = useAuthenticatedMediaSrc(videoUrl, open);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Load image blob
  useEffect(() => {
    let cancelled = false;

    async function loadImage(): Promise<void> {
      if (!imageUrl || !open) {
        setImageBlobUrl(null);
        return;
      }

      setImageLoading(true);
      console.info('[ScenePreviewModal] Loading scene image', {
        sceneNumber,
        url: imageUrl.split('?')[0],
      });
      try {
        const blobUrl = await fetchMediaBlobUrl(imageUrl);
        if (cancelled) {
          return;
        }
        setImageBlobUrl(blobUrl);
        if (!blobUrl) {
          console.warn('[ScenePreviewModal] Scene image blob was empty', {
            sceneNumber,
            url: imageUrl.split('?')[0],
          });
        }
      } catch (error) {
        console.error('[ScenePreviewModal] Failed to load scene image', {
          sceneNumber,
          url: imageUrl.split('?')[0],
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setImageBlobUrl(null);
        }
      } finally {
        if (!cancelled) {
          setImageLoading(false);
        }
      }
    }

    loadImage().catch((error) => {
      console.error('[ScenePreviewModal] Unhandled image load error', {
        sceneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, open, sceneNumber]);

  // Load audio blob
  useEffect(() => {
    let cancelled = false;

    async function loadAudio(): Promise<void> {
      if (!audioUrl || !open) {
        setAudioBlobUrl(null);
        return;
      }

      setAudioLoading(true);
      console.info('[ScenePreviewModal] Loading scene audio', {
        sceneNumber,
        url: audioUrl.split('?')[0],
      });
      try {
        const blobUrl = await fetchMediaBlobUrl(audioUrl);
        if (cancelled) {
          return;
        }
        setAudioBlobUrl(blobUrl);
        if (!blobUrl) {
          console.warn('[ScenePreviewModal] Scene audio blob was empty', {
            sceneNumber,
            url: audioUrl.split('?')[0],
          });
        }
      } catch (error) {
        console.error('[ScenePreviewModal] Failed to load scene audio', {
          sceneNumber,
          url: audioUrl.split('?')[0],
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) {
          setAudioBlobUrl(null);
        }
      } finally {
        if (!cancelled) {
          setAudioLoading(false);
        }
      }
    }

    loadAudio().catch((error) => {
      console.error('[ScenePreviewModal] Unhandled audio load error', {
        sceneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [audioUrl, open, sceneNumber]);

  // Create audio element
  useEffect(() => {
    if (audioBlobUrl) {
      const audio = new Audio(audioBlobUrl);
      audio.addEventListener('ended', () => setIsPlaying(false));
      setAudioElement(audio);
      return () => {
        audio.pause();
        audio.remove();
      };
    }
  }, [audioBlobUrl]);

  const togglePlayPause = () => {
    if (!audioElement) {
      console.warn('[ScenePreviewModal] Play skipped: audio element is not ready', { sceneNumber });
      return;
    }

    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
      return;
    }

    audioElement
      .play()
      .then(() => setIsPlaying(true))
      .catch((error) => {
        console.error('[ScenePreviewModal] Failed to play scene audio', {
          sceneNumber,
          error: error instanceof Error ? error.message : String(error),
        });
        setIsPlaying(false);
      });
  };

  const handleClose = () => {
    if (audioElement) {
      audioElement.pause();
      setIsPlaying(false);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#f8fafc',
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Scene {sceneNumber} Preview
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              {sceneTitle}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {videoUrl && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: '#475569' }}>
                Scene Video
              </Typography>
              {videoLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : videoSrc ? (
                <Box
                  sx={{
                    width: '100%',
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: '#000',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <video
                    controls
                    src={videoSrc}
                    style={{ width: '100%', display: 'block', maxHeight: 420 }}
                  >
                    Your browser does not support video playback.
                  </video>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {videoError || 'Failed to load video'}
                </Typography>
              )}
            </Box>
          )}

          {/* Image Preview */}
          {imageUrl && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: '#475569' }}>
                🖼️ Scene Image
              </Typography>
              {imageLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : imageBlobUrl ? (
                <Box
                  component="img"
                  src={imageBlobUrl}
                  alt={sceneTitle}
                  sx={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: 2,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Failed to load image
                </Typography>
              )}
            </Box>
          )}

          {/* Audio Preview */}
          {audioUrl && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: '#475569' }}>
                🎤 Scene Audio
              </Typography>
              {audioLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : audioBlobUrl ? (
                <Box
                  sx={{
                    p: 3,
                    bgcolor: 'white',
                    borderRadius: 2,
                    border: '2px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <IconButton
                    onClick={togglePlayPause}
                    disabled={!audioElement}
                    sx={{
                      bgcolor: '#667eea',
                      color: 'white',
                      '&:hover': {
                        bgcolor: '#5568d3',
                      },
                      '&:disabled': {
                        bgcolor: '#cbd5e1',
                      },
                    }}
                  >
                    {isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      {isPlaying ? 'Playing...' : 'Click to play audio'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Scene narration audio
                    </Typography>
                  </Box>
                  <VolumeUp sx={{ color: '#94a3b8' }} />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Failed to load audio
                </Typography>
              )}
            </Box>
          )}

          {!imageUrl && !audioUrl && !videoUrl && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 3 }}>
              No assets available for preview
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

