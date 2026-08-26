import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  CircularProgress,
  Chip,
  Alert
} from '@mui/material';
import HourglassIcon from '@mui/icons-material/HourglassEmpty';
import TrendingIcon from '@mui/icons-material/TrendingUp';
import CheckIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  progress?: number;
  message?: string;
}

interface WizardLoadingStateProps {
  title: string;
  subtitle?: string;
  steps?: LoadingStep[];
  overallProgress?: number;
  isGenerating?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const LoadingStepItem: React.FC<{ step: LoadingStep }> = ({ step }) => {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <CheckIcon color="success" fontSize="small" />;
      case 'loading':
        return <CircularProgress size={16} />;
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />;
      default:
        return <HourglassIcon color="disabled" fontSize="small" />;
    }
  };

  const getStatusColor = () => {
    switch (step.status) {
      case 'completed':
        return 'success';
      case 'loading':
        return 'primary';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2, 
      p: 2, 
      borderRadius: 1,
      bgcolor: step.status === 'loading' ? 'action.hover' : 'transparent',
      border: step.status === 'loading' ? '1px solid' : 'none',
      borderColor: 'primary.main'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {getStatusIcon()}
      </Box>
      
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {step.label}
        </Typography>
        {step.message && (
          <Typography variant="caption" color="text.secondary">
            {step.message}
          </Typography>
        )}
      </Box>

      <Chip
        label={step.status}
        size="small"
        color={getStatusColor() as any}
        variant={step.status === 'pending' ? 'outlined' : 'filled'}
      />

      {step.progress !== undefined && step.status === 'loading' && (
        <Box sx={{ width: 100 }}>
          <LinearProgress 
            variant="determinate" 
            value={step.progress} 
          />
        </Box>
      )}
    </Box>
  );
};

export const WizardLoadingState: React.FC<WizardLoadingStateProps> = ({
  title,
  subtitle,
  steps = [],
  overallProgress,
  isGenerating = false,
  error,
  onRetry
}) => {
  const defaultSteps: LoadingStep[] = [
    {
      id: 'analyzing',
      label: 'Analyzing your strategy data',
      status: 'loading',
      progress: 25,
      message: 'Processing content pillars and target audience'
    },
    {
      id: 'configuring',
      label: 'Configuring calendar settings',
      status: 'pending',
      message: 'Setting up content mix and timing preferences'
    },
    {
      id: 'generating',
      label: 'Generating content calendar',
      status: 'pending',
      message: 'Creating optimized content schedule'
    },
    {
      id: 'optimizing',
      label: 'Optimizing for performance',
      status: 'pending',
      message: 'Applying AI-driven optimization'
    }
  ];

  const displaySteps = steps.length > 0 ? steps : defaultSteps;

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Card sx={{ 
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        border: '1px solid',
        borderColor: 'divider'
      }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              {isGenerating ? (
                <CircularProgress size={60} thickness={4} />
              ) : (
                <TrendingIcon sx={{ fontSize: 60, color: 'primary.main' }} />
              )}
            </Box>
            
            <Typography variant="h5" gutterBottom>
              {title}
            </Typography>
            
            {subtitle && (
              <Typography variant="body1" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Error Display */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 3 }}
              action={
                onRetry && (
                  <Box component="button" onClick={onRetry} sx={{ 
                    border: 'none', 
                    bgcolor: 'transparent', 
                    color: 'inherit',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}>
                    Retry
                  </Box>
                )
              }
            >
              {error}
            </Alert>
          )}

          {/* Overall Progress */}
          {overallProgress !== undefined && (
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Overall Progress
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round(overallProgress)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={overallProgress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}

          {/* Loading Steps */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {displaySteps.map((step, index) => (
              <LoadingStepItem key={step.id} step={step} />
            ))}
          </Box>

          {/* Additional Info */}
          <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              {isGenerating 
                ? 'Please wait while we generate your content calendar. This may take a few moments.'
                : 'We\'re preparing your content calendar with the latest AI-powered optimizations.'
              }
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

// Specialized loading states for different wizard operations
export const CalendarGenerationLoading: React.FC<{ progress?: number; error?: string }> = ({
  progress,
  error
}) => (
  <WizardLoadingState
    title="Generating Your Content Calendar"
    subtitle="AI is creating an optimized content schedule based on your strategy"
    overallProgress={progress}
    isGenerating={true}
    error={error}
    steps={[
      {
        id: 'validating',
        label: 'Validating configuration',
        status: progress && progress > 0 ? 'completed' : 'loading',
        progress: progress && progress > 0 ? 100 : 50
      },
      {
        id: 'processing',
        label: 'Processing strategy data',
        status: progress && progress > 20 ? 'completed' : progress && progress > 10 ? 'loading' : 'pending',
        progress: progress && progress > 10 ? Math.min(100, (progress - 10) * 5) : 0
      },
      {
        id: 'generating',
        label: 'Generating content schedule',
        status: progress && progress > 50 ? 'completed' : progress && progress > 30 ? 'loading' : 'pending',
        progress: progress && progress > 30 ? Math.min(100, (progress - 30) * 5) : 0
      },
      {
        id: 'optimizing',
        label: 'Optimizing for performance',
        status: progress && progress > 80 ? 'completed' : progress && progress > 60 ? 'loading' : 'pending',
        progress: progress && progress > 60 ? Math.min(100, (progress - 60) * 5) : 0
      }
    ]}
  />
);

export const DataProcessingLoading: React.FC<{ message?: string }> = ({ message }) => (
  <WizardLoadingState
    title="Processing Your Data"
    subtitle="Analyzing your strategy and preparing calendar configuration"
    steps={[
      {
        id: 'loading',
        label: message || 'Loading and validating data',
        status: 'loading',
        progress: 75
      }
    ]}
  />
);
