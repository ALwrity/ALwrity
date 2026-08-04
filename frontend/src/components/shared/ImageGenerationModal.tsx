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
import {
  IMAGE_GENERATION_DIALOG_Z_INDEX,
} from './imageGenerationSelectMenuProps';
import { createImageGenerationModalStyles } from './imageGenerationModalStyles';

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
  const styles = createImageGenerationModalStyles(theme);
  const { palette } = styles;

  // State
  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState<ImageStyle>(defaultStyle);
  const [renderingSpeed, setRenderingSpeed] = useState<RenderingSpeed>(defaultRenderingSpeed);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultAspectRatio);
  const [model, setModel] = useState<ImageModel | LinkedInImageModel>(defaultModel);

  // Sync defaults when the modal opens or when parent-provided defaults change.
  useEffect(() => {
    if (!open) {
      return;
    }
    setPrompt(initialPrompt);
    setStyle(defaultStyle);
    setRenderingSpeed(defaultRenderingSpeed);
    setAspectRatio(defaultAspectRatio);
    setModel(defaultModel);
  }, [open, initialPrompt, defaultStyle, defaultRenderingSpeed, defaultAspectRatio, defaultModel]);

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
    if (preset.prompt?.trim()) {
      setPrompt((current) => {
        if (!current || current.trim() === "" || current.trim() === initialPrompt.trim()) {
          return `${initialPrompt}\n${preset.prompt}`.trim();
        }
        return `${current}\n${preset.prompt}`.trim();
      });
    }
    setStyle(preset.style);
    setRenderingSpeed(preset.renderingSpeed);
    setAspectRatio(preset.aspectRatio);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{ zIndex: IMAGE_GENERATION_DIALOG_Z_INDEX }}
      scroll="paper"
      PaperProps={{
        sx: styles.dialogPaperSx,
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ ...styles.sectionTitleSx, fontWeight: 600 }}>
              {title}
            </Typography>
            {contextTitle && (
              <Typography variant="body2" sx={{ ...styles.sectionCaptionSx, mt: 1 }}>
                Customize image generation for "{contextTitle}"
              </Typography>
            )}
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={styles.closeIconSx}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          overflowY: "auto",
          overflowX: "visible",
        }}
      >
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Presets Section */}
          {presets.length > 0 && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PaletteIcon sx={{ color: palette.textPrimary, fontSize: "1.2rem" }} />
                <Typography variant="subtitle1" sx={styles.sectionTitleSx}>
                  {presetsLabel}
                </Typography>
                <Tooltip title={presetsHelp} arrow>
                  <IconButton size="small" sx={styles.helpIconSx}>
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                {presets.map((preset) => (
                  <Paper
                    key={preset.key}
                    onClick={() => applyPreset(preset)}
                    sx={styles.presetPaperSx}
                  >
                    <Typography variant="subtitle2" sx={{ ...styles.sectionTitleSx, fontWeight: 700 }}>
                      {preset.title}
                    </Typography>
                    <Typography variant="body2" sx={{ ...styles.sectionCaptionSx, lineHeight: 1.5, mb: 0.75 }}>
                      {preset.subtitle}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={styles.presetMetaSx}>
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
              <Typography variant="subtitle1" sx={styles.sectionTitleSx}>
                {promptLabel}
              </Typography>
              <Tooltip title={promptHelp} arrow>
                <IconButton size="small" sx={styles.helpIconSx}>
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
              sx={styles.textFieldSx}
            />
            <Typography variant="caption" sx={styles.promptHintSx}>
              Be specific about visual elements, lighting, and atmosphere.
            </Typography>
          </Box>

          <Divider sx={styles.dividerSx} />

          {/* Style Selection */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={styles.sectionTitleSx}>
                Visual Style
              </Typography>
              <Tooltip
                title="Determines the artistic style of the image generation. Auto lets the AI choose, Fiction creates more stylized/artistic results, and Realistic produces photorealistic results."
                arrow
              >
                <IconButton size="small" sx={styles.helpIconSx}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <FormControl fullWidth>
              <Select
                value={style}
                onChange={(e) => setStyle(e.target.value as ImageStyle)}
                sx={styles.selectSx}
                MenuProps={styles.selectMenuProps}
              >
                <MenuItem value="Auto">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>Auto</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      AI automatically selects the best style
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Fiction">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>Fiction</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Stylized, artistic appearance
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Realistic">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>Realistic</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Photorealistic, professional appearance
                    </Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            {recommendations?.style && (
              <Paper sx={styles.infoPanelSx(palette.primaryAccent)}>
                <Stack direction="row" spacing={1}>
                  <InfoIcon sx={{ color: palette.primaryAccent, fontSize: "1.2rem", mt: 0.1 }} />
                  <Box>
                    <Typography variant="body2" sx={styles.infoTitleSx}>
                      Style Impact:
                    </Typography>
                    <Typography variant="body2" sx={styles.infoBodySx}>
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
              <Typography variant="subtitle1" sx={styles.sectionTitleSx}>
                Generation Speed
              </Typography>
              <Tooltip
                title="Controls the balance between generation speed, cost, and quality. Turbo is fastest and cheapest. Quality is slowest but produces the best results."
                arrow
              >
                <IconButton size="small" sx={styles.helpIconSx}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <FormControl fullWidth>
              <Select
                value={renderingSpeed}
                onChange={(e) => setRenderingSpeed(e.target.value as RenderingSpeed)}
                sx={styles.selectSx}
                MenuProps={styles.selectMenuProps}
              >
                <MenuItem value="Turbo">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>Turbo ⚡</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Fastest (~10-20s) • Cheapest • Good for quick iterations
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Default">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>Default ⚖️</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Balanced (~30-60s) • Moderate cost • Great for most content
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="Quality">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>Quality ✨</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Slowest (~60-120s) • Highest quality • Perfect for professional content
                    </Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            {recommendations?.speed && (
              <Paper sx={styles.infoPanelSx(palette.secondaryAccent)}>
                <Stack direction="row" spacing={1}>
                  <InfoIcon sx={{ color: palette.secondaryAccent, fontSize: "1.2rem", mt: 0.1 }} />
                  <Box>
                    <Typography variant="body2" sx={styles.infoTitleSx}>
                      Speed vs Quality:
                    </Typography>
                    <Typography variant="body2" sx={styles.infoBodySx}>
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
                <Typography variant="subtitle1" sx={styles.sectionTitleSx}>
                  AI Model
                </Typography>
                <Tooltip
                  title="Choose the AI model for image generation. Different models offer different quality levels and costs."
                  arrow
                >
                  <IconButton size="small" sx={styles.helpIconSx}>
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <FormControl fullWidth>
                <Select
                  value={model}
                  onChange={(e) => setModel(e.target.value as ImageModel | LinkedInImageModel)}
                  sx={styles.selectSx}
                  MenuProps={styles.selectMenuProps}
                >
                  {availableModels.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      <Stack>
                        <Typography sx={styles.menuItemTitleSx}>{m.name}</Typography>
                        <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                          {m.description}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {recommendations?.model && (
                <Paper sx={styles.infoPanelSx(palette.secondaryAccent)}>
                  <Stack direction="row" spacing={1}>
                    <InfoIcon sx={{ color: palette.secondaryAccent, fontSize: "1.2rem", mt: 0.1 }} />
                    <Box>
                      <Typography variant="body2" sx={styles.infoTitleSx}>
                        Model Recommendations:
                      </Typography>
                      <Typography variant="body2" sx={styles.infoBodySx}>
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
              <Typography variant="subtitle1" sx={styles.sectionTitleSx}>
                Aspect Ratio
              </Typography>
              <Tooltip
                title="The width-to-height ratio of the generated image. Choose based on your format: 16:9 for widescreen, 9:16 for vertical/mobile, 1:1 for square."
                arrow
              >
                <IconButton size="small" sx={styles.helpIconSx}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <FormControl fullWidth>
              <Select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                sx={styles.selectSx}
                MenuProps={styles.selectMenuProps}
              >
                <MenuItem value="16:9">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>16:9 (Widescreen)</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Standard video format, best for YouTube, web
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="9:16">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>9:16 (Vertical)</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Mobile/social media format (TikTok, Instagram Stories)
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="1:1">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>1:1 (Square)</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Thumbnails, profile images, Instagram posts
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="4:3">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>4:3 (Traditional)</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Classic format, presentations
                    </Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="3:4">
                  <Stack>
                    <Typography sx={styles.menuItemTitleSx}>3:4 (Portrait)</Typography>
                    <Typography variant="caption" sx={styles.menuItemCaptionSx}>
                      Portrait orientation, mobile apps
                    </Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
            {recommendations?.aspectRatio && (
              <Paper sx={styles.infoPanelSx(palette.warningAccent)}>
                <Stack direction="row" spacing={1}>
                  <InfoIcon sx={{ color: palette.warningAccent, fontSize: "1.2rem", mt: 0.1 }} />
                  <Box>
                    <Typography variant="body2" sx={styles.infoTitleSx}>
                      Format Recommendation:
                    </Typography>
                    <Typography variant="body2" sx={styles.infoBodySx}>
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
          sx={styles.cancelButtonSx}
        >
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          variant="contained"
          sx={styles.generateButtonSx(isGenerating)}
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

