import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Stack,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  Tooltip,
  IconButton,
  Alert,
  Chip,
  // Divider,
  Modal,
  Fade,
  Backdrop,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText
} from '@mui/material';
import {
  CloudUpload,
  // // Refresh,
  PhotoCamera,
  AutoFixHigh,
  InfoOutlined,
  Close,
  // PlayArrow,
  HelpOutline,
  // Palette,
  Psychology,
  // AutoFixNormal,
  Create,
  CheckCircle,
  Fullscreen,
  Lightbulb,
  RestartAlt,
  Undo
} from '@mui/icons-material';
import { OperationButton } from '../../../shared/OperationButton';
import {
  getLatestBrandAvatar,
  generateBrandAvatar,
  createAvatarVariation,
  enhanceBrandAvatar,
  optimizeAvatarPrompt,
  setBrandAvatar,
  AssetResponse
} from '../../../../api/brandAssets';
import { getApiUrl } from '../../../../api/client';
import { ImageGenerationModal } from '../../../shared/ImageGenerationModal';
import { 
  ImageGenerationSettings, 
  ImageModel 
} from '../../../shared/ImageGenerationModal.types';
import { UsedInStrip } from '../../PersonaStep/UsedInStrip';
import { 
  BRAND_AVATAR_PRESETS, 
  BRAND_AVATAR_THEME, 
  BRAND_AVATAR_RECOMMENDATIONS 
} from '../../../shared/ImageGenerationPresets';

type GenerationMode = 'generate' | 'variation' | 'enhance';

/* const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`; */

export const BrandAvatarStudio: React.FC<{ domainName?: string; onAvatarSet?: () => void }> = ({ domainName, onAvatarSet }) => {
  const [mode, setMode] = useState<GenerationMode>('generate');
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const STORAGE_KEY = 'brand_avatar_result';
  const STORAGE_BACKUP_KEY = 'brand_avatar_result_backup';

  const [resultImage, setResultImage] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved && saved.length > 0 ? saved : null;
    } catch { return null; }
  });

  const [archivedResultImage, setArchivedResultImage] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BACKUP_KEY);
      return saved && saved.length > 0 ? saved : null;
    } catch { return null; }
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false);
  const [style, setStyle] = useState<'Auto' | 'Fiction' | 'Realistic'>('Auto');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [renderingSpeed, setRenderingSpeed] = useState<'Turbo' | 'Default' | 'Quality'>('Quality');
  const [model, setModel] = useState<ImageModel>('ideogram-v3-turbo');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync result to localStorage
  React.useEffect(() => {
    try {
      if (resultImage) {
        localStorage.setItem(STORAGE_KEY, resultImage);
      }
    } catch (e) {
      console.warn('Failed to save brand avatar to localStorage', e);
    }
  }, [resultImage]);

  // Sync archived result to localStorage
  React.useEffect(() => {
    try {
      if (archivedResultImage) {
        localStorage.setItem(STORAGE_BACKUP_KEY, archivedResultImage);
      } else {
        localStorage.removeItem(STORAGE_BACKUP_KEY);
      }
    } catch (e) {
      console.warn('Failed to save archived avatar to localStorage', e);
    }
  }, [archivedResultImage]);

  // Load latest avatar on mount
  React.useEffect(() => {
    const loadLatestAvatar = async () => {
      try {
        const response = await getLatestBrandAvatar();
        if (response.success) {
          if (response.prompt) setPrompt(response.prompt);
          // Only load from backend if we don't have a local draft
          if (response.image_url && !localStorage.getItem(STORAGE_KEY)) {
            setResultImage(response.image_url);
            setArchivedResultImage(null); // Clear archive on new load from backend
          }
        }
      } catch (err) {
        console.error("Failed to load latest avatar:", err);
      }
    };
    loadLatestAvatar();
  }, []);

  const getImgSrc = (src: string) => {
    if (src.startsWith('http')) {
      return src;
    }
    if (src.startsWith('/')) {
      const apiUrl = getApiUrl();
      return `${apiUrl}${src}`;
    }
    return `data:image/png;base64,${src}`;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResultImage(null);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOptimizePrompt = async () => {
    if (!prompt) return;
    setOptimizing(true);
    try {
      const response = await optimizeAvatarPrompt(prompt);
      if (response.success && response.optimized_prompt) {
        setPrompt(response.optimized_prompt);
      }
    } catch (e) {
      console.error('Failed to optimize prompt', e);
    } finally {
      setOptimizing(false);
    }
  };

  const handleModalGenerate = async (settings: ImageGenerationSettings) => {
    setIsGenerationModalOpen(false);
    setLoading(true);
    setArchivedResultImage(null);
    setError(null);
    setSuccessMessage(null);
    
    // Update local prompt to match modal
    setPrompt(settings.prompt);

    try {
      const response = await generateBrandAvatar(
        settings.prompt,
        settings.style === 'Auto' ? undefined : settings.style,
        settings.aspectRatio,
        settings.model,
        settings.renderingSpeed
      );

      if (response.success && response.image_base64) {
        setResultImage(response.image_base64);
      } else {
        setError(response.error || 'Operation failed');
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred during generation');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setArchivedResultImage(null);
    setError(null);
    setSuccessMessage(null);
    try {
      let response: AssetResponse;
      if (mode === 'generate') {
         response = await generateBrandAvatar(
          prompt,
          style === 'Auto' ? undefined : style,
          aspectRatio,
          model,
          renderingSpeed
        );
      } else if (mode === 'variation') {
        if (!selectedFile) throw new Error('Please upload an image first');
        response = await createAvatarVariation(prompt, selectedFile);
      } else {
        if (!selectedFile) throw new Error('Please upload an image first');
        response = await enhanceBrandAvatar(selectedFile);
      }

      if (response.success && response.image_base64) {
        setResultImage(response.image_base64);
      } else {
        setError(response.error || 'Operation failed');
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred during generation');
    } finally {
      setLoading(false);
    }
  };

  const handleReDo = () => {
    if (resultImage) {
      setArchivedResultImage(resultImage);
    }
    setResultImage(null);
    setSuccessMessage(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleRestore = () => {
    if (archivedResultImage) {
      setResultImage(archivedResultImage);
      setArchivedResultImage(null);
      setSuccessMessage('Restored previous avatar');
    }
  };

  const handleSetAsBrandAvatar = async () => {
    if (!resultImage) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const labelDomain = domainName ? domainName.replace(/^www\./i, '') : undefined;
      const resp = await setBrandAvatar({
        image_base64: resultImage,
        domain_name: labelDomain,
        title: labelDomain ? `Brand Avatar (${labelDomain})` : 'Brand Avatar',
      });
      if (resp.success) {
        setSuccessMessage(resp.message || 'Avatar set as active');
        // Persist selection state locally
        try {
          localStorage.setItem('brand_avatar_selection', JSON.stringify({
            set: true,
            timestamp: new Date().toISOString(),
            url: resp.image_url || (resultImage.startsWith('data:') ? 'base64' : resultImage)
          }));
        } catch (e) {
          console.warn('Failed to save avatar selection to storage', e);
        }
        if (onAvatarSet) onAvatarSet();
      } else {
        setError(resp.error || 'Failed to save brand avatar');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save brand avatar');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = (preset: any) => {
    setPrompt(preset.prompt);
    setStyle(preset.style);
    setRenderingSpeed(preset.renderingSpeed);
    setAspectRatio(preset.aspectRatio);
    if (preset.model) setModel(preset.model);
    if (preset.image) setResultImage(preset.image);
    setShowExamplesModal(false);
  };

  const inputSx = {
    '& .MuiInputLabel-root': { 
      color: '#374151', 
      fontSize: '11px', 
      fontWeight: 600,
      mb: 0.25,
    },
    '& .MuiOutlinedInput-root': { 
      height: '32px', 
      bgcolor: '#FFFFFF',
      borderRadius: '8px',
      fontSize: '12px',
      color: '#111827',
      '& fieldset': { borderColor: '#D1D5DB', borderWidth: '1px' },
      '&:hover fieldset': { borderColor: '#7C3AED' },
      '&.Mui-focused fieldset': { borderColor: '#7C3AED', borderWidth: '2px' },
    },
    '& .MuiInputBase-input': { 
      height: '32px', 
      color: '#111827', 
      fontWeight: 400,
      padding: '0 8px',
      '&::placeholder': { color: '#6B7280', opacity: 1 }
    },
  };

  const cardSx = {
    p: 1.5,
    borderRadius: '12px',
    bgcolor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    height: '100%'
  };

  const gradientAccent = 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)';

  return (
    <Box sx={{ py: 1, px: 0, minHeight: '100%' }}>
      <Stack spacing={1.5}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Box>
              <Typography variant="h6" sx={{ color: '#111827', fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1rem' }}>
                Brand Visual {domainName ? `for ${domainName}` : ''}
              </Typography>
              <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.75rem' }}>
                The face of your brand — appears in every image, video, and social card.
              </Typography>
            </Box>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<HelpOutline sx={{ fontSize: 14 }} />}
              onClick={() => setShowInfoModal(true)}
              size="small"
              sx={{ 
                color: '#7C3AED', 
                fontWeight: 700, 
                textTransform: 'none',
                fontSize: '0.7rem',
                '&:hover': { bgcolor: 'rgba(124, 58, 237, 0.05)' }
              }}
            >
              What, How & Why
            </Button>
            <Tooltip 
              title={
                <Box sx={{ p: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Avatar Design Guidance</Typography>
                  <Typography variant="body2" component="div" sx={{ opacity: 0.9, fontSize: '0.75rem' }}>
                    • Detailed prompts yield consistent brand aesthetics.<br/>
                    • Mention style (e.g., minimalist, 3D, sketch).<br/>
                    • Specify lighting and color palette for better alignment.<br/>
                    • High-resolution reference images improve variations.
                  </Typography>
                </Box>
              }
              arrow
              placement="left"
            >
              <Chip
                icon={<InfoOutlined sx={{ color: '#FFFFFF !important', fontSize: '12px' }} />}
                label="Quality Tips"
                size="small"
                sx={{
                  background: gradientAccent,
                  color: '#FFFFFF',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  height: '22px',
                  fontSize: '0.65rem',
                  boxShadow: '0 2px 6px rgba(124, 58, 237, 0.2)',
                  cursor: 'help'
                }}
              />
            </Tooltip>
          </Stack>
        </Box>
          <Box sx={{ pl: 0.5, mb: 0.5 }}>
            <UsedInStrip
              size="sm"
              tools={['image-studio', 'video', 'podcast', 'linkedin', 'blog']}
            />
          </Box>
        </Box>

        <Grid container spacing={1.5}>
          {/* Configuration Column - Reduced Width (40%) */}
          {!resultImage && (
          <Grid item xs={12} md={5}>
            <Paper sx={cardSx} elevation={0}>
              <Stack spacing={1.5}>
                {/* Restore Option */}
                {archivedResultImage && (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Undo />}
                    onClick={handleRestore}
                    sx={{ 
                      textTransform: 'none', 
                      fontWeight: 600,
                      borderStyle: 'dashed',
                      borderColor: '#7C3AED',
                      color: '#7C3AED',
                      bgcolor: 'rgba(124, 58, 237, 0.05)',
                      '&:hover': { 
                        borderStyle: 'solid',
                        bgcolor: 'rgba(124, 58, 237, 0.1)'
                      }
                    }}
                  >
                    Restore Last Generated Avatar
                  </Button>
                )}
                <Box>
                  <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#111827', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.85rem' }}>
                    <PhotoCamera sx={{ color: '#7C3AED', fontSize: 16 }} />
                    Avatar Configuration
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', fontSize: '0.7rem' }}>
                    Design your brand's digital face. Choose your generation mode below.
                  </Typography>

                  <RadioGroup
                    value={mode}
                    onChange={(e) => setMode(e.target.value as GenerationMode)}
                    sx={{ 
                      mb: 1.5, 
                      display: 'flex', 
                      flexDirection: 'row', 
                      gap: 1,
                      '& .MuiFormControlLabel-label': { color: '#111827', fontWeight: 600, fontSize: '0.7rem' }
                    }}
                  >
                    {[
                      { value: 'generate', label: 'Create Your AI Model', tip: 'Synthesize a completely new brand avatar from text' },
                      { value: 'variation', label: 'Your Look-Alike Avatar', tip: 'Create variations based on a reference photo' },
                      { value: 'enhance', label: 'AI enhance Your Photo', tip: 'Upscale and refine an existing brand image' }
                    ].map((m) => (
                      <Tooltip key={m.value} title={m.tip} arrow>
                        <FormControlLabel 
                          value={m.value} 
                          control={<Radio size="small" sx={{ p: 0.5, color: '#7C3AED', '&.Mui-checked': { color: '#EC4899' } }} />} 
                          label={m.label} 
                        />
                      </Tooltip>
                    ))}
                  </RadioGroup>
                </Box>

                {mode === 'generate' && (
                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                         <FormControl fullWidth size="small">
                            <InputLabel id="style-select-label" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Style</InputLabel>
                            <Select
                              labelId="style-select-label"
                              value={style}
                              label="Style"
                              onChange={(e) => setStyle(e.target.value as any)}
                              sx={{ 
                                height: '36px', 
                                fontSize: '0.8rem',
                                bgcolor: '#fff',
                                color: '#111827',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' }
                              }}
                            >
                              <MenuItem value="Auto">Auto</MenuItem>
                              <MenuItem value="Fiction">Fiction</MenuItem>
                              <MenuItem value="Realistic">Realistic</MenuItem>
                            </Select>
                            <FormHelperText sx={{ fontSize: '0.65rem', mt: 0.5 }}>Realistic for professional, Fiction for creative.</FormHelperText>
                         </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="ratio-select-label" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Aspect Ratio</InputLabel>
                            <Select
                              labelId="ratio-select-label"
                              value={aspectRatio}
                              label="Aspect Ratio"
                              onChange={(e) => setAspectRatio(e.target.value as any)}
                              sx={{ 
                                height: '36px', 
                                fontSize: '0.8rem',
                                bgcolor: '#fff',
                                color: '#111827',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' }
                              }}
                            >
                              <MenuItem value="1:1">1:1 (Square)</MenuItem>
                              <MenuItem value="16:9">16:9 (Landscape)</MenuItem>
                              <MenuItem value="9:16">9:16 (Portrait)</MenuItem>
                            </Select>
                            <FormHelperText sx={{ fontSize: '0.65rem', mt: 0.5 }}>1:1 for social profiles, 16:9 for banners.</FormHelperText>
                         </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="speed-select-label" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>Quality</InputLabel>
                            <Select
                              labelId="speed-select-label"
                              value={renderingSpeed}
                              label="Quality"
                              onChange={(e) => setRenderingSpeed(e.target.value as any)}
                              sx={{ 
                                height: '36px', 
                                fontSize: '0.8rem',
                                bgcolor: '#fff',
                                color: '#111827',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB' }
                              }}
                            >
                              <MenuItem value="Turbo">Turbo</MenuItem>
                              <MenuItem value="Default">Balanced</MenuItem>
                              <MenuItem value="Quality">High Quality</MenuItem>
                            </Select>
                            <FormHelperText sx={{ fontSize: '0.65rem', mt: 0.5 }}>Quality for final results, Turbo for testing.</FormHelperText>
                         </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Hidden input for other modes */}
                {(mode === 'variation' || mode === 'enhance') && (
                  <Box>
                    <Tooltip title="Upload the base image for AI processing" arrow>
                      <Typography sx={inputSx['& .MuiInputLabel-root']}>
                        {mode === 'variation' ? 'Reference Image' : 'Source Image'}
                      </Typography>
                    </Tooltip>
                    {!previewUrl ? (
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        startIcon={<CloudUpload sx={{ fontSize: 20 }} />}
                        sx={{ 
                          py: 1.5, 
                          borderStyle: 'dashed', 
                          borderRadius: '8px',
                          borderColor: '#E0E0E0',
                          color: 'text.primary',
                          fontSize: '0.8rem',
                          '&:hover': { borderColor: '#7C3AED', bgcolor: 'rgba(124, 58, 237, 0.05)' }
                        }}
                      >
                        Upload Image
                        <input type="file" hidden accept="image/*" onChange={handleFileSelect} ref={fileInputRef} />
                      </Button>
                    ) : (
                      <Box sx={{ position: 'relative', width: 'fit-content' }}>
                        <Box
                          component="img"
                          src={previewUrl}
                          sx={{ width: 80, height: 80, borderRadius: '8px', objectFit: 'cover', border: '2px solid #FFFFFF', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                        />
                        <IconButton
                          size="small"
                          onClick={handleClearFile}
                          sx={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            bgcolor: '#FFFFFF',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            p: 0.5,
                            '&:hover': { bgcolor: '#F5F5F5' }
                          }}
                        >
                          <Close sx={{ fontSize: 14, color: 'text.primary' }} />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                )}

                {(mode === 'generate' || mode === 'variation') && (
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Tooltip title="Describe the visual appearance of your brand avatar" arrow>
                        <Typography sx={inputSx['& .MuiInputLabel-root']}>
                          Creative Prompt
                        </Typography>
                      </Tooltip>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          label="Examples"
                          size="small"
                          icon={<Lightbulb sx={{ fontSize: '12px !important' }} />}
                          onClick={() => setShowExamplesModal(true)}
                          sx={{
                            height: '20px',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            bgcolor: '#F3E8FF',
                            color: '#7C3AED',
                            border: '1px solid #E9D5FF',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#E9D5FF' }
                          }}
                        />
                        <Button
                          size="small"
                          startIcon={optimizing ? <CircularProgress size={10} /> : <AutoFixHigh sx={{ fontSize: 14 }} />}
                          onClick={handleOptimizePrompt}
                          disabled={!prompt || optimizing}
                          sx={{ 
                            textTransform: 'none', 
                            fontWeight: '700',
                            color: '#EC4899',
                            fontSize: '0.7rem',
                            minWidth: 'auto',
                            p: 0.5,
                            '&:hover': { bgcolor: 'transparent', opacity: 0.8 }
                          }}
                        >
                          AI Optimize
                        </Button>
                      </Stack>
                    </Stack>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={mode === 'generate' 
                        ? "e.g., A professional female entrepreneur, minimalist aesthetic..." 
                        : "e.g., Maintain the same person but change background..."}
                      sx={{
                        ...inputSx, 
                        '& .MuiOutlinedInput-root': { 
                          ...inputSx['& .MuiOutlinedInput-root'], 
                          height: 'auto', 
                          fontSize: '0.8rem', 
                          color: '#111827',
                          bgcolor: '#FFFFFF'
                        },
                        '& .MuiInputBase-input': {
                          ...inputSx['& .MuiInputBase-input'],
                          height: 'auto',
                          color: '#111827',
                          WebkitTextFillColor: '#111827'
                        }
                      }}
                      inputProps={{ 'aria-label': 'Avatar Description' }}
                    />
                  </Box>
                )}

                {mode !== 'generate' && (
                  <OperationButton
                    operation={{
                      provider: 'fal-ai',
                      operation_type: mode === 'variation' ? 'image_variation' : 'image_upscale',
                      actual_provider_name: 'fal-ai'
                    }}
                    label={mode === 'variation' ? 'Create Variation' : 'Enhance Image'}
                    loading={loading || optimizing}
                    onClick={handleGenerate}
                    startIcon={mode === 'variation' ? <Psychology /> : <AutoFixHigh />}
                    variant="contained"
                    fullWidth
                    sx={{
                      background: gradientAccent,
                      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                      '&:hover': { boxShadow: '0 6px 16px rgba(124, 58, 237, 0.4)' },
                      py: 1
                    }}
                  />
                )}
                
                {mode === 'generate' && (
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<Create />}
                    onClick={handleGenerate}
                    disabled={loading || !prompt}
                    sx={{
                      background: gradientAccent,
                      color: 'white',
                      fontWeight: 700,
                      py: 1.5,
                      borderRadius: '8px',
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                      '&:hover': {
                        boxShadow: '0 6px 16px rgba(124, 58, 237, 0.4)',
                      }
                    }}
                  >
                    {loading ? 'Generating...' : 'Generate Avatar'}
                  </Button>
                )}

                {/* Hidden input for other modes */}
                {mode === 'generate' && (
                    <Box sx={{ display: 'none' }}>
                       <TextField value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                    </Box>
                )}

                {error && <Alert severity="error" sx={{ borderRadius: '8px', py: 0, fontSize: '0.8rem' }}>{error}</Alert>}
                {successMessage && <Alert severity="success" sx={{ borderRadius: '8px', py: 0, fontSize: '0.8rem' }}>{successMessage}</Alert>}

                {/* Info & Cost Section */}
                <Alert severity="info" sx={{ 
                  borderRadius: '8px', 
                  py: 0, 
                  fontSize: '0.75rem', 
                  '& .MuiAlert-icon': { fontSize: '16px', mt: 0.5 },
                  bgcolor: '#F3F4F6',
                  color: '#4B5563',
                  border: '1px solid #E5E7EB'
                }}>
                  <Typography variant="caption" display="block" fontWeight={600} gutterBottom>
                    Cost & Usage
                  </Typography>
                  Generations cost approx. $0.04 - $0.08 per image. Use detailed prompts and high-quality reference images for best results.
                </Alert>

                <Alert severity="info" icon={<Lightbulb fontSize="inherit" />} sx={{ 
                  borderRadius: '8px', 
                  py: 0, 
                  fontSize: '0.75rem', 
                  '& .MuiAlert-icon': { fontSize: '16px', mt: 0.5 },
                  bgcolor: '#F0F9FF',
                  color: '#0369A1',
                  border: '1px solid #BAE6FD'
                }}>
                   <Typography variant="caption" display="block" fontWeight={600} gutterBottom>
                    Pro Tip
                  </Typography>
                  Use the <strong>Examples</strong> button to load optimized templates.
                </Alert>

              </Stack>
            </Paper>
          </Grid>
          )}
          
          {/* Right Column - Preview - Increased Width (60%) */}
          <Grid item xs={12} md={resultImage ? 12 : 7}>
            <Paper sx={{ ...cardSx, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', bgcolor: '#F9FAFB' }} elevation={0}>
              {loading ? (
                <Stack alignItems="center" spacing={2}>
                  <CircularProgress size={40} sx={{ color: '#7C3AED' }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Creating your masterpiece...
                  </Typography>
                </Stack>
              ) : resultImage ? (
                <Stack spacing={2} sx={{ width: '100%', height: '100%' }}>
                  <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <Box 
                      component="img" 
                      src={getImgSrc(resultImage)}
                      sx={{ 
                        width: '100%', 
                        height: 'auto', 
                        maxHeight: '400px', 
                        objectFit: 'contain', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }} 
                    />
                    {/* Checkmark Overlay if Saved */}
                    {successMessage && (
                      <Box sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        bgcolor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '50%',
                        p: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                      }}>
                        <CheckCircle sx={{ color: '#10B981', fontSize: 24 }} />
                      </Box>
                    )}
                    {/* Full Screen Button */}
                    <IconButton
                      onClick={() => setShowFullScreen(true)}
                      sx={{
                        position: 'absolute',
                        bottom: 10,
                        right: 10,
                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' }
                      }}
                      size="small"
                    >
                      <Fullscreen fontSize="small" />
                    </IconButton>
                  </Box>
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Button 
                      variant="contained" 
                      onClick={handleSetAsBrandAvatar} 
                      disabled={saving || !!successMessage}
                      size="small"
                      startIcon={successMessage ? <CheckCircle /> : undefined}
                      sx={{ 
                        background: successMessage ? '#10B981' : gradientAccent, 
                        textTransform: 'none', 
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        '&:disabled': {
                          background: successMessage ? '#10B981' : '#E5E7EB',
                          color: successMessage ? 'white' : 'rgba(0, 0, 0, 0.26)'
                        }
                      }}
                    >
                      {saving ? 'Saving...' : successMessage ? 'Active Avatar' : 'Use This Avatar'}
                    </Button>
                    <Button 
                      variant="outlined"
                      onClick={handleReDo}
                      size="small"
                      startIcon={<RestartAlt />}
                      sx={{ 
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: '#E5E7EB',
                        color: '#6B7280',
                        '&:hover': { borderColor: '#9CA3AF', bgcolor: '#F9FAFB' }
                      }}
                    >
                      Redo
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <>
                  <Stack alignItems="center" spacing={1} sx={{ opacity: 0.5, mb: 4 }}>
                    <PhotoCamera sx={{ fontSize: 48, color: '#9CA3AF' }} />
                    <Typography variant="body2" color="text.secondary">
                      Preview will appear here
                    </Typography>
                  </Stack>
  
                  <Box sx={{ width: '100%', px: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: '#374151', fontSize: '0.8rem' }}>
                      Or start with a template:
                    </Typography>
                    <Grid container spacing={1.5}>
                      {BRAND_AVATAR_PRESETS.slice(0, 4).map((preset) => (
                        <Grid item xs={6} sm={3} key={preset.key}>
                          <Paper 
                            elevation={0}
                            sx={{ 
                              p: 0.5, 
                              cursor: 'pointer',
                              border: '1px solid #E5E7EB',
                              borderRadius: '6px',
                              transition: 'all 0.2s',
                              '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderColor: '#7C3AED' }
                            }}
                            onClick={() => handleApplyPreset(preset)}
                          >
                            <Box 
                              component="img"
                              src={preset.image || `https://placehold.co/150x150?text=${preset.title.charAt(0)}`} 
                              sx={{ width: '100%', aspectRatio: '1/1', borderRadius: '4px', mb: 0.5, objectFit: 'cover', bgcolor: '#f3f4f6' }} 
                            />
                            <Typography variant="caption" fontWeight={600} display="block" noWrap sx={{ color: '#111827', fontSize: '0.65rem', textAlign: 'center' }}>
                              {preset.title}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Info Modal */}
        <Modal
          open={showInfoModal}
          onClose={() => setShowInfoModal(false)}
          closeAfterTransition
          BackdropComponent={Backdrop}
          BackdropProps={{ timeout: 500 }}
        >
          <Fade in={showInfoModal}>
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 450,
              bgcolor: 'background.paper',
              borderRadius: '16px',
              boxShadow: 24,
              p: 3,
              outline: 'none'
            }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">Brand Avatar Guide</Typography>
                <IconButton onClick={() => setShowInfoModal(false)} size="small"><Close /></IconButton>
              </Stack>
              <Typography variant="body2" paragraph>
                <strong>What is a Brand Avatar?</strong><br/>
                A consistent digital identity that represents your brand across social media, videos, and marketing materials.
              </Typography>
              <Typography variant="body2" paragraph>
                <strong>How to create one?</strong><br/>
                Use our AI studio to generate a new avatar from text prompts, or upload an existing photo to create variations or enhance quality.
              </Typography>
              <Typography variant="body2">
                <strong>Why use it?</strong><br/>
                Consistent visual branding builds trust and recognition. Your avatar will be used in video intros, social posts, and thumbnails.
              </Typography>
            </Box>
          </Fade>
        </Modal>

        {/* Examples Modal */}
        <Modal
          open={showExamplesModal}
          onClose={() => setShowExamplesModal(false)}
          closeAfterTransition
          BackdropComponent={Backdrop}
          BackdropProps={{ timeout: 500 }}
        >
          <Fade in={showExamplesModal}>
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              bgcolor: 'background.paper',
              borderRadius: '16px',
              boxShadow: 24,
              p: 3,
              outline: 'none'
            }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">Avatar Templates</Typography>
                <IconButton onClick={() => setShowExamplesModal(false)} size="small"><Close /></IconButton>
              </Stack>
              <Grid container spacing={2}>
                {BRAND_AVATAR_PRESETS.map((preset) => (
                  <Grid item xs={12} sm={6} key={preset.key}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        cursor: 'pointer', 
                        border: '1px solid #E5E7EB',
                        '&:hover': { borderColor: '#7C3AED', bgcolor: '#F9FAFB' },
                        height: '100%'
                      }}
                      onClick={() => handleApplyPreset(preset)}
                    >
                      <Box 
                        component="img"
                        src={preset.image || `https://placehold.co/150x150?text=${preset.title.charAt(0)}`} 
                        sx={{ width: '100%', aspectRatio: '1/1', borderRadius: '8px', mb: 2, objectFit: 'cover', bgcolor: '#f3f4f6' }} 
                      />
                      <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                        {preset.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: '0.8rem' }}>
                        {preset.subtitle}
                      </Typography>
                      <Chip label={preset.style} size="small" sx={{ mr: 1, fontSize: '0.7rem' }} />
                      <Chip label={preset.renderingSpeed} size="small" sx={{ fontSize: '0.7rem' }} />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Fade>
        </Modal>

        {/* Full Screen Modal */}
        <Modal
          open={showFullScreen}
          onClose={() => setShowFullScreen(false)}
          closeAfterTransition
          BackdropComponent={Backdrop}
          BackdropProps={{ timeout: 500 }}
        >
          <Fade in={showFullScreen}>
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90vw',
              height: '90vh',
              bgcolor: 'transparent',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}>
              <Box 
                sx={{ 
                  position: 'relative', 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  pointerEvents: 'auto' 
                }}
              >
                <IconButton 
                  onClick={() => setShowFullScreen(false)}
                  sx={{
                    position: 'absolute',
                    top: -40,
                    right: 0,
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.5)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                  }}
                >
                  <Close />
                </IconButton>
                {resultImage && (
                  <img 
                    src={getImgSrc(resultImage)} 
                    alt="Full Screen Avatar" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '90vh', 
                      borderRadius: '8px', 
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)' 
                    }} 
                  />
                )}
              </Box>
            </Box>
          </Fade>
        </Modal>

        {/* Image Generation Modal */}
        <ImageGenerationModal
          open={isGenerationModalOpen}
          onClose={() => setIsGenerationModalOpen(false)}
          onGenerate={handleModalGenerate}
          initialPrompt={prompt}
          isGenerating={loading}
          title="Brand Avatar Studio"
          contextTitle={domainName ? `for ${domainName}` : undefined}
          presets={BRAND_AVATAR_PRESETS}
          presetsLabel="Avatar Styles"
          presetsHelp="Choose a predefined style for your avatar."
          theme={BRAND_AVATAR_THEME}
          recommendations={BRAND_AVATAR_RECOMMENDATIONS}
          showModelSelection={true}
          defaultModel="ideogram-v3-turbo" 
          defaultAspectRatio="1:1"
        />
      </Stack>
    </Box>
  );
};
