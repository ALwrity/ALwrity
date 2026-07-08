import React, { useState, useEffect, useMemo, useImperativeHandle } from 'react';
import { 
  Box, Button, MenuItem, Select, TextField, Typography, FormControl, InputLabel, Grid, 
  Card, CardMedia, CircularProgress, LinearProgress, Tabs, Tab, 
  Tooltip, Alert, Chip
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import InfoIcon from '@mui/icons-material/Info';
import { useImageGeneration, ImageGenerationRequest, fetchPromptSuggestions } from './useImageGeneration';
import { apiClient } from '../../api/client';

type ImageType = 'realistic' | 'chart' | 'conceptual' | 'diagram' | 'illustration' | 'background' | 'infographic';

interface ImageGeneratorProps {
  defaultModel?: string;
  defaultPrompt?: string;
  onImageReady?: (base64: string) => void;
  context?: {
    title?: string | null;
    outline?: any[];
    research?: any;
    persona?: { audience?: string; tone?: string; industry?: string } | any;
    section?: {
      heading?: string;
      subheadings?: string[];
      key_points?: string[];
      keywords?: string[];
      [key: string]: any;
    };
  };
}

export interface ImageGeneratorHandle {
  suggest: () => Promise<void> | void;
  generate: () => Promise<void> | void;
}

type ModelMeta = {
  label: string;
  cost: string;
  costUsd: number;
  description: string;
};

const MODEL_META: Record<string, ModelMeta> = {
  'qwen-image': { label: 'Qwen Image', cost: '$0.30/image', costUsd: 0.30, description: 'Fast generation, optimized for blog content' },
  'ideogram-v3-turbo': { label: 'Ideogram V3 Turbo', cost: '$0.30/image', costUsd: 0.30, description: 'Superior text rendering, photorealistic' },
  'flux-kontext-pro': { label: 'FLUX Kontext Pro', cost: '$0.04/image', costUsd: 0.04, description: 'Professional typography, improved prompt adherence' },
  'black-forest-labs/FLUX.1-Krea-dev': { label: 'FLUX.1 Krea Dev', cost: '$0.30/image', costUsd: 0.30, description: 'Photorealistic Flux model' },
  'black-forest-labs/FLUX.1-dev': { label: 'FLUX.1 Dev', cost: '$0.30/image', costUsd: 0.30, description: 'High-quality Flux generation' },
  'runwayml/flux-dev': { label: 'Flux Dev (Runway)', cost: '$0.30/image', costUsd: 0.30, description: 'RunwayML hosted Flux' },
  'stable-diffusion-xl-1024-v1-0': { label: 'SDXL 1.0', cost: '$0.30/image', costUsd: 0.30, description: 'SDXL-quality professional outputs' },
  'stable-diffusion-xl-base-1.0': { label: 'SDXL Base', cost: '$0.30/image', costUsd: 0.30, description: 'SDXL base model' },
};

const SESSION_COST_WARNING_THRESHOLD = 1;

const PROVIDER_MODELS: Record<string, string[]> = {
  wavespeed: ['qwen-image', 'ideogram-v3-turbo', 'flux-kontext-pro'],
  huggingface: ['black-forest-labs/FLUX.1-Krea-dev', 'black-forest-labs/FLUX.1-dev', 'runwayml/flux-dev'],
  stability: ['stable-diffusion-xl-1024-v1-0', 'stable-diffusion-xl-base-1.0'],
};

const DEFAULT_MODELS: Record<string, string> = {
  wavespeed: 'flux-kontext-pro',
  huggingface: 'black-forest-labs/FLUX.1-Krea-dev',
  stability: 'stable-diffusion-xl-1024-v1-0',
};

const MAX_DIMENSIONS = { maxWidth: 1024, maxHeight: 1024 } as const;

export const ImageGenerator = React.forwardRef<ImageGeneratorHandle, ImageGeneratorProps>((
  { defaultModel, defaultPrompt, onImageReady, context },
  ref
) => {
  const [provider, setProvider] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [model, setModel] = useState<string>(defaultModel || '');
  const [imageType, setImageType] = useState<ImageType>('conceptual');
  const [prompt, setPrompt] = useState<string>(defaultPrompt || '');
  const [negative, setNegative] = useState<string>('');
  const [width, setWidth] = useState<number>(1024);
  const [height, setHeight] = useState<number>(1024);
  const { isGenerating, error, result, generate } = useImageGeneration();
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ prompt: string; negative_prompt?: string; width?: number; height?: number; overlay_text?: string }>>([]);
  const [suggestionIndex, setSuggestionIndex] = useState<number>(0);
  const [sessionGeneratedCount, setSessionGeneratedCount] = useState<number>(0);

  // Fetch the active image provider from backend GPT_PROVIDER
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiClient.get('/api/images/config');
        const p: string = res.data.provider;
        setProvider(p);
      } catch {
        setProvider('wavespeed');
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const availableModels = provider ? (PROVIDER_MODELS[provider] || []) : [];
  const defaultModelForProvider = provider ? (DEFAULT_MODELS[provider] || '') : '';

  // Set initial model once provider is known, if not already set via defaultModel prop
  useEffect(() => {
    if (!model && defaultModelForProvider) {
      setModel(defaultModelForProvider);
    }
  }, [defaultModelForProvider]);

  // Sync model if current selection is invalid for the resolved provider
  useEffect(() => {
    if (provider && model && availableModels.length > 0 && !availableModels.includes(model)) {
      setModel(defaultModelForProvider);
    }
  }, [provider, availableModels.length]);

  const canGenerate = useMemo(() => prompt.trim().length > 0 && !isGenerating, [prompt, isGenerating]);
  const canOptimize = useMemo(() => prompt.trim().length > 0 && !loadingSuggestions, [prompt, loadingSuggestions]);

  // Clamp dimensions when model changes to ensure they don't exceed model limits
  useEffect(() => {
    if (width > MAX_DIMENSIONS.maxWidth) {
      setWidth(MAX_DIMENSIONS.maxWidth);
    }
    if (height > MAX_DIMENSIONS.maxHeight) {
      setHeight(MAX_DIMENSIONS.maxHeight);
    }
  }, [model]);

  // Get model-specific tips, warnings, and compatibility guidance
  const getModelGuidance = (modelName: string, imgType: ImageType): { tips: string[]; warnings: string[]; recommendations: string } => {
    const modelLower = modelName.toLowerCase();
    const tips: string[] = [];
    const warnings: string[] = [];
    let recommendations = '';

    if (modelLower === 'ideogram-v3-turbo') {
      tips.push('Excellent photorealistic quality with good text rendering');
      tips.push('Best for simple text overlays (3-5 words max)');
      if (imgType === 'chart') {
        warnings.push('Avoid complex charts. Use simple visual representations with text overlay zones, not embedded chart labels.');
        recommendations = 'Create clean, high-contrast backgrounds for text placement';
      } else if (imgType === 'diagram') {
        tips.push('Can render simple diagrams with text');
        recommendations = 'Keep diagrams simple with clear visual hierarchy';
      } else if (imgType === 'conceptual' || imgType === 'background') {
        recommendations = 'Design with text overlay zones in mind (top 20% or bottom 20% of image)';
      }
    } else if (modelLower === 'qwen-image') {
      tips.push('Fast generation, cost-effective at $0.30/image');
      tips.push('Best for abstract concepts, backgrounds, and simple compositions');
      warnings.push('Cannot render readable text — design for text overlay areas only');
      if (imgType === 'chart') {
        warnings.push('qwen-image cannot render charts with readable labels. Use abstract data metaphors only: flowing shapes, color gradients, or geometric patterns.');
        recommendations = 'Create visual metaphors and patterns that represent data concepts, never actual charts';
      } else if (imgType === 'diagram') {
        warnings.push('qwen-image cannot render diagram labels. Use abstract visual representations instead.');
        recommendations = 'Use abstract shapes and patterns to represent technical concepts';
      } else {
        recommendations = 'Design clean backgrounds with space for text overlays (never embed text)';
      }
    } else if (modelLower === 'flux-kontext-pro') {
      tips.push('Excellent typography and text rendering capabilities');
      tips.push('Improved prompt adherence for consistent results');
      tips.push('Cost-effective at $0.04 per image');
      if (imgType === 'chart' || imgType === 'diagram') {
        tips.push('Can render simple charts with text labels effectively');
        recommendations = 'Use for data visualizations that require clear text labels and typography';
      } else if (imgType === 'realistic' || imgType === 'illustration') {
        recommendations = 'Great for professional designs with text overlays or embedded typography';
      } else {
        recommendations = 'Ideal for blog images that need clear, readable text elements';
      }
    }

    return { tips, warnings, recommendations };
  };

  // Get current model guidance for display
  const modelGuidance = useMemo(() => getModelGuidance(model, imageType), [model, imageType]);

  // Professional styling with improved contrast and readability
  const textInputSx = {
    '& .MuiInputBase-input': { 
      color: '#1a1a1a',
      fontSize: '14px',
      lineHeight: '1.5'
    },
    '& .MuiInputLabel-root': { 
      color: '#5f6368',
      fontSize: '14px',
      fontWeight: 500
    },
    '& .MuiOutlinedInput-notchedOutline': { 
      borderColor: '#dadce0',
      borderWidth: '1.5px'
    },
    '&:hover .MuiOutlinedInput-notchedOutline': { 
      borderColor: '#80868b'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { 
      borderColor: '#1976d2',
      borderWidth: '2px'
    },
    backgroundColor: '#ffffff',
    '& .MuiFormHelperText-root': {
      fontSize: '12px',
      color: '#5f6368',
      marginTop: '4px'
    }
  } as const;

  // Default negative prompts for blog writer use-case
  useEffect(() => {
    if (negative.trim().length > 0) return;
    setNegative('people posing, social media graphics, posters, text rendered as images, busy compositions, watermarks, brand logos, random people, cartoon, low quality, blurry, distorted');
  }, [negative]);

  const suggestPrompt = async () => {
    console.time('[suggestPrompt] total');
    console.time('[suggestPrompt] pre-call');
    setLoadingSuggestions(true);
    setSuggestionError(null);
    try {
      const payload = {
        model,
        image_type: imageType,
        title: context?.title || context?.section?.heading || defaultPrompt || '',
        section: context?.section || undefined,
        research: context?.research || undefined,
        persona: context?.persona || undefined,
      };
      console.timeLog('[suggestPrompt] pre-call', 'calling fetchPromptSuggestions');
      console.time('[suggestPrompt] fetchPromptSuggestions');
      const suggs = await fetchPromptSuggestions(payload);
      console.timeLog('[suggestPrompt] fetchPromptSuggestions', 'response received');
      setSuggestions(suggs);
      if (suggs.length > 0) {
        setPrompt(suggs[0].prompt || '');
        if (suggs[0].negative_prompt) setNegative(suggs[0].negative_prompt);
        if (suggs[0].width) setWidth(Math.min(suggs[0].width, MAX_DIMENSIONS.maxWidth));
        if (suggs[0].height) setHeight(Math.min(suggs[0].height, MAX_DIMENSIONS.maxHeight));
        setSuggestionIndex(0);
      }
    } catch (e) {
      setSuggestionError(e instanceof Error ? e.message : 'Failed to optimize prompt. The API is unavailable.');
    } finally {
      setLoadingSuggestions(false);
      console.timeLog('[suggestPrompt] total', 'done');
      console.timeEnd('[suggestPrompt] total');
    }
  };

  const onGenerate = async () => {
    console.time('[onGenerate] total');
    if (width > MAX_DIMENSIONS.maxWidth || height > MAX_DIMENSIONS.maxHeight) {
      alert(`Resolution ${width}x${height} exceeds maximum ${MAX_DIMENSIONS.maxWidth}x${MAX_DIMENSIONS.maxHeight} for model ${model}. Please adjust the dimensions.`);
      return;
    }
    if (
      estimatedSpendAfterNext >= SESSION_COST_WARNING_THRESHOLD &&
      !window.confirm(`This session is estimated to reach $${estimatedSpendAfterNext.toFixed(2)} after this image. Continue generating?`)
    ) {
      console.timeEnd('[onGenerate] total');
      return;
    }
    
    const suggestion = suggestionIndex >= 0 && suggestionIndex < suggestions.length ? suggestions[suggestionIndex] : null;
    const req: ImageGenerationRequest = { 
      prompt, 
      negative_prompt: negative, 
      model, 
      width, 
      height,
      overlay_text: suggestion?.overlay_text || undefined,
    };
    console.time('[onGenerate] generate');
    let res;
    try {
      res = await generate(req);
    } catch {
      console.timeEnd('[onGenerate] generate');
      console.timeEnd('[onGenerate] total');
      return;
    }
    console.timeLog('[onGenerate] generate', 'done');
    setSessionGeneratedCount((count) => count + 1);
    if (onImageReady) onImageReady(res.image_base64);
    try {
      const { publishImage } = await import('../../utils/imageBus');
      publishImage({ base64: res.image_base64, provider: res.provider, model: res.model });
    } catch {}
    console.timeEnd('[onGenerate] total');
  };

  useImperativeHandle(ref, () => ({
    suggest: () => suggestPrompt(),
    generate: () => onGenerate()
  }));

  const currentModelMeta = model ? MODEL_META[model] : undefined;
  const sessionEstimatedSpend = sessionGeneratedCount * (currentModelMeta?.costUsd || 0);
  const estimatedSpendAfterNext = sessionEstimatedSpend + (currentModelMeta?.costUsd || 0);
  const lowerCostModel = availableModels
    .map((availableModel) => ({ id: availableModel, meta: MODEL_META[availableModel] }))
    .filter(({ meta }) => meta && currentModelMeta && meta.costUsd < currentModelMeta.costUsd)
    .sort((a, b) => a.meta.costUsd - b.meta.costUsd)[0];
  const costInfo = currentModelMeta
    ? { cost: currentModelMeta.cost, description: currentModelMeta.description, costUsd: currentModelMeta.costUsd }
    : { cost: '', description: '', costUsd: 0 };

  if (configLoading) {
    return (
      <Box sx={{ maxWidth: '900px', mx: 'auto', p: 3, backgroundColor: '#ffffff', borderRadius: '8px' }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      maxWidth: '900px', 
      mx: 'auto',
      p: 3,
      backgroundColor: '#ffffff',
      borderRadius: '8px'
    }}>
      {/* Prompt Input with Optimize Button Inside */}
      <Box sx={{ mb: 2, position: 'relative' }}>
        <Tooltip 
          title="Describe what you want in the image. Be specific: mention style (photorealistic, editorial, cinematic), subjects, composition, lighting, and mood. The AI uses this to generate your image." 
          placement="top" 
          arrow
        >
          <TextField 
            fullWidth
            multiline 
            minRows={4}
            maxRows={8}
            label="Describe Blog Section Image" 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate for this blog section. Be specific about style, composition, and mood..."
            sx={{
              ...textInputSx,
              '& .MuiInputBase-root': {
                paddingRight: '140px',
                paddingBottom: '8px'
              }
            }}
            helperText="Tip: Include camera settings (e.g., '50mm lens, f/2.8'), lighting direction, and visual emphasis for better results."
          />
        </Tooltip>
        <Box sx={{
          position: 'absolute',
          bottom: '32px',
          right: '14px',
          zIndex: 1
        }}>
          <Tooltip 
            title="Get AI-generated prompt suggestions optimized for blog images. Focuses on data visualization, infographics, clean layouts with text overlay areas, and conceptual illustrations." 
            placement="left" 
            arrow
          >
            <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={loadingSuggestions ? <CircularProgress size={14} /> : <AutoFixHighIcon />}
                        onClick={suggestPrompt}
                        disabled={!canOptimize}
                        sx={{
                          minWidth: 'auto',
                          px: 1.5,
                          py: 0.5,
                          fontSize: '12px',
                          textTransform: 'none',
                          background: canOptimize 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : '#f5f5f5',
                          border: 'none',
                          color: canOptimize ? '#ffffff' : '#9aa0a6',
                          boxShadow: canOptimize 
                            ? '0 2px 8px rgba(102, 126, 234, 0.3)'
                            : 'none',
                          '&:hover': {
                            background: canOptimize
                              ? 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'
                              : '#f5f5f5',
                            boxShadow: canOptimize
                              ? '0 4px 12px rgba(102, 126, 234, 0.4)'
                              : 'none',
                            transform: canOptimize ? 'translateY(-1px)' : 'none'
                          },
                          '&:disabled': {
                            background: '#f5f5f5',
                            color: '#9aa0a6',
                            border: 'none'
                          },
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {loadingSuggestions ? 'Optimizing...' : 'Optimize Prompt'}
                      </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Advanced Options - Always Visible */}
      <Box sx={{ 
        mb: 2, 
        p: 2, 
        border: '1.5px solid #e8eaed', 
        borderRadius: '6px', 
        backgroundColor: '#f8f9fa'
      }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={5}>
              <FormControl fullWidth>
                <InputLabel id="model-select-label" sx={{ fontSize: '14px' }}>Model</InputLabel>
                <Select 
                  labelId="model-select-label"
                  value={model} 
                  label="Model"
                  onChange={(e) => setModel(e.target.value)}
                  sx={{
                    ...textInputSx,
                    '& .MuiSelect-select': {
                      cursor: 'pointer'
                    }
                  }}
                  MenuProps={{ 
                    disablePortal: true,
                    PaperProps: { 
                      sx: { 
                        zIndex: 2200,
                        color: '#202124',
                        maxHeight: 300,
                        '& .MuiMenuItem-root': {
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: '#f5f5f5'
                          }
                        }
                      } 
                    },
                    anchorOrigin: {
                      vertical: 'bottom',
                      horizontal: 'left',
                    },
                    transformOrigin: {
                      vertical: 'top',
                      horizontal: 'left',
                    }
                  }}
                >
                  {availableModels.map((m) => {
                    const meta = MODEL_META[m];
                    return (
                      <MenuItem key={m} value={m}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{meta?.label || m}</Typography>
                          {meta && (
                            <Typography variant="caption" sx={{ color: '#5f6368' }}>
                              {meta.cost} — {meta.description}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="image-type-select-label" sx={{ fontSize: '14px' }}>Image Type</InputLabel>
                <Select 
                  labelId="image-type-select-label"
                  value={imageType} 
                  label="Image Type"
                  onChange={(e) => setImageType(e.target.value as ImageType)}
                  sx={{
                    ...textInputSx,
                    '& .MuiSelect-select': {
                      cursor: 'pointer'
                    }
                  }}
                  MenuProps={{ 
                    disablePortal: true,
                    PaperProps: { 
                      sx: { 
                        zIndex: 2200,
                        color: '#202124',
                        maxHeight: 300,
                        '& .MuiMenuItem-root': {
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: '#f5f5f5'
                          }
                        }
                      } 
                    }
                  }}
                >
                  <MenuItem value="realistic">Realistic (Photography)</MenuItem>
                  <MenuItem value="chart">Chart/Data Visualization</MenuItem>
                  <MenuItem value="conceptual">Conceptual (Abstract)</MenuItem>
                  <MenuItem value="diagram">Diagram (Technical)</MenuItem>
                  <MenuItem value="illustration">Illustration (Stylized)</MenuItem>
                  <MenuItem value="background">Background (Text Overlay)</MenuItem>
                </Select>
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: '#5f6368', fontSize: '12px' }}>
                  Select the type of image you want to generate
                </Typography>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={1.5}>
              <Tooltip 
                title={`Image width in pixels. Max: ${MAX_DIMENSIONS.maxWidth}px. Recommended: 1024 for square images.`} 
                placement="top" 
                arrow
              >
                <TextField 
                  fullWidth 
                  type="number" 
                  label="Width" 
                  value={width} 
                  onChange={(e) => {
                    const newWidth = parseInt(e.target.value || '0', 10);
                    setWidth(Math.min(newWidth, MAX_DIMENSIONS.maxWidth));
                  }} 
                  inputProps={{ min: 64, max: MAX_DIMENSIONS.maxWidth }}
                  sx={textInputSx} 
                  error={width > MAX_DIMENSIONS.maxWidth}
                  helperText={width > MAX_DIMENSIONS.maxWidth ? `Max: ${MAX_DIMENSIONS.maxWidth}px` : ''}
                />
              </Tooltip>
            </Grid>
            <Grid item xs={6} md={1.5}>
              <Tooltip 
                title={`Image height in pixels. Max: ${MAX_DIMENSIONS.maxHeight}px. Recommended: 1024 for square images.`} 
                placement="top" 
                arrow
              >
                <TextField 
                  fullWidth 
                  type="number" 
                  label="Height" 
                  value={height} 
                  onChange={(e) => {
                    const newHeight = parseInt(e.target.value || '0', 10);
                    setHeight(Math.min(newHeight, MAX_DIMENSIONS.maxHeight));
                  }} 
                  inputProps={{ min: 64, max: MAX_DIMENSIONS.maxHeight }}
                  sx={textInputSx} 
                  error={height > MAX_DIMENSIONS.maxHeight}
                  helperText={height > MAX_DIMENSIONS.maxHeight ? `Max: ${MAX_DIMENSIONS.maxHeight}px` : ''}
                />
              </Tooltip>
            </Grid>
          </Grid>
          
          {/* Cost Chip */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={`Estimated Cost: ${costInfo.cost}/image`} 
              size="small" 
              color="primary" 
              variant="outlined"
              sx={{ fontSize: '12px', fontWeight: 500 }}
            />
            <Typography variant="caption" sx={{ color: '#5f6368' }}>
              {costInfo.description}
            </Typography>
          </Box>
          <Box sx={{ mt: 1.5 }}>
            <Alert
              severity={lowerCostModel ? 'info' : 'success'}
              icon={<InfoIcon />}
              sx={{
                py: 0.75,
                backgroundColor: lowerCostModel ? '#eff6ff' : '#f0fdf4',
                '& .MuiAlert-message': { width: '100%' }
              }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Cost guard
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${sessionGeneratedCount} generated this session`}
                  sx={{ fontSize: '11px' }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Session estimate: $${sessionEstimatedSpend.toFixed(2)}`}
                  sx={{ fontSize: '11px' }}
                />
                {lowerCostModel ? (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setModel(lowerCostModel.id)}
                    sx={{ textTransform: 'none', fontSize: '12px', fontWeight: 700, px: 1 }}
                  >
                    Switch to {lowerCostModel.meta.label} ({lowerCostModel.meta.cost})
                  </Button>
                ) : (
                  <Typography variant="caption" sx={{ color: '#166534' }}>
                    Current model is the lowest-cost option for this provider.
                  </Typography>
                )}
              </Box>
            </Alert>
          </Box>
        </Box>

        {/* Model-Specific Guidance */}
        {(() => {
          const guidance = modelGuidance;
          if (guidance.tips.length === 0 && guidance.warnings.length === 0 && !guidance.recommendations) return null;
          
          return (
            <Box sx={{ mb: 2 }}>
              {guidance.warnings.length > 0 && (
                <Alert 
                  severity="warning" 
                  icon={<InfoIcon />}
                  sx={{ 
                    mb: 1,
                    backgroundColor: '#fff3cd',
                    '& .MuiAlert-icon': { color: '#856404' },
                    '& .MuiAlert-message': { color: '#856404' }
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Important Notes:
                  </Typography>
                  {guidance.warnings.map((warning: string, idx: number) => (
                    <Typography key={idx} variant="body2" sx={{ fontSize: '13px', mb: 0.5 }}>
                      • {warning}
                    </Typography>
                  ))}
                </Alert>
              )}
              
              {(guidance.tips.length > 0 || guidance.recommendations) && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  {guidance.tips.length > 0 && (
                    <Tooltip
                      title={
                        <Box>
                          {guidance.tips.map((tip: string, idx: number) => (
                            <Typography key={idx} variant="body2" sx={{ fontSize: '13px', mb: 0.5 }}>
                              • {tip}
                            </Typography>
                          ))}
                        </Box>
                      }
                      placement="top"
                      arrow
                    >
                      <Chip
                        label={`💡 Best Practices for ${model}`}
                        size="small"
                        variant="outlined"
                        sx={{ cursor: 'pointer', borderColor: '#1976d2', color: '#1565c0', fontWeight: 500 }}
                      />
                    </Tooltip>
                  )}
                  
                  {guidance.recommendations && (
                    <Tooltip
                      title={guidance.recommendations}
                      placement="top"
                      arrow
                    >
                      <Chip
                        label="✅ Recommendation"
                        size="small"
                        variant="outlined"
                        sx={{ cursor: 'pointer', borderColor: '#155724', color: '#155724', fontWeight: 500 }}
                      />
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          );
        })()}

      {/* Loading indicators */}
      {loadingSuggestions && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: '#5f6368' }}>
            Optimizing prompt...
          </Typography>
        </Box>
      )}
      {isGenerating && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: '#5f6368' }}>
            Generating image... This may take 10-30 seconds
          </Typography>
        </Box>
      )}

      {/* Negative Prompt */}
      <Box sx={{ mb: 3 }}>
        <Tooltip 
          title="List elements you want to avoid in the image (e.g., blurry, cartoon, watermark, low quality). This helps the AI exclude unwanted features." 
          placement="top" 
          arrow
        >
          <TextField 
            fullWidth
            multiline 
            minRows={2}
            maxRows={4}
            label="Negative Prompt (optional)" 
            value={negative} 
            onChange={(e) => setNegative(e.target.value)}
            placeholder="Elements to avoid: blurry, distorted, watermark, low quality..."
            sx={textInputSx}
            helperText="Common exclusions: text artifacts, brand logos, distorted anatomy, oversaturation, noise"
          />
        </Tooltip>
      </Box>

      {/* Generate Button */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Tooltip 
          title="Generate the image using your current prompt and settings. The process may take 10-30 seconds depending on provider and image size." 
          placement="top" 
          arrow
        >
          <span>
            <Button 
              variant="contained" 
              disabled={!canGenerate} 
              onClick={onGenerate} 
              startIcon={isGenerating ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{
                px: 3,
                py: 1.2,
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'none',
                background: canGenerate
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
                  : 'linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%)',
                border: 'none',
                color: canGenerate ? '#ffffff' : '#9e9e9e',
                boxShadow: canGenerate
                  ? '0 4px 15px rgba(102, 126, 234, 0.4)'
                  : 'none',
                '&:hover': {
                  background: canGenerate
                    ? 'linear-gradient(135deg, #764ba2 0%, #667eea 50%, #f093fb 100%)'
                    : 'linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%)',
                  boxShadow: canGenerate
                    ? '0 6px 20px rgba(102, 126, 234, 0.5)'
                    : 'none',
                  transform: canGenerate ? 'translateY(-2px)' : 'none'
                },
                '&:disabled': {
                  background: 'linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%)',
                  color: '#9e9e9e',
                  boxShadow: 'none'
                },
                transition: 'all 0.3s ease'
              }}
            >
              {isGenerating ? 'Generating…' : 'Generate Image'}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {/* Suggestion Error Display */}
      {suggestionError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setSuggestionError(null)}>
          <Typography variant="body2">{suggestionError}</Typography>
        </Alert>
      )}

      {/* Generated Image */}
      {result && (
        <Box sx={{ mb: 2 }}>
          <Card sx={{ 
            maxWidth: 512, 
            mx: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <CardMedia 
              component="img" 
              image={`data:image/png;base64,${result.image_base64}`} 
              alt="Generated image"
              sx={{ width: '100%', height: 'auto' }}
            />
          </Card>
        </Box>
      )}

      {/* Prompt Suggestions Tabs */}
      {suggestions.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#202124' }}>
            Optimized Prompt Suggestions
          </Typography>
          <Tooltip 
            title="Browse through AI-generated prompt suggestions. Each tab shows a different prompt optimized for your section and provider. Click a tab to preview and auto-fill the prompt fields." 
            placement="top" 
            arrow
          >
            <Tabs 
              value={suggestionIndex} 
              onChange={(e, v) => {
                setSuggestionIndex(v);
                const s = suggestions[v];
                if (s) {
                  setPrompt(s.prompt || '');
                  setNegative(s.negative_prompt || '');
                  if (s.width) setWidth(s.width);
                  if (s.height) setHeight(s.height);
                }
              }} 
              variant="scrollable" 
              scrollButtons="auto"
              sx={{
                borderBottom: '1px solid #e8eaed',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  minHeight: 40
                }
              }}
            >
              {suggestions.map((_, i) => (
                <Tab key={i} label={`Suggestion ${i + 1}`} />
              ))}
            </Tabs>
          </Tooltip>
          <Box sx={{ 
            p: 2, 
            border: '1px solid #e8eaed', 
            borderTop: 'none', 
            borderRadius: '0 0 8px 8px', 
            backgroundColor: '#f8f9fa'
          }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#202124', mb: 1 }}>
              {suggestions[suggestionIndex]?.prompt}
            </Typography>
            {suggestions[suggestionIndex]?.negative_prompt && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #e8eaed' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', display: 'block', mb: 0.5 }}>
                  Negative Prompt:
                </Typography>
                <Typography variant="caption" sx={{ color: '#5f6368' }}>
                  {suggestions[suggestionIndex]?.negative_prompt}
                </Typography>
              </Box>
            )}
            {suggestions[suggestionIndex]?.overlay_text && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #e8eaed' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', display: 'block', mb: 0.5 }}>
                  Suggested Text Overlay
                </Typography>
                <Chip 
                  label={suggestions[suggestionIndex]?.overlay_text}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '12px', borderColor: '#9aa0a6', color: '#3c4043' }}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
});

export default ImageGenerator;
