import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Chip
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  TravelExplore as CrawlIcon,
  Psychology as VoiceIcon,
  Translate as StyleIcon,
  Group as AudienceIcon,
  Analytics as StrategyIcon,
  AutoAwesome as AIIcon,
  Language as GlobeIcon,
  Memory as ProcessIcon
} from '@mui/icons-material';

interface AnalysisProgress {
  step: number;
  message: string;
  subMessage?: string;
  completed: boolean;
}

interface AnalysisProgressDisplayProps {
  loading: boolean;
  progress: AnalysisProgress[];
}

const stepIcons: Record<number, React.ReactNode> = {
  1: <GlobeIcon />,
  2: <CrawlIcon />,
  3: <ProcessIcon />,
  4: <VoiceIcon />,
  5: <StyleIcon />,
  6: <AudienceIcon />,
  7: <StrategyIcon />,
};

const fallbackIcon = <AIIcon />;

const AnalysisProgressDisplay: React.FC<AnalysisProgressDisplayProps> = ({
  loading,
  progress
}) => {
  const completedSteps = progress.filter(p => p.completed).length;
  const totalSteps = progress.length;
  const percentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 4px 20px rgba(16,24,40,0.06)',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: '#EEF2FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6366F1',
          }}
        >
          <CrawlIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0B1220', lineHeight: 1.3 }}>
            Website Analysis in Progress
          </Typography>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>
            AI is learning your brand voice and content style
          </Typography>
        </Box>
        <Chip
          label={`${Math.round(percentage)}%`}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.8rem',
            bgcolor: percentage === 100 ? '#DCFCE7' : '#EEF2FF',
            color: percentage === 100 ? '#16A34A' : '#6366F1',
            borderRadius: '8px',
          }}
        />
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 6,
          borderRadius: 3,
          mb: 3,
          bgcolor: '#F3F4F6',
          '& .MuiLinearProgress-bar': {
            bgcolor: percentage === 100 ? '#16A34A' : '#6366F1',
            borderRadius: 3,
            transition: 'transform 0.5s ease',
          },
        }}
      />

      {/* Step list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {progress.map((step) => (
          <Paper
            key={step.step}
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.5,
              borderRadius: 2,
              bgcolor: step.completed ? '#FAFAFA' : '#FFFFFF',
              border: '1px solid',
              borderColor: step.completed ? '#E5E7EB' : '#F3F4F6',
              opacity: step.completed ? 1 : 0.85,
              transition: 'all 0.3s ease',
            }}
          >
            {/* Icon */}
            <Box
              sx={{
                width: 32,
                height: 32,
                minWidth: 32,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: step.completed ? '#DCFCE7' : '#F3F4F6',
                color: step.completed ? '#16A34A' : '#9CA3AF',
                transition: 'all 0.3s ease',
              }}
            >
              {step.completed ? <CheckIcon sx={{ fontSize: 18 }} /> : (stepIcons[step.step] || fallbackIcon)}
            </Box>

            {/* Text */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: step.completed ? '#0B1220' : '#4B5563',
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                }}
              >
                {step.message}
              </Typography>
              {step.subMessage && (
                <Typography
                  variant="caption"
                  sx={{
                    color: '#9CA3AF',
                    display: 'block',
                    mt: 0.25,
                    fontSize: '0.75rem',
                    lineHeight: 1.3,
                  }}
                >
                  {step.subMessage}
                </Typography>
              )}
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Footer tip */}
      <Box
        sx={{
          mt: 2.5,
          p: 2,
          borderRadius: 2,
          bgcolor: '#FFFBEB',
          border: '1px solid #FDE68A',
        }}
      >
        <Typography variant="caption" sx={{ color: '#92400E', display: 'block', fontWeight: 600, mb: 0.25 }}>
          Why this matters for your content strategy
        </Typography>
        <Typography variant="caption" sx={{ color: '#A16207', lineHeight: 1.4 }}>
          Alwrity analyzes your existing website content to understand your brand's unique voice, 
          tone, and audience. This ensures every AI-generated post, article, and campaign 
          sounds authentically <em>you</em> — not generic AI.
        </Typography>
      </Box>

      {/* Scheduling notification — shown when all steps complete */}
      {percentage === 100 && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              minWidth: 8,
              borderRadius: '50%',
              bgcolor: '#22C55E',
            }}
          />
          <Typography variant="caption" sx={{ color: '#166534', fontWeight: 500, lineHeight: 1.4 }}>
            Deep analysis started in background — SEO audit, market trends, competitive intelligence, and website content indexing for AI insights
            are now running while you continue setup. Check back on your dashboard for results.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default AnalysisProgressDisplay;
