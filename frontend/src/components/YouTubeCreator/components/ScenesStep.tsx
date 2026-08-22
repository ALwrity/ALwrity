/**
 * Scenes Step Component
 */

import React, { useMemo } from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
} from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import VideoLibrary from '@mui/icons-material/VideoLibrary';
import { motion } from 'framer-motion';
import { VideoPlan, Scene } from '../../../services/youtubeApi';
import { PlanDetails } from './PlanDetails';
import { YouTubeUnifiedPlanScript } from './YouTubeUnifiedPlanScript';
import { YT_BORDER } from '../constants';
import { OperationButton } from '../../shared/OperationButton';
import { buildSceneBuildingOperation } from '../utils/operationHelpers';
import { DurationType } from '../constants';
import { SceneBuildLoadingPanel } from './SceneBuildLoadingPanel';
import { ScenePromptPreview } from './ScenePromptPreview';
import { SceneGenerationMeta } from './SceneGenerationMeta';
import type { SceneBuildGeneration } from '../../../services/youtubeApi';
import type { YouTubeScriptPhase } from '../../../hooks/useYouTubeCreatorState';

interface ScenesStepProps {
  videoPlan: VideoPlan;
  scenes: Scene[];
  sceneBuildGeneration?: SceneBuildGeneration | null;
  editingSceneId: number | null;
  editedScene: Partial<Scene> | null;
  loading: boolean;
  onBuildScenes: () => void;
  onEditScene: (scene: Scene) => void;
  onSaveScene: () => void;
  onCancelEdit: () => void;
  onEditChange: (updates: Partial<Scene>) => void;
  onToggleScene: (sceneNumber: number) => void;
  onBack: () => void;
  onNext: () => void;
  onAvatarRegenerate?: () => void;
  regeneratingAvatar?: boolean;
  onPlanChange?: (plan: VideoPlan) => void;
  fullScript?: string | null;
  scriptPhase?: YouTubeScriptPhase;
  onFullScriptChange?: (value: string) => void;
}

export const ScenesStep: React.FC<ScenesStepProps> = React.memo(({
  videoPlan,
  scenes,
  sceneBuildGeneration,
  editingSceneId,
  editedScene,
  loading,
  onBuildScenes,
  onEditScene,
  onSaveScene,
  onCancelEdit,
  onEditChange,
  onToggleScene,
  onBack,
  onNext,
  onAvatarRegenerate,
  regeneratingAvatar = false,
  onPlanChange,
  fullScript,
  scriptPhase = 'idle',
  onFullScriptChange,
}) => {
  const enabledScenesCount = useMemo(
    () => scenes.filter(s => s.enabled !== false).length,
    [scenes]
  );

  // Memoize operation object to avoid recreating on every render
  const sceneBuildingOperation = useMemo(() => {
    const durationType = (videoPlan?.duration_type as DurationType) || 'medium';
    const hasPlan = !!videoPlan; // Check if plan exists
    return buildSceneBuildingOperation(durationType, hasPlan);
  }, [videoPlan]);

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            2️⃣ Review & Edit Scenes
          </Typography>
          {scenes.length === 0 && (
            <OperationButton
              operation={sceneBuildingOperation}
              label="Build Scenes from Plan"
              variant="contained"
              color="error"
              startIcon={<PlayArrow />}
              onClick={onBuildScenes}
              disabled={loading || !videoPlan.content_outline?.length}
              loading={loading}
              checkOnHover={true}
              checkOnMount={false}
              showCost={true}
            />
          )}
        </Box>

        {scriptPhase === 'ready' && fullScript ? (
          <YouTubeUnifiedPlanScript
            value={fullScript}
            onChange={onFullScriptChange}
            disabled={loading}
          />
        ) : (
          <PlanDetails
            plan={videoPlan}
            onAvatarRegenerate={onAvatarRegenerate}
            regeneratingAvatar={regeneratingAvatar}
            onPlanChange={onPlanChange}
          />
        )}

        {scenes.length === 0 ? <ScenePromptPreview plan={videoPlan} /> : null}
        {sceneBuildGeneration ? (
          <SceneGenerationMeta generation={sceneBuildGeneration} defaultExpanded />
        ) : null}

        {scenes.length === 0 && loading && (
          <Box sx={{ py: 2 }}>
            <SceneBuildLoadingPanel />
          </Box>
        )}

        {scenes.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <VideoLibrary sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Click "Build Scenes from Plan" to generate scene-by-scene breakdown
            </Typography>
          </Box>
        )}

        {scenes.length > 0 && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'space-between' }}>
            <Button variant="outlined" onClick={onBack}>
              Back to Plan
            </Button>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography variant="body2" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
                {enabledScenesCount} of {scenes.length} scenes enabled
              </Typography>
              <Button
                variant="contained"
                color="error"
                onClick={onNext}
                disabled={enabledScenesCount === 0}
              >
                Proceed to Render ({enabledScenesCount} scenes)
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </motion.div>
  );
});

ScenesStep.displayName = 'ScenesStep';

