import React, { useState, useCallback } from 'react';
import {
  Grid,
  Box,
  Button,
  Typography,
  Stack,
  CircularProgress,
  LinearProgress,
  Alert,
  Paper,
  TextField,
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import { ImageStudioLayout } from '../../ImageStudio/ImageStudioLayout';
import { useProductMarketing } from '../../../hooks/useProductMarketing';
import { useModelPricing } from '../../../hooks/useModelPricing';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AnimationIcon from '@mui/icons-material/Animation';
import ImageIcon from '@mui/icons-material/Image';

const ProductAnimationStudio: React.FC = () => {
  const { generateProductAnimation, isGeneratingAnimation, generatedAnimation, animationError } = useProductMarketing();
  const { getWanRate } = useModelPricing();
  const wanRate480 = getWanRate('480p');
  const wanRate720 = getWanRate('720p');
  const wanRate1080 = getWanRate('1080p');

  const [productImageBase64, setProductImageBase64] = useState<string | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [animationType, setAnimationType] = useState('reveal');
  const [resolution, setResolution] = useState('720p');
  const [duration, setDuration] = useState(5);
  const [additionalContext, setAdditionalContext] = useState('');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setProductImageBase64(base64);
        setProductImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleGenerate = async () => {
    if (!productImageBase64 || !productName) {
      return;
    }

    setProgress(0);
    setStatusMessage('Starting animation generation...');

    try {
      setProgress(20);
      setStatusMessage('Submitting animation request...');

      const result = await generateProductAnimation({
        product_image_base64: productImageBase64,
        animation_type: animationType,
        product_name: productName,
        product_description: productDescription || undefined,
        resolution: resolution as '480p' | '720p' | '1080p',
        duration: duration,
        additional_context: additionalContext || undefined,
      });

      setProgress(100);
      setStatusMessage('Animation generated successfully!');
    } catch (err: any) {
      console.error('Animation generation error:', err);
    }
  };

  const canGenerate = productImageBase64 !== null && productName.trim() !== '';

  const costEstimate = useCallback(() => {
    const costPerSecond = getWanRate(resolution).costPerSecond;
    return (costPerSecond * duration).toFixed(2);
  }, [resolution, duration, getWanRate]);

  return (
    <ImageStudioLayout
      headerProps={{
        title: 'Product Animation Studio',
        subtitle:
          'Transform your product images into engaging animations using WAN 2.5 Image-to-Video. Create reveal animations, 360° rotations, and product demos.',
      }}
    >
      <Grid container spacing={4}>
        {/* Left Panel - Upload & Settings */}
        <Grid item xs={12} lg={5}>
          <Stack spacing={3}>
            {/* Product Image Upload */}
            <Paper sx={{ p: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="h6" gutterBottom>
                Product Image
              </Typography>
              <Box
                sx={{
                  border: '2px dashed rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'rgba(124, 58, 237, 0.5)',
                    background: 'rgba(124, 58, 237, 0.05)',
                  },
                }}
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />
                {productImagePreview ? (
                  <Box>
                    <img
                      src={productImagePreview}
                      alt="Product preview"
                      style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 8 }}
                    />
                    <Button size="small" sx={{ mt: 1 }} onClick={() => setProductImageBase64(null)}>
                      Change Image
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Click to upload product image
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Product Information */}
            <Paper sx={{ p: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="h6" gutterBottom>
                Product Information
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Product Name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Product Description (Optional)"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                />
              </Stack>
            </Paper>

            {/* Animation Settings */}
            <Paper sx={{ p: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="h6" gutterBottom>
                Animation Settings
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Animation Type"
                  value={animationType}
                  onChange={(e) => setAnimationType(e.target.value)}
                  fullWidth
                >
                  <MenuItem value="reveal">Reveal - Elegant product unveiling</MenuItem>
                  <MenuItem value="rotation">Rotation - 360° product rotation</MenuItem>
                  <MenuItem value="demo">Demo - Product in use demonstration</MenuItem>
                  <MenuItem value="lifestyle">Lifestyle - Realistic lifestyle setting</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  fullWidth
                >
                  <MenuItem value="480p">480p - ${wanRate480.costPerSecond.toFixed(2)}/second</MenuItem>
                  <MenuItem value="720p">720p - ${wanRate720.costPerSecond.toFixed(2)}/second</MenuItem>
                  <MenuItem value="1080p">1080p - ${wanRate1080.costPerSecond.toFixed(2)}/second</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  fullWidth
                >
                  <MenuItem value={5}>5 seconds</MenuItem>
                  <MenuItem value={10}>10 seconds</MenuItem>
                </TextField>

                <TextField
                  label="Additional Context (Optional)"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="e.g., 'cinematic lighting', 'smooth camera movement'"
                />
              </Stack>
            </Paper>

            {/* Cost Estimate */}
            <Card sx={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Estimated Cost
                </Typography>
                <Typography variant="h6" color="primary">
                  ${costEstimate()}
                </Typography>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={isGeneratingAnimation ? <CircularProgress size={20} color="inherit" /> : <AnimationIcon />}
              onClick={handleGenerate}
              disabled={!canGenerate || isGeneratingAnimation}
              sx={{
                py: 1.5,
                backgroundColor: '#7c3aed',
                '&:hover': {
                  backgroundColor: '#6d28d9',
                },
                '&:disabled': {
                  backgroundColor: '#cbd5e1',
                  color: '#94a3b8',
                },
              }}
            >
              {isGeneratingAnimation ? 'Generating Animation...' : 'Generate Animation'}
            </Button>

            {/* Progress */}
            {isGeneratingAnimation && (
              <Box>
                <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {statusMessage}
                </Typography>
              </Box>
            )}

            {/* Error */}
            {animationError && (
              <Alert severity="error" icon={<ErrorIcon />}>
                {animationError}
              </Alert>
            )}
          </Stack>
        </Grid>

        {/* Right Panel - Preview & Result */}
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="h6" gutterBottom>
              Preview & Result
            </Typography>

            {generatedAnimation ? (
              <Box>
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                  Animation generated successfully!
                </Alert>
                <Box sx={{ mb: 2 }}>
                  <video
                    src={generatedAnimation.video_url?.startsWith('http') ? generatedAnimation.video_url : `${window.location.origin}${generatedAnimation.video_url}`}
                    controls
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </Box>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Cost:</strong> ${generatedAnimation.cost?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Animation Type:</strong> {generatedAnimation.animation_type}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Resolution:</strong> {generatedAnimation.resolution || resolution}
                  </Typography>
                </Stack>
              </Box>
            ) : (
              <Box
                sx={{
                  border: '2px dashed rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  p: 6,
                  textAlign: 'center',
                }}
              >
                <PlayArrowIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Generated animation will appear here
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ImageStudioLayout>
  );
};

export default ProductAnimationStudio;
