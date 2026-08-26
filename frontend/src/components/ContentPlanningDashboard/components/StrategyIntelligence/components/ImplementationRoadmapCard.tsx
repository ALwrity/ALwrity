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
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { StrategyData } from '../types/strategy.types';
import {
  ANALYSIS_CARD_STYLES,
  getSectionStyles,
  getAccordionStyles,
  getEnhancedChipStyles,
  getListItemStyles
} from '../styles';
import ProgressiveCard from './ProgressiveCard';
// import { safeRenderText, safeRenderArray, hasValidData, getFallbackValue } from '../utils/defensiveRendering';

interface ImplementationRoadmapCardProps {
  strategyData: StrategyData | null;
}

const ImplementationRoadmapCard: React.FC<ImplementationRoadmapCardProps> = ({ strategyData }) => {
  // Get style objects
  const sectionStyles = getSectionStyles();
  const accordionStyles = getAccordionStyles();
  const listItemStyles = getListItemStyles();

  // Helper function to format budget allocation
  const formatBudgetAllocation = (budgetAllocation: any): string => {
    if (typeof budgetAllocation === 'string') return budgetAllocation;
    if (typeof budgetAllocation === 'object' && budgetAllocation !== null) {
      return Object.entries(budgetAllocation)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    return 'Budget allocation not specified';
  };

  // Helper function to safely render text content
  const safeRenderText = (content: any): string => {
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      return JSON.stringify(content);
    }
    return 'Data not available';
  };

  if (!strategyData?.implementation_roadmap) {
    return (
      <ProgressiveCard
        title="Implementation Roadmap"
        subtitle="Strategic execution plan"
        icon={<TimelineIcon sx={{ color: 'white', fontSize: 20 }} />}
        summary={
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body1" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
              Implementation roadmap data not available
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
      {/* Project Overview */}
      <Box sx={sectionStyles.sectionContainer}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
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
              fontWeight: 600,
              boxShadow: `0 4px 12px ${ANALYSIS_CARD_STYLES.colors.info}30`,
              flexShrink: 0
            }}>
              {strategyData.implementation_roadmap.timeline}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontWeight: 600 }}>
                Implementation Roadmap
              </Typography>
              <Typography variant="caption" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
                {strategyData.implementation_roadmap.timeline} implementation timeline
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label={`${strategyData.implementation_roadmap.phases?.length || 0} Phases`}
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
            />
            <Chip 
              label={`${strategyData.implementation_roadmap.milestones?.length || 0} Milestones`}
              size="small"
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip}
            />
          </Box>
        </Box>
      </Box>

      {/* Timeline Preview */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 1, fontWeight: 600 }}>
          Project Timeline
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`Duration: ${strategyData.implementation_roadmap.timeline}`}
            size="small"
            icon={<TimelineIcon />}
            sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip}
          />
          {strategyData.implementation_roadmap.phases && strategyData.implementation_roadmap.phases.length > 0 && (
            <Chip
              label={`${strategyData.implementation_roadmap.phases.length} Phases`}
              size="small"
              icon={<TimelineIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.info).chip}
            />
          )}
          {strategyData.implementation_roadmap.milestones && strategyData.implementation_roadmap.milestones.length > 0 && (
            <Chip
              label={`${strategyData.implementation_roadmap.milestones.length} Milestones`}
              size="small"
              icon={<CheckCircleIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.success).chip}
            />
          )}
          {strategyData.implementation_roadmap.resource_requirements && strategyData.implementation_roadmap.resource_requirements.length > 0 && (
            <Chip
              label={`${strategyData.implementation_roadmap.resource_requirements.length} Resources`}
              size="small"
              icon={<GroupIcon />}
              sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.warning).chip}
            />
          )}
        </Box>
      </Box>
    </Box>
  );

  // Detailed content - shown on expansion
  const detailedContent = (
    <Box>
      {/* Project Timeline */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
          Project Timeline
        </Typography>
        <Box sx={sectionStyles.sectionContainer}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary }}>
              Duration: {strategyData.implementation_roadmap.timeline}
            </Typography>
          </Box>
          {strategyData.implementation_roadmap.timeline && (
            <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary, mb: 1 }}>
              Timeline: {strategyData.implementation_roadmap.timeline}
            </Typography>
          )}
          {strategyData.implementation_roadmap.timeline_object?.start_date && (
            <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary, mb: 1 }}>
              Start Date: {strategyData.implementation_roadmap.timeline_object.start_date}
            </Typography>
          )}
          {strategyData.implementation_roadmap.timeline_object?.end_date && (
            <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.secondary, mb: 1 }}>
              End Date: {strategyData.implementation_roadmap.timeline_object.end_date}
            </Typography>
          )}
          {strategyData.implementation_roadmap.timeline_object?.key_milestones && strategyData.implementation_roadmap.timeline_object.key_milestones.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontWeight: 600, mb: 1 }}>
                Key Milestones:
              </Typography>
              <List dense>
                {strategyData.implementation_roadmap.timeline_object.key_milestones.map((milestone: string, index: number) => (
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
                      primary={safeRenderText(milestone)}
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

      {/* Implementation Phases */}
      {strategyData.implementation_roadmap.phases && strategyData.implementation_roadmap.phases.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Implementation Phases ({strategyData.implementation_roadmap.phases.length})
          </Typography>
          
          {strategyData.implementation_roadmap.phases.map((phase: any, index: number) => (
            <Accordion key={index} defaultExpanded={false} sx={accordionStyles.accordion}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={accordionStyles.expandIcon} />}
                sx={accordionStyles.accordionSummary}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Box sx={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%', 
                    background: `linear-gradient(135deg, ${ANALYSIS_CARD_STYLES.colors.primary} 0%, ${ANALYSIS_CARD_STYLES.colors.secondary} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 2,
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: 600
                  }}>
                    {index + 1}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={accordionStyles.accordionTitle}>
                      {phase.phase || `Phase ${index + 1}`}
                    </Typography>
                    <Typography variant="caption" sx={accordionStyles.accordionSubtitle}>
                      {phase.duration} • {phase.tasks?.length || 0} tasks • {phase.milestones?.length || 0} milestones
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Box sx={sectionStyles.sectionContainer}>
                  {/* Phase Description */}
                  {phase.description && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontSize: '0.875rem' }}>
                        {phase.description}
                      </Typography>
                    </Box>
                  )}

                  {/* Tasks */}
                  {phase.tasks && phase.tasks.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.primary, fontWeight: 600, mb: 1 }}>
                        Tasks ({phase.tasks.length})
                      </Typography>
                      <List dense>
                        {phase.tasks.map((task: string, taskIndex: number) => (
                          <ListItem key={taskIndex} sx={listItemStyles.listItem}>
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
                    primary={safeRenderText(task)}
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

                  {/* Milestones */}
                  {phase.milestones && phase.milestones.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.success, fontWeight: 600, mb: 1 }}>
                        Milestones ({phase.milestones.length})
                      </Typography>
                      <List dense>
                        {phase.milestones.map((milestone: string, milestoneIndex: number) => (
                          <ListItem key={milestoneIndex} sx={listItemStyles.listItem}>
                            <ListItemIcon sx={listItemStyles.listItemIcon}>
                              <CheckCircleIcon sx={{ color: ANALYSIS_CARD_STYLES.colors.success, fontSize: 16 }} />
                            </ListItemIcon>
                            <ListItemText 
                              primary={safeRenderText(milestone)}
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

                  {/* Resources */}
                  {phase.resources && phase.resources.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.warning, fontWeight: 600, mb: 1 }}>
                        Resources ({phase.resources.length})
                      </Typography>
                      <List dense>
                        {phase.resources.map((resource: string, resourceIndex: number) => (
                          <ListItem key={resourceIndex} sx={listItemStyles.listItem}>
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
                              primary={safeRenderText(resource)}
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
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Milestones */}
      {strategyData.implementation_roadmap.milestones && strategyData.implementation_roadmap.milestones.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Project Milestones ({strategyData.implementation_roadmap.milestones.length})
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <List dense>
              {strategyData.implementation_roadmap.milestones.map((milestone: string, index: number) => (
                <ListItem key={index} sx={listItemStyles.listItem}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <CheckCircleIcon sx={{ color: ANALYSIS_CARD_STYLES.colors.success, fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={safeRenderText(milestone)}
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

      {/* Resource Requirements */}
      {strategyData.implementation_roadmap.resource_requirements && strategyData.implementation_roadmap.resource_requirements.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Resource Requirements ({strategyData.implementation_roadmap.resource_requirements.length})
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <List dense>
              {strategyData.implementation_roadmap.resource_requirements.map((requirement: string, index: number) => (
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
                    primary={safeRenderText(requirement)}
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

      {/* Critical Path */}
      {strategyData.implementation_roadmap.critical_path && strategyData.implementation_roadmap.critical_path.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Critical Path ({strategyData.implementation_roadmap.critical_path.length})
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <List dense>
              {strategyData.implementation_roadmap.critical_path.map((path: string, index: number) => (
                <ListItem key={index} sx={listItemStyles.listItem}>
                  <ListItemIcon sx={listItemStyles.listItemIcon}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: ANALYSIS_CARD_STYLES.colors.error,
                      opacity: 0.7
                    }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={safeRenderText(path)}
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

      {/* Resource Allocation */}
      {strategyData.implementation_roadmap.resource_allocation && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Resource Allocation
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            {/* Team Members */}
            {strategyData.implementation_roadmap.resource_allocation.team_members && strategyData.implementation_roadmap.resource_allocation.team_members.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.primary, fontWeight: 600, mb: 1 }}>
                  Team Members ({strategyData.implementation_roadmap.resource_allocation.team_members.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {strategyData.implementation_roadmap.resource_allocation.team_members.map((member: string, index: number) => (
                    <Chip
                      key={index}
                      label={member}
                      size="small"
                      icon={<GroupIcon />}
                      sx={getEnhancedChipStyles(ANALYSIS_CARD_STYLES.colors.primary).chip}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Budget Allocation */}
            {strategyData.implementation_roadmap.resource_allocation.budget_allocation && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.success, fontWeight: 600, mb: 1 }}>
                  Budget Allocation
                </Typography>
                <Typography variant="body2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, fontSize: '0.875rem' }}>
                  {formatBudgetAllocation(strategyData.implementation_roadmap.resource_allocation.budget_allocation)}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Success Metrics */}
      {strategyData.implementation_roadmap.success_metrics && strategyData.implementation_roadmap.success_metrics.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: ANALYSIS_CARD_STYLES.colors.text.primary, mb: 2, fontWeight: 600 }}>
            Success Metrics ({strategyData.implementation_roadmap.success_metrics.length})
          </Typography>
          <Box sx={sectionStyles.sectionContainer}>
            <List dense>
              {strategyData.implementation_roadmap.success_metrics.map((metric: string, index: number) => (
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
                    primary={safeRenderText(metric)}
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
      title="Implementation Roadmap"
      subtitle="Project timeline and phases"
      icon={<TimelineIcon sx={{ color: 'white', fontSize: 20 }} />}
      summary={summaryContent}
      details={detailedContent}
      trigger="hover"
      autoCollapseDelay={3000}
      componentId="implementation_roadmap"
    />
  );
};

export default ImplementationRoadmapCard; 