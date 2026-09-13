import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography
} from '@mui/material';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';
import MonitoringTasksHealthCard from '../components/MonitoringTasksHealthCard';

const PerformanceAnalyticsTab: React.FC = () => {
  const { performanceMetrics, currentStrategy } = useContentPlanningStore();

  // Strict numeric id only — no user_id/1 fallbacks. The card renders
  // nothing without a real strategy id (fail-fast, never fabricated).
  const numericId = Number(currentStrategy?.id);
  const strategyId = Number.isFinite(numericId) && numericId > 0 ? numericId : null;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Performance Analytics
      </Typography>

      {performanceMetrics ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Content Performance by Type
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No content performance data available
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Growth Trends
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No trend data available
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', p: 3 }}>
          No performance analytics data available
        </Typography>
      )}

      {/* Monitoring tasks — Phase 3b: live scheduler health + constrained
          schedule editing (frequency / pause-resume). Independent of the
          analytics payload above; the card owns its loading/error states. */}
      <MonitoringTasksHealthCard strategyId={strategyId} />
    </Box>
  );
};

export default PerformanceAnalyticsTab; 