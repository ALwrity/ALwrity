import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormControlLabel,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  Switch,
  Divider
} from '@mui/material';
import AIIcon from '@mui/icons-material/AutoAwesome';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingIcon from '@mui/icons-material/TrendingUp';
import PsychologyIcon from '@mui/icons-material/Psychology';
import InfoIcon from '@mui/icons-material/Info';
import AssessmentIcon from '@mui/icons-material/Assessment';

interface AdvancedOptionsStepProps {
  calendarConfig: any;
  onConfigUpdate: (updates: any) => void;
  strategyContext?: any;
}

const AdvancedOptionsStep: React.FC<AdvancedOptionsStepProps> = ({
  calendarConfig,
  onConfigUpdate,
  strategyContext
}) => {
  const handlePerformancePredictionChange = (metric: string, value: number) => {
    const newPredictions = { ...calendarConfig.performancePredictions, [metric]: value };
    onConfigUpdate({ performancePredictions: newPredictions });
  };

  const handleAdvancedSettingChange = (setting: string, value: any) => {
    const newAdvancedSettings = { ...calendarConfig.advancedSettings, [setting]: value };
    onConfigUpdate({ advancedSettings: newAdvancedSettings });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Advanced Options & Optimization
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure advanced settings for AI-powered optimization, performance predictions, and content strategy enhancement.
      </Typography>

      <Grid container spacing={3}>
        {/* AI Optimization Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              avatar={<AIIcon color="primary" />}
              title="AI Optimization Settings"
              action={
                <Tooltip title="Configure AI-powered optimization features">
                  <IconButton size="small">
                    <InfoIcon />
                  </IconButton>
                </Tooltip>
              }
            />
            <CardContent>
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarConfig.advancedSettings?.aiOptimization || false}
                      onChange={(e) => handleAdvancedSettingChange('aiOptimization', e.target.checked)}
                    />
                  }
                  label="Enable AI Content Optimization"
                />
                <Typography variant="body2" color="text.secondary">
                  AI will automatically optimize content titles, descriptions, and timing for maximum engagement
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarConfig.advancedSettings?.smartScheduling || false}
                      onChange={(e) => handleAdvancedSettingChange('smartScheduling', e.target.checked)}
                    />
                  }
                  label="Smart Scheduling"
                />
                <Typography variant="body2" color="text.secondary">
                  Automatically adjust posting times based on audience behavior and engagement patterns
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarConfig.advancedSettings?.trendIntegration || false}
                      onChange={(e) => handleAdvancedSettingChange('trendIntegration', e.target.checked)}
                    />
                  }
                  label="Trend Integration"
                />
                <Typography variant="body2" color="text.secondary">
                  Incorporate trending topics and hashtags into your content calendar
                </Typography>
              </Box>

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarConfig.advancedSettings?.competitiveAnalysis || false}
                      onChange={(e) => handleAdvancedSettingChange('competitiveAnalysis', e.target.checked)}
                    />
                  }
                  label="Competitive Analysis"
                />
                <Typography variant="body2" color="text.secondary">
                  Monitor competitor content and adjust strategy based on their performance
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Predictions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              avatar={<AnalyticsIcon color="primary" />}
              title="Performance Predictions"
              action={
                <Tooltip title="Set performance targets and predictions">
                  <IconButton size="small">
                    <InfoIcon />
                  </IconButton>
                </Tooltip>
              }
            />
            <CardContent>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Expected Traffic Growth
                </Typography>
                <Slider
                  value={calendarConfig.performancePredictions?.trafficGrowth || 25}
                  onChange={(_, value) => handlePerformancePredictionChange('trafficGrowth', value as number)}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 25, label: '25%' },
                    { value: 50, label: '50%' },
                    { value: 75, label: '75%' },
                    { value: 100, label: '100%' }
                  ]}
                />
                <Typography variant="body2" color="text.secondary">
                  Predicted increase in website traffic from content calendar
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Engagement Rate Target
                </Typography>
                <Slider
                  value={calendarConfig.performancePredictions?.engagementRate || 15}
                  onChange={(_, value) => handlePerformancePredictionChange('engagementRate', value as number)}
                  min={0}
                  max={50}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 10, label: '10%' },
                    { value: 20, label: '20%' },
                    { value: 30, label: '30%' },
                    { value: 40, label: '40%' },
                    { value: 50, label: '50%' }
                  ]}
                />
                <Typography variant="body2" color="text.secondary">
                  Target engagement rate for social media content
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Conversion Rate Target
                </Typography>
                <Slider
                  value={calendarConfig.performancePredictions?.conversionRate || 10}
                  onChange={(_, value) => handlePerformancePredictionChange('conversionRate', value as number)}
                  min={0}
                  max={25}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 5, label: '5%' },
                    { value: 10, label: '10%' },
                    { value: 15, label: '15%' },
                    { value: 20, label: '20%' },
                    { value: 25, label: '25%' }
                  ]}
                />
                <Typography variant="body2" color="text.secondary">
                  Target conversion rate from content to leads/sales
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Content Strategy Enhancement */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              avatar={<TrendingIcon color="primary" />}
              title="Content Strategy Enhancement"
              action={
                <Tooltip title="Advanced content strategy settings">
                  <IconButton size="small">
                    <InfoIcon />
                  </IconButton>
                </Tooltip>
              }
            />
            <CardContent>
              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Content Repurposing Strategy</InputLabel>
                  <Select
                    value={calendarConfig.advancedSettings?.repurposingStrategy || 'moderate'}
                    label="Content Repurposing Strategy"
                    onChange={(e) => handleAdvancedSettingChange('repurposingStrategy', e.target.value)}
                  >
                    <MenuItem value="minimal">Minimal (Original content only)</MenuItem>
                    <MenuItem value="moderate">Moderate (Some repurposing)</MenuItem>
                    <MenuItem value="aggressive">Aggressive (Maximum repurposing)</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary">
                  How much content should be repurposed across different formats and platforms
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Content Personalization Level</InputLabel>
                  <Select
                    value={calendarConfig.advancedSettings?.personalizationLevel || 'medium'}
                    label="Content Personalization Level"
                    onChange={(e) => handleAdvancedSettingChange('personalizationLevel', e.target.value)}
                  >
                    <MenuItem value="low">Low (Generic content)</MenuItem>
                    <MenuItem value="medium">Medium (Some personalization)</MenuItem>
                    <MenuItem value="high">High (Highly personalized)</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary">
                  Level of audience personalization in content creation
                </Typography>
              </Box>

              <Box>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Content Innovation Level</InputLabel>
                  <Select
                    value={calendarConfig.advancedSettings?.innovationLevel || 'balanced'}
                    label="Content Innovation Level"
                    onChange={(e) => handleAdvancedSettingChange('innovationLevel', e.target.value)}
                  >
                    <MenuItem value="conservative">Conservative (Proven formats)</MenuItem>
                    <MenuItem value="balanced">Balanced (Mix of proven and new)</MenuItem>
                    <MenuItem value="innovative">Innovative (Experimental content)</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary">
                  Balance between proven content formats and experimental approaches
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Audience Behavior Optimization */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              avatar={<PsychologyIcon color="primary" />}
              title="Audience Behavior Optimization"
              action={
                <Tooltip title="Optimize for audience behavior patterns">
                  <IconButton size="small">
                    <InfoIcon />
                  </IconButton>
                </Tooltip>
              }
            />
            <CardContent>
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarConfig.advancedSettings?.audienceSegmentation || false}
                      onChange={(e) => handleAdvancedSettingChange('audienceSegmentation', e.target.checked)}
                    />
                  }
                  label="Audience Segmentation"
                />
                <Typography variant="body2" color="text.secondary">
                  Create different content for different audience segments
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarConfig.advancedSettings?.behavioralTargeting || false}
                      onChange={(e) => handleAdvancedSettingChange('behavioralTargeting', e.target.checked)}
                    />
                  }
                  label="Behavioral Targeting"
                />
                <Typography variant="body2" color="text.secondary">
                  Target content based on user behavior and preferences
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarConfig.advancedSettings?.journeyMapping || false}
                      onChange={(e) => handleAdvancedSettingChange('journeyMapping', e.target.checked)}
                    />
                  }
                  label="Customer Journey Mapping"
                />
                <Typography variant="body2" color="text.secondary">
                  Align content with different stages of the customer journey
                </Typography>
              </Box>

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarConfig.advancedSettings?.sentimentAnalysis || false}
                      onChange={(e) => handleAdvancedSettingChange('sentimentAnalysis', e.target.checked)}
                    />
                  }
                  label="Sentiment Analysis"
                />
                <Typography variant="body2" color="text.secondary">
                  Monitor and respond to audience sentiment in content planning
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Monitoring */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              avatar={<AssessmentIcon color="primary" />}
              title="Performance Monitoring & Analytics"
              action={
                <Tooltip title="Configure performance monitoring settings">
                  <IconButton size="small">
                    <InfoIcon />
                  </IconButton>
                </Tooltip>
              }
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Monitoring Frequency</InputLabel>
                    <Select
                      value={calendarConfig.advancedSettings?.monitoringFrequency || 'weekly'}
                      label="Monitoring Frequency"
                      onChange={(e) => handleAdvancedSettingChange('monitoringFrequency', e.target.value)}
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Alert Threshold</InputLabel>
                    <Select
                      value={calendarConfig.advancedSettings?.alertThreshold || 'medium'}
                      label="Alert Threshold"
                      onChange={(e) => handleAdvancedSettingChange('alertThreshold', e.target.value)}
                    >
                      <MenuItem value="low">Low (Minimal alerts)</MenuItem>
                      <MenuItem value="medium">Medium (Balanced alerts)</MenuItem>
                      <MenuItem value="high">High (Frequent alerts)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Optimization Frequency</InputLabel>
                    <Select
                      value={calendarConfig.advancedSettings?.optimizationFrequency || 'bi-weekly'}
                      label="Optimization Frequency"
                      onChange={(e) => handleAdvancedSettingChange('optimizationFrequency', e.target.value)}
                    >
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="bi-weekly">Bi-weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Key Performance Indicators (KPIs)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {[
                    'Traffic Growth',
                    'Engagement Rate',
                    'Conversion Rate',
                    'Brand Awareness',
                    'Lead Generation',
                    'Social Reach',
                    'Content Quality Score',
                    'ROI'
                  ].map((kpi) => (
                    <Chip
                      key={kpi}
                      label={kpi}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Advanced Settings Summary */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Advanced Configuration Summary
        </Typography>
        <Typography variant="body2">
          AI optimization is {calendarConfig.advancedSettings?.aiOptimization ? 'enabled' : 'disabled'}, 
          smart scheduling is {calendarConfig.advancedSettings?.smartScheduling ? 'enabled' : 'disabled'}, 
          and performance monitoring is set to {calendarConfig.advancedSettings?.monitoringFrequency || 'weekly'} frequency. 
          Expected traffic growth: {calendarConfig.performancePredictions?.trafficGrowth || 25}%.
        </Typography>
      </Alert>
    </Box>
  );
};

export default AdvancedOptionsStep;
