/**
 * Semantic Insights Components for ALwrity Onboarding Step 3
 * React components for displaying AI-powered semantic analysis results.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningIcon from '@mui/icons-material/Warning';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import StarsIcon from '@mui/icons-material/Stars';
import AgentIcon from '@mui/icons-material/Face';

// TypeScript interfaces for semantic insights
export interface ContentPillar {
  pillar_id: string;
  theme: string;
  size: number;
  relevance_score: number;
  key_topics: string[];
  competitor_coverage: number;
  user_coverage: number;
  source_agent?: string; // Added for agent attribution
}

export interface SemanticGap {
  topic: string;
  reason: string;
  competitor_count: number;
  opportunity_score: number;
  suggested_content_ideas: string[];
  source_agent?: string; // Added for agent attribution
}

export interface ThemeAnalysis {
  theme: string;
  relevance_score: number;
  user_content_relevance: number;
  competitor_content_relevance: number;
  content_opportunities: string[];
}

export interface StrategicRecommendation {
  type: 'content_pillars' | 'content_gaps' | 'content_themes' | 'strategic_overview';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_items: string[];
  estimated_impact: 'high' | 'medium' | 'low';
  implementation_difficulty: 'easy' | 'moderate' | 'challenging';
}

export interface SemanticInsights {
  content_pillars: ContentPillar[];
  semantic_gaps: SemanticGap[];
  themes_analysis: ThemeAnalysis[];
  strategic_recommendations: StrategicRecommendation[];
  confidence_scores: {
    pillar_discovery: boolean;
    gap_analysis: boolean;
    theme_analysis: boolean;
  };
  analysis_timestamp: string;
  total_competitors_analyzed: number;
  total_pages_analyzed: number;
}

interface SemanticInsightsDisplayProps {
  insights: SemanticInsights;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export const SemanticInsightsDisplay: React.FC<SemanticInsightsDisplayProps> = ({
  insights,
  isLoading = false,
  onRefresh,
  className
}) => {
  if (isLoading) {
    return (
      <Box className={className}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <PsychologyIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" component="h3">
              AI-Powered Semantic Analysis
            </Typography>
          </Box>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <Typography variant="body2" color="text.secondary">
              Analyzing semantic patterns and competitive landscape...
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  }

  if (!insights || insights.content_pillars.length === 0) {
    return (
      <Box className={className}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <PsychologyIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" component="h3">
              AI-Powered Semantic Analysis
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Semantic insights will appear here after competitor analysis is complete.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box className={className}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center">
            <PsychologyIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" component="h3">
              AI-Powered Semantic Insights
            </Typography>
          </Box>
          {onRefresh && (
            <Tooltip title="Refresh semantic analysis">
              <IconButton onClick={onRefresh} size="small">
                <AssessmentIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Content Pillars Section */}
        <ContentPillarsSection pillars={insights.content_pillars} />

        <Divider sx={{ my: 3 }} />

        {/* Semantic Gaps Section */}
        <SemanticGapsSection gaps={insights.semantic_gaps} />

        <Divider sx={{ my: 3 }} />

        {/* Strategic Recommendations */}
        <StrategicRecommendationsSection recommendations={insights.strategic_recommendations} />

        {/* Analysis Summary */}
        <Box mt={3} pt={2} borderTop="1px solid" borderColor="divider">
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Analysis Summary
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            <Chip 
              icon={<StarsIcon />} 
              label={`${insights.total_competitors_analyzed} competitors analyzed`}
              size="small"
              variant="outlined"
            />
            <Chip 
              icon={<AssessmentIcon />} 
              label={`${insights.total_pages_analyzed} pages processed`}
              size="small"
              variant="outlined"
            />
            <Chip 
              icon={<CheckCircleIcon />} 
              label={`${insights.content_pillars.length} content pillars identified`}
              size="small"
              color="success"
              variant="outlined"
            />
            <Chip 
              icon={<WarningIcon />} 
              label={`${insights.semantic_gaps.length} content gaps found`}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

const ContentPillarsSection: React.FC<{ pillars: ContentPillar[] }> = ({ pillars }) => {
  if (!pillars || pillars.length === 0) return null;

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={2}>
        <TrendingUpIcon color="success" sx={{ mr: 1 }} />
        <Typography variant="h6" component="h4">
          Content Pillars Discovered
        </Typography>
        <Tooltip title="These are your core content themes based on semantic analysis of your website">
          <IconButton size="small" sx={{ ml: 1 }}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={2}>
        {pillars.map((pillar, index) => (
          <Grid item xs={12} md={6} key={pillar.pillar_id}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" component="h5" sx={{ flexGrow: 1 }}>
                    {pillar.theme}
                  </Typography>
                  <Chip 
                    label={`${pillar.size} items`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                </Box>

                <Box mb={1}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Relevance Score: {Math.round(pillar.relevance_score * 100)}%
                  </Typography>
                </Box>

                {pillar.key_topics && pillar.key_topics.length > 0 && (
                  <Box mb={1}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Key Topics:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {pillar.key_topics.slice(0, 3).map((topic, idx) => (
                        <Chip key={idx} label={topic} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                )}

                <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                  <Typography variant="caption" color="text.secondary">
                    Your Coverage: {Math.round(pillar.user_coverage * 100)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Competitor Coverage: {Math.round(pillar.competitor_coverage * 100)}%
                  </Typography>
                </Box>
                
                {pillar.source_agent && (
                  <Box mt={2} pt={1} borderTop="1px solid #eee" display="flex" alignItems="center" gap={1}>
                    <AgentIcon fontSize="small" color="action" sx={{ width: 16, height: 16 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Identified by {pillar.source_agent}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

const SemanticGapsSection: React.FC<{ gaps: SemanticGap[] }> = ({ gaps }) => {
  if (!gaps || gaps.length === 0) return null;

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={2}>
        <WarningIcon color="warning" sx={{ mr: 1 }} />
        <Typography variant="h6" component="h4">
          Content Gaps Identified
        </Typography>
        <Tooltip title="Topics your competitors cover that you haven't addressed yet">
          <IconButton size="small" sx={{ ml: 1 }}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {gaps.map((gap, index) => (
        <Accordion key={index} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" width="100%">
              <PriorityHighIcon color="warning" sx={{ mr: 1 }} />
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                {gap.topic}
              </Typography>
              <Chip 
                label={`${gap.competitor_count} competitors`}
                size="small"
                color="warning"
                variant="outlined"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {gap.reason}
            </Typography>
            
            {gap.suggested_content_ideas && gap.suggested_content_ideas.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Suggested Content Ideas:
                </Typography>
                <List dense>
                  {gap.suggested_content_ideas.map((idea, idx) => (
                    <ListItem key={idx}>
                      <ListItemIcon>
                        <LightbulbIcon fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={idea} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Opportunity Score: {Math.round(gap.opportunity_score * 100)}%
              </Typography>
              
              {gap.source_agent && (
                <Box display="flex" alignItems="center" gap={1}>
                  <AgentIcon fontSize="small" color="action" sx={{ width: 16, height: 16 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Spotted by {gap.source_agent}
                  </Typography>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

const StrategicRecommendationsSection: React.FC<{ recommendations: StrategicRecommendation[] }> = ({ recommendations }) => {
  if (!recommendations || recommendations.length === 0) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return <TrendingUpIcon color="error" />;
      case 'medium': return <TrendingUpIcon color="warning" />;
      case 'low': return <TrendingUpIcon color="info" />;
      default: return <TrendingUpIcon />;
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={2}>
        <AssessmentIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6" component="h4">
          Strategic Recommendations
        </Typography>
      </Box>

      {recommendations.map((rec, index) => (
        <Card key={index} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
              {getImpactIcon(rec.estimated_impact)}
              <Typography variant="subtitle1" sx={{ ml: 1, flexGrow: 1 }}>
                {rec.title}
              </Typography>
              <Chip 
                label={rec.priority.toUpperCase()}
                size="small"
                color={getPriorityColor(rec.priority)}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              {rec.description}
            </Typography>

            {rec.action_items && rec.action_items.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Action Items:
                </Typography>
                <List dense>
                  {rec.action_items.map((item, idx) => (
                    <ListItem key={idx}>
                      <ListItemIcon>
                        <CheckCircleIcon fontSize="small" color="success" />
                      </ListItemIcon>
                      <ListItemText primary={item} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Box display="flex" gap={1} mt={2}>
              <Chip 
                label={`Impact: ${rec.estimated_impact}`}
                size="small"
                variant="outlined"
              />
              <Chip 
                label={`Difficulty: ${rec.implementation_difficulty}`}
                size="small"
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

interface SemanticInsightsProps {
  maxInsights?: number;
}

const SemanticInsights: React.FC<SemanticInsightsProps> = ({ maxInsights }) => {
  // Mock data or state management here
  // For now, returning null or a placeholder if no data, or using the Display component with empty data
  
  // TODO: Connect to real API and map data
  const mockInsights: SemanticInsights = {
    content_pillars: [],
    semantic_gaps: [],
    themes_analysis: [],
    strategic_recommendations: [],
    confidence_scores: {
      pillar_discovery: false,
      gap_analysis: false,
      theme_analysis: false
    },
    analysis_timestamp: new Date().toISOString(),
    total_competitors_analyzed: 0,
    total_pages_analyzed: 0
  };

  return <SemanticInsightsDisplay insights={mockInsights} isLoading={false} />;
};

export default SemanticInsights;
