/**
 * Shared Image Generation Modal
 * 
 * A reusable, configurable image generation settings modal that supports
 * hyper-personalization for different use cases (YouTube Creator, Podcast Maker, etc.)
 * while maintaining consistent core functionality.
 * 
 * Usage:
 * - YouTube Creator: Pass YOUTUBE_PRESETS, showModelSelection=true, YOUTUBE_THEME
 * - Podcast Maker: Pass PODCAST_PRESETS, showModelSelection=false, PODCAST_THEME
 */

import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import {
  Info as InfoIcon,
  HelpOutline as HelpOutlineIcon,
  Close as CloseIcon,
  Palette as PaletteIcon,
} from "@mui/icons-material";

import {
  ImageGenerationModalProps,
  ImageGenerationSettings,
  ImageStyle,
  RenderingSpeed,
  AspectRatio,
  ImageModel,
  LinkedInImageModel,
  ImagePreset,
  DEFAULT_THEME,
  DEFAULT_MODELS,
} from './ImageGenerationModal.types';

export const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({
  // Core
  open,
  onClose,
  onGenerate,
  initialPrompt,
  isGenerating = false,
  
  // Context
  title = 'Generate Image',
  contextTitle,
  promptLabel = 'Visual Prompt',
  promptHelp = 'Describe what you want to see in the generated image. Include scene context, visual elements, mood, and style preferences.',
  generateButtonLabel = 'Generate Image',
  
  // Presets
  presets = [],
  presetsLabel = 'Quick Presets',
  presetsHelp = 'Quickly apply a preset look. Each preset adjusts lighting, composition, and style.',
  
  // Model selection
  showModelSelection = false,
  availableModels = DEFAULT_MODELS,
  defaultModel = 'ideogram-v3-turbo',
  
  // Default values
  defaultStyle = 'Realistic',
  defaultRenderingSpeed = 'Quality',
  defaultAspectRatio = '16:9',
  
  // Theming
  theme = DEFAULT_THEME,
  
  // Custom recommendations
  recommendations,
}) => {
  // State
  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState<ImageStyle>(defaultStyle);
  const [renderingSpeed, setRenderingSpeed] = useState<RenderingSpeed>(defaultRenderingSpeed);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultAspectRatio);
  const [model, setModel] = useState<ImageModel | LinkedInImageModel>(defaultModel);

  // Update state when initial values change
  useEffect(() => {
    setPrompt(initialPrompt);
    setStyle(defaultStyle);
    setRenderingSpeed(defaultRenderingSpeed);
    setAspectRatio(defaultAspectRatio);
    setModel(defaultModel);
  }, [initialPrompt, defaultStyle, defaultRenderingSpeed, defaultAspectRatio, defaultModel]);

  const handleGenerate = () => {
    const settings: ImageGenerationSettings = {
      prompt,
      style,
      renderingSpeed,
      aspectRatio,
    };
    
    if (showModelSelection) {
      settings.model = model;
    }
    
    onGenerate(settings);
  };

  const applyPreset = (preset: ImagePreset) => {
    // Combine the preset prompt with current scene prompt context
    setPrompt((current) => {
      if (!current || current.trim() === "" || current.trim() === initialPrompt.trim()) {
        return `${initialPrompt}\n${preset.prompt}`.trim();
      }
      return `${current}\n${preset.prompt}`.trim();
    });
    setStyle(preset.style);
    setRenderingSpeed(preset.renderingSpeed);
    setAspectRatio(preset.aspectRatio);
  };

  // Common select styles
  const selectSx = {
    backgroundColor: alpha("#ffffff", 0.05),
    color: "white",
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255,255,255,0.2)",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255,255,255,0.3)",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.primaryAccent,
    },
    "& .MuiSvgIcon-root": {
      color: "rgba(255,255,255,0.7)",
    },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: theme.dialogBackground,
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 4,
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ color: "white", fontWeight: 600 }}>
              {title}
            </Typography>
            {contextTitle && (
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mt: 1 }}>
                Customize image generation for "{contextTitle}"
              </Typography>
            )}
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: "rgba(255,255,255,0.7)" }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Presets Section */}
          {presets.length > 0 && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PaletteIcon sx={{ color: "white", fontSize: "1.2rem" }} />
                <Typography variant="subtitle1" sx={{ color: "white", fontWeight: 600 }}>
                  {presetsLabel}
                </Typography>
                <Tooltip title={presetsHelp} arrow>
                  <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                {presets.map((preset) => (
                  <Paper
                    key={preset.key}
                    onClick={() => applyPreset(preset)}
                    sx={{
                      p: 1.5,
                      flex: 1,
                      cursor: "pointer",
                      backgroundColor: alpha("#ffffff", 0.04),
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      transition: "all 0.2s ease",
                      "&:hover": {
                        borderColor: alpha(theme.primaryAccent, 0.7),
                        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                        backgroundColor: alpha(theme.primaryAccent, 0.08),
                      },
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ color: "white", fontWeight: 700 }}>
                      {preset.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.5, mb: 0.75 }}>
                      {preset.subtitle}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" }}>
                      <Typography variant="caption">Style: {preset.style}</Typography>
                      <Typography variant="caption">Speed: {preset.renderingSpeed}</Typography>
                      <Typography variant="caption">AR: {preset.aspectRatio}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* Prompt Section */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ color: "white", fontWeight: 600 }}>
                {promptLabel}
              </Typography>
              <Tooltip title={promptHelp} arrow>
                <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
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
              placeholder="Describe the scene, visual elements, mood, and style..."
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: alpha("#ffffff", 0.05),
                  color: "white",
                  "& fieldset": {
                    borderColor: "rgba(255,255,255,0.2)",
                  },
                  "&:hover fieldset": {
                    borderColor: "rgba(255,255,255,0.3)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: theme.primaryAccent,
                  },
                },
                "& .MuiInputBase-input": {
                  color: "white",
                },
              }}
            />
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", mt: 0.5, display: "block" }}>
              Be specific about visual elements, lighting, and atmosphere.
            </Typography>
          </Box>

          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />

          {/* Style Selection */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ color: "white", fontWeight: 600 }}>
                Visual Style
              </Typography>
              <Tooltip
                title="Determines the artistic style of the image generation. Auto lets the AI choose, Fiction creates more stylized/artistic results, and Realistic produces photorealistic results."
                arrow
              >
                <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <FormControl fullWidth>
              <Select
                value={style}
                onChange={(e) => setStyle(e.target.value as ImageStyle)}
                sx={selectSx}
              >
                <MenuItem value="Auto">
                  <Stack>
                    <Typography sx={{ color: "white" }}>Auto</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      AI automatically selects the best style
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Fiction">
                  <Stack>
                    <Typography sx={{ color: "white" }}>Fiction</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Stylized, artistic appearance
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Realistic">
                  <Stack>
                    <Typography sx={{ color: "white" }}>Realistic</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Photorealistic, professional appearance
                    </Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            {recommendations?.style && (
              <Paper
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  backgroundColor: alpha(theme.primaryAccent, 0.1),
                  border: `1px solid ${alpha(theme.primaryAccent, 0.3)}`,
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" spacing={1}>
                  <InfoIcon sx={{ color: theme.primaryAccent, fontSize: "1.2rem", mt: 0.1 }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 500, mb: 0.5 }}>
                      Style Impact:
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                      {recommendations.style}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}
          </Box>

          {/* Rendering Speed */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ color: "white", fontWeight: 600 }}>
                Generation Speed
              </Typography>
              <Tooltip
                title="Controls the balance between generation speed, cost, and quality. Turbo is fastest and cheapest. Quality is slowest but produces the best results."
                arrow
              >
                <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <FormControl fullWidth>
              <Select
                value={renderingSpeed}
                onChange={(e) => setRenderingSpeed(e.target.value as RenderingSpeed)}
                sx={selectSx}
              >
                <MenuItem value="Turbo">
                  <Stack>
                    <Typography sx={{ color: "white" }}>Turbo ⚡</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Fastest (~10-20s) • Cheapest • Good for quick iterations
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Default">
                  <Stack>
                    <Typography sx={{ color: "white" }}>Default ⚖️</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Balanced (~30-60s) • Moderate cost • Great for most content
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Quality">
                  <Stack>
                    <Typography sx={{ color: "white" }}>Quality ✨</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Slowest (~60-120s) • Highest quality • Perfect for professional content
                    </Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            {recommendations?.speed && (
              <Paper
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  backgroundColor: alpha(theme.secondaryAccent, 0.1),
                  border: `1px solid ${alpha(theme.secondaryAccent, 0.3)}`,
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" spacing={1}>
                  <InfoIcon sx={{ color: theme.secondaryAccent, fontSize: "1.2rem", mt: 0.1 }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 500, mb: 0.5 }}>
                      Speed vs Quality:
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                      {recommendations.speed}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}
          </Box>

          {/* AI Model Selection (optional) */}
          {showModelSelection && availableModels.length > 0 && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ color: "white", fontWeight: 600 }}>
                  AI Model
                </Typography>
                <Tooltip
                  title="Choose the AI model for image generation. Different models offer different quality levels and costs."
                  arrow
                >
                  <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <FormControl fullWidth>
                <Select
                  value={model}
                  onChange={(e) => setModel(e.target.value as ImageModel | LinkedInImageModel)}
                  sx={selectSx}
                >
                  {availableModels.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      <Stack>
                        <Typography sx={{ color: "white" }}>{m.name}</Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                          {m.description}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {recommendations?.model && (
                <Paper
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    backgroundColor: alpha(theme.secondaryAccent, 0.1),
                    border: `1px solid ${alpha(theme.secondaryAccent, 0.3)}`,
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" spacing={1}>
                    <InfoIcon sx={{ color: theme.secondaryAccent, fontSize: "1.2rem", mt: 0.1 }} />
                    <Box>
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 500, mb: 0.5 }}>
                        Model Recommendations:
                      </Typography>
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                        {recommendations.model}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}
            </Box>
          )}

          {/* Aspect Ratio */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ color: "white", fontWeight: 600 }}>
                Aspect Ratio
              </Typography>
              <Tooltip
                title="The width-to-height ratio of the generated image. Choose based on your format: 16:9 for widescreen, 9:16 for vertical/mobile, 1:1 for square."
                arrow
              >
                <IconButton size="small" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <FormControl fullWidth>
              <Select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                sx={selectSx}
              >
                <MenuItem value="16:9">
                  <Stack>
                    <Typography sx={{ color: "white" }}>16:9 (Widescreen)</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Standard video format, best for YouTube, web
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="9:16">
                  <Stack>
                    <Typography sx={{ color: "white" }}>9:16 (Vertical)</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Mobile/social media format (TikTok, Instagram Stories)
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="1:1">
                  <Stack>
                    <Typography sx={{ color: "white" }}>1:1 (Square)</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Thumbnails, profile images, Instagram posts
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="4:3">
                  <Stack>
                    <Typography sx={{ color: "white" }}>4:3 (Traditional)</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Classic format, presentations
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="3:4">
                  <Stack>
                    <Typography sx={{ color: "white" }}>3:4 (Portrait)</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                      Portrait orientation, mobile apps
                    </Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            {recommendations?.aspectRatio && (
              <Paper
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  backgroundColor: alpha(theme.warningAccent, 0.1),
                  border: `1px solid ${alpha(theme.warningAccent, 0.3)}`,
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" spacing={1}>
                  <InfoIcon sx={{ color: theme.warningAccent, fontSize: "1.2rem", mt: 0.1 }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 500, mb: 0.5 }}>
                      Format Recommendation:
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                      {recommendations.aspectRatio}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={onClose}
          disabled={isGenerating}
          sx={{ color: "rgba(255,255,255,0.7)" }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          variant="contained"
          sx={{
            backgroundColor: isGenerating ? "rgba(255,255,255,0.1)" : theme.primaryAccent,
            color: "white",
            "&:hover": {
              backgroundColor: isGenerating ? "rgba(255,255,255,0.1)" : alpha(theme.primaryAccent, 0.8),
            },
            "&:disabled": {
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.3)",
            },
            px: 3,
            py: 1,
            borderRadius: 2,
          }}
        >
          {isGenerating ? "Generating..." : generateButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Re-export types and presets for convenience
export * from './ImageGenerationModal.types';
export * from './ImageGenerationPresets';

