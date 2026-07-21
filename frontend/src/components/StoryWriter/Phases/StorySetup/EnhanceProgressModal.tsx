import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import AutoAwesome from '@mui/icons-material/AutoAwesome';

interface EnhanceProgressModalProps {
  open: boolean;
}

const STEPS = [
  { label: 'Analyzing your story idea', duration: 1800 },
  { label: 'Identifying narrative patterns', duration: 1600 },
  { label: 'Generating enhanced variations', duration: 2200 },
  { label: 'Crafting recommendations', duration: 1800 },
  { label: 'Finalizing options', duration: 1200 },
];

export const EnhanceProgressModal: React.FC<EnhanceProgressModalProps> = ({ open }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setCompletedSteps([]);
      return;
    }

    const timers: NodeJS.Timeout[] = [];
    let cumulativeDelay = 400;

    STEPS.forEach((step, index) => {
      const startDelay = cumulativeDelay;
      cumulativeDelay += step.duration;

      const showTimer = setTimeout(() => {
        setActiveStep(index);
      }, startDelay);

      const completeTimer = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, index]);
      }, startDelay + step.duration - 200);

      timers.push(showTimer, completeTimer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [open]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: '#FAF9F6',
          boxShadow: '0 24px 64px rgba(44,36,22,0.25)',
          border: '1px solid rgba(141,110,99,0.2)',
          overflow: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          height: 3,
          bgcolor: '#F7F3E9',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${(completedSteps.length / STEPS.length) * 100}%`,
            background: 'linear-gradient(90deg, #8D6E63, #5D4037, #3E2723)',
            transition: 'width 0.5s ease',
            borderRadius: '0 2px 2px 0',
          }}
        />
      </Box>
      <DialogContent sx={{ py: 4, px: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <AutoAwesome sx={{ fontSize: 36, color: '#5D4037', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#2C2416' }}>
            Enhancing Your Story Idea
          </Typography>
          <Typography variant="body2" sx={{ color: '#8D6E63', mt: 0.5 }}>
            Alwrity AI is crafting 3 enhanced options
          </Typography>
        </Box>

        <Box sx={{ maxWidth: 320, mx: 'auto' }}>
          {STEPS.map((step, index) => {
            const isActive = activeStep === index && !completedSteps.includes(index);
            const isCompleted = completedSteps.includes(index);
            const isPending = !isActive && !isCompleted;

            return (
              <Box
                key={step.label}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1,
                  opacity: isPending ? 0.4 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    bgcolor: isCompleted ? '#3E2723' : isActive ? '#F7F3E9' : 'transparent',
                    border: '2px solid',
                    borderColor: isCompleted ? '#3E2723' : isActive ? '#5D4037' : '#D7CCC8',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isCompleted ? (
                    <CheckCircleOutline sx={{ fontSize: 16, color: '#FAF9F6' }} />
                  ) : isActive ? (
                    <CircularProgress size={14} sx={{ color: '#5D4037' }} />
                  ) : null}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: isCompleted ? '#2C2416' : isActive ? '#3E2723' : '#8D6E63',
                    fontWeight: isCompleted ? 500 : isActive ? 600 : 400,
                    transition: 'all 0.3s ease',
                  }}
                >
                  {step.label}
                  {isActive && '...'}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box
          sx={{
            mt: 3,
            p: 1.5,
            bgcolor: '#F7F3E9',
            borderRadius: 2,
            border: '1px solid rgba(141,110,99,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CircularProgress size={14} sx={{ color: '#8D6E63', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: '#6D4C41' }}>
            {completedSteps.length < STEPS.length
              ? 'This usually takes a few seconds'
              : 'Finalizing your enhanced options...'}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
