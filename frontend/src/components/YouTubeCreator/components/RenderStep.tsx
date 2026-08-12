/**
 * Render Step Component
 * 
 * Main component for the render step in YouTube Creator workflow.
 * Orchestrates scene overview, settings, cost estimation, and render status.
 */

import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Stack,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import CheckCircle from '@mui/icons-material/CheckCircle';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Visibility from '@mui/icons-material/Visibility';
import ImageIcon from '@mui/icons-material/Image';
import VolumeUp from '@mui/icons-material/VolumeUp';
import { motion } from 'framer-motion';
import { TaskStatus, CostEstimate, VideoPlan, Scene } from '../../../services/youtubeApi';
import { YT_BORDER, type Resolution } from '../constants';
import { CombinedSceneOverview } from './CombinedSceneOverview';
import { CostEstimateCard } from './CostEstimateCard';
import { RenderSettings } from './RenderSettings';
import { RenderStatusDisplay } from './RenderStatusDisplay';
import { ScenePreviewModal } from './ScenePreviewModal';
import { YouTubeFinalVideoPanel } from './YouTubeFinalVideoPanel';
import { useYouTubeRenderQueue } from '../hooks/useYouTubeRenderQueue';
import { YouTubePublishPanel } from './YouTubePublishPanel';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertColor } from '@mui/material/Alert';

interface RenderStepProps {
  renderTaskId: string | null;
  renderStatus: TaskStatus | null;
  renderProgress: number;
  resolution: Resolution;
  combineScenes: boolean;
  enabledScenesCount: number;
  costEstimate: CostEstimate | null;
  loadingCostEstimate: boolean;
  loading: boolean;
  scenes: Scene[];
  videoPlan: VideoPlan | null;
  onResolutionChange: (resolution: Resolution) => void;
  onCombineScenesChange: (combine: boolean) => void;
  onStartRender: () => void;
  onBack: () => void;
  onReset: () => void;
  onRetryFailedScenes: (failedScenes: any[]) => void;
  onScenesUpdate: (updatedScenes: Scene[]) => void;
  getVideoUrl: () => string | null;
}

export const RenderStep: React.FC<RenderStepProps> = React.memo(({
  renderTaskId,
  renderStatus,
  renderProgress,
  resolution,
  combineScenes,
  enabledScenesCount,
  costEstimate,
  loadingCostEstimate,
  loading,
  scenes,
  videoPlan,
  onResolutionChange,
  onCombineScenesChange,
  onStartRender,
  onBack,
  onReset,
  onRetryFailedScenes,
  getVideoUrl,
  onScenesUpdate,
}) => {
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);

  const showSnackbar = (message: string, severity: AlertColor = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handlePreviewScene = (scene: Scene) => {
    setPreviewScene(scene);
    setPreviewModalOpen(true);
  };

  const {
    sceneStatuses,
    finalVideoUrl,
    combining,
    combiningProgress,
    combiningMessage,
    runSceneVideo,
    combineVideos,
  } = useYouTubeRenderQueue({
    scenes,
    videoPlan,
    resolution,
    onScenesUpdate,
    onError: (msg) => showSnackbar(msg, 'error'),
    onSuccess: (msg) => showSnackbar(msg, 'success'),
    onInfo: (msg) => showSnackbar(msg, 'info'),
  });

  const resolvedVideoUrl = finalVideoUrl || getVideoUrl();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Paper
        sx={{
          p: 4,
          backgroundColor: 'white',
          border: `1px solid ${YT_BORDER}`,
        }}
      >
                    <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                      4️⃣ Render Final Video
                    </Typography>

                    {!renderTaskId ? (
                      <Stack spacing={3}>
                        <Alert severity="info" icon={<CheckCircle />}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Ready to create your video!
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                            All scenes have their images and audio. Configure your render settings below and start the video generation process.
                          </Typography>
                        </Alert>

            {/* Combined Scene Statistics & Timeline */}
            {scenes.length > 0 && (
              <CombinedSceneOverview scenes={scenes} />
            )}

            {/* Scene-wise Video Generation */}
            {scenes.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'between', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.1rem' }}>
                    🎬 Scene Video Generation
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  Generate video for each scene individually. Videos are created using your scene images and audio narration. 
                  You can preview assets and retry failed scenes.
                </Typography>
                <Stack spacing={2}>
                  {scenes.filter(s => s.enabled !== false).map((scene) => {
                    const st = sceneStatuses[scene.scene_number] || { status: 'idle', progress: 0 };
                    const hasAssets = !!scene.imageUrl && !!scene.audioUrl;
                    const running = st.status === 'running';
                    const failed = st.status === 'failed';
                    const completed = st.status === 'completed';
                    
                    return (
                      <Paper
                        key={scene.scene_number}
                        elevation={0}
                        sx={{ 
                          p: 3,
                          border: completed ? '2px solid #10b981' : failed ? '2px solid #ef4444' : '2px solid #e2e8f0',
                          borderRadius: 2,
                          bgcolor: completed ? '#f0fdf4' : failed ? '#fef2f2' : 'white',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          },
                        }}
                      >
                        <Stack spacing={2}>
                          {/* Header Row */}
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.5 }}>
                                Scene {scene.scene_number}: {scene.title}
                              </Typography>
                              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Chip 
                                  label={`${scene.duration_estimate}s`} 
                                  size="small" 
                                  sx={{ 
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    bgcolor: '#eff6ff',
                                    color: '#1e40af',
                                  }} 
                                />
                                {/* Asset Status Chips */}
                                <Tooltip 
                                  title={scene.imageUrl ? "Image ready - click to preview" : "Image not generated yet"} 
                                  arrow
                                >
                                  <Chip
                                    icon={<ImageIcon sx={{ fontSize: 14 }} />}
                                    label="Image"
                                    size="small"
                                    onClick={scene.imageUrl ? () => handlePreviewScene(scene) : undefined}
                                    sx={{
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      bgcolor: scene.imageUrl ? '#d1fae5' : '#fee2e2',
                                      color: scene.imageUrl ? '#065f46' : '#991b1b',
                                      cursor: scene.imageUrl ? 'pointer' : 'default',
                                      '&:hover': scene.imageUrl ? {
                                        bgcolor: '#a7f3d0',
                                      } : {},
                                    }}
                                  />
                                </Tooltip>
                                <Tooltip 
                                  title={scene.audioUrl ? "Audio ready - click to preview" : "Audio not generated yet"} 
                                  arrow
                                >
                                  <Chip
                                    icon={<VolumeUp sx={{ fontSize: 14 }} />}
                                    label="Audio"
                                    size="small"
                                    onClick={scene.audioUrl ? () => handlePreviewScene(scene) : undefined}
                                    sx={{
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      bgcolor: scene.audioUrl ? '#d1fae5' : '#fee2e2',
                                      color: scene.audioUrl ? '#065f46' : '#991b1b',
                                      cursor: scene.audioUrl ? 'pointer' : 'default',
                                      '&:hover': scene.audioUrl ? {
                                        bgcolor: '#a7f3d0',
                                      } : {},
                                    }}
                                  />
                                </Tooltip>
                                {/* Status Indicator */}
                                {completed && (
                                  <Chip 
                                    icon={<CheckCircle sx={{ fontSize: 14 }} />}
                                    label="Video Ready" 
                                    size="small" 
                                    color="success"
                                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                                  />
                                )}
                                {failed && (
                                  <Chip 
                                    label="Failed" 
                                    size="small" 
                                    color="error"
                                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                                  />
                                )}
                              </Stack>
                            </Box>

                            {/* Action Buttons */}
                            <Stack direction="row" spacing={1} alignItems="center">
                              {running && st.progress > 0 && st.progress < 100 && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <CircularProgress 
                                    size={32} 
                                    variant="determinate" 
                                    value={Math.min(100, st.progress)} 
                                    sx={{ color: '#667eea' }}
                                  />
                                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                                    {Math.round(st.progress)}%
                                  </Typography>
                                </Box>
                              )}
                              {hasAssets && (
                                <Tooltip title="Preview scene assets" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handlePreviewScene(scene)}
                                    sx={{
                                      color: '#667eea',
                                      '&:hover': {
                                        bgcolor: '#eff6ff',
                                      },
                                    }}
                                  >
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Button
                                variant={completed ? "outlined" : "contained"}
                                color={completed ? "success" : "primary"}
                                onClick={() => runSceneVideo(scene)}
                                disabled={!hasAssets || running}
                                startIcon={running ? <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
                                sx={{ 
                                  textTransform: 'none', 
                                  fontWeight: 700,
                                  minWidth: 120,
                                  px: 2.5,
                                }}
                              >
                                {running ? 'Generating' : failed ? 'Retry Video' : completed ? 'Regenerate' : 'Generate Video'}
                              </Button>
                            </Stack>
                          </Box>

                          {/* Progress/Error Message */}
                          {st.status !== 'idle' && st.status !== 'completed' && (
                            <Box 
                              sx={{ 
                                px: 2, 
                                py: 1, 
                                bgcolor: failed ? '#fef2f2' : '#f8fafc',
                                borderRadius: 1,
                                border: `1px solid ${failed ? '#fecaca' : '#e2e8f0'}`,
                              }}
                            >
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: failed ? '#991b1b' : '#475569',
                                  fontSize: '0.875rem',
                                  fontWeight: 500,
                                }}
                              >
                                {running 
                                  ? `Generating video... This may take 1-2 minutes.`
                                  : failed
                                    ? `❌ ${st.error || 'Generation failed. Please retry.'}`
                                    : 'Processing...'}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* Combine Scene Videos (Optional) */}
            {combineScenes && scenes.filter(s => s.enabled !== false && s.videoUrl).length >= 2 && (
              <YouTubeFinalVideoPanel
                finalVideoUrl={finalVideoUrl}
                combining={combining}
                combiningProgress={combiningProgress}
                combiningMessage={combiningMessage}
                onCombine={combineVideos}
              />
            )}

            {/* Render Settings */}
            <RenderSettings
              resolution={resolution}
              combineScenes={combineScenes}
              enabledScenesCount={enabledScenesCount}
              onResolutionChange={onResolutionChange}
              onCombineScenesChange={onCombineScenesChange}
            />

            {/* Cost Estimate */}
            <CostEstimateCard
              costEstimate={costEstimate}
              loadingCostEstimate={loadingCostEstimate}
              scenes={scenes}
            />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="outlined" 
                startIcon={<ArrowBack />}
                onClick={onBack}
              >
                Back to Assets
              </Button>
              <Tooltip
                title={
                  enabledScenesCount === 0
                    ? "Please enable at least one scene"
                    : loading
                    ? "Video render in progress"
                    : `Generate videos for ${enabledScenesCount} scene${enabledScenesCount !== 1 ? 's' : ''}. Estimated cost includes video generation and processing.`
                }
                arrow
                placement="top"
              >
                <span>
                  <Button
                    variant="contained"
                    color="error"
                    size="large"
                    startIcon={<PlayArrow />}
                    onClick={onStartRender}
                    disabled={loading || enabledScenesCount === 0}
                    sx={{
                      px: 4,
                      fontWeight: 600,
                      '&:disabled': {
                        opacity: 0.6,
                      },
                    }}
                  >
                    {loading ? (
                      <>
                        Rendering...
                        <CircularProgress size={16} sx={{ ml: 1 }} color="inherit" />
                      </>
                    ) : (
                      `Start Video Render ${costEstimate?.total_cost ? `($${costEstimate.total_cost.toFixed(2)})` : ''}`
                    )}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Stack>
        ) : (
          <RenderStatusDisplay
            renderStatus={renderStatus}
            renderProgress={renderProgress}
            getVideoUrl={getVideoUrl}
            onReset={onReset}
            onRetryFailedScenes={onRetryFailedScenes}
          />
        )}
      </Paper>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MuiAlert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          elevation={6}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>

      {/* Scene Preview Modal */}
      {previewScene && (
        <ScenePreviewModal
          open={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false);
            setPreviewScene(null);
          }}
          sceneTitle={previewScene.title}
          sceneNumber={previewScene.scene_number}
          imageUrl={previewScene.imageUrl}
          audioUrl={previewScene.audioUrl}
        />
      )}

      <YouTubePublishPanel
        videoUrl={resolvedVideoUrl}
        scenes={scenes}
        videoPlan={videoPlan}
      />
    </motion.div>
  );
});

RenderStep.displayName = 'RenderStep';
