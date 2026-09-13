import React from 'react';
import {
  Box,
  Typography,
  LinearProgress
} from '@mui/material';
import { SEOAnalysisLoadingProps } from '../../shared/types';

const SEOAnalysisLoading: React.FC<SEOAnalysisLoadingProps> = ({ loading, progress, stage }) => {
  if (!loading) return null;

  const determinate = typeof progress === 'number';

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body1" sx={{ color: 'white', mb: 2 }}>
        🤖 AI is analyzing your website...
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
        {stage ?? 'Identifying specific issues and generating actionable fixes...'}
        {determinate && ` ${Math.round(progress)}%`}
      </Typography>
      {determinate ? (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, Math.max(0, progress))}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #2196F3, #4CAF50)',
              borderRadius: 3,
            },
          }}
        />
      ) : (
        <LinearProgress
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #2196F3, #4CAF50)',
              borderRadius: 3,
            },
          }}
        />
      )}
    </Box>
  );
};

export default SEOAnalysisLoading;
