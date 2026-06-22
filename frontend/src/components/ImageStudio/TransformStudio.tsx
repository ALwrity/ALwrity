import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Tooltip,
  LinearProgress,
  Chip,
  Divider,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Transform as TransformIcon,
  VideoLibrary,
  Upload,
  PlayArrow,
  Download,
  AttachMoney,
  Info,
  Close,
} from '@mui/icons-material';
import { motion, type Variants, type Easing } from 'framer-motion';
import { useTransformStudio } from '../../hooks/useTransformStudio';
import { ImageStudioLayout } from './ImageStudioLayout';
import { OperationButton } from '../shared/OperationButton';
import { PreflightOperation } from '../../services/billingService';
import { getApiUrl } from '../../api/client';

const MotionPaper = motion.create(Paper);
const MotionCard = motion.create(Card);
const fadeEase: Easing = [0.4, 0, 0.2, 1];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: fadeEase },
  },
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`transform-tabpanel-${index}`}
      aria-labelledby={`transform-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export const TransformStudio: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [audioBase64, setAudioBase64] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [seed, setSeed] = useState<string>('');
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const {
    isGenerating,
    error,
    result,
    costEstimate,
    transformImageToVideo,
    createTalkingAvatar,
    estimateCost,
    clearError,
    clearResult,
  } = useTransformStudio();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    clearError();
    clearResult();
    setVideoUrl(null);
  };

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAudioUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Please upload an audio file (wav or mp3)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setAudioBase64(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const canGenerateImageToVideo = useMemo(() => {
    return imageBase64 && prompt.trim().length > 0;
  }, [imageBase64, prompt]);

  const canGenerateTalkingAvatar = useMemo(() => {
    return imageBase64 && audioBase64;
  }, [imageBase64, audioBase64]);

  // Define preflight operations for cost estimation
  const imageToVideoOperation: PreflightOperation = useMemo(() => ({
    provider: 'wavespeed',
    model: 'alibaba/wan-2.5/image-to-video',
    operation_type: 'image-to-video',
  }), []);

  const talkingAvatarOperation: PreflightOperation = useMemo(() => ({
    provider: 'wavespeed',
    model: 'wavespeed-ai/infinitetalk',
    operation_type: 'talking-avatar',
  }), []);

  const handleEstimateCost = useCallback(async () => {
    if (tabValue === 0) {
      // Image-to-video
      if (!canGenerateImageToVideo) return;
      await estimateCost({
        operation: 'image-to-video',
        resolution,
        duration,
      });
    } else {
      // Talking avatar
      if (!canGenerateTalkingAvatar) return;
      await estimateCost({
        operation: 'talking-avatar',
        resolution: resolution as '480p' | '720p',
      });
    }
  }, [tabValue, canGenerateImageToVideo, canGenerateTalkingAvatar, resolution, duration, estimateCost]);

  const handleGenerate = useCallback(async () => {
    clearError();
    clearResult();
    setVideoUrl(null);

    try {
      if (tabValue === 0) {
        // Image-to-video
        const response = await transformImageToVideo({
          image_base64: imageBase64,
          prompt,
          audio_base64: audioBase64 || undefined,
          resolution,
          duration,
          negative_prompt: negativePrompt || undefined,
          seed: seed ? parseInt(seed) : undefined,
          enable_prompt_expansion: enablePromptExpansion,
        });
        if (response.video_url) {
          // Get auth token for video URL (video elements can't use headers)
          const token = await (window as any).Clerk?.session?.getToken();
          const baseUrl = getApiUrl();
          const videoUrlWithToken = token 
            ? `${baseUrl}${response.video_url}?token=${encodeURIComponent(token)}`
            : `${baseUrl}${response.video_url}`;
          setVideoUrl(videoUrlWithToken);
        }
      } else {
        // Talking avatar
        const response = await createTalkingAvatar({
          image_base64: imageBase64,
          audio_base64: audioBase64,
          resolution: resolution as '480p' | '720p',
          prompt: prompt || undefined,
          seed: seed ? parseInt(seed) : undefined,
        });
        if (response.video_url) {
          // Get auth token for video URL (video elements can't use headers)
          const token = await (window as any).Clerk?.session?.getToken();
          const baseUrl = getApiUrl();
          const videoUrlWithToken = token 
            ? `${baseUrl}${response.video_url}?token=${encodeURIComponent(token)}`
            : `${baseUrl}${response.video_url}`;
          setVideoUrl(videoUrlWithToken);
        }
      }
    } catch (err) {
      // Error is handled by the hook
      console.error('Generation failed:', err);
    }
  }, [
    tabValue,
    imageBase64,
    audioBase64,
    prompt,
    negativePrompt,
    resolution,
    duration,
    seed,
    enablePromptExpansion,
    transformImageToVideo,
    createTalkingAvatar,
    clearError,
    clearResult,
  ]);

  const handleDownload = useCallback(() => {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  }, [videoUrl]);

  return (
    <ImageStudioLayout>
      <MotionPaper
        elevation={0}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(15,23,42,0.72)',
          p: { xs: 3, md: 5 },
          backdropFilter: 'blur(25px)',
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{
                background: 'linear-gradient(120deg,#ede9fe,#c7d2fe)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              Transform Studio
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Convert images into videos, talking avatars, and more
            </Typography>
          </Box>

          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: 'primary.main',
                },
              },
            }}
          >
            <Tab label="Image to Video" icon={<VideoLibrary />} iconPosition="start" />
            <Tab label="Talking Avatar" icon={<TransformIcon />} iconPosition="start" />
          </Tabs>

          {error && (
            <Alert severity="error" onClose={clearError}>
              {error}
            </Alert>
          )}

          {/* Image-to-Video Tab */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <MotionCard variants={cardVariants} sx={{ p: 3, background: 'rgba(255,255,255,0.05)' }}>
                  <Stack spacing={3}>
                    <Typography variant="h6" fontWeight={600}>
                      Upload Image
                    </Typography>
                    <Box>
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="image-upload"
                        type="file"
                        onChange={handleImageUpload}
                      />
                      <label htmlFor="image-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={<Upload />}
                          fullWidth
                          sx={{ py: 2 }}
                        >
                          {imageBase64 ? 'Change Image' : 'Upload Image'}
                        </Button>
                      </label>
                      {imageBase64 && (
                        <Box sx={{ mt: 2 }}>
                          <CardMedia
                            component="img"
                            image={imageBase64}
                            alt="Uploaded image"
                            sx={{
                              maxHeight: 300,
                              objectFit: 'contain',
                              borderRadius: 2,
                            }}
                          />
                        </Box>
                      )}
                    </Box>

                    <TextField
                      label="Video Prompt"
                      multiline
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe what should happen in the video..."
                      fullWidth
                      required
                    />

                    <Box>
                      <input
                        accept="audio/*"
                        style={{ display: 'none' }}
                        id="audio-upload"
                        type="file"
                        onChange={handleAudioUpload}
                      />
                      <label htmlFor="audio-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={<Upload />}
                          fullWidth
                          sx={{ py: 1.5 }}
                        >
                          {audioBase64 ? 'Change Audio (Optional)' : 'Upload Audio (Optional)'}
                        </Button>
                      </label>
                    </Box>

                    <TextField
                      label="Negative Prompt (Optional)"
                      multiline
                      rows={2}
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="What to avoid in the video..."
                      fullWidth
                    />

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <FormControl fullWidth>
                          <InputLabel>Resolution</InputLabel>
                          <Select
                            value={resolution}
                            label="Resolution"
                            onChange={(e) => setResolution(e.target.value as any)}
                          >
                            <MenuItem value="480p">480p</MenuItem>
                            <MenuItem value="720p">720p</MenuItem>
                            <MenuItem value="1080p">1080p</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={6}>
                        <FormControl fullWidth>
                          <InputLabel>Duration</InputLabel>
                          <Select
                            value={duration}
                            label="Duration"
                            onChange={(e) => setDuration(e.target.value as 5 | 10)}
                          >
                            <MenuItem value={5}>5 seconds</MenuItem>
                            <MenuItem value={10}>10 seconds</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    <TextField
                      label="Seed (Optional)"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      placeholder="Random seed for reproducibility"
                      fullWidth
                    />
                  </Stack>
                </MotionCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <MotionCard variants={cardVariants} sx={{ p: 3, background: 'rgba(255,255,255,0.05)' }}>
                  <Stack spacing={3}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" fontWeight={600}>
                        Preview & Generate
                      </Typography>
                      {costEstimate && (
                        <Chip
                          icon={<AttachMoney />}
                          label={`$${costEstimate.estimated_cost.toFixed(2)}`}
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    {isGenerating && (
                      <Box>
                        <LinearProgress />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                          Generating video... This may take 1-2 minutes.
                        </Typography>
                      </Box>
                    )}

                    {videoUrl && (
                      <Box>
                        <video
                          src={videoUrl}
                          controls
                          style={{
                            width: '100%',
                            borderRadius: 8,
                            maxHeight: 400,
                          }}
                        />
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            startIcon={<Download />}
                            onClick={handleDownload}
                            fullWidth
                          >
                            Download Video
                          </Button>
                        </Box>
                        {result && (
                          <Box sx={{ mt: 2 }}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              Duration: {result.duration}s | Resolution: {result.resolution} | Cost: ${result.cost.toFixed(2)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

                    {!videoUrl && !isGenerating && (
                      <Box
                        sx={{
                          border: '2px dashed',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 4,
                          textAlign: 'center',
                        }}
                      >
                        <VideoLibrary sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="body2" color="text.secondary">
                          Generated video will appear here
                        </Typography>
                      </Box>
                    )}

                    <Stack direction="row" spacing={2}>
                      <Button
                        variant="outlined"
                        startIcon={<AttachMoney />}
                        onClick={handleEstimateCost}
                        disabled={!canGenerateImageToVideo || isGenerating}
                        fullWidth
                      >
                        Estimate Cost
                      </Button>
                      <OperationButton
                        operation={imageToVideoOperation}
                        label="Generate Video"
                        onClick={handleGenerate}
                        disabled={!canGenerateImageToVideo || isGenerating}
                        loading={isGenerating}
                        fullWidth
                      />
                    </Stack>
                  </Stack>
                </MotionCard>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Talking Avatar Tab */}
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <MotionCard variants={cardVariants} sx={{ p: 3, background: 'rgba(255,255,255,0.05)' }}>
                  <Stack spacing={3}>
                    <Typography variant="h6" fontWeight={600}>
                      Upload Image & Audio
                    </Typography>
                    <Box>
                      <input
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="avatar-image-upload"
                        type="file"
                        onChange={handleImageUpload}
                      />
                      <label htmlFor="avatar-image-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={<Upload />}
                          fullWidth
                          sx={{ py: 2 }}
                        >
                          {imageBase64 ? 'Change Image' : 'Upload Person Image'}
                        </Button>
                      </label>
                      {imageBase64 && (
                        <Box sx={{ mt: 2 }}>
                          <CardMedia
                            component="img"
                            image={imageBase64}
                            alt="Uploaded image"
                            sx={{
                              maxHeight: 300,
                              objectFit: 'contain',
                              borderRadius: 2,
                            }}
                          />
                        </Box>
                      )}
                    </Box>

                    <Box>
                      <input
                        accept="audio/*"
                        style={{ display: 'none' }}
                        id="avatar-audio-upload"
                        type="file"
                        onChange={handleAudioUpload}
                      />
                      <label htmlFor="avatar-audio-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          startIcon={<Upload />}
                          fullWidth
                          sx={{ py: 2 }}
                        >
                          {audioBase64 ? 'Change Audio' : 'Upload Audio (Required)'}
                        </Button>
                      </label>
                    </Box>

                    <TextField
                      label="Prompt (Optional)"
                      multiline
                      rows={3}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe expression, style, or pose..."
                      fullWidth
                    />

                    <FormControl fullWidth>
                      <InputLabel>Resolution</InputLabel>
                      <Select
                        value={resolution}
                        label="Resolution"
                        onChange={(e) => setResolution(e.target.value as '480p' | '720p')}
                      >
                        <MenuItem value="480p">480p</MenuItem>
                        <MenuItem value="720p">720p</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      label="Seed (Optional)"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      placeholder="Random seed for reproducibility"
                      fullWidth
                    />
                  </Stack>
                </MotionCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <MotionCard variants={cardVariants} sx={{ p: 3, background: 'rgba(255,255,255,0.05)' }}>
                  <Stack spacing={3}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" fontWeight={600}>
                        Preview & Generate
                      </Typography>
                      {costEstimate && (
                        <Chip
                          icon={<AttachMoney />}
                          label={`$${costEstimate.estimated_cost.toFixed(2)}`}
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    {isGenerating && (
                      <Box>
                        <LinearProgress />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                          Generating talking avatar... This may take up to 10 minutes.
                        </Typography>
                      </Box>
                    )}

                    {videoUrl && (
                      <Box>
                        <video
                          src={videoUrl}
                          controls
                          style={{
                            width: '100%',
                            borderRadius: 8,
                            maxHeight: 400,
                          }}
                        />
                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            startIcon={<Download />}
                            onClick={handleDownload}
                            fullWidth
                          >
                            Download Video
                          </Button>
                        </Box>
                        {result && (
                          <Box sx={{ mt: 2 }}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              Duration: {result.duration}s | Resolution: {result.resolution} | Cost: ${result.cost.toFixed(2)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

                    {!videoUrl && !isGenerating && (
                      <Box
                        sx={{
                          border: '2px dashed',
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 4,
                          textAlign: 'center',
                        }}
                      >
                        <TransformIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="body2" color="text.secondary">
                          Generated talking avatar will appear here
                        </Typography>
                      </Box>
                    )}

                    <Stack direction="row" spacing={2}>
                      <Button
                        variant="outlined"
                        startIcon={<AttachMoney />}
                        onClick={handleEstimateCost}
                        disabled={!canGenerateTalkingAvatar || isGenerating}
                        fullWidth
                      >
                        Estimate Cost
                      </Button>
                      <OperationButton
                        operation={talkingAvatarOperation}
                        label="Generate Avatar"
                        onClick={handleGenerate}
                        disabled={!canGenerateTalkingAvatar || isGenerating}
                        loading={isGenerating}
                        fullWidth
                      />
                    </Stack>
                  </Stack>
                </MotionCard>
              </Grid>
            </Grid>
          </TabPanel>
        </Stack>
      </MotionPaper>
    </ImageStudioLayout>
  );
};

