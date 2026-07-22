import React from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  alpha,
} from '@mui/material';
import VideoLibrary from '@mui/icons-material/VideoLibrary';
import Image from '@mui/icons-material/Image';
import VolumeUp from '@mui/icons-material/VolumeUp';
import Movie from '@mui/icons-material/Movie';
import Slideshow from '@mui/icons-material/Slideshow';
import TuneIcon from '@mui/icons-material/Tune';

interface StoryVideoProgressModalProps {
  open: boolean;
  progress: number;
  message?: string;
}

interface Step {
  label: string;
  description: string;
  threshold: number;
}

const STEPS: Step[] = [
  { label: 'Initializing video generation', description: 'Collecting scenes, images, and audio', threshold: 0 },
  { label: 'Resolving scene assets', description: 'Loading images, animated clips, and narration', threshold: 10 },
  { label: 'Composing video from scenes', description: 'Synchronizing visuals with audio', threshold: 30 },
  { label: 'Applying transitions and rendering', description: 'Stitching scenes with fades and effects', threshold: 80 },
  { label: 'Finalizing your story video', description: 'Encoding and saving the final file', threshold: 95 },
];

const EXPECT_FIELDS = [
  {
    icon: Slideshow,
    label: 'Narrative scene sequence',
    hint: 'Your outline scenes assembled in order with audio',
  },
  {
    icon: Image,
    label: 'Scene images or animations',
    hint: 'Illustrated visuals for each scene',
  },
  {
    icon: VolumeUp,
    label: 'Background narration',
    hint: 'AI or generated voiceover synced to scenes',
  },
  {
    icon: Movie,
    label: 'Smooth transitions',
    hint: 'Fades/cuts between scenes at your chosen FPS',
  },
];

export const StoryVideoProgressModal: React.FC<StoryVideoProgressModalProps> = ({
  open,
  progress,
  message,
}) => {
  if (!open) return null;

  const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  // Determine active step based on current progress threshold.
  let activeStepIndex = 0;
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (normalizedProgress >= STEPS[i].threshold) {
      activeStepIndex = i;
      break;
    }
  }

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      onBackdropClick={(e) => e.preventDefault()}
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#FAF9F6',
          boxShadow: '0 24px 64px rgba(44,36,22,0.28)',
          border: '1px solid rgba(141,110,99,0.22)',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Top progress band */}
      <Box sx={{ height: 4, bgcolor: '#F7F3E9', position: 'relative', flexShrink: 0 }}>
        <Box
          sx={{
            height: '100%',
            width: `${normalizedProgress}%`,
            background: 'linear-gradient(90deg, #8D6E63, #5D4037, #3E2723)',
            transition: 'width 0.5s ease',
            borderRadius: '0 3px 3px 0',
          }}
        />
      </Box>

      <DialogContent sx={{ py: 3.5, px: { xs: 2.5, sm: 3.5 }, flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#5D4037', 0.1),
              border: '1px solid rgba(93,64,55,0.18)',
              flexShrink: 0,
            }}
          >
            <VideoLibrary sx={{ fontSize: 24, color: '#5D4037' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2C2416', lineHeight: 1.2 }}>
              Generating your Story Video
            </Typography>
            <Typography variant="body2" sx={{ color: '#8D6E63', mt: 0.25 }}>
              Alwrity AI is composing a narrative video from your scenes, images, and audio
            </Typography>
          </Box>
        </Box>

        {/* Status bar — moved to top */}
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="caption" sx={{ color: '#6D4C41', fontWeight: 500 }}>
            {activeStepIndex >= 0 ? `Step ${activeStepIndex + 1} of ${STEPS.length} · this usually takes 1–5 minutes` : 'Starting...'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#8D6E63', fontStyle: 'italic' }}>
            Keep this dialog open — the video will appear below once ready
          </Typography>
        </Box>

        {/* Live progress bar and backend message */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#3E2723' }}>
              {STEPS[activeStepIndex].label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#5D4037' }}>
              {normalizedProgress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={normalizedProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#E8E5D3',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #8D6E63, #5D4037, #3E2723)',
                borderRadius: 4,
              },
            }}
          />
          {message && (
            <Typography variant="caption" sx={{ color: '#6D4C41', mt: 0.75, display: 'block' }}>
              {message}
            </Typography>
          )}
        </Box>

        {/* Two-column layout: steps on the left, what-you'll-get on the right */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.1fr 1fr' },
            gap: 2.5,
            alignItems: 'start',
          }}
        >
          {/* Steps rail */}
          <Box sx={{ pr: { sm: 1 } }}>
            {STEPS.map((step, index) => {
              const isActive = index === activeStepIndex;
              const isCompleted = normalizedProgress >= step.threshold && index < activeStepIndex;
              const isPending = !isActive && !isCompleted;

              return (
                <Box
                  key={step.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    py: 0.6,
                    opacity: isPending ? 0.45 : 1,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.25,
                      bgcolor: isCompleted ? '#3E2723' : isActive ? '#F7F3E9' : 'transparent',
                      border: '2px solid',
                      borderColor: isCompleted ? '#3E2723' : isActive ? '#5D4037' : '#D7CCC8',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {isCompleted ? (
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#FAF9F6' }} />
                    ) : isActive ? (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#5D4037' }} />
                    ) : null}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: isCompleted
                          ? '#2C2416'
                          : isActive
                            ? '#3E2723'
                            : '#8D6E63',
                        fontWeight: isCompleted ? 500 : isActive ? 600 : 400,
                        lineHeight: 1.3,
                        fontSize: '0.85rem',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {step.label}
                      {isActive && '...'}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#8D6E63',
                        display: 'block',
                        lineHeight: 1.2,
                        mt: 0.15,
                      }}
                    >
                      {step.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* What you'll get panel */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: '#F7F3E9',
              border: '1px solid rgba(141,110,99,0.18)',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: '#2C2416',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mb: 1,
              }}
            >
              <TuneIcon sx={{ fontSize: 16, color: '#5D4037' }} />
              What to expect
            </Typography>
            <Typography variant="caption" sx={{ color: '#6D4C41', display: 'block', mb: 1.5, lineHeight: 1.45 }}>
              The generated video will be ready to preview and download. You can regenerate it with different settings if needed.
            </Typography>
            <Divider sx={{ mb: 1, borderColor: 'rgba(141,110,99,0.2)' }} />
            <List dense disablePadding sx={{ py: 0 }}>
              {EXPECT_FIELDS.map((field) => {
                const Icon = field.icon;
                return (
                  <ListItem
                    key={field.label}
                    disableGutters
                    sx={{
                      py: 0.55,
                      px: 0,
                      alignItems: 'flex-start',
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 28,
                        mt: 0.35,
                        color: '#5D4037',
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#3E2723', lineHeight: 1.2, fontSize: '0.85rem' }}>
                          {field.label}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: '#6D4C41', display: 'block', lineHeight: 1.35, mt: 0.1 }}>
                          {field.hint}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </Box>

      </DialogContent>
    </Dialog>
  );
};

export default StoryVideoProgressModal;