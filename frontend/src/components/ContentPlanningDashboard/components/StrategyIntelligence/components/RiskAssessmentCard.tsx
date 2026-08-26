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
import SecurityIcon from '@mui/icons-material/Security';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { StrategyData } from '../types/strategy.types';
import {
  ANALYSIS_CARD_STYLES,
  getSectionStyles,
  getAccordionStyles,
  getEnhancedChipStyles,
  getListItemStyles
} from '../styles';
import ProgressiveCard from './ProgressiveCard';
import { safeRenderText, safeRenderArray, hasValidData, getFallbackValue } from '../utils/defensiveRendering';

interface RiskAssessmentCardProps {
  strategyData: StrategyData | null;
}

const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({ strategyData }) => {

  
  // Get style objects
  const sectionStyles = getSectionStyles();
  const accordionStyles = getAccordionStyles();
  const listItemStyles = getListItemStyles();

  // Helper function to get risk level color
  const getRiskLevelColor = (level: string) => {
    const lowerLevel = level.toLowerCase();
    if (lowerLevel.includes('high')) return ANALYSIS_CARD_STYLES.colors.error;
    if (lowerLevel.includes('medium')) return ANALYSIS_CARD_STYLES.colors.warning;
    if (lowerLevel.includes('low')) return ANALYSIS_CARD_STYLES.colors.success;
    return ANALYSIS_CARD_STYLES.colors.info;
  };

  // Helper function to safely render text content
  const safeRenderText = (content: any): string => {
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      return JSON.stringify(content);
    }
    return 'Data not available';
  };

  if (!strategyData?.risk_assessment) {
    return (
      <ProgressiveCard
        title="Risk Assessment"
        subtitle="Strategic risk analysis"
        icon={<WarningIcon sx={{ color: 'white', fontSize: 20 }} />}
        summary={
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body1" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
              Risk assessment data not available
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
      {/* Risk Overview */}
      <Box sx={sectionStyles.sectionContainer}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ 
              width: 40, 
              height: 40, 
              borderRadius: '50%', 
              background: `linear-gradient(135deg, ${getRiskLevelColor(strategyData.risk_assessment.overall_risk_level || 'Medium')} 0%, ${ANALYSIS_CARD_STYLES.colors.warning} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2,
              color: 'white',
              fontSize: '1.2rem',
              fontWeight: 600,
              boxShadow: `0 4px 12px ${getRiskLevelColor(strategyData.risk_assessment.overall_risk_level || 'Medium')}30`
            }}>
              {strategyData.risk_assessment.risks?.length || 0}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontWeight: 600 }}>
                Risk Level
              </Typography>
              <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
                {strategyData.risk_assessment.overall_risk_level || 'Medium'} overall risk
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label={`${strategyData.risk_assessment.risks?.length || 0} Risks`}
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.error).chip}
            />
            <Chip 
              label={`${strategyData.risk_assessment.mitigation_strategies?.length || 0} Mitigations`}
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
            />
          </Box>
        </Box>
      </Box>

      {/* Risk Categories Preview */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1, fontWeight: 600 }}>
          Risk Categories
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {strategyData.risk_assessment.risk_categories && Object.keys(strategyData.risk_assessment.risk_categories).slice(0, 4).map((category: string) => (
            <Chip
              key={category}
              label={category.replace(/_/g, ' ')}
              size="small"
              icon={<WarningIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.warning).chip}
            />
          ))}
          {strategyData.risk_assessment.risk_categories && Object.keys(strategyData.risk_assessment.risk_categories).length > 4 && (
            <Chip
              label={`+${Object.keys(strategyData.risk_assessment.risk_categories).length - 4} more`}
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.secondary).chip}
            />
          )}
        </Box>
      </Box>
    </Box>
  );

  // Detailed content - shown on expansion
  const detailedContent = (
    <Box>
      {/* Overall Risk Assessment */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
          Overall Risk Assessment
        </Typography>
        <Box sx={sectionStyles.sectionContainer}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Chip
              label={strategyData.risk_assessment.overall_risk_level || 'Medium'}
              size="medium"
              icon={<SecurityIcon />}
              sx={getEnhancedChipStyles(getRiskLevelColor(strategyData.risk_assessment.overall_risk_level || 'Medium')).chip}
            />
          </Box>
          <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
            {strategyData.risk_assessment.risks?.length || 0} identified risks with {strategyData.risk_assessment.mitigation_strategies?.length || 0} mitigation strategies
          </Typography>
        </Box>
      </Box>

      {/* Individual Risks */}
      {strategyData.risk_assessment.risks && strategyData.risk_assessment.risks.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Individual Risks ({strategyData.risk_assessment.risks.length})
          </Typography>
          
          {strategyData.risk_assessment.risks.map((risk: any, index: number) => (
            <Accordion key={index} defaultExpanded={false} sx={accordionStyles.accordion}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={accordionStyles.expandIcon} />}
                sx={accordionStyles.accordionSummary}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Box sx={{ mr: 1.5 }}>
                    <ErrorIcon sx={{ color: ANALYSIS_CARD_STYLES.colors.error, fontSize: 20 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={accordionStyles.accordionTitle}>
                      {typeof risk === 'string' ? risk : risk.risk || 'Risk'}
                    </Typography>
                    <Typography variant="caption" sx={accordionStyles.accordionSubtitle}>
                      {typeof risk === 'object' && risk.probability ? `${risk.probability} probability, ${risk.impact} impact` : 'Risk assessment'}
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Box sx={sectionStyles.sectionContainer}>
                  {typeof risk === 'object' && (
                    <>
                      {/* Risk Details */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontSize: '0.875rem', mb: 1 }}>
                          {risk.risk}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          <Chip
                            label={`Probability: ${risk.probability || 'Unknown'}`}
                            size="small"
                            sx={getEnhancedChipStyles(
                              risk.probability === 'High' ? ANALYSIS_CARD_STYLES.colors.error :
                              risk.probability === 'Medium' ? ANALYSIS_CARD_STYLES.colors.warning :
                              ANALYSIS_CARD_STYLES.colors.success
                            ).chip}
                          />
                          <Chip
                            label={`Impact: ${risk.impact || 'Unknown'}`}
                            size="small"
                            sx={getEnhancedChipStyles(
                              risk.impact === 'High' ? ANALYSIS_CARD_STYLES.colors.error :
                              risk.impact === 'Medium' ? ANALYSIS_CARD_STYLES.colors.warning :
                              ANALYSIS_CARD_STYLES.colors.success
                            ).chip}
                          />
                        </Box>
                      </Box>

                      {/* Mitigation Strategy */}
                      {risk.mitigation && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.success, fontWeight: 600, mb: 1 }}>
                            Mitigation Strategy
                          </Typography>
                          <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontSize: '0.875rem' }}>
                            {risk.mitigation}
                          </Typography>
                        </Box>
                      )}

                      {/* Contingency Plan */}
                      {risk.contingency && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.warning, fontWeight: 600, mb: 1 }}>
                            Contingency Plan
                          </Typography>
                          <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontSize: '0.875rem' }}>
                            {risk.contingency}
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                  
                  {typeof risk === 'string' && (
                    <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontSize: '0.875rem' }}>
                      {risk}
                    </Typography>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Mitigation Strategies */}
      {strategyData.risk_assessment.mitigation_strategies && strategyData.risk_assessment.mitigation_strategies.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Mitigation Strategies ({strategyData.risk_assessment.mitigation_strategies.length})
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <List dense>
              {strategyData.risk_assessment.mitigation_strategies.map((strategy: any, index: number) => (
                <ListItem key={index} sx={listItemStyles.listItem}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <CheckCircleIcon sx={{ color: ANALYSIS_CARD_STYLES.colors.success, fontSize: 16 }} />
                  </ListItemIcon>
                                          <ListItemText 
                          primary={safeRenderText(typeof strategy === 'string' ? strategy : strategy.mitigation || strategy.risk || 'Mitigation strategy')}
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

      {/* Risk Categories */}
      {strategyData.risk_assessment.risk_categories && Object.keys(strategyData.risk_assessment.risk_categories).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Risk Categories
          </Typography>
          
          {Object.entries(strategyData.risk_assessment.risk_categories).map(([category, risks]: [string, any]) => {
            // Skip empty arrays or null values
            if (!risks || !Array.isArray(risks) || risks.length === 0) {
              return null;
            }
            
            return (
              <Accordion key={category} defaultExpanded={false} sx={accordionStyles.accordion}>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={accordionStyles.expandIcon} />}
                  sx={accordionStyles.accordionSummary}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Box sx={{ mr: 1.5 }}>
                      <WarningIcon sx={{ color: ANALYSIS_CARD_STYLES.colors.warning, fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={accordionStyles.accordionTitle}>
                        {category.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="caption" sx={accordionStyles.accordionSubtitle}>
                        {risks.length} risks
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Box sx={sectionStyles.sectionContainer}>
                    <List dense>
                      {risks.map((risk: any, index: number) => (
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
                          primary={safeRenderText(typeof risk === 'string' ? risk : risk.risk || 'Risk')}
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
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}

      {/* Monitoring Framework */}
      {strategyData.risk_assessment.monitoring_framework && Object.keys(strategyData.risk_assessment.monitoring_framework).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Monitoring Framework
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            {Object.entries(strategyData.risk_assessment.monitoring_framework).map(([key, value]: [string, any]) => {
              // Skip empty values
              if (!value || (Array.isArray(value) && value.length === 0)) {
                return null;
              }
              
              return (
                <Box key={key} sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.primary, fontWeight: 600, mb: 0.5 }}>
                    {key.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontSize: '0.875rem' }}>
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <ProgressiveCard
      title="Risk Assessment"
      subtitle="Risk analysis and mitigation"
      icon={<SecurityIcon sx={{ color: 'white', fontSize: 20 }} />}
      summary={summaryContent}
      details={detailedContent}
      trigger="hover"
      autoCollapseDelay={3000}
      componentId="risk_assessment"
    />
  );
};

export default RiskAssessmentCard; 