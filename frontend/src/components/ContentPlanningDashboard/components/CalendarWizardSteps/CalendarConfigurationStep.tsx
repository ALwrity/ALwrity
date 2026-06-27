import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Grid,
  Card,
  CardContent,
  Tooltip,
  IconButton,
  Alert,
  FormHelperText,
  Button,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  Help as HelpIcon,
  TrendingUp as TrendingUpIcon,
  Public as PublicIcon,
  AccessTime as AccessTimeIcon,
  ContentPaste as ContentPasteIcon,
  AutoAwesome as AutoAwesomeIcon,
  Lightbulb as LightbulbIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

// Import calendar-specific types
import { type CalendarConfig } from './types';

// Import simplified mapper
import { 
  generateSmartDefaults, 
  generateUserGuidance, 
  generateTransparencyIndicators,
  applySmartDefaultsToConfig,
  type SmartDefaults,
  type UserGuidance,
  type TransparencyIndicators
} from '../../../../services/strategyCalendarMapper';

interface CalendarConfigurationStepProps {
  calendarConfig: CalendarConfig;
  onConfigUpdate: (updates: Partial<CalendarConfig>) => void;
  strategyContext?: any;
  isFromStrategyActivation?: boolean; // Strategy context available for generation
}

// Enhanced styling with better input prominence and readability
const ENHANCED_STYLES = {
  card: {
    borderRadius: 2,
    background: 'rgba(255, 255, 255, 0.95)',
    color: '#333',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    position: 'relative' as const,
    overflow: 'hidden',
    '&:hover': {
      boxShadow: '0 6px 25px rgba(0, 0, 0, 0.15)',
      transform: 'translateY(-2px)'
    },
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  cardContent: {
    p: 3,
    position: 'relative' as const,
    zIndex: 1
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    mb: 3,
    '& .MuiTypography-root': {
      fontWeight: 600,
      color: '#2c3e50'
    }
  },
  iconContainer: {
    p: 1.5,
    borderRadius: 2,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    mr: 2,
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  formControl: {
    '& .MuiInputLabel-root': {
      color: '#555',
      fontWeight: 500,
      '&.Mui-focused': {
        color: '#667eea'
      }
    },
    '& .MuiOutlinedInput-root': {
      color: '#333',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      '& fieldset': {
        borderColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: '2px'
      },
      '&:hover fieldset': {
        borderColor: 'rgba(102, 126, 234, 0.5)'
      },
      '&.Mui-focused fieldset': {
        borderColor: '#667eea',
        borderWidth: '2px'
      }
    },
    '& .MuiSelect-icon': {
      color: '#555'
    }
  },
  textField: {
    '& .MuiInputLabel-root': {
      color: '#555',
      fontWeight: 500,
      '&.Mui-focused': {
        color: '#667eea'
      }
    },
    '& .MuiOutlinedInput-root': {
      color: '#333',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      '& fieldset': {
        borderColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: '2px'
      },
      '&:hover fieldset': {
        borderColor: 'rgba(102, 126, 234, 0.5)'
      },
      '&.Mui-focused fieldset': {
        borderColor: '#667eea',
        borderWidth: '2px'
      }
    }
  },
  platformCard: {
    background: 'rgba(255, 255, 255, 0.9)',
    border: '2px solid rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: 'rgba(102, 126, 234, 0.05)',
      border: '2px solid rgba(102, 126, 234, 0.3)',
      transform: 'translateY(-2px)'
    },
    '&.selected': {
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
      border: '2px solid rgba(102, 126, 234, 0.5)',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
    }
  },
  checkbox: {
    color: '#b0b0b0',
    '&.Mui-checked': {
      color: '#667eea'
    }
  }
};

const CalendarConfigurationStep: React.FC<CalendarConfigurationStepProps> = ({
  calendarConfig,
  onConfigUpdate,
  strategyContext,
  isFromStrategyActivation = false
}) => {
  // Smart defaults and guidance state
  const [smartDefaults, setSmartDefaults] = useState<SmartDefaults | null>(null);
  const [userGuidance, setUserGuidance] = useState<UserGuidance | null>(null);
  const [transparencyIndicators, setTransparencyIndicators] = useState<TransparencyIndicators | null>(null);
  const [showSmartDefaults, setShowSmartDefaults] = useState(true);

  // Generate smart defaults and guidance when strategy context changes
  useEffect(() => {
    console.log('🎯 CalendarConfigurationStep: Strategy context changed:', {
      hasStrategyContext: !!strategyContext,
      hasStrategyData: !!strategyContext?.strategyData,
      strategyDataType: strategyContext?.strategyData ? typeof strategyContext.strategyData : 'none'
    });
    
    if (strategyContext?.strategyData) {
      console.log('🎯 CalendarConfigurationStep: Generating smart defaults from strategy data');
      console.log('🎯 CalendarConfigurationStep: About to call generateSmartDefaults with:', strategyContext.strategyData);
      
      const defaults = generateSmartDefaults(strategyContext.strategyData);
      console.log('🎯 CalendarConfigurationStep: generateSmartDefaults returned:', defaults);
      
      const guidance = generateUserGuidance(strategyContext.strategyData);
      const transparency = generateTransparencyIndicators(strategyContext.strategyData);
      
      console.log('🎯 CalendarConfigurationStep: Generated data:', {
        defaults: defaults,
        guidance: {
          warnings: guidance.warnings.length,
          recommendations: guidance.recommendations.length,
          missingData: guidance.missingData.length
        },
        transparency: {
          integrationLevel: transparency.integrationStatus.integrationLevel,
          alignmentScore: transparency.strategyAlignment.alignmentScore
        }
      });
      
      setSmartDefaults(defaults);
      setUserGuidance(guidance);
      setTransparencyIndicators(transparency);
      
      console.log('🎯 CalendarConfigurationStep: Smart defaults generated:', {
        calendarType: defaults.suggestedCalendarType,
        postingFrequency: defaults.suggestedPostingFrequency,
        platforms: defaults.suggestedPlatforms,
        guidanceCount: guidance.warnings.length + guidance.recommendations.length + guidance.missingData.length
      });
    } else {
      console.log('🎯 CalendarConfigurationStep: No strategy context available, using default defaults');
      const defaults = generateSmartDefaults(null);
      const guidance = generateUserGuidance(null);
      const transparency = generateTransparencyIndicators(null);
      
      setSmartDefaults(defaults);
      setUserGuidance(guidance);
      setTransparencyIndicators(transparency);
    }
  }, [strategyContext]);

  // Validate timezone on component mount and when timezone changes
  useEffect(() => {
    const validTimezones = timeZones.map(tz => tz.value);
    if (!validTimezones.includes(calendarConfig.timeZone)) {
      console.log('🎯 CalendarConfigurationStep: Invalid timezone detected, fixing:', calendarConfig.timeZone);
      // Fix invalid timezone
      onConfigUpdate({ timeZone: 'America/New_York' });
    }
  // timeZones is a const defined later in this component, safe to exclude
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarConfig.timeZone, onConfigUpdate]);

  // Apply smart defaults to configuration
  const handleApplySmartDefaults = (applyAll: boolean = false) => {
    if (smartDefaults) {
      const updates = applySmartDefaultsToConfig(calendarConfig, smartDefaults, applyAll);
      onConfigUpdate(updates);
      
      console.log('🎯 CalendarConfigurationStep: Applied smart defaults:', updates);
    }
  };

  // Enhanced calendar-specific handlers
  const handleCalendarTypeChange = (type: 'weekly' | 'monthly' | 'quarterly') => {
    onConfigUpdate({ calendarType: type });
  };

  const handleDurationChange = (duration: number) => {
    onConfigUpdate({ calendarDuration: duration });
  };

  const handleStartDateChange = (date: string) => {
    onConfigUpdate({ startDate: date });
  };

  const handlePostingFrequencyChange = (frequency: number) => {
    onConfigUpdate({ postingFrequency: frequency });
  };

  const handleContentVolumeChange = (volume: number) => {
    onConfigUpdate({ contentVolume: volume });
  };

  const handlePlatformChange = (platform: string, checked: boolean) => {
    let newPlatforms = [...(calendarConfig.priorityPlatforms || [])];
    if (checked) {
      newPlatforms.push(platform);
    } else {
      newPlatforms = newPlatforms.filter(p => p !== platform);
    }
    onConfigUpdate({ priorityPlatforms: newPlatforms });
  };

  const handleTimeZoneChange = (timezone: string) => {
    // Ensure the timezone is valid
    const validTimezones = timeZones.map(tz => tz.value);
    if (validTimezones.includes(timezone)) {
      onConfigUpdate({ timeZone: timezone });
    } else {
      // Fallback to a valid timezone
      onConfigUpdate({ timeZone: 'America/New_York' });
    }
  };

  const handleContentDistributionChange = (distribution: 'even' | 'frontloaded' | 'backloaded') => {
    onConfigUpdate({ contentDistribution: distribution });
  };

  const handleReviewCycleChange = (cycle: 'weekly' | 'monthly' | 'quarterly') => {
    onConfigUpdate({ reviewCycle: cycle });
  };

  const availablePlatforms = [
    { value: 'LinkedIn', label: 'LinkedIn', icon: '💼', description: 'Professional networking and B2B content' },
    { value: 'Twitter', label: 'Twitter/X', icon: '🐦', description: 'Real-time updates and engagement' },
    { value: 'Facebook', label: 'Facebook', icon: '📘', description: 'Community building and brand awareness' },
    { value: 'Instagram', label: 'Instagram', icon: '📸', description: 'Visual content and storytelling' },
    { value: 'YouTube', label: 'YouTube', icon: '📺', description: 'Video content and tutorials' },
    { value: 'Blog', label: 'Blog/Website', icon: '📝', description: 'Long-form content and SEO' },
    { value: 'Email', label: 'Email Newsletter', icon: '📧', description: 'Direct communication and nurturing' }
  ];

  const timeZones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' }
  ];

  return (
    <Box sx={{ p: 2 }}>
      {/* Header with Strategy Context */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ 
          fontWeight: 700,
          color: '#2c3e50',
          mb: 1
        }}>
          Calendar Configuration
      </Typography>
        
        <Typography variant="body1" color="#555" sx={{ mb: 2 }}>
          Configure your content calendar settings to create an optimized publishing schedule.
      </Typography>

        {isFromStrategyActivation && (
          <Alert severity="success" sx={{ 
            background: 'rgba(76, 175, 80, 0.1)', 
            border: '1px solid rgba(76, 175, 80, 0.3)',
            color: '#2e7d32'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon />
              <Typography variant="body2">
                Strategy context available - your activated strategy will enhance calendar generation
              </Typography>
            </Box>
          </Alert>
        )}
      </Box>

      {/* Smart Defaults Section */}
      {smartDefaults && (
        <Card sx={{ ...ENHANCED_STYLES.card, mb: 3, background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)' }}>
          <CardContent sx={ENHANCED_STYLES.cardContent}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AutoAwesomeIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                  Smart Defaults
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowSmartDefaults(!showSmartDefaults)}
                startIcon={<LightbulbIcon />}
                sx={{ 
                  borderColor: '#667eea', 
                  color: '#667eea',
                  '&:hover': { borderColor: '#764ba2', color: '#764ba2' }
                }}
              >
                {showSmartDefaults ? 'Hide' : 'Show'} Suggestions
              </Button>
            </Box>

            {showSmartDefaults && (
              <Box>
                <Typography variant="body2" color="#666" sx={{ mb: 3 }}>
                  Based on your strategy data, here are our smart suggestions for optimal calendar configuration:
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 2, border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                      <Typography variant="caption" color="#666" display="block">Suggested Calendar Type</Typography>
                      <Typography variant="body1" fontWeight={600} color="#2c3e50">
                        {smartDefaults.suggestedCalendarType.charAt(0).toUpperCase() + smartDefaults.suggestedCalendarType.slice(1)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 2, border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                      <Typography variant="caption" color="#666" display="block">Suggested Posts per Week</Typography>
                      <Typography variant="body1" fontWeight={600} color="#2c3e50">
                        {smartDefaults.suggestedPostingFrequency}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 2, border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                      <Typography variant="caption" color="#666" display="block">Suggested Duration</Typography>
                      <Typography variant="body1" fontWeight={600} color="#2c3e50">
                        {smartDefaults.suggestedDuration} {smartDefaults.suggestedCalendarType === 'weekly' ? 'weeks' : 
                        smartDefaults.suggestedCalendarType === 'monthly' ? 'months' : 'quarters'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 2, border: '1px solid rgba(102, 126, 234, 0.2)' }}>
                      <Typography variant="caption" color="#666" display="block">Suggested Platforms</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {smartDefaults.suggestedPlatforms.slice(0, 2).map((platform: string, index: number) => (
                          <Chip 
                            key={index} 
                            label={platform} 
                            size="small" 
                            sx={{ 
                              bgcolor: 'rgba(102, 126, 234, 0.1)', 
                              color: '#667eea',
                              fontSize: '0.7rem'
                            }} 
                          />
                        ))}
                        {smartDefaults.suggestedPlatforms.length > 2 && (
                          <Chip 
                            label={`+${smartDefaults.suggestedPlatforms.length - 2}`} 
                            size="small" 
                            sx={{ 
                              bgcolor: 'rgba(102, 126, 234, 0.1)', 
                              color: '#667eea',
                              fontSize: '0.7rem'
                            }} 
                          />
                        )}
                      </Box>
                    </Box>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleApplySmartDefaults(false)}
                    startIcon={<AutoAwesomeIcon />}
                    sx={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '&:hover': { background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)' }
                    }}
                  >
                    Apply Smart Defaults
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleApplySmartDefaults(true)}
                    sx={{ 
                      borderColor: '#667eea', 
                      color: '#667eea',
                      '&:hover': { borderColor: '#764ba2', color: '#764ba2' }
                    }}
                  >
                    Apply All Suggestions
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Guidance Section */}
      {userGuidance && (
        <Card sx={{ ...ENHANCED_STYLES.card, mb: 3, background: 'rgba(255, 248, 220, 0.3)' }}>
          <CardContent sx={ENHANCED_STYLES.cardContent}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <LightbulbIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                Strategy Guidance
              </Typography>
            </Box>

            <Grid container spacing={2}>
              {userGuidance.warnings.length > 0 && (
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: 2, border: '1px solid rgba(255, 193, 7, 0.3)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <WarningIcon sx={{ color: '#f57c00', fontSize: 20 }} />
                      <Typography variant="subtitle2" fontWeight={600} color="#f57c00">
                        Warnings ({userGuidance.warnings.length})
                      </Typography>
                    </Box>
                    {userGuidance.warnings.slice(0, 2).map((warning: any, index: number) => (
                      <Typography key={index} variant="body2" color="#666" sx={{ mb: 0.5 }}>
                        • {warning.message}
                      </Typography>
                    ))}
                  </Box>
                </Grid>
              )}

              {userGuidance.recommendations.length > 0 && (
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 2, border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LightbulbIcon sx={{ color: '#2e7d32', fontSize: 20 }} />
                      <Typography variant="subtitle2" fontWeight={600} color="#2e7d32">
                        Recommendations ({userGuidance.recommendations.length})
                      </Typography>
                    </Box>
                    {userGuidance.recommendations.slice(0, 2).map((rec: any, index: number) => (
                      <Typography key={index} variant="body2" color="#666" sx={{ mb: 0.5 }}>
                        • {rec.message}
                      </Typography>
                    ))}
                  </Box>
                </Grid>
              )}

              {userGuidance.missingData.length > 0 && (
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'rgba(33, 150, 243, 0.1)', borderRadius: 2, border: '1px solid rgba(33, 150, 243, 0.3)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <HelpIcon sx={{ color: '#1976d2', fontSize: 20 }} />
                      <Typography variant="subtitle2" fontWeight={600} color="#1976d2">
                        Missing Data ({userGuidance.missingData.length})
                      </Typography>
                    </Box>
                    {userGuidance.missingData.slice(0, 2).map((missing: any, index: number) => (
                      <Typography key={index} variant="body2" color="#666" sx={{ mb: 0.5 }}>
                        • {missing.message}
                      </Typography>
                    ))}
                  </Box>
                </Grid>
              )}

              {/* Show success state when no issues */}
              {userGuidance.warnings.length === 0 && userGuidance.recommendations.length === 0 && userGuidance.missingData.length === 0 && (
                <Grid item xs={12}>
                  <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 2, border: '1px solid rgba(76, 175, 80, 0.3)', textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                      <CheckCircleIcon sx={{ color: '#2e7d32', fontSize: 20 }} />
                      <Typography variant="subtitle2" fontWeight={600} color="#2e7d32">
                        Strategy Analysis Complete
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="#666">
                      Your strategy data is comprehensive and ready for calendar generation. No issues or missing data detected.
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Transparency Indicators */}
      {transparencyIndicators && (
        <Card sx={{ ...ENHANCED_STYLES.card, mb: 3, background: 'rgba(240, 248, 255, 0.3)' }}>
          <CardContent sx={ENHANCED_STYLES.cardContent}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUpIcon sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                Strategy Integration Status
              </Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="#2c3e50" gutterBottom>
                    Integration Level
                  </Typography>
                  <Chip 
                    label={transparencyIndicators.integrationStatus.integrationLevel.toUpperCase()} 
                    color={
                      transparencyIndicators.integrationStatus.integrationLevel === 'full' ? 'success' :
                      transparencyIndicators.integrationStatus.integrationLevel === 'enhanced' ? 'primary' :
                      transparencyIndicators.integrationStatus.integrationLevel === 'basic' ? 'warning' : 'default'
                    }
                    size="small"
                  />
                  {transparencyIndicators.integrationStatus.integrationBenefits.length > 0 && (
                    <Typography variant="body2" color="#666" sx={{ mt: 1 }}>
                      {transparencyIndicators.integrationStatus.integrationBenefits[0]}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="#2c3e50" gutterBottom>
                    Strategy Alignment
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={transparencyIndicators.strategyAlignment.alignmentScore} 
                      sx={{ 
                        flexGrow: 1, 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'rgba(0, 0, 0, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        }
                      }} 
                    />
                    <Typography variant="body2" color="#666">
                      {transparencyIndicators.strategyAlignment.alignmentScore}%
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="#666">
                    {transparencyIndicators.strategyAlignment.isAligned ? 'Strategy aligned' : 'Strategy not aligned'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Basic Calendar Setup */}
      <Card sx={{ ...ENHANCED_STYLES.card, mb: 3 }}>
        <CardContent sx={ENHANCED_STYLES.cardContent}>
          <Box sx={ENHANCED_STYLES.sectionHeader}>
            <Box sx={ENHANCED_STYLES.iconContainer}>
              <CalendarIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography variant="h5">
              Basic Calendar Setup
            </Typography>
            <Tooltip title="Configure the fundamental structure of your content calendar">
              <IconButton size="small" sx={{ ml: 1, color: '#555' }}>
                <HelpIcon />
                  </IconButton>
                </Tooltip>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={ENHANCED_STYLES.formControl}>
                <InputLabel>Calendar Type</InputLabel>
                <Select
                  value={calendarConfig.calendarType}
                  onChange={(e) => handleCalendarTypeChange(e.target.value as 'weekly' | 'monthly' | 'quarterly')}
                  label="Calendar Type"
                >
                  <MenuItem value="weekly">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>📅</span>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>Weekly</Typography>
                        <Typography variant="caption" color="#666">7-day planning cycles</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="monthly">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>📆</span>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>Monthly</Typography>
                        <Typography variant="caption" color="#666">30-day planning cycles</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="quarterly">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>📊</span>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>Quarterly</Typography>
                        <Typography variant="caption" color="#666">90-day strategic planning</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                </Select>
                <FormHelperText sx={{ color: '#666' }}>
                  Choose your planning cycle - affects content volume and scheduling
                </FormHelperText>
              </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={calendarConfig.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={ENHANCED_STYLES.textField}
                InputProps={{
                  startAdornment: <AccessTimeIcon sx={{ mr: 1, color: '#666' }} />
                }}
              />
              <FormHelperText sx={{ color: '#666' }}>
                When should your calendar begin?
              </FormHelperText>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Duration (periods)"
                type="number"
                value={calendarConfig.calendarDuration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 1)}
                inputProps={{ min: 1, max: 52 }}
                sx={ENHANCED_STYLES.textField}
                InputProps={{
                  startAdornment: <ContentPasteIcon sx={{ mr: 1, color: '#666' }} />
                }}
              />
              <FormHelperText sx={{ color: '#666' }}>
                Number of {calendarConfig.calendarType === 'weekly' ? 'weeks' : 
                calendarConfig.calendarType === 'monthly' ? 'months' : 'quarters'} to generate
              </FormHelperText>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Posts per Week"
                type="number"
                value={calendarConfig.postingFrequency}
                onChange={(e) => handlePostingFrequencyChange(parseInt(e.target.value) || 1)}
                inputProps={{ min: 1, max: 7 }}
                sx={ENHANCED_STYLES.textField}
                InputProps={{
                  startAdornment: <ScheduleIcon sx={{ mr: 1, color: '#666' }} />
                }}
              />
              <FormHelperText sx={{ color: '#666' }}>
                How many posts should be published weekly?
              </FormHelperText>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Content Volume per Period"
                type="number"
                value={calendarConfig.contentVolume}
                onChange={(e) => handleContentVolumeChange(parseInt(e.target.value) || 1)}
                inputProps={{ min: 1 }}
                sx={ENHANCED_STYLES.textField}
                InputProps={{
                  startAdornment: <ContentPasteIcon sx={{ mr: 1, color: '#666' }} />
                }}
              />
              <FormHelperText sx={{ color: '#666' }}>
                Total content pieces per {calendarConfig.calendarType === 'weekly' ? 'week' : 
                calendarConfig.calendarType === 'monthly' ? 'month' : 'quarter'}
              </FormHelperText>
            </Grid>
          </Grid>
            </CardContent>
          </Card>

      {/* Platform & Scheduling Preferences */}
      <Card sx={{ ...ENHANCED_STYLES.card, mb: 3 }}>
        <CardContent sx={ENHANCED_STYLES.cardContent}>
          <Box sx={ENHANCED_STYLES.sectionHeader}>
            <Box sx={ENHANCED_STYLES.iconContainer}>
              <PublicIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Typography variant="h5">
              Platform & Scheduling Preferences
            </Typography>
            <Tooltip title="Select your content distribution platforms and scheduling preferences">
              <IconButton size="small" sx={{ ml: 1, color: '#555' }}>
                <HelpIcon />
                  </IconButton>
                </Tooltip>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ color: '#2c3e50', mb: 2 }}>
                Priority Platforms
              </Typography>
              <Typography variant="body2" color="#666" sx={{ mb: 2 }}>
                Select the platforms where you'll publish your content. Choose platforms that align with your audience and content strategy.
              </Typography>
              <Grid container spacing={2}>
                {availablePlatforms.map((platform) => (
                  <Grid item xs={12} sm={6} md={4} key={platform.value}>
                    <Card 
                      sx={{ 
                        ...ENHANCED_STYLES.platformCard,
                        ...(calendarConfig.priorityPlatforms.includes(platform.value) && { className: 'selected' })
                      }}
                      onClick={() => handlePlatformChange(platform.value, !calendarConfig.priorityPlatforms.includes(platform.value))}
                    >
                      <CardContent sx={{ p: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                              checked={calendarConfig.priorityPlatforms.includes(platform.value)}
                        onChange={(e) => handlePlatformChange(platform.value, e.target.checked)}
                              sx={ENHANCED_STYLES.checkbox}
                            />
                          }
                          label={
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <span style={{ fontSize: '1.2rem' }}>{platform.icon}</span>
                                <Typography variant="body2" fontWeight={600} color="#2c3e50">
                                  {platform.label}
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="#666">
                                {platform.description}
                              </Typography>
                            </Box>
                          }
                          sx={{ m: 0, width: '100%' }}
                        />
            </CardContent>
          </Card>
        </Grid>
                ))}
              </Grid>
        </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={ENHANCED_STYLES.formControl}>
                <InputLabel>Time Zone</InputLabel>
                    <Select
                  value={calendarConfig.timeZone}
                  onChange={(e) => handleTimeZoneChange(e.target.value)}
                  label="Time Zone"
                >
                  {timeZones.map((tz) => (
                    <MenuItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </MenuItem>
                  ))}
                    </Select>
                <FormHelperText sx={{ color: '#666' }}>Your local timezone for accurate scheduling</FormHelperText>
                  </FormControl>
                </Grid>
                
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={ENHANCED_STYLES.formControl}>
                <InputLabel>Content Distribution</InputLabel>
                    <Select
                  value={calendarConfig.contentDistribution}
                  onChange={(e) => handleContentDistributionChange(e.target.value as 'even' | 'frontloaded' | 'backloaded')}
                  label="Content Distribution"
                >
                  <MenuItem value="even">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Even Distribution</Typography>
                      <Typography variant="caption" color="#666">Consistent posting throughout the period</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="frontloaded">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Front-loaded</Typography>
                      <Typography variant="caption" color="#666">More content at the beginning</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="backloaded">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Back-loaded</Typography>
                      <Typography variant="caption" color="#666">More content towards the end</Typography>
                    </Box>
                  </MenuItem>
                    </Select>
                <FormHelperText sx={{ color: '#666' }}>How should content be distributed across the period?</FormHelperText>
                  </FormControl>
                </Grid>
                
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={ENHANCED_STYLES.formControl}>
                <InputLabel>Review Cycle</InputLabel>
                    <Select
                  value={calendarConfig.reviewCycle}
                  onChange={(e) => handleReviewCycleChange(e.target.value as 'weekly' | 'monthly' | 'quarterly')}
                  label="Review Cycle"
                >
                  <MenuItem value="weekly">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Weekly</Typography>
                      <Typography variant="caption" color="#666">Review and adjust every week</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="monthly">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Monthly</Typography>
                      <Typography variant="caption" color="#666">Review and adjust every month</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="quarterly">
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Quarterly</Typography>
                      <Typography variant="caption" color="#666">Review and adjust every quarter</Typography>
                    </Box>
                  </MenuItem>
                    </Select>
                <FormHelperText sx={{ color: '#666' }}>How often should you review and adjust your calendar?</FormHelperText>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
    </Box>
  );
};

export default CalendarConfigurationStep;
