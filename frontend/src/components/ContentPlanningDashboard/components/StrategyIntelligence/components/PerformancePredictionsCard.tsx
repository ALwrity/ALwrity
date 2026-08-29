import React from 'react';
import {
  Grid,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TimelineIcon from '@mui/icons-material/Timeline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { StrategyData } from '../types/strategy.types';
import {
  ANALYSIS_CARD_STYLES,
  getSectionStyles,
  getEnhancedChipStyles,
  getListItemStyles
} from '../styles';
import ProgressiveCard from './ProgressiveCard';
import { safeRenderText, safeRenderArray, hasValidData, getFallbackValue } from '../utils/defensiveRendering';

interface PerformancePredictionsCardProps {
  strategyData: StrategyData | null;
}

const PerformancePredictionsCard: React.FC<PerformancePredictionsCardProps> = ({ strategyData }) => {
  // Get style objects
  const sectionStyles = getSectionStyles();
  const listItemStyles = getListItemStyles();

  // Helper function to safely render text content
  const safeRenderText = (content: any): string => {
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      return JSON.stringify(content);
    }
    return 'Data not available';
  };

  if (!strategyData?.performance_predictions) {
    return (
      <ProgressiveCard
        title="Performance Predictions"
        subtitle="AI-powered forecasting"
        icon={<TrendingUpIcon sx={{ color: 'white', fontSize: 20 }} />}
        summary={
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body1" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
              Performance predictions data not available
            </Typography>
          </Box>
        }
        details={
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
              Available data keys: {strategyData ? Object.keys(strategyData).join(', ') : 'No data'}
            </Typography>
          </Box>
        }
        trigger="hover"
        autoCollapseDelay={3000}
      />
    );
  }

  // Summary content - always visible
  const summaryContent = (
    <Box>
      {/* ROI Summary */}
      <Box sx={sectionStyles.sectionContainer}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' }, 
          justifyContent: 'space-between', 
          mb: 2,
          gap: 2,
          width: '100%'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            flex: 1,
            minWidth: 0
          }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              borderRadius: '50%', 
              background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.success} 0%, ${ANALYSIS_CARD_STYLES.colors.accent} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2,
              color: 'white',
              fontSize: '1.2rem',
              fontWeight: 600,
              boxShadow: `0 4px 12px ${ANALYSIS_CARD_STYLES.colors.success}30`,
              flexShrink: 0
            }}>
              {strategyData.performance_predictions.estimated_roi || '25%'}
            </Box>
            <Box sx={{ 
              minWidth: 0, 
              flex: 1
            }}>
              <Typography variant="h6" sx={{ 
                color: ANALYSIS_CARD_STYLES.colors.text.primary, 
                fontWeight: 600,
                fontSize: '1rem',
                lineHeight: 1.2,
                mb: 0.5,
                wordBreak: 'break-word'
              }}>
                Performance Predictions
              </Typography>
              <Typography variant="caption" sx={{ 
                color: ANALYSIS_CARD_STYLES.colors.text.secondary,
                fontSize: '0.7rem',
                lineHeight: 1.2,
                wordBreak: 'break-word'
              }}>
                Expected ROI and success metrics
              </Typography>
            </Box>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            flexWrap: 'wrap',
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            flexShrink: 0
          }}>
            <Chip 
              label={`${strategyData.performance_predictions.success_probability || '85%'} Success`}
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
            />
            <Chip 
              label="12 months"
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
            />
          </Box>
        </Box>
        
        {/* ROI Description - Full width container */}
        <Box sx={{ mt: 2, width: '100%' }}>
          <Typography variant="body2" sx={{ 
            color: ANALYSIS_CARD_STYLES.colors.text.secondary,
            fontSize: '0.8rem',
            lineHeight: 1.5,
            wordBreak: 'break-word',
            textAlign: 'left'
          }}>
            ROI of {strategyData.performance_predictions.estimated_roi || '20-30%'} is achievable with {strategyData.performance_predictions.success_probability || '85%'} success probability.
          </Typography>
        </Box>
      </Box>

      {/* Key Metrics Preview */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ 
          color: ANALYSIS_CARD_STYLES.colors.text.primary, 
          mb: 1.5, 
          fontWeight: 600,
          fontSize: '0.85rem'
        }}>
          Key Metrics Preview
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 1,
          justifyContent: 'flex-start'
        }}>
          {strategyData.performance_predictions.traffic_growth && (
            <Chip 
              label={`${strategyData.performance_predictions.traffic_growth.month_12 || '100%'} Traffic`}
              size="small" 
              icon={<TrendingUpIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip} 
            />
          )}
          {strategyData.performance_predictions.engagement_metrics && (
            <Chip 
              label={`${strategyData.performance_predictions.engagement_metrics.time_on_page || '3-5 min'}`}
              size="small" 
              icon={<AssessmentIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.secondary).chip} 
            />
          )}
          {strategyData.performance_predictions.conversion_predictions && (
            <Chip 
              label={`${strategyData.performance_predictions.conversion_predictions.lead_generation || '5-8%'} Leads`}
              size="small" 
              icon={<ShowChartIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.accent).chip} 
            />
          )}
        </Box>
      </Box>
    </Box>
  );

  // Detailed content - shown on expansion
  const detailedContent = (
    <Box>
      {/* ROI Summary */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
          ROI Summary
        </Typography>
        <Box sx={sectionStyles.sectionContainer}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.text.secondary, 
              fontSize: '0.85rem',
              lineHeight: 1.5,
              wordBreak: 'break-word'
            }}>
              Estimated ROI: {strategyData.performance_predictions.estimated_roi || '20-30%'}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.text.secondary, 
              fontSize: '0.85rem',
              lineHeight: 1.5,
              wordBreak: 'break-word'
            }}>
              Success Probability: {strategyData.performance_predictions.success_probability || '85%'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Traffic Growth */}
      {strategyData.performance_predictions.traffic_growth && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Traffic Growth Projections
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(150px, 1fr))' }, 
              gap: 2 
            }}>
              {strategyData.performance_predictions.traffic_growth.month_3 && (
                <Box sx={{ 
                  p: 2, 
                  border: `1px solid ${ANALYSIS_CARD_STYLES.colors.success}`, 
                  borderRadius: 2,
                  background: `rgba(76, 175, 80, 0.1)`,
                  textAlign: 'center'
                }}>
                  <Typography variant="body2" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.success, 
                    fontWeight: 600, 
                    mb: 1,
                    fontSize: '0.8rem'
                  }}>
                    Month 3
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.text.primary,
                    fontSize: '1.2rem',
                    fontWeight: 700
                  }}>
                    {strategyData.performance_predictions.traffic_growth.month_3}
                  </Typography>
                </Box>
              )}
              {strategyData.performance_predictions.traffic_growth.month_6 && (
                <Box sx={{ 
                  p: 2, 
                  border: `1px solid ${ANALYSIS_CARD_STYLES.colors.primary}`, 
                  borderRadius: 2,
                  background: `rgba(63, 81, 181, 0.1)`,
                  textAlign: 'center'
                }}>
                  <Typography variant="body2" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.primary, 
                    fontWeight: 600, 
                    mb: 1,
                    fontSize: '0.8rem'
                  }}>
                    Month 6
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.text.primary,
                    fontSize: '1.2rem',
                    fontWeight: 700
                  }}>
                    {strategyData.performance_predictions.traffic_growth.month_6}
                  </Typography>
                </Box>
              )}
              {strategyData.performance_predictions.traffic_growth.month_12 && (
                <Box sx={{ 
                  p: 2, 
                  border: `1px solid ${ANALYSIS_CARD_STYLES.colors.accent}`, 
                  borderRadius: 2,
                  background: `rgba(240, 147, 251, 0.1)`,
                  textAlign: 'center'
                }}>
                  <Typography variant="body2" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.accent, 
                    fontWeight: 600, 
                    mb: 1,
                    fontSize: '0.8rem'
                  }}>
                    Month 12
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    color: ANALYSIS_CARD_STYLES.colors.text.primary,
                    fontSize: '1.2rem',
                    fontWeight: 700
                  }}>
                    {strategyData.performance_predictions.traffic_growth.month_12}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Engagement Metrics */}
      {strategyData.performance_predictions.engagement_metrics && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Engagement Metrics
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <List dense>
              {strategyData.performance_predictions.engagement_metrics.bounce_rate && (
                <ListItem sx={{ ...listItemStyles.listItem, py: 1.5 }}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: ANALYSIS_CARD_STYLES.colors.warning,
                      opacity: 0.7
                    }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Bounce Rate"
                    secondary={strategyData.performance_predictions.engagement_metrics.bounce_rate}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontSize: '0.875rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.warning, fontWeight: 600, mb: 0.5 }
                    }}
                    secondaryTypographyProps={{ 
                      variant: 'caption', 
                      fontSize: '0.75rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.text.secondary, lineHeight: 1.4 }
                    }}
                  />
                </ListItem>
              )}
              {strategyData.performance_predictions.engagement_metrics.time_on_page && (
                <ListItem sx={{ ...listItemStyles.listItem, py: 1.5 }}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: ANALYSIS_CARD_STYLES.colors.success,
                      opacity: 0.7
                    }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Time on Page"
                    secondary={strategyData.performance_predictions.engagement_metrics.time_on_page}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontSize: '0.875rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.success, fontWeight: 600, mb: 0.5 }
                    }}
                    secondaryTypographyProps={{ 
                      variant: 'caption', 
                      fontSize: '0.75rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.text.secondary, lineHeight: 1.4 }
                    }}
                  />
                </ListItem>
              )}
              {strategyData.performance_predictions.engagement_metrics.social_shares && (
                <ListItem sx={{ ...listItemStyles.listItem, py: 1.5 }}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: ANALYSIS_CARD_STYLES.colors.info,
                      opacity: 0.7
                    }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Social Shares"
                    secondary={strategyData.performance_predictions.engagement_metrics.social_shares}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontSize: '0.875rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.info, fontWeight: 600, mb: 0.5 }
                    }}
                    secondaryTypographyProps={{ 
                      variant: 'caption', 
                      fontSize: '0.75rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.text.secondary, lineHeight: 1.4 }
                    }}
                  />
                </ListItem>
              )}
            </List>
          </Box>
        </Box>
      )}

      {/* Conversion Predictions */}
      {strategyData.performance_predictions.conversion_predictions && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Conversion Predictions
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <List dense>
              {strategyData.performance_predictions.conversion_predictions.content_downloads && (
                <ListItem sx={{ ...listItemStyles.listItem, py: 1.5 }}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: ANALYSIS_CARD_STYLES.colors.primary,
                      opacity: 0.7
                    }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Content Downloads"
                    secondary={strategyData.performance_predictions.conversion_predictions.content_downloads}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontSize: '0.875rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.primary, fontWeight: 600, mb: 0.5 }
                    }}
                    secondaryTypographyProps={{ 
                      variant: 'caption', 
                      fontSize: '0.75rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.text.secondary, lineHeight: 1.4 }
                    }}
                  />
                </ListItem>
              )}
              {strategyData.performance_predictions.conversion_predictions.email_signups && (
                <ListItem sx={{ ...listItemStyles.listItem, py: 1.5 }}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: ANALYSIS_CARD_STYLES.colors.secondary,
                      opacity: 0.7
                    }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Email Signups"
                    secondary={strategyData.performance_predictions.conversion_predictions.email_signups}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontSize: '0.875rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.secondary, fontWeight: 600, mb: 0.5 }
                    }}
                    secondaryTypographyProps={{ 
                      variant: 'caption', 
                      fontSize: '0.75rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.text.secondary, lineHeight: 1.4 }
                    }}
                  />
                </ListItem>
              )}
              {strategyData.performance_predictions.conversion_predictions.lead_generation && (
                <ListItem sx={{ ...listItemStyles.listItem, py: 1.5 }}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: ANALYSIS_CARD_STYLES.colors.accent,
                      opacity: 0.7
                    }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Lead Generation"
                    secondary={strategyData.performance_predictions.conversion_predictions.lead_generation}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontSize: '0.875rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.accent, fontWeight: 600, mb: 0.5 }
                    }}
                    secondaryTypographyProps={{ 
                      variant: 'caption', 
                      fontSize: '0.75rem',
                      sx: { color: ANALYSIS_CARD_STYLES.colors.text.secondary, lineHeight: 1.4 }
                    }}
                  />
                </ListItem>
              )}
            </List>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 2, opacity: 0.2, borderColor: ANALYSIS_CARD_STYLES.colors.border.secondary }} />

      {/* Success Factors */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
          Success Factors
        </Typography>
        <Box sx={sectionStyles.sectionContainer}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.text.secondary, 
              fontSize: '0.8rem',
              lineHeight: 1.5
            }}>
              • High success probability of {strategyData.performance_predictions.success_probability || '85%'}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.text.secondary, 
              fontSize: '0.8rem',
              lineHeight: 1.5
            }}>
              • Expected ROI of {strategyData.performance_predictions.estimated_roi || '20-30%'}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.text.secondary, 
              fontSize: '0.8rem',
              lineHeight: 1.5
            }}>
              • Traffic growth from {strategyData.performance_predictions.traffic_growth?.month_3 || '25%'} to {strategyData.performance_predictions.traffic_growth?.month_12 || '100%'}
            </Typography>
            <Typography variant="body2" sx={{ 
              color: ANALYSIS_CARD_STYLES.colors.text.secondary, 
              fontSize: '0.8rem',
              lineHeight: 1.5
            }}>
              • Lead generation improvement of {strategyData.performance_predictions.conversion_predictions?.lead_generation || '5-8%'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <ProgressiveCard
      title="Performance Predictions"
      subtitle="ROI and success metrics"
      icon={<ShowChartIcon sx={{ color: 'white', fontSize: 20 }} />}
      summary={summaryContent}
      details={detailedContent}
      trigger="hover"
      autoCollapseDelay={3000}
      componentId="performance_predictions"
    />
  );
};

export default PerformancePredictionsCard; 