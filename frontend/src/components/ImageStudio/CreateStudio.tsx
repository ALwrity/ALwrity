import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Collapse,
  Fade,
  Zoom,
  CircularProgress,
  Divider,
  ButtonGroup,
  Stack,
  alpha,
  Slider,
} from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import Refresh from '@mui/icons-material/Refresh';
import Download from '@mui/icons-material/Download';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import ZoomIn from '@mui/icons-material/ZoomIn';
import Close from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import AttachMoney from '@mui/icons-material/AttachMoney';
import Info from '@mui/icons-material/Info';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Star from '@mui/icons-material/Star';
import Bolt from '@mui/icons-material/Bolt';
import ImageIcon from '@mui/icons-material/Image';
import { motion, AnimatePresence, type Variants, type Easing } from 'framer-motion';
import { useImageStudio } from '../../hooks/useImageStudio';
import { TemplateSelector } from './TemplateSelector';
import { ImageResultsGallery } from './ImageResultsGallery';
import { CostEstimator } from './CostEstimator';
import { ImageStudioLayout } from './ImageStudioLayout';
import { OperationButton } from '../shared/OperationButton';

const MotionBox = motion.create(Box);
const MotionPaper = motion.create(Paper);
const MotionCard = motion.create(Card);

// Cubic bezier easing
const easeInOut: Easing = [0.22, 0.61, 0.36, 1];
const easeOut: Easing = [0.4, 0, 1, 1];

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOut },
  },
};

const primaryTextColor = '#0f172a';
const mutedTextColor = '#475569';

const outlinedInputBase = {
  borderRadius: 3,
  backgroundColor: '#fff',
  '& fieldset': {
    borderColor: '#e2e8f0',
  },
  '&:hover fieldset': {
    borderColor: '#cbd5f5',
  },
  '&.Mui-focused fieldset': {
    borderColor: '#7c3aed',
    boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.15)',
  },
};

const inputBaseStyles = {
  color: primaryTextColor,
  '::placeholder': {
    color: '#94a3b8',
    opacity: 1,
  },
};

const sharedInputStyles = {
  '& .MuiOutlinedInput-root': outlinedInputBase,
  '& .MuiInputBase-input': inputBaseStyles,
};

const inputLabelStyles = {
  color: mutedTextColor,
  fontWeight: 600,
  '&.Mui-focused': { color: '#7c3aed' },
};

interface StylePresetOption {
  value: string;
  label: string;
}

const stylePresetOptions: StylePresetOption[] = [
  { value: 'photographic', label: 'Photographic' },
  { value: 'digital-art', label: 'Digital Art' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime' },
  { value: '3d-model', label: '3D Model' },
  { value: 'line-art', label: 'Line Art' },
];

const providerDefaults: Record<
  string,
  { guidance: number; steps: number }
> = {
  stability: { guidance: 7.5, steps: 40 },
  wavespeed: { guidance: 5, steps: 22 },
  huggingface: { guidance: 6, steps: 30 },
  gemini: { guidance: 4, steps: 25 },
};

const advancedCardStyles = {
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: 2,
  background: 'rgba(255, 255, 255, 0.9)',
  p: 2.5,
};

const formatModelName = (model: string) =>
  model
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export interface CreateStudioProps {
  onImageGenerated?: (imageData: any) => void;
}

export const CreateStudio: React.FC<CreateStudioProps> = ({ onImageGenerated }) => {
  // State
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('auto');
  const [quality, setQuality] = useState<'draft' | 'standard' | 'premium'>('standard');
  const [numVariations, setNumVariations] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [stylePreset, setStylePreset] = useState<string>('');
  const [guidanceScale, setGuidanceScale] = useState<number>(providerDefaults.stability.guidance);
  const [steps, setSteps] = useState<number>(providerDefaults.stability.steps);
  const [seed, setSeed] = useState<string>('');
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const previousProviderRef = useRef<string | null>(null);
  
  // Hooks
  const {
    templates,
    providers,
    isLoading: isLoadingMeta,
    isGenerating,
    results,
    error,
    costEstimate,
    generateImage,
    estimateCost,
    loadTemplates,
    loadProviders,
    saveImageToLibrary,
  } = useImageStudio();

  // Load meta data on mount
  useEffect(() => {
    loadTemplates();
    loadProviders();
  }, [loadTemplates, loadProviders]);

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null;
    return templates?.find((template) => template.id === templateId) || null;
  }, [templates, templateId]);

  const resolvedProviderForCost = useMemo(() => {
    if (provider && provider !== 'auto') {
      return provider;
    }
    if (selectedTemplate?.recommended_provider) {
      return selectedTemplate.recommended_provider;
    }
    return 'stability';
  }, [provider, selectedTemplate]);

  const providerForAdvanced = provider !== 'auto' ? provider : null;

  const selectedTemplateWidth = selectedTemplate?.aspect_ratio?.width;
  const selectedTemplateHeight = selectedTemplate?.aspect_ratio?.height;
  const selectedTemplateStylePreset = selectedTemplate?.style_preset;
  const selectedTemplateId = selectedTemplate?.id;

  useEffect(() => {
    if (!providerForAdvanced) {
      setModelOverride(null);
      return;
    }
    const availableModels = providers?.[providerForAdvanced]?.models ?? [];
    if (!availableModels.length) {
      setModelOverride(null);
      return;
    }
    setModelOverride((prev) =>
      prev && availableModels.includes(prev) ? prev : availableModels[0]
    );
  }, [providerForAdvanced, providers]);

  useEffect(() => {
    if (previousProviderRef.current === providerForAdvanced) {
      return;
    }
    previousProviderRef.current = providerForAdvanced;
    if (!providerForAdvanced) {
      setGuidanceScale(providerDefaults.stability.guidance);
      setSteps(providerDefaults.stability.steps);
      setSeed('');
      return;
    }
    const defaults = providerDefaults[providerForAdvanced] || providerDefaults.stability;
    setGuidanceScale(defaults.guidance);
    setSteps(defaults.steps);
    setSeed('');
  }, [providerForAdvanced]);

  useEffect(() => {
    if (selectedTemplateStylePreset) {
      setStylePreset(selectedTemplateStylePreset);
    }
  }, [selectedTemplateStylePreset]);

  const effectiveStylePreset = stylePreset || selectedTemplateStylePreset || undefined;
  const effectiveModel = modelOverride || undefined;
  const parsedSeed = seed ? Number(seed) : undefined;

  // Estimate cost whenever key parameters change (with auto provider resolution)
  useEffect(() => {
    if (!resolvedProviderForCost) return;
    estimateCost({
      provider: resolvedProviderForCost,
      model: effectiveModel,
      operation: 'generate',
      num_images: numVariations,
      width: selectedTemplateWidth,
      height: selectedTemplateHeight,
    });
  }, [
    resolvedProviderForCost,
    numVariations,
    selectedTemplateStylePreset,
    selectedTemplateWidth,
    selectedTemplateHeight,
    selectedTemplateId,
    effectiveModel,
    estimateCost,
  ]);

  // Check if can generate
  const canGenerate = useMemo(() => {
    return prompt.trim().length > 0 && !isGenerating;
  }, [prompt, isGenerating]);

  const createOperation = useMemo(() => {
    const providerName = resolvedProviderForCost || 'stability';
    return {
      provider: providerName,
      operation_type: 'image_generation',
      actual_provider_name: providerName,
    };
  }, [resolvedProviderForCost]);

  // Handle generate
  const handleGenerate = async () => {
    try {
      const result = await generateImage({
        prompt,
        template_id: templateId,
        provider,
        model: effectiveModel,
        style_preset: effectiveStylePreset,
        quality,
        num_variations: numVariations,
        negative_prompt: negativePrompt || undefined,
        enhance_prompt: enhancePrompt,
        guidance_scale: providerForAdvanced ? guidanceScale : undefined,
        steps: providerForAdvanced ? steps : undefined,
        seed: providerForAdvanced ? parsedSeed : undefined,
      });

      // Auto-save generated images to asset library
      if (result?.results?.length) {
        const resolvedProvider = result.request?.provider || provider;
        const resolvedModel = result.request?.model || effectiveModel;
        for (const imgResult of result.results) {
          if (imgResult.image_base64) {
            saveImageToLibrary({
              imageBase64: imgResult.image_base64,
              prompt,
              provider: resolvedProvider,
              model: resolvedModel,
              operation: 'image-generation',
            }).catch((e) => console.warn('Asset library save skipped:', e.message || e));
          }
        }
      }

      if (onImageGenerated && (result?.results?.length ?? 0) > 0) {
        onImageGenerated(result);
      }
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    setTemplateId(template.id);

    if (template.style_preset) {
      setStylePreset(template.style_preset);
    } else {
      setStylePreset('');
    }

    if (template.recommended_provider) {
      setProvider(template.recommended_provider);
    } else {
      setProvider('auto');
    }

    const templateProvider =
      template.recommended_provider && template.recommended_provider !== 'auto'
        ? template.recommended_provider
        : null;
    const defaults =
      (templateProvider && providerDefaults[templateProvider]) || providerDefaults.stability;
    setGuidanceScale(defaults.guidance);
    setSteps(defaults.steps);
    setSeed('');
  };

  // Provider options
  const providerOptions = useMemo(() => {
    const options = [
      { value: 'auto', label: 'Auto-Select (Recommended)', icon: <AutoAwesome /> },
    ];
    
    if (providers) {
      Object.keys(providers).forEach((key) => {
        const p = providers[key];
        options.push({
          value: key,
          label: p.name,
          icon: <PhotoLibrary />,
        });
      });
    }
    
    return options;
  }, [providers]);

  // Quality options with descriptions
  const qualityOptions = [
    { 
      value: 'draft' as const, 
      label: 'Draft', 
      description: 'Fast generation, lower cost',
      icon: <Bolt />,
      color: '#10b981',
    },
    { 
      value: 'standard' as const, 
      label: 'Standard', 
      description: 'Balanced quality and speed',
      icon: <Star />,
      color: '#3b82f6',
    },
    { 
      value: 'premium' as const, 
      label: 'Premium', 
      description: 'Highest quality, best results',
      icon: <TrendingUp />,
      color: '#8b5cf6',
    },
  ];

  const renderStylePresetChips = (
    presets: StylePresetOption[] = stylePresetOptions
  ) => (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {presets.map((preset) => {
        const isActive = stylePreset === preset.value;
        return (
          <Chip
            key={preset.value}
            label={preset.label}
            color={isActive ? 'primary' : 'default'}
            variant={isActive ? 'filled' : 'outlined'}
            onClick={() => setStylePreset(preset.value)}
            sx={{
              borderRadius: 999,
              textTransform: 'capitalize',
            }}
          />
        );
      })}
      <Chip
        label="Reset"
        variant={stylePreset ? 'outlined' : 'filled'}
        onClick={() => setStylePreset('')}
        sx={{ borderRadius: 999 }}
      />
    </Stack>
  );

  const renderProviderAdvancedOptions = () => {
    if (!providerForAdvanced) {
      return (
        <Alert
          severity="info"
          sx={{
            borderRadius: 2,
            background: alpha('#6366f1', 0.08),
            color: primaryTextColor,
          }}
        >
          Select a specific provider above to unlock provider-level controls like model
          selection, guidance scale, inference steps, and reproducible seeds.
        </Alert>
      );
    }

    const providerLabel = providers?.[providerForAdvanced]?.name || providerForAdvanced;
    const availableModels = providers?.[providerForAdvanced]?.models ?? [];
    const modelValue = modelOverride ?? (availableModels[0] ?? '');

    const modelDropdown =
      availableModels.length > 0 ? (
        <FormControl fullWidth>
          <InputLabel sx={inputLabelStyles}>Model</InputLabel>
          <Select
            label="Model"
            value={modelValue}
            onChange={(e) => setModelOverride(e.target.value as string)}
            sx={{
              '& .MuiOutlinedInput-root': outlinedInputBase,
              '& .MuiInputBase-input': inputBaseStyles,
            }}
          >
            {availableModels.map((model) => (
              <MenuItem key={model} value={model}>
                {formatModelName(model)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null;

    switch (providerForAdvanced) {
      case 'stability':
        return (
          <Stack spacing={2} sx={advancedCardStyles}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryTextColor }}>
              {providerLabel} Controls
            </Typography>
            <Typography variant="body2" sx={{ color: mutedTextColor }}>
              Access full Stable Diffusion parameters for SD3 / Ultra pipelines.
            </Typography>
            {modelDropdown}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: primaryTextColor }}>
                Style Preset
              </Typography>
              {renderStylePresetChips()}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: primaryTextColor }}>
                Guidance Scale: {guidanceScale.toFixed(1)}
              </Typography>
              <Slider
                min={0}
                max={20}
                step={0.5}
                value={guidanceScale}
                onChange={(_, value) => setGuidanceScale(value as number)}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: primaryTextColor }}>
                Inference Steps: {steps}
              </Typography>
              <Slider
                min={10}
                max={150}
                step={1}
                value={steps}
                onChange={(_, value) => setSteps(value as number)}
              />
            </Box>
            <TextField
              fullWidth
              type="number"
              label="Seed (optional)"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              InputLabelProps={{ sx: inputLabelStyles }}
              sx={sharedInputStyles}
              placeholder="Leave blank for random seed"
            />
          </Stack>
        );
      case 'wavespeed':
        return (
          <Stack spacing={2} sx={advancedCardStyles}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryTextColor }}>
              WaveSpeed Controls
            </Typography>
            <Typography variant="body2" sx={{ color: mutedTextColor }}>
              Switch between Ideogram V3 Turbo (photorealistic) and Qwen Image (fast text-to-image).
            </Typography>
            {modelDropdown}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: primaryTextColor }}>
                Guidance Scale: {guidanceScale.toFixed(1)}
              </Typography>
              <Slider
                min={0}
                max={12}
                step={0.5}
                value={guidanceScale}
                onChange={(_, value) => setGuidanceScale(value as number)}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: primaryTextColor }}>
                Steps: {steps}
              </Typography>
              <Slider
                min={5}
                max={60}
                step={1}
                value={steps}
                onChange={(_, value) => setSteps(value as number)}
              />
            </Box>
            <TextField
              fullWidth
              type="number"
              label="Seed (optional)"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              InputLabelProps={{ sx: inputLabelStyles }}
              sx={sharedInputStyles}
            />
          </Stack>
        );
      case 'huggingface':
        return (
          <Stack spacing={2} sx={advancedCardStyles}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryTextColor }}>
              HuggingFace Controls
            </Typography>
            <Typography variant="body2" sx={{ color: mutedTextColor }}>
              Choose FLUX vs Runway pipelines and control step counts.
            </Typography>
            {modelDropdown}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: primaryTextColor }}>
                Steps: {steps}
              </Typography>
              <Slider
                min={5}
                max={80}
                step={1}
                value={steps}
                onChange={(_, value) => setSteps(value as number)}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: primaryTextColor }}>
                Style Preset
              </Typography>
              {renderStylePresetChips(
                stylePresetOptions.filter((option) =>
                  ['digital-art', 'anime', 'line-art', 'photographic'].includes(option.value)
                )
              )}
            </Box>
            <TextField
              fullWidth
              type="number"
              label="Seed (optional)"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              InputLabelProps={{ sx: inputLabelStyles }}
              sx={sharedInputStyles}
            />
          </Stack>
        );
      case 'gemini':
        return (
          <Stack spacing={2} sx={advancedCardStyles}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryTextColor }}>
              Gemini Creative Controls
            </Typography>
            <Typography variant="body2" sx={{ color: mutedTextColor }}>
              Tune Gemini Imagen creativity vs adherence to the prompt.
            </Typography>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: primaryTextColor }}>
                Creativity: {guidanceScale.toFixed(1)}
              </Typography>
              <Slider
                min={1}
                max={10}
                step={0.5}
                value={guidanceScale}
                onChange={(_, value) => setGuidanceScale(value as number)}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: primaryTextColor }}>
                Style Direction
              </Typography>
              {renderStylePresetChips(
                stylePresetOptions.filter((option) =>
                  ['photographic', 'cinematic', 'digital-art', 'anime'].includes(option.value)
                )
              )}
            </Box>
          </Stack>
        );
      default:
        return (
          <Stack spacing={2} sx={advancedCardStyles}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryTextColor }}>
              {providerLabel} Controls
            </Typography>
            {modelDropdown}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: primaryTextColor }}>
                Guidance Scale: {guidanceScale.toFixed(1)}
              </Typography>
              <Slider
                min={0}
                max={15}
                step={0.5}
                value={guidanceScale}
                onChange={(_, value) => setGuidanceScale(value as number)}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: primaryTextColor }}>
                Steps: {steps}
              </Typography>
              <Slider
                min={5}
                max={80}
                step={1}
                value={steps}
                onChange={(_, value) => setSteps(value as number)}
              />
            </Box>
          </Stack>
        );
    }
  };

  return (
    <ImageStudioLayout>
      <MotionBox
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <MotionPaper
          variants={itemVariants}
          elevation={0}
          sx={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 4,
            p: 4,
            mb: 3,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gradient overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '100%',
              background: 'linear-gradient(90deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
              zIndex: 0,
            }}
          />
          
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={2} mb={1}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ImageIcon sx={{ fontSize: 32, color: '#fff' }} />
              </Box>
              <Box>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(90deg, #fff, rgba(255,255,255,0.8))',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 0.5,
                  }}
                >
                  Create Studio
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}
                >
                  AI-Powered Image Generation for Digital Marketing
                </Typography>
              </Box>
            </Stack>
            
            {/* Stats */}
            <Stack direction="row" spacing={2} mt={3}>
              <Chip
                icon={<AutoAwesome />}
                label={`${Object.keys(providers || {}).length} AI Providers`}
                sx={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontWeight: 600,
                  backdropFilter: 'blur(10px)',
                }}
              />
              <Chip
                icon={<PhotoLibrary />}
                label={`${templates?.length || 0} Platform Templates`}
                sx={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontWeight: 600,
                  backdropFilter: 'blur(10px)',
                }}
              />
              <Chip
                icon={<TrendingUp />}
                label="Enterprise Quality"
                sx={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontWeight: 600,
                  backdropFilter: 'blur(10px)',
                }}
              />
            </Stack>
          </Box>
        </MotionPaper>

        <Grid container spacing={3}>
          {/* Left Panel - Generation Controls */}
          <Grid item xs={12} lg={5}>
            <MotionBox variants={itemVariants}>
              <Paper
                elevation={0}
                sx={{
                  background: 'rgba(248, 250, 252, 0.96)',
                  backdropFilter: 'blur(18px)',
                  border: '1px solid rgba(148, 163, 184, 0.35)',
                  borderRadius: 3,
                  p: 3,
                  height: '100%',
                  color: primaryTextColor,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <AutoAwesome sx={{ color: '#667eea' }} />
                  Generation Settings
                </Typography>

                <Stack spacing={3}>
                  {/* Template Selector */}
                  <TemplateSelector
                    templates={templates || []}
                    selectedTemplateId={templateId}
                    onSelectTemplate={handleTemplateSelect}
                    isLoading={isLoadingMeta}
                  />

                  {/* Prompt Input */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      color: primaryTextColor,
                      }}
                    >
                      <AutoAwesome sx={{ fontSize: 18, color: '#667eea' }} />
                      Describe Your Image
                      {enhancePrompt && (
                        <Chip
                          size="small"
                          label="AI Enhanced"
                          icon={<Star sx={{ fontSize: 14 }} />}
                          sx={{
                            ml: 1,
                            height: 22,
                            background: 'linear-gradient(90deg, #667eea, #764ba2)',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        />
                      )}
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="E.g., Modern coffee shop interior, cozy atmosphere, natural lighting..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          ...outlinedInputBase,
                          minHeight: 140,
                        },
                        '& .MuiInputBase-input': {
                          ...inputBaseStyles,
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 1,
                        display: 'block',
                        color: mutedTextColor,
                      }}
                    >
                      {prompt.length}/500 characters
                    </Typography>
                  </Box>

                  {/* Quality Selector */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 600, mb: 1.5, color: primaryTextColor }}
                    >
                      Quality Level
                    </Typography>
                    <ButtonGroup fullWidth variant="outlined">
                      {qualityOptions.map((option) => (
                        <Button
                          key={option.value}
                          onClick={() => setQuality(option.value)}
                          sx={{
                            py: 1.5,
                            borderColor: quality === option.value ? option.color : 'divider',
                            background: quality === option.value
                              ? `linear-gradient(135deg, ${alpha(option.color, 0.1)}, ${alpha(option.color, 0.05)})`
                              : 'transparent',
                            color: quality === option.value ? option.color : mutedTextColor,
                            fontWeight: quality === option.value ? 700 : 500,
                            borderWidth: quality === option.value ? 2 : 1,
                            '&:hover': {
                              borderColor: option.color,
                              borderWidth: 2,
                              background: `linear-gradient(135deg, ${alpha(option.color, 0.15)}, ${alpha(option.color, 0.08)})`,
                            },
                          }}
                        >
                          <Stack alignItems="center" spacing={0.5}>
                            {option.icon}
                            <Typography variant="caption" sx={{ fontWeight: 'inherit', fontSize: 11 }}>
                              {option.label}
                            </Typography>
                          </Stack>
                        </Button>
                      ))}
                    </ButtonGroup>
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 1,
                        display: 'block',
                        color: mutedTextColor,
                        textAlign: 'center',
                      }}
                    >
                      {qualityOptions.find(o => o.value === quality)?.description}
                    </Typography>
                  </Box>

                  {/* Provider Selection */}
                  <FormControl fullWidth>
                    <InputLabel sx={inputLabelStyles}>AI Provider</InputLabel>
                    <Select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      label="AI Provider"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          ...outlinedInputBase,
                        },
                        '& .MuiInputBase-input': {
                          ...inputBaseStyles,
                        },
                      }}
                    >
                      {providerOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            {option.icon}
                            <Typography>{option.label}</Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Number of Variations */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 600, mb: 1, color: primaryTextColor }}
                    >
                      Number of Variations: {numVariations}
                    </Typography>
                    <Box sx={{ px: 1 }}>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={numVariations}
                        onChange={(e) => setNumVariations(Number(e.target.value))}
                        style={{
                          width: '100%',
                          height: 8,
                          borderRadius: 4,
                          outline: 'none',
                          background: `linear-gradient(to right, #667eea 0%, #667eea ${(numVariations - 1) * 11.11}%, #e2e8f0 ${(numVariations - 1) * 11.11}%, #e2e8f0 100%)`,
                          WebkitAppearance: 'none',
                          appearance: 'none',
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Advanced Options */}
                  <Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                      sx={{
                        borderRadius: 2,
                        borderColor: '#d2d9ee',
                        color: primaryTextColor,
                        backgroundColor: 'rgba(255, 255, 255, 0.85)',
                        '&:hover': {
                          borderColor: '#7c3aed',
                          background: alpha('#667eea', 0.05),
                        },
                      }}
                    >
                      Advanced Options
                    </Button>
                    
                    <Collapse in={showAdvanced}>
                      <Stack spacing={2} mt={2}>
                        {selectedTemplate && (
                          <Chip
                            icon={<AutoAwesome fontSize="small" />}
                            label={`Optimized for ${selectedTemplate.name}`}
                            sx={{
                              alignSelf: 'flex-start',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#047857',
                              '& .MuiChip-icon': { color: '#047857' },
                            }}
                          />
                        )}
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          label="Negative Prompt (Optional)"
                          value={negativePrompt}
                          onChange={(e) => setNegativePrompt(e.target.value)}
                          placeholder="What to avoid in the image..."
                          InputLabelProps={{ sx: inputLabelStyles }}
                          sx={sharedInputStyles}
                        />
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <input
                            type="checkbox"
                            checked={enhancePrompt}
                            onChange={(e) => setEnhancePrompt(e.target.checked)}
                            style={{ width: 18, height: 18 }}
                          />
                          <Typography variant="body2" sx={{ color: primaryTextColor }}>
                            Enhance prompt with AI
                          </Typography>
                          <Tooltip title="AI will optimize your prompt for better results">
                            <Info sx={{ fontSize: 16, color: mutedTextColor }} />
                          </Tooltip>
                        </Box>

                        {renderProviderAdvancedOptions()}
                      </Stack>
                    </Collapse>
                  </Box>

                  {/* Cost Estimator */}
                  {costEstimate && (
                    <CostEstimator estimate={costEstimate} />
                  )}

                  {/* Generate Button */}
                <OperationButton
                  operation={createOperation}
                  label="Generate Images"
                  startIcon={<AutoAwesome />}
                  onClick={handleGenerate}
                  checkOnMount
                  loading={isGenerating}
                  disabled={!canGenerate}
                  fullWidth
                  sx={{
                    py: 2,
                    borderRadius: 2,
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    fontWeight: 700,
                    fontSize: 16,
                    textTransform: 'none',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #5568d3 0%, #65408b 100%)',
                      boxShadow: '0 12px 32px rgba(102, 126, 234, 0.5)',
                    },
                    '&.Mui-disabled': {
                      background: '#e2e8f0',
                      color: '#94a3b8',
                    },
                  }}
                />
                </Stack>
              </Paper>
            </MotionBox>
          </Grid>

          {/* Right Panel - Results Gallery */}
          <Grid item xs={12} lg={7}>
            <MotionBox variants={itemVariants}>
              <Paper
                elevation={0}
                sx={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 3,
                  p: 3,
                  minHeight: 600,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <PhotoLibrary sx={{ color: '#667eea' }} />
                  Generated Images
                  {results?.length > 0 && (
                    <Chip
                      size="small"
                      label={results.length}
                      sx={{
                        ml: 1,
                        background: '#667eea',
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    />
                  )}
                </Typography>

                {/* Loading State */}
                {isGenerating && (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <CircularProgress size={60} sx={{ color: '#667eea', mb: 3 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      Creating Your Images
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This may take a few seconds...
                    </Typography>
                    <LinearProgress
                      sx={{
                        mt: 3,
                        mx: 'auto',
                        maxWidth: 300,
                        height: 6,
                        borderRadius: 3,
                        background: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #667eea, #764ba2)',
                        },
                      }}
                    />
                  </Box>
                )}

                {/* Error State */}
                {error && !isGenerating && (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {error}
                  </Alert>
                )}

                {/* Empty State */}
                {!isGenerating && !results?.length && !error && (
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 8,
                      px: 3,
                    }}
                  >
                    <Box
                      sx={{
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea20, #764ba220)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 60, color: '#667eea' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      No Images Yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Enter a prompt and click "Generate Images" to get started
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {['Product Photo', 'Social Media Post', 'Blog Header', 'Ad Creative'].map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{
                            background: 'rgba(102, 126, 234, 0.1)',
                            color: '#667eea',
                            fontWeight: 600,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Results Gallery */}
                {results && results.length > 0 && !isGenerating && (
                  <ImageResultsGallery
                    results={results}
                    onImageSelect={(image) => console.log('Selected:', image)}
                  />
                )}
              </Paper>
            </MotionBox>
          </Grid>
        </Grid>
      </MotionBox>
    </ImageStudioLayout>
  );
};

