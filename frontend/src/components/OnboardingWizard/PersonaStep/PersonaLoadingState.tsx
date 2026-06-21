import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Card,
  CardContent,
  LinearProgress,
  Fade,
  Collapse,
  IconButton,
  Stack
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LanguageIcon from '@mui/icons-material/Language';
import { PersonaGenerationProgress } from './PersonaGenerationProgress';
import { type GenerationStep } from './PersonaGenerationProgress';

interface PersonaLoadingStateProps {
  showPreview: boolean;
  isGenerating: boolean;
  corePersona: any;
  progress: number;
  generationStep: string;
  generationSteps: GenerationStep[];
  progressMessages: any[];
  error: string | null;
  pollingError: string | null;
  success: string | null;
  handleRegenerate: () => void;
  generatePersonas: () => void;
  setShowPreview: (show: boolean) => void;
  setSuccess: (message: string | null) => void;
}

const LOADING_MESSAGES = [
  { icon: <LanguageIcon sx={{ fontSize: 16 }} />, text: 'Reading your website and gathering signals' },
  { icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} />, text: 'Analyzing your writing style and tone' },
  { icon: <PsychologyIcon sx={{ fontSize: 16 }} />, text: 'Building your brand voice from the data' },
  { icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} />, text: 'Tailoring for each platform you selected' },
  { icon: <PsychologyIcon sx={{ fontSize: 16 }} />, text: 'Scoring quality and finalizing' },
];

export const PersonaLoadingState: React.FC<PersonaLoadingStateProps> = ({
  showPreview,
  isGenerating,
  corePersona,
  progress,
  generationStep,
  generationSteps,
  progressMessages,
  error,
  pollingError,
  success,
  handleRegenerate,
  generatePersonas,
  setShowPreview,
  setSuccess
}) => {
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Cycle through friendly loading messages while waiting
  useEffect(() => {
    if (showPreview || isGenerating || corePersona) {
      setLoadingMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [showPreview, isGenerating, corePersona]);

  const activeError = error || pollingError;
  const isCacheSuccess = success && success.toLowerCase().includes('cached');

  return (
    <>
      {/* Safeguard: show friendly loading instead of blank while initial checks run */}
      {!showPreview && !isGenerating && !corePersona && (
        <Fade in={true}>
          <Card sx={{
            mb: 4,
            position: 'relative',
            background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #fdf2f8 100%)',
            border: '1px solid #ddd6fe',
            boxShadow: '0 10px 25px -8px rgba(124, 58, 237, 0.12)',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <Box
              sx={{
                height: 4,
                background: 'linear-gradient(90deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%)',
                backgroundSize: '200% 100%',
                animation: 'persona-load-shimmer 3s ease-in-out infinite',
                '@keyframes persona-load-shimmer': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' }
                }
              }}
            />
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2.5,
                    boxShadow: '0 12px 24px -8px rgba(124, 58, 237, 0.45)'
                  }}
                >
                  <PsychologyIcon sx={{ fontSize: 36, color: 'white' }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e1b4b', mb: 1 }}>
                  Preparing Persona Workspace
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', maxWidth: 480, mx: 'auto' }}>
                  Checking cache and getting everything ready for your brand voice generation.
                </Typography>
              </Box>
              <LinearProgress
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(124, 58, 237, 0.1)',
                  mb: 2.5,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: 'linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)'
                  }
                }}
              />
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                spacing={1}
                sx={{
                  minHeight: 24,
                  color: '#7C3AED',
                  transition: 'opacity 0.3s ease'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {LOADING_MESSAGES[loadingMsgIndex].icon}
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                  {LOADING_MESSAGES[loadingMsgIndex].text}…
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Fade>
      )}

      {/* Generation Progress */}
      <PersonaGenerationProgress
        isGenerating={isGenerating}
        progress={progress}
        currentStep={generationStep}
        generationSteps={generationSteps}
        progressMessages={progressMessages}
      />

      {/* Error Display — friendly, with collapsible "what happened" */}
      {activeError && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 3, alignItems: 'flex-start' }}
          action={
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={handleRegenerate}
              sx={{ textTransform: 'none', fontWeight: 600, mt: 0.5 }}
            >
              Try again
            </Button>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Something went wrong while building your brand voice
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            This is usually temporary. Click <strong>Try again</strong> and we'll start over.
          </Typography>
          <Button
            size="small"
            onClick={() => setShowErrorDetails((v) => !v)}
            endIcon={
              <ExpandMoreIcon
                sx={{
                  fontSize: 14,
                  transform: showErrorDetails ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            }
            sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#7f1d1d', p: 0, minWidth: 0, mt: 0.5 }}
          >
            {showErrorDetails ? 'Hide' : 'What happened?'}
          </Button>
          <Collapse in={showErrorDetails} timeout={200}>
            <Typography
              variant="caption"
              component="pre"
              sx={{
                mt: 1,
                p: 1.5,
                bgcolor: 'rgba(127, 29, 29, 0.05)',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#7f1d1d',
              }}
            >
              {activeError}
            </Typography>
          </Collapse>
        </Alert>
      )}

      {/* Cache notice — friendly, action-oriented */}
      {showPreview && isCacheSuccess && (
        <Alert
          severity="success"
          icon={<AutoAwesomeIcon fontSize="small" />}
          sx={{ mb: 3, borderRadius: 3 }}
          action={
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={() => {
                setShowPreview(false);
                setSuccess(null);
                generatePersonas();
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Generate new
            </Button>
          }
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
            We found a saved brand voice
          </Typography>
          <Typography variant="body2">
            Your last brand voice is shown below. Click <strong>Generate new</strong> if you'd like a fresh one.
          </Typography>
        </Alert>
      )}
    </>
  );
};

export default PersonaLoadingState;
