/**
 * Per-scene video actions on the YouTube render step.
 *
 * Matches podcast SceneActionButtons: preview, download, generate/retry.
 */

import React, { useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import Download from '@mui/icons-material/Download';
import Visibility from '@mui/icons-material/Visibility';
import { Scene } from '../../../services/youtubeApi';
import { downloadMediaBlob } from '../../../utils/fetchMediaBlobUrl';

interface SceneVideoActionsProps {
  scene: Scene;
  running: boolean;
  failed: boolean;
  completed: boolean;
  hasAssets: boolean;
  progress: number;
  onPreview: () => void;
  onGenerate: () => void;
  onError?: (message: string) => void;
}

export const SceneVideoActions: React.FC<SceneVideoActionsProps> = ({
  scene,
  running,
  failed,
  completed,
  hasAssets,
  progress,
  onPreview,
  onGenerate,
  onError,
}) => {
  const [downloading, setDownloading] = useState(false);
  const videoUrl = scene.videoUrl;
  const canPreview = hasAssets || Boolean(videoUrl);

  const handleDownload = async (): Promise<void> => {
    if (!videoUrl) {
      console.warn('[SceneVideoActions] Download skipped: scene has no videoUrl', {
        sceneNumber: scene.scene_number,
      });
      onError?.('Scene video is not ready to download yet.');
      return;
    }

    setDownloading(true);
    console.info('[SceneVideoActions] Starting scene video download', {
      sceneNumber: scene.scene_number,
      url: videoUrl.split('?')[0],
    });
    try {
      await downloadMediaBlob(videoUrl, `youtube-scene-${scene.scene_number}-${Date.now()}.mp4`);
      console.info('[SceneVideoActions] Scene video download started', {
        sceneNumber: scene.scene_number,
      });
    } catch (error) {
      console.error('[SceneVideoActions] Scene video download failed', {
        sceneNumber: scene.scene_number,
        url: videoUrl.split('?')[0],
        error: error instanceof Error ? error.message : String(error),
      });
      onError?.('Download failed. Please retry in a moment.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {running && progress > 0 && progress < 100 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress
            size={32}
            variant="determinate"
            value={Math.min(100, progress)}
            sx={{ color: '#667eea' }}
          />
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
            {Math.round(progress)}%
          </Typography>
        </Box>
      )}
      {canPreview && (
        <Tooltip title={videoUrl ? 'Preview scene video' : 'Preview scene assets'} arrow>
          <IconButton
            size="small"
            onClick={onPreview}
            aria-label={`Preview scene ${scene.scene_number}`}
            sx={{
              color: '#667eea',
              '&:hover': {
                bgcolor: '#eff6ff',
              },
            }}
          >
            <Visibility />
          </IconButton>
        </Tooltip>
      )}
      {videoUrl && (
        <Tooltip title="Download scene video" arrow>
          <span>
            <IconButton
              size="small"
              onClick={handleDownload}
              disabled={downloading}
              aria-label={`Download scene ${scene.scene_number} video`}
              sx={{
                color: '#059669',
                '&:hover': {
                  bgcolor: '#ecfdf5',
                },
              }}
            >
              {downloading ? <CircularProgress size={18} /> : <Download />}
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Button
        variant={completed ? 'outlined' : 'contained'}
        color={completed ? 'success' : 'primary'}
        onClick={onGenerate}
        disabled={!hasAssets || running}
        startIcon={running ? <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
        sx={{
          textTransform: 'none',
          fontWeight: 700,
          minWidth: 120,
          px: 2.5,
        }}
      >
        {running ? 'Generating' : failed ? 'Retry Video' : completed ? 'Regenerate' : 'Generate Video'}
      </Button>
    </Stack>
  );
};
