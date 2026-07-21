import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Badge,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useStoryWriterState } from '../../../hooks/useStoryWriterState';

interface MultimediaToolbarProps {
  state: ReturnType<typeof useStoryWriterState>;
  onGenerateAudio?: () => void;
  onGenerateVideo?: () => void;
  isGeneratingAudio?: boolean;
  isGeneratingVideo?: boolean;
  onOpenPanel?: (section: 'audio' | 'video') => void;
  colorMode?: 'light' | 'dark';
}

export const MultimediaToolbar: React.FC<MultimediaToolbarProps> = ({
  state,
  onGenerateAudio,
  onGenerateVideo,
  isGeneratingAudio = false,
  isGeneratingVideo = false,
  onOpenPanel,
  colorMode = 'dark',
}) => {
  const isLight = colorMode === 'light';
  const hasScenes = state.isOutlineStructured && state.outlineScenes && state.outlineScenes.length > 0;
  const hasAudio = state.enableNarration && state.sceneAudio && state.sceneAudio.size > 0;
  const hasVideo = state.enableVideoNarration && !!state.storyVideo;
  const hasImages = state.sceneImages && state.sceneImages.size > 0;

  const audioFeatureEnabled = state.enableNarration;
  const videoFeatureEnabled = state.enableVideoNarration;
  const canGenerateAudio = hasScenes && audioFeatureEnabled && !isGeneratingAudio;
  const canGenerateVideo = hasScenes && videoFeatureEnabled && hasImages && hasAudio && !isGeneratingVideo;

  const audioStatus = hasAudio ? 'success' : isGeneratingAudio ? 'loading' : 'idle';
  const videoStatus = hasVideo ? 'success' : isGeneratingVideo ? 'loading' : canGenerateVideo ? 'ready' : 'disabled';

  const [audioMenuAnchor, setAudioMenuAnchor] = useState<null | HTMLElement>(null);
  const [videoMenuAnchor, setVideoMenuAnchor] = useState<null | HTMLElement>(null);

  const handleAudioMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAudioMenuAnchor(event.currentTarget);
  };

  const handleAudioMenuClose = () => {
    setAudioMenuAnchor(null);
  };

  const handleVideoMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setVideoMenuAnchor(event.currentTarget);
  };

  const handleVideoMenuClose = () => {
    setVideoMenuAnchor(null);
  };

  const handleOpenPanel = (section: 'audio' | 'video') => {
    handleAudioMenuClose();
    handleVideoMenuClose();
    onOpenPanel?.(section);
  };

  const iconBtnSx = isLight ? {
    color: '#5D4037',
    backgroundColor: 'rgba(93, 64, 55, 0.08)',
    '&:hover': {
      backgroundColor: 'rgba(93, 64, 55, 0.15)',
      color: '#3E2723',
    },
    '&:disabled': {
      color: '#C4B8A8',
      backgroundColor: 'rgba(93, 64, 55, 0.04)',
    },
  } : {
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      color: 'white',
    },
    '&:disabled': {
      color: 'rgba(255, 255, 255, 0.4)',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {/* Audio Generation Button */}
      <Tooltip
        title={
          !audioFeatureEnabled
            ? 'Enable Narration in Story Setup'
            : !hasScenes
            ? 'Generate outline first'
            : hasAudio
            ? 'Audio generated ✓'
            : isGeneratingAudio
            ? 'Generating audio...'
            : 'Generate audio narration'
        }
      >
        <span>
          <IconButton
            onClick={handleAudioMenuOpen}
            disabled={!hasScenes || !audioFeatureEnabled}
            sx={iconBtnSx}
            size="small"
          >
            {isGeneratingAudio ? (
              <CircularProgress size={18} sx={{ color: isLight ? '#5D4037' : 'rgba(255, 255, 255, 0.9)' }} />
            ) : hasAudio ? (
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <CheckCircleIcon sx={{ fontSize: 11, color: '#4caf50' }} />
                }
              >
                <VolumeUpIcon sx={{ fontSize: 18 }} />
              </Badge>
            ) : (
              <VolumeUpIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={audioMenuAnchor}
        open={Boolean(audioMenuAnchor)}
        onClose={handleAudioMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => handleOpenPanel('audio')} disabled={!hasScenes || !audioFeatureEnabled}>
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Listen & manage audio" />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleAudioMenuClose();
            onGenerateAudio?.();
          }}
          disabled={!canGenerateAudio || !onGenerateAudio}
        >
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={hasAudio ? 'Regenerate audio' : 'Generate audio for all scenes'}
          />
        </MenuItem>
      </Menu>

      {/* Video Generation Button */}
      <Tooltip
        title={
          !videoFeatureEnabled
            ? 'Enable Story Video in Story Setup'
            : !hasScenes
            ? 'Generate outline first'
            : !hasImages
            ? 'Generate images first'
            : !hasAudio
            ? 'Generate audio first'
            : hasVideo
            ? 'Video generated ✓'
            : isGeneratingVideo
            ? 'Generating video...'
            : 'Generate video'
        }
      >
        <span>
          <IconButton
            onClick={handleVideoMenuOpen}
            disabled={!hasScenes || !videoFeatureEnabled}
            sx={iconBtnSx}
            size="small"
          >
            {isGeneratingVideo ? (
              <CircularProgress size={18} sx={{ color: isLight ? '#5D4037' : 'rgba(255, 255, 255, 0.9)' }} />
            ) : hasVideo ? (
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <CheckCircleIcon sx={{ fontSize: 11, color: '#4caf50' }} />
                }
              >
                <VideoLibraryIcon sx={{ fontSize: 18 }} />
              </Badge>
            ) : (
              <VideoLibraryIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={videoMenuAnchor}
        open={Boolean(videoMenuAnchor)}
        onClose={handleVideoMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => handleOpenPanel('video')} disabled={!hasScenes || !videoFeatureEnabled}>
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="View video options" />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleVideoMenuClose();
            onGenerateVideo?.();
          }}
          disabled={!canGenerateVideo || !onGenerateVideo}
        >
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={hasVideo ? 'Regenerate video' : 'Generate video'}
          />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MultimediaToolbar;
