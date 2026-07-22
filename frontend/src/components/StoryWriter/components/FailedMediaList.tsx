import React from 'react';
import {
  Box,
  Alert,
  Button,
  Chip,
  Typography,
  CircularProgress,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import RefreshIcon from '@mui/icons-material/Refresh';

interface FailedSceneMedia {
  sceneNumber: number;
  sceneTitle?: string;
  hasImage: boolean;
  hasAudio: boolean;
}

interface FailedMediaListProps {
  failedScenes: FailedSceneMedia[];
  onRetryAllImages?: () => void;
  onRetryAllAudio?: () => void;
  onRetryScene?: (sceneNumber: number, type: 'image' | 'audio') => void;
  isRetryingImages?: boolean;
  isRetryingAudio?: boolean;
  onClear?: () => void;
}

const FailedMediaList: React.FC<FailedMediaListProps> = ({
  failedScenes,
  onRetryAllImages,
  onRetryAllAudio,
  onRetryScene,
  isRetryingImages,
  isRetryingAudio,
  onClear,
}) => {
  if (failedScenes.length === 0) return null;

  const failedImageCount = failedScenes.filter((s) => s.hasImage).length;
  const failedAudioCount = failedScenes.filter((s) => s.hasAudio).length;

  return (
    <Alert
      severity="warning"
      sx={{ mb: 3 }}
      action={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {failedImageCount > 0 && onRetryAllImages && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={isRetryingImages ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={onRetryAllImages}
              disabled={isRetryingImages}
            >
              Retry {failedImageCount} image{failedImageCount !== 1 ? 's' : ''}
            </Button>
          )}
          {failedAudioCount > 0 && onRetryAllAudio && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={isRetryingAudio ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={onRetryAllAudio}
              disabled={isRetryingAudio}
            >
              Retry {failedAudioCount} audio{failedAudioCount !== 1 ? 's' : ''}
            </Button>
          )}
          {onClear && (
            <Button size="small" variant="text" onClick={onClear}>
              Dismiss
            </Button>
          )}
        </Box>
      }
    >
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {failedImageCount > 0 && failedAudioCount > 0
          ? `${failedImageCount} image${failedImageCount !== 1 ? 's' : ''} and ${failedAudioCount} audio file${failedAudioCount !== 1 ? 's' : ''} failed to generate.`
          : failedImageCount > 0
          ? `${failedImageCount} scene image${failedImageCount !== 1 ? 's' : ''} failed to generate.`
          : `${failedAudioCount} scene audio${failedAudioCount !== 1 ? 's' : ''} failed to generate.`}
      </Typography>
      {failedScenes.length <= 5 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {failedScenes.map((scene) => (
            <Chip
              key={scene.sceneNumber}
              size="small"
              label={scene.sceneTitle || `Scene ${scene.sceneNumber}`}
              icon={scene.hasImage ? <ImageIcon /> : <AudiotrackIcon />}
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
              onClick={() => {
                if (scene.hasImage && onRetryScene) onRetryScene(scene.sceneNumber, 'image');
                if (scene.hasAudio && onRetryScene) onRetryScene(scene.sceneNumber, 'audio');
              }}
            />
          ))}
        </Box>
      )}
    </Alert>
  );
};

export default FailedMediaList;
export type { FailedSceneMedia };
