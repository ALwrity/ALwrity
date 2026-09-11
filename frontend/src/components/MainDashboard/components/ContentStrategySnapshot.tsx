import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Button,
  Chip,
  Skeleton,
  Grid,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningIcon from '@mui/icons-material/Warning';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';
import { useOnboardingTasksStatus } from '../../../hooks/useOnboardingTasksStatus';
import SemanticIndexSnapshotRow from './SemanticIndexSnapshotRow';
import { isStrategySifSnapshotEnabled } from '../../../config/strategySifConfig';

interface StrategySnapshotProps {
  /** Current strategy status from ContentStrategyTab */
  strategyStatus: 'active' | 'inactive' | 'pending' | 'none';
  /** Strategy data from AI analysis (when available) */
  strategyData?: any;
  /** onboarding tasks status from hook */
  onboardingTasks?: any;
  /** Callback when user wants to view/edit strategy */
  onViewStrategy?: () => void;
  /** Callback when user wants to activate strategy */
  onActivateStrategy?: () => void;
  /** Callback when user wants to edit strategy */
  onEditStrategy?: () => void;
  /** Callback when user dismisses the component */
  onDismiss?: () => void;
}

/**
 * ContentStrategySnapshot - Gives end users a snapshot view of their content strategy
 * 
 * Designed for non-tech users with:
 - Plain language metrics (no technical jargon)
 - Color-coded working indicator (green/yellow/red)
 - One primary action per state
 - Clear, immediate understanding of "is my strategy working?"
 */
const ContentStrategySnapshot: React.FC<StrategySnapshotProps> = ({
  strategyStatus,
  strategyData,
  onboardingTasks,
  onViewStrategy,
  onActivateStrategy,
  onEditStrategy,
  onDismiss,
}) => {
  const navigate = useNavigate();
  // onboardingTasks is passed as a prop, no need to fetch hook internally

  // Extract strategy info from various data sources
  const strategyName = useMemo(() => {
    if (!strategyData) return 'Your Content Strategy';
    if (strategyData.name) return strategyData.name;
    if (strategyData.strategy_name) return strategyData.strategy_name;
    return 'Your Content Strategy';
  }, [strategyData]);

  // Determine status label and color for non-tech users
  const statusInfo = useMemo(() => {
    switch (strategyStatus) {
      case 'active':
        return {
          label: 'Strategy Active',
          subtitle: 'Your content strategy is live and being monitored',
          color: 'success',
          actionLabel: 'View Analytics',
          actionIcon: <CheckCircleIcon sx={{ color: 'green' }} />,
          needsActivation: false,
        };
      case 'pending':
        return {
          label: 'Strategy Ready',
          subtitle: 'Your AI-generated strategy is ready for review',
          color: 'warning',
          actionLabel: 'Activate Strategy',
          actionIcon: <WarningIcon sx={{ color: 'orange' }} />,
          needsActivation: true,
        };
      case 'inactive':
        return {
          label: 'Strategy Inactive',
          subtitle: 'Your strategy was previously active but is currently paused',
          color: 'error',
          actionLabel: 'Reactivate Strategy',
          actionIcon: <PlayArrowIcon sx={{ color: 'purple' }} />,
          needsActivation: true,
        };
      case 'none':
      default:
        return {
          label: 'No Strategy',
          subtitle: 'Let\'s create your first AI-powered content strategy',
          color: 'secondary',
          actionLabel: 'Create Strategy',
          actionIcon: <RefreshIcon sx={{ color: '#555' }} />,
          needsActivation: true,
        };
    }
  }, [strategyStatus]);

  // Determine metrics and working indicator for active strategies
  const metricsInfo = useMemo(() => {
    // Only show metrics for active strategies with data
    if (strategyStatus !== 'active' || !strategyData) {
      return {
        hasMetrics: false,
        workingIndicator: null,
        workingColor: 'secondary',
        workingLabel: '',
      };
    }

    // Extract metrics from strategy data - plain language, no jargon
    const performancePredictions = strategyData.performance_predictions || {};
    const strategicInsights = strategyData.strategic_insights || {};

    // Get metrics with friendly names
    const trafficGrowth = performancePredictions.traffic_growth || '—';
    const engagementRate = performancePredictions.engagement_metrics || '—';
    const conversionRate = performancePredictions.conversion_metrics || '—';

    // Determine if strategy is "working" based on having positive metrics
    const hasPositiveMetrics =
      (performancePredictions.traffic_growth && 
        String(performancePredictions.traffic_growth).includes('%')) ||
      (performancePredictions.engagement_metrics && 
        String(performancePredictions.engagement_metrics).includes('%'));

    let workingIndicator;
    let workingColor = 'secondary';
    let workingLabel = '';

    if (hasPositiveMetrics) {
      workingIndicator = <CheckCircleIcon sx={{ color: 'green' }} />;
      workingColor = 'success';
      workingLabel = 'Strategy is working';
    } else {
      workingIndicator = <WarningIcon sx={{ color: 'orange' }} />;
      workingColor = 'warning';
      workingLabel = 'Strategy needs attention';
    }

    return {
      hasMetrics: true,
      trafficGrowth,
      engagementRate,
      conversionRate,
      workingIndicator,
      workingColor,
      workingLabel,
    };
  }, [strategyStatus, strategyData]);

  // Handle action button clicks
  const handleActionClick = useCallback(() => {
    switch (statusInfo.needsActivation) {
      case true:
        if (onActivateStrategy) onActivateStrategy();
        else if (onEditStrategy) onEditStrategy();
        break;
      case false:
        if (onViewStrategy) onViewStrategy();
        break;
    }
  }, [statusInfo.needsActivation, onActivateStrategy, onEditStrategy, onViewStrategy]);

  // Determine if we should show skeleton loading
  const isLoading = !strategyData && strategyStatus !== 'none';

  return (
    <Box sx={{ p: 2, mb: 3 }}>
      {/* Status Header Card */}
      <Paper sx={{ p: 3, bgcolor: 'background', borderRadius: 1 }}>
        {/* Status Chip */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip
            label={statusInfo.label}
            color={statusInfo.color as any}
            variant="outlined"
            sx={{ height: 24 }}
          />
        </Box>

        {/* Subtitle */}
        <Typography variant="body2" color="text.secondary">
          {statusInfo.subtitle}
        </Typography>

        {/* Metrics Section (only for active strategies with data) */}
        {metricsInfo.hasMetrics && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'surface', borderRadius: 1 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {metricsInfo.trafficGrowth}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Traffic Growth
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {metricsInfo.engagementRate}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Engagement
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            {/* Working indicator row */}
            {metricsInfo.workingIndicator && (
              <Box sx={{ mt: 2, textAlign: 'center', p: 1 }}>
                <Chip
                  label={metricsInfo.workingLabel}
                  color={metricsInfo.workingColor as any}
                  sx={{ height: 28, fontSize: 12 }}
                />
              </Box>
            )}
          </Box>
        )}

        {/* Semantic Index — Phase 3: compact dashboard row for the active
            strategy's read-only index status. Gated by a feature flag (off by
            default); degrades gracefully (renders nothing) on endpoint error. */}
        {isStrategySifSnapshotEnabled() && (strategyStatus === 'active' || strategyStatus === 'pending') && (
          <SemanticIndexSnapshotRow />
        )}

        {/* Action Button */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color={statusInfo.color as any}
            onClick={handleActionClick}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              marginRight: 1,
            }}
          >
            {statusInfo.actionIcon}
            {statusInfo.actionLabel}
          </Button>
        </Box>
      </Paper>

      {/* Loading State */}
      {isLoading && !strategyData && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
            Loading strategy data...
          </Typography>
        </Box>
      )}

      {/* Empty state when no strategy data */}
      {!strategyData && strategyStatus !== 'none' && (
        <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            Strategy data not available yet
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ContentStrategySnapshot;