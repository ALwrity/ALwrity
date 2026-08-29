import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  AlertTitle,
  CircularProgress,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PeopleIcon from '@mui/icons-material/People';
import { strategyMonitoringApi, MonitoringPlan } from '../../../services/strategyMonitoringApi';

interface StrategyActivationModalProps {
  open: boolean;
  onClose: () => void;
  strategyId: number;
  strategyData: any;
  onSetupMonitoring: (monitoringPlan: any) => Promise<void>;
}

interface MonitoringTask {
  title: string;
  description: string;
  assignee: 'ALwrity' | 'Human';
  frequency: string;
  metric: string;
  measurementMethod: string;
  successCriteria: string;
  alertThreshold: string;
  actionableInsights?: string;
}

interface MonitoringComponent {
  name: string;
  icon: string;
  tasks: MonitoringTask[];
}



const StrategyActivationModal: React.FC<StrategyActivationModalProps> = ({
  open,
  onClose,
  strategyId,
  strategyData,
  onSetupMonitoring
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [monitoringPlan, setMonitoringPlan] = useState<MonitoringPlan | null>(null);
  const [showMonitoringPlan, setShowMonitoringPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetupMonitoring = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // Call the API to generate monitoring plan
      const response = await strategyMonitoringApi.generateMonitoringPlan(strategyId);
      setMonitoringPlan(response.data);
      setShowMonitoringPlan(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate monitoring plan');
      console.error('Error generating monitoring plan:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleActivateStrategy = async () => {
    if (!monitoringPlan) return;
    
    try {
      await onSetupMonitoring(monitoringPlan);
      onClose();
    } catch (error) {
      console.error('Error activating strategy:', error);
    }
  };

  const getComponentIcon = (iconName: string) => {
    const iconMap: { [key: string]: React.ReactElement } = {
      'TrendingUpIcon': <TrendingUpIcon />,
      'ThumbUpIcon': <ThumbUpIcon />,
      'MonetizationOnIcon': <MonetizationOnIcon />,
      'CheckCircleIcon': <CheckCircleIcon />,
      'StarIcon': <StarIcon />,
      'EmojiEventsIcon': <EmojiEventsIcon />,
      'PeopleIcon': <PeopleIcon />,
      'AssessmentIcon': <AssessmentIcon />
    };
    return iconMap[iconName] || <AssessmentIcon />;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <AutoAwesomeIcon color="primary" />
          Activate Content Strategy & Setup Monitoring
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!showMonitoringPlan ? (
          // Initial Setup View
          <Box>
            <Typography variant="h6" gutterBottom>
              ALwrity will create Quality & Performance Metrics
            </Typography>
            
            <Typography variant="body1" paragraph>
              Your content strategy will be continuously monitored and optimized based on comprehensive metrics and AI-powered analysis.
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>What happens next?</AlertTitle>
              ALwrity AI will analyze your strategy components and create a customized monitoring plan with specific tasks, metrics, and schedules to keep your strategy performing optimally.
            </Alert>

            {isGenerating && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  🎯 Creating Your Custom Monitoring Plan
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Step 1: Analyzing Strategy Components
                  </Typography>
                  <LinearProgress variant="indeterminate" sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Reviewing your content pillars, target audience, and business goals
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Step 2: Generating Monitoring Tasks
                  </Typography>
                  <LinearProgress variant="indeterminate" sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Creating automated ALwrity tasks and manual human review tasks
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Step 3: Setting Up Metrics & Alerts
                  </Typography>
                  <LinearProgress variant="indeterminate" sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Configuring success criteria, alert thresholds, and measurement methods
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Step 4: Finalizing Your Plan
                  </Typography>
                  <LinearProgress variant="indeterminate" sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Validating plan structure and preparing for activation
                  </Typography>
                </Box>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  <AlertTitle>What You'll Get</AlertTitle>
                  <Typography variant="body2" component="div">
                    • <strong>Automated Tasks:</strong> ALwrity will handle daily monitoring, analytics, and alerting
                    <br />
                    • <strong>Manual Tasks:</strong> You'll review strategic decisions and creative direction
                    <br />
                    • <strong>Performance Metrics:</strong> Track traffic growth, engagement, conversions, and ROI
                    <br />
                    • <strong>Smart Alerts:</strong> Get notified when metrics need attention
                    <br />
                    • <strong>Actionable Insights:</strong> Clear recommendations for optimization
                  </Typography>
                </Alert>
              </Box>
            )}

            <Button
              variant="contained"
              size="large"
              onClick={handleSetupMonitoring}
              disabled={isGenerating || !!error}
              startIcon={isGenerating ? <CircularProgress size={20} /> : <AssessmentIcon />}
              fullWidth
              sx={{ mt: 2 }}
            >
              {isGenerating ? 'Creating Your Monitoring Plan...' : 'Setup Audit & Adaptive Monitoring'}
            </Button>
            
            {error && (
              <Button
                variant="outlined"
                size="large"
                onClick={() => {
                  setError(null);
                  handleSetupMonitoring();
                }}
                disabled={isGenerating}
                fullWidth
                sx={{ mt: 1 }}
              >
                Retry Setup
              </Button>
            )}
          </Box>
        ) : (
          // Monitoring Plan Display View
          <Box>
            <Typography variant="h6" gutterBottom>
              Generated Monitoring Plan
            </Typography>
            
            {monitoringPlan && (
              <MonitoringPlanDisplay 
                plan={monitoringPlan} 
                strategyData={strategyData}
                getComponentIcon={getComponentIcon}
              />
            )}

            <Alert severity="success" sx={{ mt: 2 }}>
              <AlertTitle>Monitoring Plan Ready!</AlertTitle>
              Your strategy will now be continuously monitored with AI-powered analysis and adaptive recommendations.
            </Alert>

            <Button
              variant="contained"
              size="large"
              onClick={handleActivateStrategy}
              startIcon={<PlayArrowIcon />}
              fullWidth
              sx={{ mt: 2 }}
            >
              Activate Strategy & Start Monitoring
            </Button>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          {showMonitoringPlan ? 'Cancel' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Monitoring Plan Display Component
interface MonitoringPlanDisplayProps {
  plan: MonitoringPlan;
  strategyData: any;
  getComponentIcon: (iconName: string) => React.ReactElement;
}

const MonitoringPlanDisplay: React.FC<MonitoringPlanDisplayProps> = ({
  plan,
  strategyData,
  getComponentIcon
}) => {
  // Helper function to get icon name from component name
  const getComponentIconName = (componentName: string): string => {
    const iconMap: Record<string, string> = {
      'Strategic Insights': 'TrendingUpIcon',
      'Competitive Analysis': 'EmojiEventsIcon',
      'Performance Predictions': 'AssessmentIcon',
      'Implementation Roadmap': 'CheckCircleIcon',
      'Risk Assessment': 'StarIcon'
    };
    return iconMap[componentName] || 'TrendingUpIcon';
  };
  return (
    <Box>
      {/* Enhanced Summary Section */}
      <Card sx={{ 
        mb: 3, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
      }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            🎯 AI-Powered Monitoring Plan
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
            Your content strategy will be continuously monitored with comprehensive metrics and actionable insights
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {plan.totalTasks}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Tasks</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#4caf50' }}>
                  {plan.alwrityTasks}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>AI Automated</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#ff9800' }}>
                  {plan.humanTasks}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Human Tasks</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#2196f3' }}>
                  {plan.metricsCount}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Metrics Tracked</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Enhanced Component-wise Monitoring Tasks */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        📊 Monitoring Tasks by Strategy Component
      </Typography>
      
      {/* Group tasks by component */}
      {(() => {
        const tasksByComponent = plan.monitoringTasks.reduce((acc: Record<string, typeof plan.monitoringTasks>, task) => {
          if (!acc[task.component]) {
            acc[task.component] = [];
          }
          acc[task.component].push(task);
          return acc;
        }, {});

        return Object.entries(tasksByComponent).map(([componentName, tasks], index) => (
          <Card key={index} sx={{ 
            mb: 3, 
            border: '1px solid rgba(102, 126, 234, 0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            '&:hover': {
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
              transform: 'translateY(-2px)'
            },
            transition: 'all 0.3s ease'
          }}>
            <CardContent sx={{ p: 3 }}>
              {/* Component Header */}
              <Box display="flex" alignItems="center" gap={2} sx={{ mb: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}>
                  {getComponentIcon(getComponentIconName(componentName))}
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {componentName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tasks.length} comprehensive monitoring tasks
                  </Typography>
                </Box>
              </Box>
              
              {/* Enhanced Task List */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(tasks as typeof plan.monitoringTasks).map((task, taskIndex) => (
                <Card key={taskIndex} sx={{ 
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: task.assignee === 'ALwrity' ? 'rgba(76, 175, 80, 0.05)' : 'rgba(255, 152, 0, 0.05)'
                }}>
                  <CardContent sx={{ p: 2.5 }}>
                    {/* Task Header */}
                    <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 1, 
                        background: task.assignee === 'ALwrity' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                        color: task.assignee === 'ALwrity' ? '#4caf50' : '#ff9800'
                      }}>
                        {task.assignee === 'ALwrity' ? 
                          <SmartToyIcon fontSize="small" /> : 
                          <PersonIcon fontSize="small" />
                        }
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {task.title}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip 
                            label={task.assignee} 
                            size="small" 
                            color={task.assignee === 'ALwrity' ? 'success' : 'warning'}
                            sx={{ fontWeight: 600 }}
                          />
                          <Chip 
                            label={task.frequency} 
                            size="small" 
                            variant="outlined"
                            sx={{ fontWeight: 500 }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    {/* Task Description */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                      {task.description}
                    </Typography>

                    {/* Task Details Grid */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, background: 'rgba(33, 150, 243, 0.05)', borderRadius: 1 }}>
                          <Typography variant="caption" color="primary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                            Metric to Track
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {task.metric}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, background: 'rgba(156, 39, 176, 0.05)', borderRadius: 1 }}>
                          <Typography variant="caption" color="secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                            Success Criteria
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {task.successCriteria}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Measurement Method */}
                    <Box sx={{ p: 2, background: 'rgba(255, 193, 7, 0.05)', borderRadius: 1, mb: 2 }}>
                      <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        📏 Measurement Method
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                        {task.measurementMethod}
                      </Typography>
                    </Box>

                    {/* Alert Threshold and Actionable Insights */}
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, background: 'rgba(244, 67, 54, 0.05)', borderRadius: 1 }}>
                          <Typography variant="caption" color="error" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                            🚨 Alert Threshold
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {task.alertThreshold}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, background: 'rgba(76, 175, 80, 0.05)', borderRadius: 1 }}>
                          <Typography variant="caption" color="success.main" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                            💡 Actionable Insights
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {task.actionableInsights || "Review data and adjust strategy based on performance trends"}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </CardContent>
        </Card>
      ));
      })()}
    </Box>
  );
};

export default StrategyActivationModal;
