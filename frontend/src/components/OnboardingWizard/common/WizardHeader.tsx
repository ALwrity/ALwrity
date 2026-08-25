import React from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Tooltip,
  Fade,
  CircularProgress
} from '@mui/material';
import {
  HelpOutline,
  Close
} from '@mui/icons-material';
import UserBadge from '../../shared/UserBadge';

interface WizardHeaderProps {
  activeStep: number;
  furthestAccessibleStep: number;
  progress: number;
  stepHeaderContent: {
    title: string;
    description: string;
  };
  showProgressMessage: boolean;
  progressMessage: string;
  showHelp: boolean;
  isMobile: boolean;
  steps: Array<{
    label: string;
    description: string;
    icon: string;
  }>;
  onStepClick: (stepIndex: number) => void;
  onHelpToggle: () => void;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({
  activeStep,
  furthestAccessibleStep,
  progress,
  stepHeaderContent,
  showProgressMessage,
  progressMessage,
  showHelp,
  isMobile,
  steps,
  onStepClick,
  onHelpToggle
}) => {
  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        p: { xs: 2, md: 3 },
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none',
        }
      }}
    >
      {/* Progress Message */}
      {showProgressMessage && (
        <Fade in={showProgressMessage}>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              background: 'rgba(16, 185, 129, 0.9)',
              color: 'white',
              p: 2,
              textAlign: 'center',
              zIndex: 10,
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {progressMessage}
            </Typography>
          </Box>
        </Fade>
      )}
      
      {/* Top Row - Title and Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, position: 'relative', zIndex: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <UserBadge colorMode="dark" />
        </Box>
        <Box sx={{ flex: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.025em' }}>
            {stepHeaderContent.title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 0.5 }}>
            <Tooltip title={`Setup progress: ${Math.round(progress)}%`} arrow>
              <Box sx={{ position: 'relative', width: 36, height: 36 }}>
                <CircularProgress
                  variant="determinate"
                  value={progress}
                  size={36}
                  thickness={3.6}
                  sx={{
                    color: 'rgba(248, 250, 252, 0.95)',
                    '& .MuiCircularProgress-circle': {
                      strokeLinecap: 'round'
                    }
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: 9, opacity: 0.85 }}>
                      Setup
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {Math.round(progress)}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Tooltip>
          </Box>
          <Tooltip title="Get Help" arrow>
            <IconButton 
              onClick={onHelpToggle}
              sx={{ 
                color: 'white', 
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                }
              }}
            >
              <HelpOutline />
            </IconButton>
          </Tooltip>
          <Tooltip title="Skip for now" arrow>
            <IconButton 
              sx={{ 
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                }
              }}
            >
              <Close />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Stepper in Header */}
      <Box sx={{ position: 'relative', zIndex: 1, mt: 0.25 }}>
        <Stepper 
          activeStep={activeStep} 
          alternativeLabel={!isMobile}
          sx={{
            '& .MuiStepLabel-root': {
              cursor: 'pointer',
            },
            '& .MuiStepLabel-label': {
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'white',
            },
            '& .MuiStepLabel-labelContainer': {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mt: 0.25
            },
            '& .MuiStepLabel-label.Mui-completed': {
              color: 'rgba(255, 255, 255, 0.9)',
            },
            '& .MuiStepLabel-label.Mui-active': {
              color: 'white',
            },
            '& .MuiStepLabel-label.Mui-disabled': {
              color: 'rgba(255, 255, 255, 0.6)',
            },
          }}
        >
          {steps.map((step, index) => (
            <Step key={step.label}>
              <Tooltip title={step.description} arrow>
                <StepLabel
                  onClick={() => onStepClick(index)}
                  sx={{
                    cursor: index <= furthestAccessibleStep ? 'pointer' : 'default',
                    '& .MuiStepLabel-iconContainer': {
                      background: index <= furthestAccessibleStep 
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: index <= furthestAccessibleStep ? 'white' : 'rgba(255, 255, 255, 0.6)',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: index <= furthestAccessibleStep 
                        ? '0 3px 10px rgba(15, 23, 42, 0.45)'
                        : 'none',
                      border: index < activeStep
                        ? '1px solid rgba(248, 250, 252, 0.9)'
                        : '1px solid rgba(148, 163, 184, 0.4)',
                      '&:hover': {
                        transform: index <= furthestAccessibleStep ? 'translateY(-1px) scale(1.03)' : 'none',
                        boxShadow: index <= furthestAccessibleStep 
                          ? '0 5px 14px rgba(15, 23, 42, 0.55)'
                          : 'none',
                      }
                    },
                    '& .MuiStepLabel-label': {
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textAlign: 'center',
                      textDecoration: index < activeStep ? 'underline' : 'none',
                      opacity: index <= furthestAccessibleStep ? 0.98 : 0.7
                    }
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'center' }}>
                    {step.label}
                  </Typography>
                </StepLabel>
              </Tooltip>
            </Step>
          ))}
        </Stepper>
      </Box>
    </Box>
  );
};
