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
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ImageIcon from '@mui/icons-material/Image';

const ProductAvatarStudio: React.FC = () => {
  const { generateProductAvatar, isGeneratingAvatar, generatedAvatar, avatarError } = useProductMarketing();
  const { getInfiniteTalkRate } = useModelPricing();
  const rate480 = getInfiniteTalkRate('480p');
  const rate720 = getInfiniteTalkRate('720p');

  const [avatarImageBase64, setAvatarImageBase64] = useState<string | null>(null);
  const [avatarImagePreview, setAvatarImagePreview] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [explainerType, setExplainerType] = useState('product_overview');
  const [resolution, setResolution] = useState('720p');
  const [additionalContext, setAdditionalContext] = useState('');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setAvatarImageBase64(base64);
        setAvatarImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleGenerate = async () => {
    if (!avatarImageBase64 || !productName || (!scriptText.trim() && !productDescription.trim())) {
      return;
    }

    setProgress(0);
    setStatusMessage('Starting avatar video generation...');

    try {
      setProgress(20);
      setStatusMessage('Submitting avatar request...');

      // Use script_text if provided, otherwise use product_description
      const script = scriptText.trim() || productDescription;

      const result = await generateProductAvatar({
        avatar_image_base64: avatarImageBase64,
        script_text: script,
        product_name: productName,
        product_description: productDescription || undefined,
        explainer_type: explainerType,
        resolution: resolution as '480p' | '720p',
        additional_context: additionalContext || undefined,
      });

      setProgress(100);
      setStatusMessage('Avatar video generated successfully!');
    } catch (err: any) {
      console.error('Avatar generation error:', err);
    }
  };

  const canGenerate =
    avatarImageBase64 !== null &&
    productName.trim() !== '' &&
    (scriptText.trim() !== '' || productDescription.trim() !== '');

  const costEstimate = useCallback(() => {
    // Estimate based on script length (roughly 150 words per minute)
    const estimatedWords = scriptText.trim().split(/\s+/).length || productDescription.trim().split(/\s+/).length || 50;
    const estimatedDuration = Math.max(5, (estimatedWords / 150) * 60); // Minimum 5 seconds
    const costPerSecond = getInfiniteTalkRate(resolution).costPerSecond;
    return (costPerSecond * estimatedDuration).toFixed(2);
  }, [resolution, scriptText, productDescription, getInfiniteTalkRate]);

  return (
    <ImageStudioLayout
      headerProps={{
        title: 'Product Avatar Studio',
        subtitle:
          'Create product explainer videos with talking avatars using InfiniteTalk. Generate overview videos, feature explainers, tutorials, and brand messages with precise lip-sync.',
      }}
    >
      <Grid container spacing={4}>
        {/* Left Panel - Upload & Settings */}
        <Grid item xs={12} lg={5}>
          <Stack spacing={3}>
            {/* Avatar Image Upload */}
            <Paper sx={{ p: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="h6" gutterBottom>
                Avatar Image
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Upload product image, brand spokesperson, or brand mascot
              </Typography>
              <Box
                sx={{
                  border: '2px dashed rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    background: 'rgba(16, 185, 129, 0.05)',
                  },
                }}
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />
                {avatarImagePreview ? (
                  <Box>
                    <img
                      src={avatarImagePreview}
                      alt="Avatar preview"
                      style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 8 }}
                    />
                    <Button size="small" sx={{ mt: 1 }} onClick={() => setAvatarImageBase64(null)}>
                      Change Image
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Click to upload avatar image
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

            {/* Script */}
            <Paper sx={{ p: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="h6" gutterBottom>
                Script
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Enter the script that will be converted to speech. If empty, product description will be used.
              </Typography>
              <TextField
                label="Script Text"
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                fullWidth
                multiline
                rows={6}
                placeholder="Enter the script for the avatar to speak. This will be converted to speech automatically."
              />
            </Paper>

            {/* Explainer Settings */}
            <Paper sx={{ p: 3, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography variant="h6" gutterBottom>
                Explainer Settings
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Explainer Type"
                  value={explainerType}
                  onChange={(e) => setExplainerType(e.target.value)}
                  fullWidth
                >
                  <MenuItem value="product_overview">Product Overview - Professional presentation</MenuItem>
                  <MenuItem value="feature_explainer">Feature Explainer - Detailed feature demonstration</MenuItem>
                  <MenuItem value="tutorial">Tutorial - Step-by-step instruction</MenuItem>
                  <MenuItem value="brand_message">Brand Message - Authentic brand storytelling</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  fullWidth
                >
                  <MenuItem value="480p">480p - ${rate480.costPerSecond.toFixed(2)}/second</MenuItem>
                  <MenuItem value="720p">720p - ${rate720.costPerSecond.toFixed(2)}/second</MenuItem>
                </TextField>

                <TextField
                  label="Additional Context (Optional)"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="e.g., 'professional setting', 'friendly tone'"
                />
              </Stack>
            </Paper>

            {/* Cost Estimate */}
            <Card sx={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Estimated Cost
                </Typography>
                <Typography variant="h6" color="primary">
                  ${costEstimate()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Based on script length (minimum 5 seconds)
                </Typography>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={isGeneratingAvatar ? <CircularProgress size={20} color="inherit" /> : <RecordVoiceOverIcon />}
              onClick={handleGenerate}
              disabled={!canGenerate || isGeneratingAvatar}
              sx={{
                py: 1.5,
                backgroundColor: '#10b981',
                '&:hover': {
                  backgroundColor: '#059669',
                },
                '&:disabled': {
                  backgroundColor: '#cbd5e1',
                  color: '#94a3b8',
                },
              }}
            >
              {isGeneratingAvatar ? 'Generating Avatar Video...' : 'Generate Avatar Video'}
            </Button>

            {/* Progress */}
            {isGeneratingAvatar && (
              <Box>
                <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {statusMessage}
                </Typography>
              </Box>
            )}

            {/* Error */}
            {avatarError && (
              <Alert severity="error" icon={<ErrorIcon />}>
                {avatarError}
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

            {generatedAvatar ? (
              <Box>
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                  Avatar video generated successfully!
                </Alert>
                <Box sx={{ mb: 2 }}>
                  <video
                    src={generatedAvatar.video_url?.startsWith('http') ? generatedAvatar.video_url : `${window.location.origin}${generatedAvatar.video_url}`}
                    controls
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </Box>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Cost:</strong> ${generatedAvatar.cost?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Explainer Type:</strong> {generatedAvatar.explainer_type}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Resolution:</strong> {generatedAvatar.resolution || resolution}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Duration:</strong> {generatedAvatar.duration?.toFixed(1) || 'N/A'} seconds
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
                  Generated avatar video will appear here
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ImageStudioLayout>
  );
};

export default ProductAvatarStudio;
