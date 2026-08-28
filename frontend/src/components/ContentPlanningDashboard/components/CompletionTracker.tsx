import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Card,
  CardContent,
  Grid,
  Tooltip,
  IconButton
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoIcon from '@mui/icons-material/Info';

interface CompletionStats {
  total_fields: number;
  filled_fields: number;
  completion_percentage: number;
  category_completion: Record<string, number>;
}

interface CompletionTrackerProps {
  completionPercentage: number;
  completionStats: CompletionStats;
}

const CompletionTracker: React.FC<CompletionTrackerProps> = ({
  completionPercentage,
  completionStats
}) => {
  const getCategoryColor = (percentage: number) => {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'error';
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      business_context: '🏢',
      audience_intelligence: '👥',
      competitive_intelligence: '📈',
      content_strategy: '📝',
      performance_analytics: '📊'
    };
    return icons[category as keyof typeof icons] || '📋';
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      business_context: 'Business Context',
      audience_intelligence: 'Audience Intelligence',
      competitive_intelligence: 'Competitive Intelligence',
      content_strategy: 'Content Strategy',
      performance_analytics: 'Performance & Analytics'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCompletionStatus = (percentage: number) => {
    if (percentage >= 90) return { status: 'Excellent', color: 'success' as const };
    if (percentage >= 70) return { status: 'Good', color: 'primary' as const };
    if (percentage >= 50) return { status: 'Fair', color: 'warning' as const };
    return { status: 'Needs Work', color: 'error' as const };
  };

  const status = getCompletionStatus(completionPercentage);

  return (
    <Card variant="outlined" sx={{ minWidth: 300 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <TrendingUpIcon color="primary" />
          <Typography variant="h6">
            Strategy Progress
          </Typography>
          <Chip
            label={status.status}
            color={status.color}
            size="small"
          />
        </Box>

        {/* Overall Progress */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Overall Completion
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(completionPercentage)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={completionPercentage}
            sx={{ height: 8, borderRadius: 4 }}
            color={status.color}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {completionStats.filled_fields} of {completionStats.total_fields} fields completed
          </Typography>
        </Box>

        {/* Category Breakdown */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Category Progress
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(completionStats.category_completion).map(([category, percentage]) => (
              <Grid item xs={12} key={category}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 20 }}>
                    {getCategoryIcon(category)}
                  </Typography>
                  <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.875rem' }}>
                    {getCategoryLabel(category)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
                    {Math.round(percentage)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={percentage}
                  color={getCategoryColor(percentage)}
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Progress Insights */}
        {completionPercentage > 0 && (
          <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {completionPercentage >= 80 ? (
                '🎉 Great progress! You\'re ready to generate AI recommendations.'
              ) : completionPercentage >= 50 ? (
                '📈 Good progress! Consider filling more fields for better AI insights.'
              ) : (
                '💡 Start with the Business Context section to build a strong foundation.'
              )}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default CompletionTracker; 