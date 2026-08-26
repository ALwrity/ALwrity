import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Badge,
  Tooltip as MuiTooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import { motion } from 'framer-motion';

interface ProgressTrackerProps {
  reviewProgressPercentage: number;
  reviewedCategoriesCount: number;
  totalCategories: number;
  autoPopulatedFields: any;
  aiGenerating: boolean;
  onShowAIRecommendations: () => void;
  onShowDataSourceTransparency: () => void;
  onRefreshData: () => void;
  onRefreshAI?: () => void;
  // New optional props for refresh feedback
  refreshMessage?: string | null;
  refreshProgress?: number;
  isRefreshing?: boolean;
  refreshError?: string | null;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  reviewProgressPercentage,
  reviewedCategoriesCount,
  totalCategories,
  autoPopulatedFields,
  aiGenerating,
  onShowAIRecommendations,
  onShowDataSourceTransparency,
  onRefreshData,
  onRefreshAI,
  refreshMessage,
  refreshProgress = 0,
  isRefreshing = false,
  refreshError = null
}) => {
  const effectiveProgress = isRefreshing ? Math.max(5, Math.min(100, Math.round(refreshProgress))) : Math.round(reviewProgressPercentage);

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* Compact header row with title, progress, counts and actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Progress</Typography>
          <Box sx={{ position: 'relative', width: 28, height: 28 }}>
            <CircularProgress variant="determinate" value={effectiveProgress} size={28} thickness={5} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: 10 }}>{effectiveProgress}%</Typography>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {reviewedCategoriesCount}/{totalCategories}
          </Typography>
        </Box>

        {/* Actions inline in header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <MuiTooltip title="AI Recommendations">
            <IconButton size="small" onClick={onShowAIRecommendations}>
              <AutoAwesomeIcon fontSize="small" />
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="Data Transparency">
            <IconButton size="small" onClick={onShowDataSourceTransparency}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title="Refresh Data (AI)">
            <IconButton size="small" onClick={onRefreshAI || onRefreshData}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {/* Combined info line with refresh/error banner */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 22 }}>
        <CheckCircleIcon color="success" sx={{ fontSize: 14 }} />
        {refreshError ? (
          <Typography variant="caption" color="error" sx={{ fontSize: '0.72rem' }}>
            {refreshError}
          </Typography>
        ) : isRefreshing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CircularProgress size={12} thickness={6} />
            <Typography variant="caption" color="primary" sx={{ fontSize: '0.72rem' }}>
              {refreshMessage || 'Refreshing data…'}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Auto-population: {Object.keys(autoPopulatedFields || {}).length} fields • AI Insights: {aiGenerating ? 'Generating…' : 'Ready'}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ProgressTracker; 