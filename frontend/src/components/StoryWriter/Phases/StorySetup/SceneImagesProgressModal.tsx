import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  LinearProgress,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  alpha,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Palette from '@mui/icons-material/Palette';
import Brush from '@mui/icons-material/Brush';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import TuneIcon from '@mui/icons-material/Tune';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface SceneImagesProgressModalProps {
  open: boolean;
  totalScenes?: number;
  completedScenes?: number;
  failedScenes?: number;
  currentSceneTitle?: string | null;
}

interface Step {
  label: string;
  description: string;
  duration: number;
}

const STEPS: Step[] = [
  { label: 'Analyzing scene compositions', description: 'Reading scene descriptions & narrative context', duration: 1600 },
  { label: 'Setting up generation parameters', description: 'Configuring aspect ratio, style & model', duration: 1800 },
  { label: 'Generating scene illustrations', description: 'Creating images for each story scene', duration: 3500 },
  { label: 'Enhancing image quality', description: 'Optimizing resolution & visual coherence', duration: 2500 },
  { label: 'Finalizing artwork assets', description: 'Validating & storing generated images', duration: 1500 },
];

export const SceneImagesProgressModal: React.FC<SceneImagesProgressModalProps> = ({
  open,
  totalScenes,
  completedScenes = 0,
  failedScenes = 0,
  currentSceneTitle,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const hasRealProgress = totalScenes != null && totalScenes > 0;

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setCompletedSteps([]);
      return;
    }
    if (hasRealProgress) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulativeDelay = 500;

    STEPS.forEach((_step, index) => {
      const startDelay = cumulativeDelay;
      cumulativeDelay += _step.duration;

      timers.push(setTimeout(() => setActiveStep(index), startDelay));
      timers.push(setTimeout(() => setCompletedSteps((prev) => [...prev, index]), startDelay + _step.duration - 250));
    });

    return () => { timers.forEach(clearTimeout); };
  }, [open, hasRealProgress]);

  if (!open) return null;

  const allDone = hasRealProgress
    ? completedScenes >= totalScenes
    : completedSteps.length >= STEPS.length;
  const progressPercent = hasRealProgress
    ? totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0
    : Math.round((completedSteps.length / STEPS.length) * 100);

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      onBackdropClick={(e) => e.preventDefault()}
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#FAF9F6',
          boxShadow: '0 24px 64px rgba(44,36,22,0.28)',
          border: '1px solid rgba(141,110,99,0.22)',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box sx={{ height: 4, bgcolor: '#F7F3E9', position: 'relative', flexShrink: 0 }}>
        <Box
          sx={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #8D6E63, #5D4037, #3E2723)',
            transition: 'width 0.5s ease',
            borderRadius: '0 3px 3px 0',
          }}
        />
      </Box>

      <DialogContent sx={{ py: 3.5, px: { xs: 2.5, sm: 3.5 }, flex: 1, overflow: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha('#5D4037', 0.1), border: '1px solid rgba(93,64,55,0.18)', flexShrink: 0,
            }}
          >
            <ImageIcon sx={{ fontSize: 24, color: '#5D4037' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2C2416', lineHeight: 1.2 }}>
              Generating Scene Images
            </Typography>
            <Typography variant="body2" sx={{ color: '#8D6E63', mt: 0.25 }}>
              Alwrity AI is creating illustrations for each scene in your outline
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} sx={{ color: '#8D6E63', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: '#6D4C41', fontWeight: 500 }}>
              {allDone
                ? 'All scenes have been generated'
                : hasRealProgress
                ? `Scene ${completedScenes + 1} of ${totalScenes} · ${progressPercent}% complete`
                : `Step ${Math.min(completedSteps.length + 1, STEPS.length)} of ${STEPS.length} · this usually takes ~15–30 seconds`}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: '#8D6E63', fontStyle: 'italic' }}>
            Keep this dialog open — images will appear in each scene card
          </Typography>
        </Box>

        {hasRealProgress ? (
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: '#F7F3E9',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #8D6E63, #5D4037)',
                  borderRadius: 4,
                },
              }}
            />
            {currentSceneTitle && !allDone && (
              <Typography variant="body2" sx={{ color: '#5D4037', mt: 1, fontWeight: 500 }}>
                Currently: {currentSceneTitle}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#22c55e' }}>
                Done: {completedScenes}
              </Typography>
              {failedScenes > 0 && (
                <Typography variant="caption" sx={{ color: '#ef4444' }}>
                  Failed: {failedScenes}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: '#8D6E63' }}>
                Remaining: {totalScenes - completedScenes - failedScenes}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
            <Box sx={{ pr: { sm: 1 } }}>
              {STEPS.map((step, index) => {
                const isActive = activeStep === index && !completedSteps.includes(index);
                const isCompleted = completedSteps.includes(index);
                const isPending = !isActive && !isCompleted;
                return (
                  <Box key={step.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 0.75, opacity: isPending ? 0.45 : 1, transition: 'opacity 0.3s ease' }}>
                    <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25, bgcolor: isCompleted ? '#3E2723' : isActive ? '#F7F3E9' : 'transparent', border: '2px solid', borderColor: isCompleted ? '#3E2723' : isActive ? '#5D4037' : '#D7CCC8', transition: 'all 0.3s ease' }}>
                      {isCompleted ? <CheckCircleOutline sx={{ fontSize: 16, color: '#FAF9F6' }} /> : isActive ? <CircularProgress size={14} sx={{ color: '#5D4037' }} /> : null}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ color: isCompleted ? '#2C2416' : isActive ? '#3E2723' : '#8D6E63', fontWeight: isCompleted ? 500 : isActive ? 600 : 400, lineHeight: 1.3, transition: 'all 0.3s ease' }}>
                        {step.label}{isActive && '...'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#8D6E63', display: 'block', lineHeight: 1.2, mt: 0.25 }}>
                        {step.description}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F7F3E9', border: '1px solid rgba(141,110,99,0.18)' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2C2416', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <TuneIcon sx={{ fontSize: 16, color: '#5D4037' }} />
                What will be generated
              </Typography>
              <Typography variant="caption" sx={{ color: '#6D4C41', display: 'block', mb: 1.5, lineHeight: 1.45 }}>
                Each scene in your outline gets a high-quality AI illustration matching the narrative context.
              </Typography>
              <Divider sx={{ mb: 1, borderColor: 'rgba(141,110,99,0.2)' }} />
              <List dense disablePadding sx={{ py: 0 }}>
                {[
                  { icon: AutoAwesome, label: 'Scene illustrations', hint: 'One image per outline scene' },
                  { icon: Palette, label: 'Style-matched artwork', hint: 'Visuals align with your story tone' },
                  { icon: Brush, label: 'Configurable quality', hint: 'Resolution and provider from setup' },
                ].map((field) => {
                  const Icon = field.icon;
                  return (
                    <ListItem key={field.label} disableGutters sx={{ py: 0.6, px: 0, alignItems: 'flex-start' }}>
                      <ListItemIcon sx={{ minWidth: 28, mt: 0.35, color: '#5D4037' }}>
                        <Icon sx={{ fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" sx={{ fontWeight: 600, color: '#3E2723', lineHeight: 1.2 }}>{field.label}</Typography>}
                        secondary={<Typography variant="caption" sx={{ color: '#6D4C41', display: 'block', lineHeight: 1.35, mt: 0.1 }}>{field.hint}</Typography>}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SceneImagesProgressModal;
