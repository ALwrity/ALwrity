import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Alert,
  AlertTitle
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TimelineIcon from '@mui/icons-material/Timeline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { motion } from 'framer-motion';
import { safeRenderText, safeRenderArray, hasValidData, getFallbackValue } from '../utils/defensiveRendering';

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
  lastExecuted?: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

interface MetricTransparencyData {
  metricName: string;
  currentValue: number;
  unit: string;
  dataFreshness: {
    lastUpdated: string;
    updateFrequency: string;
    dataSource: string;
    confidence: number;
  };
  measurementMethodology: {
    description: string;
    calculationMethod: string;
    dataPoints: string[];
    validationProcess: string;
  };
  monitoringTasks: MonitoringTask[];
  strategyMapping: {
    relatedComponents: string[];
    impactAreas: string[];
    dependencies: string[];
  };
  aiInsights: {
    trendAnalysis: string;
    recommendations: string[];
    riskFactors: string[];
    opportunities: string[];
  };
}

interface MetricTransparencyCardProps {
  metricData: MetricTransparencyData;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const MetricTransparencyCard: React.FC<MetricTransparencyCardProps> = ({
  metricData,
  isExpanded = false,
  onToggle
}) => {
  const [expanded, setExpanded] = useState(isExpanded);

  const handleToggle = () => {
    setExpanded(!expanded);
    onToggle?.();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'completed': return '#2196f3';
      case 'pending': return '#ff9800';
      case 'failed': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return '#4caf50';
    if (confidence >= 70) return '#ff9800';
    return '#f44336';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        mb: 2,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }
      }}>
        <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <AutoAwesomeIcon sx={{ fontSize: 28, color: 'rgba(255,255,255,0.9)' }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {metricData.metricName}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {metricData.currentValue}{metricData.unit}
                </Typography>
              </Box>
            </Box>
            
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={`${metricData.dataFreshness.confidence}% Confidence`}
                size="small"
                sx={{
                  background: getConfidenceColor(metricData.dataFreshness.confidence),
                  color: 'white',
                  fontWeight: 600
                }}
              />
              <Tooltip title={expanded ? "Hide details" : "Show details"}>
                <IconButton onClick={handleToggle} sx={{ color: 'white' }}>
                  {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Data Freshness Summary */}
          <Box sx={{ mb: 2, p: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <ScheduleIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Data Freshness
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Last updated: {formatDate(metricData.dataFreshness.lastUpdated)} • 
              Source: {metricData.dataFreshness.dataSource} • 
              Updates: {metricData.dataFreshness.updateFrequency}
            </Typography>
          </Box>

          {/* Expanded Content */}
          <Collapse in={expanded}>
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.2)' }} />

              {/* Measurement Methodology */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon />
                  Measurement Methodology
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      Calculation Method
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                      {metricData.measurementMethodology.calculationMethod}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      Validation Process
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                      {metricData.measurementMethodology.validationProcess}
                    </Typography>
                  </Grid>
                </Grid>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Data Points Used
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  {metricData.measurementMethodology.dataPoints.map((point, index) => (
                    <Chip
                      key={index}
                      label={point}
                      size="small"
                      sx={{
                        background: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        fontSize: '0.7rem'
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* AI Monitoring Tasks */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PsychologyIcon />
                  AI Monitoring Tasks ({metricData.monitoringTasks.length})
                </Typography>
                
                <List sx={{ p: 0 }}>
                  {metricData.monitoringTasks.map((task, index) => (
                    <ListItem key={index} sx={{ 
                      background: 'rgba(255,255,255,0.05)', 
                      borderRadius: 1, 
                      mb: 1,
                      flexDirection: 'column',
                      alignItems: 'flex-start'
                    }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" mb={1}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {task.title}
                        </Typography>
                        <Box display="flex" gap={1}>
                          <Chip
                            label={task.assignee}
                            size="small"
                            sx={{
                              background: task.assignee === 'ALwrity' ? '#4caf50' : '#2196f3',
                              color: 'white',
                              fontSize: '0.6rem'
                            }}
                          />
                          <Chip
                            label={task.status}
                            size="small"
                            sx={{
                              background: getStatusColor(task.status),
                              color: 'white',
                              fontSize: '0.6rem'
                            }}
                          />
                        </Box>
                      </Box>
                      
                      <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                        {task.description}
                      </Typography>
                      
                      <Box display="flex" gap={2} mb={1}>
                        {task.frequency && (
                          <Chip
                            label={`${task.frequency}`}
                            size="small"
                            icon={<ScheduleIcon />}
                            sx={{
                              background: 'rgba(255,255,255,0.1)',
                              color: 'white',
                              fontSize: '0.6rem'
                            }}
                          />
                        )}
                        {task.metric && (
                          <Chip
                            label={`${task.metric}`}
                            size="small"
                            icon={<AssessmentIcon />}
                            sx={{
                              background: 'rgba(255,255,255,0.1)',
                              color: 'white',
                              fontSize: '0.6rem'
                            }}
                          />
                        )}
                      </Box>
                      
                      <Grid container spacing={2} sx={{ width: '100%' }}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                            Measurement Method
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
                            {task.measurementMethod}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                            Success Criteria
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
                            {task.successCriteria}
                          </Typography>
                        </Grid>
                        {task.alertThreshold && (
                          <Grid item xs={12} sm={6}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                              Alert Threshold
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
                              {task.alertThreshold}
                            </Typography>
                          </Grid>
                        )}
                        {task.actionableInsights && (
                          <Grid item xs={12} sm={6}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                              Actionable Insights
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
                              {task.actionableInsights}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* Strategy Mapping */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon />
                  Strategy Component Mapping
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      Related Components
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {metricData.strategyMapping.relatedComponents.map((component, index) => (
                        <Chip
                          key={index}
                          label={component}
                          size="small"
                          sx={{
                            background: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      Impact Areas
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {metricData.strategyMapping.impactAreas.map((area, index) => (
                        <Chip
                          key={index}
                          label={area}
                          size="small"
                          sx={{
                            background: 'rgba(76, 175, 80, 0.3)',
                            color: '#4caf50',
                            fontSize: '0.7rem'
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      Dependencies
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {metricData.strategyMapping.dependencies.map((dep, index) => (
                        <Chip
                          key={index}
                          label={dep}
                          size="small"
                          sx={{
                            background: 'rgba(255, 152, 0, 0.3)',
                            color: '#ff9800',
                            fontSize: '0.7rem'
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* AI Insights */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon />
                  AI-Powered Insights
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      Trend Analysis
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                      {metricData.aiInsights.trendAnalysis}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      Risk Factors
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                      {metricData.aiInsights.riskFactors.map((risk, index) => (
                        <Chip
                          key={index}
                          label={risk}
                          size="small"
                          sx={{
                            background: 'rgba(244, 67, 54, 0.3)',
                            color: '#f44336',
                            fontSize: '0.7rem'
                          }}
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Recommendations
                </Typography>
                <List sx={{ p: 0 }}>
                  {metricData.aiInsights.recommendations.map((rec, index) => (
                    <ListItem key={index} sx={{ p: 0, mb: 1 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: '#4caf50' }} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={safeRenderText(rec)}
                        sx={{
                          '& .MuiListItemText-primary': {
                            fontSize: '0.85rem',
                            opacity: 0.9
                          }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default MetricTransparencyCard;
