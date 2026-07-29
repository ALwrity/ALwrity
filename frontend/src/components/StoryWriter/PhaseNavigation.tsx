import React from 'react';
import { Box, Stepper, Step, StepLabel, StepButton, Typography, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { StoryPhase } from '../../hooks/useStoryWriterPhaseNavigation';

interface PhaseNavigationProps {
  phases: StoryPhase[];
  currentPhase: string;
  onPhaseClick: (phaseId: string) => void;
  onReset?: () => void;
  colorMode?: 'light' | 'dark';
}

export const PhaseNavigation: React.FC<PhaseNavigationProps> = ({
  phases,
  currentPhase,
  onPhaseClick,
  onReset,
  colorMode = 'dark',
}) => {
  const activeStep = phases.findIndex((p) => p.id === currentPhase);
  const isLight = colorMode === 'light';

  const handleReset = () => {
    if (window.confirm('Are you sure you want to restart? This will clear all your story data and start from the beginning.')) {
      if (onReset) {
        onReset();
      }
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {onReset && (
        <Box sx={{ position: 'absolute', top: -8, right: -8, zIndex: 10 }}>
          <Tooltip title="Restart Story (Clear all data and start from beginning)">
            <IconButton
              onClick={handleReset}
              sx={{
                color: isLight ? '#8D6E63' : 'rgba(255, 255, 255, 0.9)',
                backgroundColor: isLight ? 'rgba(93, 64, 55, 0.08)' : 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  backgroundColor: isLight ? 'rgba(93, 64, 55, 0.15)' : 'rgba(255, 255, 255, 0.2)',
                  color: isLight ? '#5D4037' : 'white',
                },
              }}
              size="small"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{
          backgroundColor: 'transparent',
          '& .MuiStepLabel-label': {
            color: isLight ? '#8D6E63' : 'rgba(255, 255, 255, 0.9)',
            '&.Mui-active': {
              color: isLight ? '#5D4037' : 'white',
              fontWeight: 600,
            },
            '&.Mui-completed': {
              color: isLight ? '#6D8A6D' : 'rgba(255, 255, 255, 0.7)',
            },
            '&.Mui-disabled': {
              color: isLight ? '#C4B8A8' : 'rgba(255, 255, 255, 0.4)',
            },
          },
          '& .MuiStepLabel-iconContainer': {
            '& .MuiSvgIcon-root': {
              color: isLight ? '#C4B8A8' : 'rgba(255, 255, 255, 0.3)',
              '&.Mui-active': {
                color: isLight ? '#8D6E63' : 'rgba(255, 255, 255, 0.6)',
              },
              '&.Mui-completed': {
                color: isLight ? '#6D8A6D' : 'rgba(255, 255, 255, 0.5)',
              },
            },
          },
        }}
      >
        {phases.map((phase) => (
          <Step key={phase.id} completed={phase.completed} disabled={phase.disabled}>
            <StepButton
              onClick={() => !phase.disabled && onPhaseClick(phase.id)}
              disabled={phase.disabled}
              sx={{
                padding: '8px 4px',
                '& .MuiStepLabel-root': {
                  cursor: phase.disabled ? 'not-allowed' : 'pointer',
                },
              }}
            >
              <StepLabel
                StepIconComponent={() => (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: phase.current
                        ? isLight ? '#5D4037' : 'rgba(255, 255, 255, 0.9)'
                        : phase.completed
                        ? isLight ? '#6D8A6D' : 'rgba(76, 175, 80, 0.9)'
                        : phase.disabled
                        ? isLight ? '#E8E5D3' : 'rgba(255, 255, 255, 0.2)'
                        : isLight ? '#E8E5D3' : 'rgba(255, 255, 255, 0.3)',
                      color: phase.current
                        ? isLight ? '#FAF9F6' : '#667eea'
                        : phase.completed
                        ? 'white'
                        : isLight ? '#8D6E63' : 'rgba(255, 255, 255, 0.7)',
                      fontSize: '1rem',
                      fontWeight: phase.current ? 600 : 400,
                      transition: 'all 0.2s ease',
                      '&:hover': !phase.disabled ? {
                        backgroundColor: phase.current
                          ? isLight ? '#3E2723' : 'rgba(255, 255, 255, 1)'
                          : isLight ? '#D4C9B5' : 'rgba(255, 255, 255, 0.4)',
                        transform: 'scale(1.05)',
                      } : {},
                    }}
                  >
                    {phase.icon}
                  </Box>
                )}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: phase.current ? 600 : 400,
                    fontSize: '0.75rem',
                    color: phase.disabled
                      ? isLight ? '#C4B8A8' : 'rgba(255, 255, 255, 0.4)'
                      : phase.current
                      ? isLight ? '#2C2416' : 'white'
                      : isLight ? '#5D4037' : 'rgba(255, 255, 255, 0.8)',
                    mt: 0.5,
                  }}
                >
                  {phase.name}
                </Typography>
              </StepLabel>
            </StepButton>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};

export default PhaseNavigation;
