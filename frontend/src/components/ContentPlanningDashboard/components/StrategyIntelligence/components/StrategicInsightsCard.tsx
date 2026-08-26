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
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BusinessIcon from '@mui/icons-material/Business';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { StrategyData } from '../types/strategy.types';
import {
  ANALYSIS_CARD_STYLES,
  getSectionStyles,
  getAccordionStyles,
  getEnhancedChipStyles,
  getListItemStyles
} from '../styles';
import ProgressiveCard from './ProgressiveCard';
import { safeRenderText, hasValidData } from '../utils/defensiveRendering';

interface StrategicInsightsCardProps {
  strategyData: StrategyData | null;
}

const StrategicInsightsCard: React.FC<StrategicInsightsCardProps> = ({ strategyData }) => {
  // Get style objects
  const sectionStyles = getSectionStyles();
  const accordionStyles = getAccordionStyles();
  const listItemStyles = getListItemStyles();



  if (!strategyData?.strategic_insights) {
    return (
      <Grid item xs={12} lg={6}>
        <ProgressiveCard
          title="Strategic Insights"
          subtitle="AI-powered market analysis"
          icon={<LightbulbIcon sx={{ color: 'white', fontSize: 20 }} />}
          summary={
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body1" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
                Strategic insights data not available
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
          trigger="click"
        />
      </Grid>
    );
  }

  // Helper function to get insight icon
  const getInsightIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'market': return <TrendingUpIcon />;
      case 'consumer': return <PsychologyIcon />;
      case 'business': return <BusinessIcon />;
      case 'analytics': return <AnalyticsIcon />;
      default: return <LightbulbIcon />;
    }
  };



  // Summary content - always visible
  const summaryContent = (
    <Box>
      {/* Market Analysis Summary */}
      <Box sx={sectionStyles.sectionContainer}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
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
              fontWeight: 600,
              boxShadow: `0 4px 12px ${ANALYSIS_CARD_STYLES.colors.success}30`
            }}>
              {strategyData.strategic_insights.market_positioning?.positioning_strength || 
               strategyData.strategic_insights.swot_summary?.overall_score || 
               85}%
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontWeight: 600 }}>
                Market Analysis
              </Typography>
              <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
                {strategyData.strategic_insights.market_positioning?.current_position || 'Strong'} market positioning identified
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label={strategyData.strategic_insights.growth_potential?.growth_rate || "High Growth"}
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
            />
            <Chip 
              label={strategyData.strategic_insights.growth_potential?.market_size || "Growing Market"}
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
            />
          </Box>
        </Box>
      </Box>

      {/* Key Insights Preview */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1, fontWeight: 600 }}>
          Key Insights Preview
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {/* Show content opportunities as key insights */}
          {strategyData.strategic_insights.content_opportunities?.slice(0, 2).map((opportunity: string, index: number) => (
            <Chip
              key={`content-${index}`}
              label={`Opportunity ${index + 1}`}
              size="small"
              icon={<LightbulbIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
            />
          ))}
          {/* Show growth drivers as key insights */}
          {strategyData.strategic_insights.growth_potential?.key_drivers?.slice(0, 1).map((driver: string, index: number) => (
            <Chip
              key={`driver-${index}`}
              label="Growth Driver"
              size="small"
              icon={<TrendingUpIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.warning).chip}
            />
          ))}
          {/* Show SWOT insights */}
          {(() => {
            const strengthsLength = strategyData.strategic_insights.market_positioning?.swot_analysis?.strengths?.length || 0;
            const opportunitiesLength = strategyData.strategic_insights.market_positioning?.swot_analysis?.opportunities?.length || 0;
            
            return (
              <>
                {strengthsLength > 0 && (
                  <Chip
                    label={`${strengthsLength} Strengths`}
                    size="small"
                    icon={<AnalyticsIcon />}
                    sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip}
                  />
                )}
                {opportunitiesLength > 0 && (
                  <Chip
                    label={`${opportunitiesLength} Opportunities`}
                    size="small"
                    icon={<PsychologyIcon />}
                    sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
                  />
                )}
              </>
            );
          })()}
        </Box>
      </Box>
    </Box>
  );

  // Detailed content - shown on expansion
  const detailedContent = (
    <Box>
      {/* Market Positioning */}
      {strategyData.strategic_insights.market_positioning && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Market Positioning
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip 
                label={`Position: ${strategyData.strategic_insights.market_positioning.current_position}`}
                size="small"
                sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip}
              />
              <Chip 
                label={`Strength: ${strategyData.strategic_insights.market_positioning.positioning_strength}%`}
                size="small"
                sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
              />
            </Box>
            
            {/* SWOT Analysis */}
            {strategyData.strategic_insights.market_positioning.swot_analysis && (
              <Box>
                <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1, fontWeight: 500 }}>
                  SWOT Analysis
                </Typography>
                
                {/* Strengths */}
                {strategyData.strategic_insights.market_positioning.swot_analysis.strengths && 
                 strategyData.strategic_insights.market_positioning.swot_analysis.strengths.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.success, fontWeight: 600, display: 'block', mb: 1 }}>
                      Strengths ({strategyData.strategic_insights.market_positioning.swot_analysis.strengths.length})
                    </Typography>
                    <List dense>
                      {strategyData.strategic_insights.market_positioning.swot_analysis.strengths.map((strength: string, index: number) => (
                        <ListItem key={index} sx={listItemStyles.listItem}>
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
                            primary={safeRenderText(strength)}
                            primaryTypographyProps={{ 
                              variant: 'body2', 
                              fontSize: '0.875rem',
                              sx: { lineHeight: 1.4, color: ANALYSIS_CARD_STYLES.colors.text.primary }
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
                
                {/* Opportunities */}
                {strategyData.strategic_insights.market_positioning.swot_analysis.opportunities && 
                 strategyData.strategic_insights.market_positioning.swot_analysis.opportunities.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.info, fontWeight: 600, display: 'block', mb: 1 }}>
                      Opportunities ({strategyData.strategic_insights.market_positioning.swot_analysis.opportunities.length})
                    </Typography>
                    <List dense>
                      {strategyData.strategic_insights.market_positioning.swot_analysis.opportunities.map((opportunity: string, index: number) => (
                        <ListItem key={index} sx={listItemStyles.listItem}>
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
                            primary={safeRenderText(opportunity)}
                            primaryTypographyProps={{ 
                              variant: 'body2', 
                              fontSize: '0.875rem',
                              sx: { lineHeight: 1.4, color: ANALYSIS_CARD_STYLES.colors.text.primary }
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Growth Potential */}
      {strategyData.strategic_insights.growth_potential && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Growth Potential
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip 
                label={`Market: ${strategyData.strategic_insights.growth_potential.market_size}`}
                size="small"
                sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip}
              />
              <Chip 
                label={`Growth: ${strategyData.strategic_insights.growth_potential.growth_rate}`}
                size="small"
                sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
              />
            </Box>
            
            {/* Key Drivers */}
            {strategyData.strategic_insights.growth_potential.key_drivers && 
             strategyData.strategic_insights.growth_potential.key_drivers.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1, fontWeight: 500 }}>
                  Key Growth Drivers ({strategyData.strategic_insights.growth_potential.key_drivers.length})
                </Typography>
                <List dense>
                  {strategyData.strategic_insights.growth_potential.key_drivers.map((driver: string, index: number) => (
                    <ListItem key={index} sx={listItemStyles.listItem}>
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
                        primary={safeRenderText(driver)}
                        primaryTypographyProps={{ 
                          variant: 'body2', 
                          fontSize: '0.875rem',
                          sx: { lineHeight: 1.4, color: ANALYSIS_CARD_STYLES.colors.text.primary }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* SWOT Summary */}
      {strategyData.strategic_insights.swot_summary && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            SWOT Summary
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip 
                label={`Overall Score: ${strategyData.strategic_insights.swot_summary.overall_score}%`}
                size="small"
                sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
              />
            </Box>
            
            {/* Primary Strengths */}
            {strategyData.strategic_insights.swot_summary.primary_strengths && 
             strategyData.strategic_insights.swot_summary.primary_strengths.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.success, fontWeight: 600, mb: 1 }}>
                  Primary Strengths ({strategyData.strategic_insights.swot_summary.primary_strengths.length})
                </Typography>
                <List dense>
                  {strategyData.strategic_insights.swot_summary.primary_strengths.map((strength: string, index: number) => (
                    <ListItem key={index} sx={listItemStyles.listItem}>
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
                        primary={safeRenderText(strength)}
                        primaryTypographyProps={{ 
                          variant: 'body2', 
                          fontSize: '0.875rem',
                          sx: { lineHeight: 1.4, color: ANALYSIS_CARD_STYLES.colors.text.primary }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            
            {/* Key Opportunities */}
            {strategyData.strategic_insights.swot_summary.key_opportunities && 
             strategyData.strategic_insights.swot_summary.key_opportunities.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.info, fontWeight: 600, mb: 1 }}>
                  Key Opportunities ({strategyData.strategic_insights.swot_summary.key_opportunities.length})
                </Typography>
                <List dense>
                  {strategyData.strategic_insights.swot_summary.key_opportunities.map((opportunity: string, index: number) => (
                    <ListItem key={index} sx={listItemStyles.listItem}>
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
                        primary={safeRenderText(opportunity)}
                        primaryTypographyProps={{ 
                          variant: 'body2', 
                          fontSize: '0.875rem',
                          sx: { lineHeight: 1.4, color: ANALYSIS_CARD_STYLES.colors.text.primary }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Strategic Insights by Type */}
      {strategyData.strategic_insights.insights && strategyData.strategic_insights.insights.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Detailed Strategic Insights ({strategyData.strategic_insights.insights.length})
          </Typography>
          
          {/* Group insights by type */}
          {Object.entries(
            strategyData.strategic_insights.insights.reduce((acc: any, insight: any) => {
              const type = insight.type || 'General';
              if (!acc[type]) acc[type] = [];
              acc[type].push(insight);
              return acc;
            }, {})
          ).map(([type, insights]: [string, any]) => (
            <Accordion key={type} defaultExpanded={false} sx={accordionStyles.accordion}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={accordionStyles.expandIcon} />}
                sx={accordionStyles.accordionSummary}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ mr: 1.5 }}>
                    {getInsightIcon(type)}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={accordionStyles.accordionTitle}>
                      {type} Insights ({insights.length})
                    </Typography>
                    <Typography variant="caption" sx={accordionStyles.accordionSubtitle}>
                      {insights.length} strategic {insights.length === 1 ? 'insight' : 'insights'}
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Box sx={sectionStyles.sectionContainer}>
                  <List dense>
                    {insights.map((insight: any, index: number) => (
                      <ListItem key={index} sx={listItemStyles.listItem}>
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
                          primary={safeRenderText(insight.insight)}
                          primaryTypographyProps={{ 
                            variant: 'body2', 
                            fontSize: '0.875rem',
                            sx: { lineHeight: 1.4, color: ANALYSIS_CARD_STYLES.colors.text.primary }
                          }}
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                                <Chip
                                  label={`P: ${safeRenderText(insight.priority) || 'Medium'}`}
                                  size="small"
                                  sx={getEnhancedChipStyles(
                                    insight.priority === 'High' ? ANALYSIS_CARD_STYLES.colors.error : 
                                    insight.priority === 'Medium' ? ANALYSIS_CARD_STYLES.colors.warning : 
                                    ANALYSIS_CARD_STYLES.colors.success
                                  ).chip}
                                />
                                <Chip
                                  label={`I: ${safeRenderText(insight.estimated_impact) || 'Medium'}`}
                                  size="small"
                                  sx={getEnhancedChipStyles(
                                    insight.estimated_impact === 'High' ? ANALYSIS_CARD_STYLES.colors.error : 
                                    insight.estimated_impact === 'Medium' ? ANALYSIS_CARD_STYLES.colors.warning : 
                                    ANALYSIS_CARD_STYLES.colors.success
                                  ).chip}
                                />
                                <Chip
                                  label={`C: ${safeRenderText(insight.confidence_level) || 'Medium'}`}
                                  size="small"
                                  sx={getEnhancedChipStyles(
                                    insight.confidence_level === 'High' ? ANALYSIS_CARD_STYLES.colors.success : 
                                    insight.confidence_level === 'Medium' ? ANALYSIS_CARD_STYLES.colors.warning : 
                                    ANALYSIS_CARD_STYLES.colors.error
                                  ).chip}
                                />
                                <Chip
                                  label={`T: ${safeRenderText(insight.implementation_time) || '3 months'}`}
                                  size="small"
                                  sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
                                />
                              </Box>
                              {hasValidData(insight.reasoning) && (
                                <Typography variant="caption" sx={{ 
                                  display: 'block', 
                                  fontSize: '0.75rem', 
                                  color: ANALYSIS_CARD_STYLES.colors.text.secondary,
                                  fontStyle: 'italic'
                                }}>
                                  <strong>Reasoning:</strong> {safeRenderText(insight.reasoning)}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Content Opportunities */}
      {strategyData.strategic_insights.content_opportunities && strategyData.strategic_insights.content_opportunities.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Content Opportunities ({strategyData.strategic_insights.content_opportunities.length})
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <List dense>
              {strategyData.strategic_insights.content_opportunities.map((opportunity: string, index: number) => (
                <ListItem key={index} sx={listItemStyles.listItem}>
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
                    primary={safeRenderText(opportunity)}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontSize: '0.875rem',
                      sx: { lineHeight: 1.4, color: ANALYSIS_CARD_STYLES.colors.text.primary }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <ProgressiveCard
      title="Strategic Insights"
      subtitle="AI-powered market analysis"
      icon={<LightbulbIcon sx={{ color: 'white', fontSize: 20 }} />}
      summary={summaryContent}
      details={detailedContent}
      trigger="hover"
      autoCollapseDelay={2000}
      componentId="strategic_insights"
    />
  );
};

export default StrategicInsightsCard; 