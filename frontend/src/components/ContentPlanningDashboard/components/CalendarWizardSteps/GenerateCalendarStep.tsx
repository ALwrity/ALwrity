import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';

// Import calendar-specific types
import { type CalendarConfig } from './types';

interface GenerateCalendarStepProps {
  calendarConfig: CalendarConfig;
  onGenerateCalendar: (config: CalendarConfig) => void;
  strategyContext?: any;
  isFromStrategyActivation?: boolean; // Strategy context available for generation
}

const GenerateCalendarStep: React.FC<GenerateCalendarStepProps> = ({
  calendarConfig,
  onGenerateCalendar,
  strategyContext,
  isFromStrategyActivation = false
}) => {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generationOptions, setGenerationOptions] = useState({
    includeAIOptimization: true,
    includeSmartScheduling: true,
    includeTrendIntegration: true,
    includeCompetitiveAnalysis: true,
    includePerformanceTracking: true,
    // Calendar-specific options moved from Step 1
    includeWeekends: calendarConfig.includeWeekends || false,
    autoSchedule: calendarConfig.autoSchedule || false,
    generateTopics: calendarConfig.generateTopics || false
  });

  // Validate calendar configuration
  useEffect(() => {
    const errors: string[] = [];
    
    // Validate essential calendar configuration
    if (!calendarConfig.calendarType) {
      errors.push('Calendar type is required');
    }
    
    if (!calendarConfig.startDate) {
      errors.push('Start date is required');
    }
    
    if (calendarConfig.calendarDuration <= 0) {
      errors.push('Calendar duration must be greater than 0');
    }
    
    if (calendarConfig.postingFrequency <= 0) {
      errors.push('Posting frequency must be greater than 0');
    }
    
    if (!calendarConfig.priorityPlatforms || calendarConfig.priorityPlatforms.length === 0) {
      errors.push('At least one platform must be selected');
    }
    
    if (!calendarConfig.timeZone) {
      errors.push('Time zone is required');
    }

    setValidationErrors(errors);
  }, [calendarConfig]);

  /*
  // Unused generation handler - logic moved to parent/stepper
  const handleGenerate = () => {
    if (validationErrors.length > 0) {
      return; // Don't proceed if there are validation errors
    }

    // Enhanced calendar config with strategy context and generation options
    const enhancedConfig = {
      ...calendarConfig,
      // Include calendar-specific options from generation options
      includeWeekends: generationOptions.includeWeekends,
      autoSchedule: generationOptions.autoSchedule,
      generateTopics: generationOptions.generateTopics,
      strategyContext: isFromStrategyActivation ? {
        strategyId: strategyContext?.strategyId,
        strategyData: strategyContext?.strategyData,
        available: true
      } : undefined,
      generationOptions,
      metadata: {
        generatedFrom: isFromStrategyActivation ? 'strategy_activation' : 'manual_config',
        timestamp: new Date().toISOString(),
        version: '3.0'
      }
    };

    onGenerateCalendar(enhancedConfig);
  };

  const canGenerate = validationErrors.length === 0;
  */

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Generate Your Content Calendar
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your configuration and generate your optimized content calendar.
      </Typography>

      {/* Strategy Context Status */}
      {isFromStrategyActivation && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircleIcon />
            <Box>
              <Typography variant="subtitle2">Strategy Context Available</Typography>
              <Typography variant="body2">
                Your activated strategy will be used internally during generation for enhanced results.
              </Typography>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Please fix the following issues:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Configuration Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Configuration Summary
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
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
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Platforms:</Typography>
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
                  <Typography variant="body2">Distribution:</Typography>
                  <Chip label={calendarConfig.contentDistribution} size="small" color="secondary" />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Review Cycle:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {calendarConfig.reviewCycle}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Generation Options */}
      <Accordion expanded={showAdvanced} onChange={() => setShowAdvanced(!showAdvanced)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon />
            Generation Options
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generationOptions.includeAIOptimization}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      includeAIOptimization: e.target.checked
                    }))}
                  />
                }
                label="AI Content Optimization"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generationOptions.includeSmartScheduling}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      includeSmartScheduling: e.target.checked
                    }))}
                  />
                }
                label="Smart Scheduling"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generationOptions.includeTrendIntegration}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      includeTrendIntegration: e.target.checked
                    }))}
                  />
                }
                label="Trend Integration"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generationOptions.includeCompetitiveAnalysis}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      includeCompetitiveAnalysis: e.target.checked
                    }))}
                  />
                }
                label="Competitive Analysis"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generationOptions.includePerformanceTracking}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      includePerformanceTracking: e.target.checked
                    }))}
                  />
                }
                label="Performance Tracking"
              />
            </Grid>
            
            {/* Calendar-specific generation options moved from Step 1 */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', borderBottom: '1px solid #e0e0e0', pb: 1 }}>
                Calendar-Specific Options
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generationOptions.includeWeekends}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      includeWeekends: e.target.checked
                    }))}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Include Weekends</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Schedule content on weekends for better engagement
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generationOptions.autoSchedule}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      autoSchedule: e.target.checked
                    }))}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Auto-Schedule Posts</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically assign optimal posting times
                    </Typography>
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={generationOptions.generateTopics}
                    onChange={(e) => setGenerationOptions(prev => ({
                      ...prev,
                      generateTopics: e.target.checked
                    }))}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Generate Topics</Typography>
                    <Typography variant="caption" color="text.secondary">
                      AI-powered topic suggestions for each post
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* What You'll Get */}
      <Card sx={{ mt: 3, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            What You'll Get
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="primary" gutterBottom>
                  {calendarConfig.contentVolume}
                </Typography>
                <Typography variant="body2">
                  Content Pieces
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="primary" gutterBottom>
                  {calendarConfig.calendarDuration}
                </Typography>
                <Typography variant="body2">
                  {calendarConfig.calendarType === 'weekly' ? 'Weeks' : 
                   calendarConfig.calendarType === 'monthly' ? 'Months' : 'Quarters'}
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="primary" gutterBottom>
                  {calendarConfig.priorityPlatforms.length}
                </Typography>
                <Typography variant="body2">
                  Platforms
                </Typography>
              </Box>
            </Grid>
          </Grid>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Your calendar will include optimized content scheduling, AI-powered topic suggestions, 
            and performance predictions based on your configuration.
          </Typography>
        </CardContent>
      </Card>

      {/* Note: Generate button is handled by the stepper navigation above */}
      {/* REMOVED: Loading state display - Let modal handle all progress */}
    </Box>
  );
};

export default GenerateCalendarStep;
