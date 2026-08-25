import React, { useState } from 'react';
import {
  Box,
  Tooltip,
  Badge,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Paper,
  Grid,
  Typography,
  Chip
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TimelineIcon from '@mui/icons-material/Timeline';
import InfoIcon from '@mui/icons-material/Info';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BusinessIcon from '@mui/icons-material/Business';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SecurityIcon from '@mui/icons-material/Security';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import StarIcon from '@mui/icons-material/Star';
import DataUsageIcon from '@mui/icons-material/DataUsage';
import InputIcon from '@mui/icons-material/Input';
import StorageIcon from '@mui/icons-material/Storage';
import PersonIcon from '@mui/icons-material/Person';
import { motion } from 'framer-motion';
import { StrategyData } from '../types/strategy.types';
import { getStrategyName, getStrategyGenerationDate } from '../utils/strategyTransformers';

interface StrategyHeaderProps {
  strategyData: StrategyData | null;
  strategyConfirmed: boolean;
  strategyStatus?: 'active' | 'inactive' | 'pending' | 'none';
  onStartReview?: () => void;
  disableCardWrapper?: boolean; // New prop to control Card wrapper rendering
}

const StrategyHeader: React.FC<StrategyHeaderProps> = ({ strategyData, strategyConfirmed, strategyStatus = 'none', onStartReview, disableCardWrapper = false }) => {
  const [showNextStepText, setShowNextStepText] = useState(false);
  
  if (!strategyData) return null;

  // Helper function to get percentage value from string
  const getPercentageValue = (value: string | undefined) => {
    if (!value) return 0;
    const match = value.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  // Helper function to get risk color
  const getRiskColor = (riskLevel: string | undefined) => {
    switch (riskLevel?.toLowerCase()) {
      case 'low': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'high': return '#f44336';
      case 'high-medium': return '#ff5722';
      default: return '#ff9800';
    }
  };

  // Helper function to extract company name from strategy name
  const getCompanyName = (strategyName: string) => {
    // Extract company name from strategy name (e.g., "Enhanced Content Strategy" -> "ALwrity")
    // For now, we'll use a default company name
    return "ALwrity";
  };

  // Helper function to get timeline percentage
  const getTimelinePercentage = (timeline: string | undefined) => {
    if (!timeline) return 0;
    const match = timeline.match(/(\d+)/);
    return match ? Math.min(parseInt(match[1]) * 10, 100) : 0; // Convert months to percentage
  };

  const roiValue = getPercentageValue(strategyData.summary?.estimated_roi);
  const successValue = getPercentageValue(strategyData.summary?.success_probability);
  const timelineValue = getTimelinePercentage(strategyData.summary?.implementation_timeline);
  const riskColor = getRiskColor(strategyData.summary?.risk_level);
  const companyName = getCompanyName(getStrategyName(strategyData));

  // Analysis components data
  const analysisComponents = [
    { name: 'Strategic Insights', icon: <AnalyticsIcon />, color: '#667eea' },
    { name: 'Competitive Analysis', icon: <BusinessIcon />, color: '#4caf50' },
    { name: 'Performance Predictions', icon: <ShowChartIcon />, color: '#2196f3' },
    { name: 'Implementation Roadmap', icon: <TimelineIcon />, color: '#ff9800' },
    { name: 'Risk Assessment', icon: <SecurityIcon />, color: '#f44336' }
  ];

  // Mock data sources and user inputs (replace with actual data from strategyData)
  const dataSources = [
    { name: 'Industry Analysis', type: 'Market Research', icon: <DataUsageIcon /> },
    { name: 'Competitor Data', type: 'External Sources', icon: <StorageIcon /> },
    { name: 'User Preferences', type: 'Input Survey', icon: <PersonIcon /> },
    { name: 'Content Performance', type: 'Analytics', icon: <InputIcon /> }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <Card 
        sx={{ 
          mb: 3, 
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)',
          color: 'white',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(102, 126, 234, 0.3)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(102, 126, 234, 0.3)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)',
            pointerEvents: 'none'
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
            animation: 'shimmer 3s infinite',
            pointerEvents: 'none'
          },
          '@keyframes shimmer': {
            '0%': { transform: 'translateX(-100%)' },
            '100%': { transform: 'translateX(100%)' }
          },
          '@keyframes gradient': {
            '0%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
            '100%': { backgroundPosition: '0% 50%' }
          }
        }}
      >
        {/* Animated Border Lights */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 20px rgba(102, 126, 234, 0.5)',
              '0 0 40px rgba(102, 126, 234, 0.8)',
              '0 0 20px rgba(102, 126, 234, 0.5)'
            ]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: '12px',
            pointerEvents: 'none'
          }}
        />

        <CardContent sx={{ position: 'relative', zIndex: 1, p: 2.5 }}>
          {/* Header Section - More Compact */}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <PsychologyIcon sx={{ fontSize: 28, color: '#667eea', mr: 1.5 }} />
                </motion.div>
                <Box>
                  <Typography variant="h5" sx={{ 
                    fontWeight: 800, 
                    background: 'linear-gradient(45deg, #667eea, #764ba2, #f093fb)',
                    backgroundSize: '200% 200%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'gradient 3s ease infinite',
                    mb: 0.25
                  }}>
                    {companyName} Content Strategy
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    opacity: 0.8, 
                    color: '#e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: '0.75rem'
                  }}>
                    <ScheduleIcon sx={{ fontSize: 12 }} />
                    Generated on {getStrategyGenerationDate(strategyData)}
                  </Typography>
                </Box>
              </Box>
              
              {/* Strategy Metadata Chips - More Compact */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                <Tooltip title="AI-Generated Strategy using advanced machine learning" arrow>
                  <Badge badgeContent={<CheckCircleIcon sx={{ fontSize: 10, color: '#4caf50' }} />} color="default">
                    <Chip
                      icon={<AutoAwesomeIcon />}
                      label="AI Generated"
                      size="small"
                      sx={{
                        background: 'rgba(102, 126, 234, 0.2)',
                        color: '#667eea',
                        border: '1px solid rgba(102, 126, 234, 0.3)',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        height: 24
                      }}
                    />
                  </Badge>
                </Tooltip>
                <Tooltip title="Comprehensive analysis covering all strategic aspects" arrow>
                  <Badge badgeContent={<CheckCircleIcon sx={{ fontSize: 10, color: '#4caf50' }} />} color="default">
                    <Chip
                      icon={<PsychologyIcon />}
                      label="Comprehensive"
                      size="small"
                      sx={{
                        background: 'rgba(76, 175, 80, 0.2)',
                        color: '#4caf50',
                        border: '1px solid rgba(76, 175, 80, 0.3)',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        height: 24
                      }}
                    />
                  </Badge>
                </Tooltip>
                <Tooltip title="Content calendar generation status" arrow>
                  <Badge badgeContent={<WarningIcon sx={{ fontSize: 10, color: '#ff9800' }} />} color="default">
                    <Chip
                      icon={<CalendarTodayIcon />}
                      label={strategyData.strategy_metadata?.content_calendar_ready ? "Calendar Ready" : "Calendar Pending"}
                      size="small"
                      color={strategyData.strategy_metadata?.content_calendar_ready ? "success" : "warning"}
                      sx={{
                        background: strategyData.strategy_metadata?.content_calendar_ready 
                          ? 'rgba(76, 175, 80, 0.2)' 
                          : 'rgba(255, 152, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        height: 24
                      }}
                    />
                  </Badge>
                </Tooltip>
              </Box>
            </Grid>

            {/* Key Metrics Section with 4 Circular Progress Charts */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                {/* ROI Circular Progress */}
                <Tooltip title="Estimated Return on Investment for content marketing efforts" arrow>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                      <CircularProgress
                        variant="determinate"
                        value={roiValue}
                        size={50}
                        thickness={3}
                        sx={{
                          color: '#4caf50',
                          '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round',
                          }
                        }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 700, fontSize: '0.6rem' }}>
                          {roiValue}%
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600, fontSize: '0.65rem' }}>
                      ROI
                    </Typography>
                  </Box>
                </Tooltip>

                {/* Success Probability Circular Progress */}
                <Tooltip title="Probability of achieving the defined content strategy goals" arrow>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                      <CircularProgress
                        variant="determinate"
                        value={successValue}
                        size={50}
                        thickness={3}
                        sx={{
                          color: '#2196f3',
                          '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round',
                          }
                        }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: '#2196f3', fontWeight: 700, fontSize: '0.6rem' }}>
                          {successValue}%
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#2196f3', fontWeight: 600, fontSize: '0.65rem' }}>
                      Success
                    </Typography>
                  </Box>
                </Tooltip>

                {/* Risk Level Circular Progress */}
                <Tooltip title="Overall risk assessment for the content strategy implementation" arrow>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                      <CircularProgress
                        variant="determinate"
                        value={strategyData.summary?.risk_level === 'Low' ? 25 : 
                               strategyData.summary?.risk_level === 'Medium' ? 50 : 
                               strategyData.summary?.risk_level === 'High' ? 75 : 60}
                        size={50}
                        thickness={3}
                        sx={{
                          color: riskColor,
                          '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round',
                          }
                        }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: riskColor, fontWeight: 700, fontSize: '0.6rem' }}>
                          {strategyData.summary?.risk_level === 'Low' ? 'L' : 
                           strategyData.summary?.risk_level === 'Medium' ? 'M' : 
                           strategyData.summary?.risk_level === 'High' ? 'H' : 'HM'}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: riskColor, fontWeight: 600, fontSize: '0.65rem' }}>
                      Risk
                    </Typography>
                  </Box>
                </Tooltip>

                {/* Timeline Circular Progress */}
                <Tooltip title="Implementation timeline for the content strategy" arrow>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                      <CircularProgress
                        variant="determinate"
                        value={timelineValue}
                        size={50}
                        thickness={3}
                        sx={{
                          color: '#667eea',
                          '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round',
                          }
                        }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: '#667eea', fontWeight: 700, fontSize: '0.6rem' }}>
                          {strategyData.summary?.implementation_timeline?.match(/\d+/)?.[0] || '6'}m
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#667eea', fontWeight: 600, fontSize: '0.65rem' }}>
                      Timeline
                    </Typography>
                  </Box>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>

          {/* Strategy Status Section - Expanded to show data sources and analysis components */}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box sx={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                p: 2, 
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, color: '#667eea', fontSize: '0.9rem' }}>
                  Strategy Status & Data Sources
                </Typography>
                <Grid container spacing={2}>
                  {/* Status Info */}
                  <Grid item xs={12} md={4}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUpIcon sx={{ color: '#4caf50', fontSize: 16 }} />
                        <Box>
                          <Typography variant="caption" sx={{ color: '#e0e0e0', fontWeight: 500, fontSize: '0.7rem' }}>
                            Status
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: '0.75rem' }}>
                            {strategyConfirmed ? 'Confirmed' : 'Pending Review'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InfoIcon sx={{ color: '#2196f3', fontSize: 16 }} />
                        <Box>
                          <Typography variant="caption" sx={{ color: '#e0e0e0', fontWeight: 500, fontSize: '0.7rem' }}>
                            User ID
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: '0.75rem' }}>
                            {strategyData.strategy_metadata?.user_id}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Data Sources */}
                  <Grid item xs={12} md={8}>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#e0e0e0', fontWeight: 500, fontSize: '0.7rem', mb: 1, display: 'block' }}>
                        Data Sources & User Inputs
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {dataSources.map((source, index) => (
                          <Chip
                            key={index}
                            icon={source.icon}
                            label={`${source.name} (${source.type})`}
                            size="small"
                            sx={{
                              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(102, 126, 234, 0.2) 100%)',
                              color: '#667eea',
                              border: '1px solid rgba(102, 126, 234, 0.4)',
                              fontWeight: 600,
                              fontSize: '0.65rem',
                              height: 24,
                              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(102, 126, 234, 0.3) 100%)',
                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                transform: 'translateY(-1px)'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Grid>
                </Grid>

                {/* Analysis Components Section - Moved inside the card */}
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <Typography variant="caption" sx={{ color: '#e0e0e0', fontWeight: 500, fontSize: '0.7rem', mb: 1, display: 'block' }}>
                    Analysis Components
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {analysisComponents.map((component, index) => (
                      <Tooltip key={index} title={`${component.name} analysis completed`} arrow>
                        <Badge badgeContent={<CheckCircleIcon sx={{ fontSize: 10, color: '#4caf50' }} />} color="default">
                          <Chip
                            icon={component.icon}
                            label={component.name}
                            size="small"
                            sx={{
                              background: `linear-gradient(135deg, ${component.color}30 0%, ${component.color}20 100%)`,
                              color: component.color,
                              border: `1px solid ${component.color}50`,
                              fontWeight: 600,
                              fontSize: '0.65rem',
                              height: 24,
                              boxShadow: `0 2px 8px ${component.color}20`,
                              '&:hover': {
                                background: `linear-gradient(135deg, ${component.color}40 0%, ${component.color}30 100%)`,
                                boxShadow: `0 4px 12px ${component.color}30`,
                                transform: 'translateY(-1px)'
                              },
                              transition: 'all 0.2s ease'
                            }}
                          />
                        </Badge>
                      </Tooltip>
                    ))}
                    <Chip
                      icon={<StarIcon />}
                      label="Ready for Review"
                      size="small"
                      color="success"
                      sx={{
                        background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.3) 0%, rgba(76, 175, 80, 0.2) 100%)',
                        color: '#4caf50',
                        border: '1px solid rgba(76, 175, 80, 0.4)',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        height: 24,
                        boxShadow: '0 2px 8px rgba(76, 175, 80, 0.2)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.4) 0%, rgba(76, 175, 80, 0.3) 100%)',
                          boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                          transform: 'translateY(-1px)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>

          {/* Next Steps Button - Area B */}
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Tooltip 
              title="Start reviewing strategy components and create content calendar"
              arrow
              open={showNextStepText}
              onClose={() => setShowNextStepText(false)}
            >
              <Button
                variant="contained"
                onClick={onStartReview}
                onMouseEnter={() => setShowNextStepText(true)}
                onMouseLeave={() => setShowNextStepText(false)}
                sx={{
                  background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 50%, #81c784 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  px: 3,
                  py: 1,
                  borderRadius: 3,
                  boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
                  border: '2px solid rgba(76, 175, 80, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #66bb6a 0%, #81c784 50%, #a5d6a7 100%)',
                    boxShadow: '0 6px 20px rgba(76, 175, 80, 0.6)',
                    transform: 'translateY(-2px)'
                  },
                  transition: 'all 0.3s ease',
                  textTransform: 'none'
                }}
                startIcon={<ArrowForwardIcon />}
              >
                Next: Review Strategy and Create Content Calendar
              </Button>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StrategyHeader; 