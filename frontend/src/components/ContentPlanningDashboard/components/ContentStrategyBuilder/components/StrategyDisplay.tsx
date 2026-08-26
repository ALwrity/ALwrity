import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Grid
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { StrategyDisplayProps } from '../types/contentStrategy.types';

const StrategyDisplay: React.FC<StrategyDisplayProps> = ({
  currentStrategy,
  error,
  categoryCompletionMessage,
  onViewStrategicIntelligence
}) => {
  return (
    <>
      {/* Success Alert */}
      {!error && currentStrategy && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Strategy "{currentStrategy.name}" created successfully! Check the Strategic Intelligence tab for detailed insights.
        </Alert>
      )}

      {/* Strategy Display */}
      {currentStrategy && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Created Strategy: {currentStrategy.name}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" color="text.secondary">
                Industry: {currentStrategy.industry}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Completion: {currentStrategy.completion_percentage}%
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" color="text.secondary">
                Created: {new Date(currentStrategy.created_at).toLocaleDateString()}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                ID: {currentStrategy.id}
              </Typography>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={onViewStrategicIntelligence}
              startIcon={<AssessmentIcon />}
            >
              View Strategic Intelligence
            </Button>
          </Box>
        </Paper>
      )}

      {/* Category Completion Message */}
      {categoryCompletionMessage && (
        <Alert
          severity="success"
          sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {categoryCompletionMessage}
        </Alert>
      )}
    </>
  );
};

export default StrategyDisplay; 