/**
 * Scene Generation Step Component
 * 
 * Third step: Generate images and audio for each scene before video rendering.
 */

import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Stack,
  Button,
  Box,
  Alert,
} from '@mui/material';
import ArrowForward from '@mui/icons-material/ArrowForward';
import ArrowBack from '@mui/icons-material/ArrowBack';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Warning from '@mui/icons-material/Warning';
import { motion } from 'framer-motion';
import { Scene, VideoPlan } from '../../../services/youtubeApi';
import { YT_BG, YT_BORDER, YT_TEXT } from '../constants';
import { SceneCard } from './SceneCard';
import { AssetGenerationCostCard } from './AssetGenerationCostCard';
import { SceneGenerationMeta } from './SceneGenerationMeta';
import type { SceneBuildGeneration } from '../../../services/youtubeApi';
import type { AudioGenerationSettings } from '../../shared/AudioSettingsModal';
import type { YouTubeImageGenerationSettings } from '../shared';

interface SceneGenerationStepProps {
  scenes: Scene[];
  videoPlan: VideoPlan | null;
  sceneBuildGeneration?: SceneBuildGeneration | null;
  editingSceneId: number | null;
  editedScene: Partial<Scene> | null;
  onEditScene: (scene: Scene) => void;
  onSaveScene: () => void;
  onCancelEdit: () => void;
  onEditChange: (updates: Partial<Scene>) => void;
  onToggleScene: (sceneNumber: number) => void;
  onGenerateImage?: (scene: Scene, settings?: YouTubeImageGenerationSettings) => Promise<void>;
  generatingImageSceneId?: number | null;
  onGenerateAudio?: (scene: Scene, settings?: AudioGenerationSettings) => Promise<void>;
  generatingAudioSceneId?: number | null;
  loading: boolean;
  avatarUrl?: string | null;
  videoPlanIdea?: string;
  language?: string; // Language code for language-aware voice selection
  onBack: () => void;
  onNext: () => void;
}

export const SceneGenerationStep: React.FC<SceneGenerationStepProps> = React.memo(({
  scenes,
  videoPlan,
  sceneBuildGeneration,
  editingSceneId,
  editedScene,
  onEditScene,
  onSaveScene,
  onCancelEdit,
  onEditChange,
  onToggleScene,
  onGenerateImage,
  generatingImageSceneId,
  onGenerateAudio,
  generatingAudioSceneId,
  loading,
  avatarUrl,
  videoPlanIdea,
  language,
  onBack,
  onNext,
}) => {
  // Check scene readiness: all enabled scenes must have both imageUrl and audioUrl
  const sceneReadiness = useMemo(() => {
    const enabledScenes = scenes.filter(s => s.enabled !== false);
    const readyScenes = enabledScenes.filter(s => s.imageUrl && s.audioUrl);
    const missingImage = enabledScenes.filter(s => !s.imageUrl);
    const missingAudio = enabledScenes.filter(s => !s.audioUrl);
    
    return {
      allReady: enabledScenes.length > 0 && readyScenes.length === enabledScenes.length,
      readyCount: readyScenes.length,
      totalEnabled: enabledScenes.length,
      missingImageCount: missingImage.length,
      missingAudioCount: missingAudio.length,
      scenesMissingImages: missingImage.map(s => s.scene_number),
      scenesMissingAudio: missingAudio.map(s => s.scene_number),
    };
  }, [scenes]);

  const canProceed = sceneReadiness.allReady;

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
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: YT_TEXT }}>
          3️⃣ Generate Scene Assets
        </Typography>

        <Typography variant="body2" sx={{ mb: 3, color: '#64748b' }}>
          Generate custom images and audio narration for each scene. All scenes must have both an image and audio before you can render the final video.
        </Typography>

        {sceneBuildGeneration ? (
          <SceneGenerationMeta generation={sceneBuildGeneration} />
        ) : null}

        {/* Cost Estimate */}
        <AssetGenerationCostCard scenes={scenes} />

        {/* Readiness Alert */}
        {sceneReadiness.allReady ? (
          <Alert 
            severity="success" 
            icon={<CheckCircle />}
            sx={{
              mb: 3,
              bgcolor: '#f0fdf4',
              border: '1px solid #86efac',
              '& .MuiAlert-icon': {
                color: '#16a34a',
              },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              ✅ All scenes are ready!
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
              {sceneReadiness.readyCount} of {sceneReadiness.totalEnabled} enabled scenes have both images and audio. You can proceed to render your video.
            </Typography>
          </Alert>
        ) : (
          <Alert 
            severity="warning" 
            icon={<Warning />}
            sx={{
              mb: 3,
              bgcolor: '#fffbeb',
              border: '1px solid #fde68a',
              '& .MuiAlert-icon': {
                color: '#d97706',
              },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Some scenes need assets generated
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              • {sceneReadiness.missingImageCount} scene(s) need images: {sceneReadiness.scenesMissingImages.join(', ')}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              • {sceneReadiness.missingAudioCount} scene(s) need audio: {sceneReadiness.scenesMissingAudio.join(', ')}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
              Click "Generate Image" and "Generate Audio" buttons on each scene card below.
            </Typography>
          </Alert>
        )}

        {/* Scene Cards */}
        {scenes.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Stack spacing={2}>
              {scenes.map((scene) => (
                <SceneCard
                  key={scene.scene_number}
                  scene={scene}
                  isEditing={editingSceneId === scene.scene_number}
                  editedScene={editedScene}
                  onToggle={onToggleScene}
                  onEdit={onEditScene}
                  onSave={onSaveScene}
                  onCancel={onCancelEdit}
                  onEditChange={onEditChange}
                  loading={loading}
                  onGenerateImage={onGenerateImage}
                  generatingImage={generatingImageSceneId === scene.scene_number}
                  onGenerateAudio={onGenerateAudio}
                  generatingAudio={generatingAudioSceneId === scene.scene_number}
                  avatarUrl={avatarUrl}
                  videoPlanIdea={videoPlanIdea}
                  language={language}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={onBack}
          >
            Back to Scenes
          </Button>
          <Button
            variant="contained"
            color="error"
            size="large"
            endIcon={<ArrowForward />}
            onClick={onNext}
            disabled={!canProceed}
            sx={{ px: 4 }}
          >
            {canProceed 
              ? 'Proceed to Video Rendering'
              : `Generate Assets (${sceneReadiness.readyCount}/${sceneReadiness.totalEnabled} ready)`}
          </Button>
        </Box>
      </Paper>
    </motion.div>
  );
});

SceneGenerationStep.displayName = 'SceneGenerationStep';

