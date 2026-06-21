/**
 * Shared Video Generation Modal
 *
 * Reusable settings modal for text-to-video generation across modules.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Divider,
  alpha,
  Tooltip,
  IconButton,
  Paper,
  Button,
  Slider,
} from '@mui/material';
import {
  Info as InfoIcon,
  HelpOutline as HelpOutlineIcon,
  Close as CloseIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';

import {
  VideoGenerationModalProps,
  VideoGenerationSettings,
  VideoAspectRatio,
  VideoResolution,
  VideoDuration,
  VideoMotionPreset,
  LinkedInVideoModel,
  VideoPreset,
  DEFAULT_VIDEO_THEME,
  DEFAULT_LINKEDIN_VIDEO_MODELS,
} from './VideoGenerationModal.types';

export const VideoGenerationModal: React.FC<VideoGenerationModalProps> = ({
  open,
  onClose,
  onGenerate,
  initialPrompt,
  isGenerating = false,
  title = 'Generate Video',
  contextTitle,
  promptLabel = 'Video Prompt',
  promptHelp = 'Describe the video you want to generate. Include scene context, visual elements, mood, and motion preferences.',
  generateButtonLabel = 'Generate Video',
  presets = [],
  presetsLabel = 'Quick Presets',
  presetsHelp = 'Quickly apply a preset look. Each preset adjusts format, duration, resolution, and motion only.',
  showModelSelection = false,
  availableModels = DEFAULT_LINKEDIN_VIDEO_MODELS,
  defaultModel = 'hunyuan-video-1.5',
  defaultAspectRatio = '16:9',
  defaultDuration = 5,
  defaultResolution = '720p',
  defaultMotion = 'Medium',
  theme = DEFAULT_VIDEO_THEME,
  recommendations,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>(defaultAspectRatio);
  const [duration, setDuration] = useState<VideoDuration>(defaultDuration);
  const [resolution, setResolution] = useState<VideoResolution>(defaultResolution);
  const [motion, setMotion] = useState<VideoMotionPreset>(defaultMotion);
  const [model, setModel] = useState<LinkedInVideoModel>(defaultModel);

  useEffect(() => {
    setPrompt(initialPrompt);
    setAspectRatio(defaultAspectRatio);
    setDuration(defaultDuration);
    setResolution(defaultResolution);
    setMotion(defaultMotion);
    setModel(defaultModel);
  }, [initialPrompt, defaultAspectRatio, defaultDuration, defaultResolution, defaultMotion, defaultModel]);

  const handleGenerate = () => {
    const settings: VideoGenerationSettings = {
      prompt,
      aspectRatio,
      duration,
      resolution,
      motion,
    };
    if (showModelSelection) {
      settings.model = model;
    }
    onGenerate(settings);
  };

  const applyPreset = (preset: VideoPreset) => {
    if (preset.prompt?.trim()) {
      setPrompt((current) => {
        if (!current || current.trim() === '' || current.trim() === initialPrompt.trim()) {
          return `${initialPrompt}\n${preset.prompt}`.trim();
        }
        return `${current}\n${preset.prompt}`.trim();
      });
    }
    setAspectRatio(preset.aspectRatio);
    setDuration(preset.duration);
    setResolution(preset.resolution);
    setMotion(preset.motion);
  };

  const selectSx = {
    backgroundColor: alpha('#ffffff', 0.05),
    color: 'white',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255,255,255,0.2)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255,255,255,0.3)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.primaryAccent,
    },
    '& .MuiSvgIcon-root': {
      color: 'rgba(255,255,255,0.7)',
    },
  };

  const renderRecommendation = (
    content: React.ReactNode | undefined,
    accentColor: string,
    label: string
  ) => {
    if (!content) return null;
    return (
      <Paper
        sx={{
          mt: 1.5,
          p: 1.5,
          backgroundColor: alpha(accentColor, 0.1),
          border: `1px solid ${alpha(accentColor, 0.3)}`,
          borderRadius: 2,
        }}
      >
        <Stack direction="row" spacing={1}>
          <InfoIcon sx={{ color: accentColor, fontSize: '1.2rem', mt: 0.1 }} />
          <Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500, mb: 0.5 }}>
              {label}:
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              {content}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={isGenerating ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: theme.dialogBackground,
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4,
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              {title}
            </Typography>
            {contextTitle && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 1 }}>
                Customize video generation for &quot;{contextTitle}&quot;
              </Typography>
            )}
          </Box>
          {!isGenerating && (
            <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <CloseIcon />
            </IconButton>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {presets.length > 0 && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <VideocamIcon sx={{ color: 'white', fontSize: '1.2rem' }} />
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
                  {presetsLabel}
                </Typography>
                <Tooltip title={presetsHelp} arrow>
                  <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap">
                {presets.map((preset) => (
                  <Paper
                    key={preset.key}
                    onClick={() => !isGenerating && applyPreset(preset)}
                    sx={{
                      p: 1.5,
                      flex: '1 1 45%',
                      minWidth: 180,
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      opacity: isGenerating ? 0.6 : 1,
                      backgroundColor: alpha('#ffffff', 0.04),
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 2,
                      transition: 'all 0.2s ease',
                      '&:hover': isGenerating
                        ? {}
                        : {
                            borderColor: alpha(theme.primaryAccent, 0.7),
                            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                            backgroundColor: alpha(theme.primaryAccent, 0.08),
                          },
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700 }}>
                      {preset.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, mb: 0.75 }}>
                      {preset.subtitle}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                      <Typography variant="caption">AR: {preset.aspectRatio}</Typography>
                      <Typography variant="caption">{preset.duration}s</Typography>
                      <Typography variant="caption">{preset.motion}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
                {promptLabel}
              </Typography>
              <Tooltip title={promptHelp} arrow>
                <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              placeholder="Describe the scene, visual elements, mood, and motion..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: alpha('#ffffff', 0.05),
                  color: 'white',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: theme.primaryAccent },
                },
                '& .MuiInputBase-input': { color: 'white' },
              }}
            />
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

          {showModelSelection && availableModels.length > 0 && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
                  AI Model
                </Typography>
                <Tooltip
                  title="Choose the text-to-video model. Different models vary in quality, speed, and cost."
                  arrow
                >
                  <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <FormControl fullWidth>
                <Select
                  value={model}
                  onChange={(e) => setModel(e.target.value as LinkedInVideoModel)}
                  disabled={isGenerating}
                  sx={selectSx}
                >
                  {availableModels.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      <Stack>
                        <Typography sx={{ color: 'white' }}>{m.name}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                          {m.description} · {m.costHint}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {renderRecommendation(recommendations?.model, theme.secondaryAccent, 'Model Recommendation')}
            </Box>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box flex={1}>
              <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600, mb: 1.5 }}>
                Video Format
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as VideoAspectRatio)}
                  disabled={isGenerating}
                  sx={selectSx}
                >
                  <MenuItem value="16:9">
                    <Stack>
                      <Typography sx={{ color: 'white' }}>16:9 (Landscape)</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        LinkedIn feed, professional content
                      </Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="1:1">
                    <Stack>
                      <Typography sx={{ color: 'white' }}>1:1 (Square)</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        Mobile feed, square posts
                      </Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="9:16">
                    <Stack>
                      <Typography sx={{ color: 'white' }}>9:16 (Vertical)</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        Mobile-first vertical video
                      </Typography>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>
              {renderRecommendation(recommendations?.aspectRatio, theme.warningAccent, 'Format Recommendation')}
            </Box>

            <Box flex={1}>
              <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600, mb: 1.5 }}>
                Video Quality
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as VideoResolution)}
                  disabled={isGenerating}
                  sx={selectSx}
                >
                  <MenuItem value="480p">
                    <Typography sx={{ color: 'white' }}>480p — Fast &amp; Affordable</Typography>
                  </MenuItem>
                  <MenuItem value="720p">
                    <Typography sx={{ color: 'white' }}>720p — Balanced (Recommended)</Typography>
                  </MenuItem>
                  <MenuItem value="1080p">
                    <Typography sx={{ color: 'white' }}>1080p — Premium</Typography>
                  </MenuItem>
                </Select>
              </FormControl>
              {renderRecommendation(recommendations?.resolution, theme.primaryAccent, 'Quality Recommendation')}
            </Box>
          </Stack>

          <Box>
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600, mb: 1.5 }}>
              Movement Style
            </Typography>
            <FormControl fullWidth>
              <Select
                value={motion}
                onChange={(e) => setMotion(e.target.value as VideoMotionPreset)}
                disabled={isGenerating}
                sx={selectSx}
              >
                <MenuItem value="Subtle">
                  <Stack>
                    <Typography sx={{ color: 'white' }}>Subtle</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Gentle movement, professional content
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Medium">
                  <Stack>
                    <Typography sx={{ color: 'white' }}>Medium</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Balanced motion for most social media
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Dynamic">
                  <Stack>
                    <Typography sx={{ color: 'white' }}>Dynamic</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Energetic movement, attention-grabbing
                    </Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            {renderRecommendation(recommendations?.motion, theme.secondaryAccent, 'Motion Recommendation')}
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
              Duration: {duration} seconds
            </Typography>
            <Slider
              value={duration}
              min={5}
              max={10}
              step={3}
              disabled={isGenerating}
              marks={[
                { value: 5, label: '5s' },
                { value: 8, label: '8s' },
                { value: 10, label: '10s' },
              ]}
              onChange={(_, val) => setDuration(val as VideoDuration)}
              sx={{
                color: theme.primaryAccent,
                '& .MuiSlider-markLabel': { color: 'rgba(255,255,255,0.7)' },
              }}
            />
            {renderRecommendation(recommendations?.duration, theme.warningAccent, 'Duration Recommendation')}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={onClose} disabled={isGenerating} sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          variant="contained"
          sx={{
            backgroundColor: isGenerating ? 'rgba(255,255,255,0.1)' : theme.primaryAccent,
            color: 'white',
            '&:hover': {
              backgroundColor: isGenerating ? 'rgba(255,255,255,0.1)' : alpha(theme.primaryAccent, 0.8),
            },
            '&:disabled': {
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)',
            },
            px: 3,
            py: 1,
            borderRadius: 2,
          }}
        >
          {isGenerating ? 'Generating...' : generateButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export * from './VideoGenerationModal.types';
export * from './VideoGenerationPresets';
