import React from 'react';
import {
  Grid,
  Typography,
  Box,
  Chip
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ProgressiveCard from './ProgressiveCard';
import { ANALYSIS_CARD_STYLES, getEnhancedChipStyles } from '../styles';

const ProgressiveDemo: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ 
        color: ANALYSIS_CARD_STYLES.colors.text.primary, 
        mb: 3, 
        textAlign: 'center',
        fontWeight: 600
      }}>
        Progressive Disclosure Demo
      </Typography>
      
      <Typography variant="body1" sx={{ 
        color: ANALYSIS_CARD_STYLES.colors.text.secondary, 
        mb: 4, 
        textAlign: 'center',
        maxWidth: 800,
        mx: 'auto'
      }}>
        Experience the new progressive disclosure system. Cards show a summary initially, 
        with detailed content revealed through user interaction.
      </Typography>

      <Grid container spacing={3}>
        {/* Click Trigger Example */}
        <Grid item xs={12} md={6}>
          <ProgressiveCard
            title="Strategic Insights"
            subtitle="Click to expand"
            icon={<LightbulbIcon sx={{ color: 'white', fontSize: 20 }} />}
            summary={
              <Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  mb: 2 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%', 
                      background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.success} 0%, ${ANALYSIS_CARD_STYLES.colors.info} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      color: 'white',
                      fontSize: '1.2rem',
                      fontWeight: 600
                    }}>
                      85%
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontWeight: 600 }}>
                        Market Analysis
                      </Typography>
                      <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
                        Strong positioning identified
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip 
                      label="High Growth"
                      size="small"
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
                    />
                    <Chip 
                      label="6 months"
                      size="small"
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
                    />
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip label="Market" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip} />
                  <Chip label="Consumer" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.secondary).chip} />
                  <Chip label="Business" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.accent).chip} />
                </Box>
              </Box>
            }
            details={
              <Box>
                <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
                  Detailed Strategic Insights
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  background: ANALYSIS_CARD_STYLES.colors.background.dark, 
                  borderRadius: 2,
                  border: `1px solid ${ANALYSIS_CARD_STYLES.colors.border.secondary}`,
                  backdropFilter: 'blur(10px)'
                }}>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Market positioning analysis reveals strong competitive advantages
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Consumer behavior patterns indicate high engagement potential
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Business model optimization opportunities identified
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary }}>
                    • Revenue growth projections show 25% increase potential
                  </Typography>
                </Box>
              </Box>
            }
            trigger="click"
          />
        </Grid>

        {/* Hover Trigger Example */}
        <Grid item xs={12} md={6}>
          <ProgressiveCard
            title="Performance Predictions"
            subtitle="Hover to expand"
            icon={<TrendingUpIcon sx={{ color: 'white', fontSize: 20 }} />}
            summary={
              <Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  mb: 2 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%', 
                      background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.warning} 0%, ${ANALYSIS_CARD_STYLES.colors.error} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      color: 'white',
                      fontSize: '1.2rem',
                      fontWeight: 600
                    }}>
                      92%
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontWeight: 600 }}>
                        ROI Predictions
                      </Typography>
                      <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
                        High success probability
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip 
                      label="25% ROI"
                      size="small"
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
                    />
                    <Chip 
                      label="6 months"
                      size="small"
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
                    />
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip label="Traffic" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip} />
                  <Chip label="Engagement" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.secondary).chip} />
                  <Chip label="Conversion" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.accent).chip} />
                </Box>
              </Box>
            }
            details={
              <Box>
                <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
                  Detailed Performance Metrics
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  background: ANALYSIS_CARD_STYLES.colors.background.dark, 
                  borderRadius: 2,
                  border: `1px solid ${ANALYSIS_CARD_STYLES.colors.border.secondary}`,
                  backdropFilter: 'blur(10px)'
                }}>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Traffic growth: 150% increase in organic visitors
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Engagement rate: 45% improvement in user interaction
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Conversion rate: 3.2% to 5.8% improvement
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary }}>
                    • Revenue impact: $50K additional monthly revenue
                  </Typography>
                </Box>
              </Box>
            }
            trigger="hover"
            autoCollapseDelay={5000}
          />
        </Grid>

        {/* Risk Assessment Example */}
        <Grid item xs={12} md={6}>
          <ProgressiveCard
            title="Risk Assessment"
            subtitle="Click to expand"
            icon={<SecurityIcon sx={{ color: 'white', fontSize: 20 }} />}
            summary={
              <Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  mb: 2 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%', 
                      background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.error} 0%, ${ANALYSIS_CARD_STYLES.colors.warning} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      color: 'white',
                      fontSize: '1.2rem',
                      fontWeight: 600
                    }}>
                      Med
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontWeight: 600 }}>
                        Risk Level
                      </Typography>
                      <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
                        Medium risk identified
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip 
                      label="7 Risks"
                      size="small"
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.error).chip}
                    />
                    <Chip 
                      label="Mitigated"
                      size="small"
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
                    />
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip label="Technical" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.error).chip} />
                  <Chip label="Market" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.warning).chip} />
                  <Chip label="Operational" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip} />
                </Box>
              </Box>
            }
            details={
              <Box>
                <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
                  Risk Categories & Mitigation
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  background: ANALYSIS_CARD_STYLES.colors.background.dark, 
                  borderRadius: 2,
                  border: `1px solid ${ANALYSIS_CARD_STYLES.colors.border.secondary}`,
                  backdropFilter: 'blur(10px)'
                }}>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Technical Risks: Infrastructure scalability challenges
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Market Risks: Competitive pressure and market saturation
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Operational Risks: Resource allocation and team scaling
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary }}>
                    • Mitigation: Comprehensive monitoring and contingency plans
                  </Typography>
                </Box>
              </Box>
            }
            trigger="click"
          />
        </Grid>

        {/* Implementation Roadmap Example */}
        <Grid item xs={12} md={6}>
          <ProgressiveCard
            title="Implementation Roadmap"
            subtitle="Hover to expand"
            icon={<ScheduleIcon sx={{ color: 'white', fontSize: 20 }} />}
            summary={
              <Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  mb: 2 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%', 
                      background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.info} 0%, ${ANALYSIS_CARD_STYLES.colors.primary} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      color: 'white',
                      fontSize: '1.2rem',
                      fontWeight: 600
                    }}>
                      6M
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontWeight: 600 }}>
                        Timeline
                      </Typography>
                      <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
                        6-month implementation
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip 
                      label="4 Phases"
                      size="small"
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
                    />
                    <Chip 
                      label="5 Team"
                      size="small"
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip}
                    />
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip label="Phase 1" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip} />
                  <Chip label="Phase 2" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.warning).chip} />
                  <Chip label="Phase 3" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.error).chip} />
                  <Chip label="Phase 4" size="small" sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip} />
                </Box>
              </Box>
            }
            details={
              <Box>
                <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
                  Implementation Phases
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  background: ANALYSIS_CARD_STYLES.colors.background.dark, 
                  borderRadius: 2,
                  border: `1px solid ${ANALYSIS_CARD_STYLES.colors.border.secondary}`,
                  backdropFilter: 'blur(10px)'
                }}>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Phase 1 (Months 1-2): Foundation and setup
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Phase 2 (Months 3-4): Core implementation
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1 }}>
                    • Phase 3 (Months 5-6): Optimization and scaling
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary }}>
                    • Phase 4 (Ongoing): Monitoring and maintenance
                  </Typography>
                </Box>
              </Box>
            }
            trigger="hover"
            autoCollapseDelay={4000}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProgressiveDemo; 