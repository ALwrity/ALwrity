import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider
} from '@mui/material';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Import calendar-specific types
import { type CalendarConfig } from './types';

interface DataReviewStepProps {
  calendarConfig: CalendarConfig;
  userData: any;
  strategyContext?: any;
  onConfigUpdate: (updates: Partial<CalendarConfig>) => void;
}

const DataReviewStep: React.FC<DataReviewStepProps> = ({
  calendarConfig,
  userData,
  strategyContext,
  onConfigUpdate
}) => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Calendar Setup Review
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your calendar configuration before proceeding to generation.
      </Typography>

      {/* Strategy Context Status */}
      {strategyContext && (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'success.light', color: 'success.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircleIcon />
            <Typography variant="h6">Strategy Context Available</Typography>
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Your activated strategy will be used internally during calendar generation for enhanced results.
          </Typography>
        </Paper>
      )}

      {/* Calendar Configuration Summary */}
      <Grid container spacing={3}>
        {/* Basic Setup */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon />
                Basic Setup
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Calendar Type:</Typography>
                  <Chip label={calendarConfig.calendarType} size="small" color="primary" />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Duration:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {calendarConfig.calendarDuration} {calendarConfig.calendarType === 'weekly' ? 'weeks' : 
                    calendarConfig.calendarType === 'monthly' ? 'months' : 'quarters'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Start Date:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {new Date(calendarConfig.startDate).toLocaleDateString()}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Posts per Week:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {calendarConfig.postingFrequency}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Content Volume:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {calendarConfig.contentVolume} pieces per period
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Platform & Scheduling */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon />
                Platform & Scheduling
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Priority Platforms:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {calendarConfig.priorityPlatforms.map((platform) => (
                      <Chip key={platform} label={platform} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Time Zone:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {calendarConfig.timeZone}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Content Distribution:</Typography>
                  <Chip label={calendarConfig.contentDistribution} size="small" color="secondary" />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Review Cycle:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {calendarConfig.reviewCycle}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Generation Options */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon />
                Generation Options
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Include Weekends:</Typography>
                    <Chip 
                      label={calendarConfig.includeWeekends ? 'Yes' : 'No'} 
                      size="small" 
                      color={calendarConfig.includeWeekends ? 'success' : 'default'}
                    />
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Auto-Schedule:</Typography>
                    <Chip 
                      label={calendarConfig.autoSchedule ? 'Yes' : 'No'} 
                      size="small" 
                      color={calendarConfig.autoSchedule ? 'success' : 'default'}
                    />
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Generate Topics:</Typography>
                    <Chip 
                      label={calendarConfig.generateTopics ? 'Yes' : 'No'} 
                      size="small" 
                      color={calendarConfig.generateTopics ? 'success' : 'default'}
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Summary */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
        <Typography variant="h6" gutterBottom>
          Ready to Generate
        </Typography>
        <Typography variant="body2">
          Your calendar will be generated with {calendarConfig.contentVolume} pieces of content over{' '}
          {calendarConfig.calendarDuration} {calendarConfig.calendarType === 'weekly' ? 'weeks' : 
          calendarConfig.calendarType === 'monthly' ? 'months' : 'quarters'} with{' '}
          {calendarConfig.postingFrequency} posts per week on {calendarConfig.priorityPlatforms.length} platforms.
        </Typography>
      </Paper>
    </Box>
  );
};

export default DataReviewStep;
