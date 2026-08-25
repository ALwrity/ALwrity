/**
 * Actionable Insights & Recommendations Display Component
 * Shows AI-powered, traffic-focused insights with implementation steps
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Button,
  Stack,
  Grid,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Badge,
  Tooltip,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FlagIcon from '@mui/icons-material/Flag';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import ShareIcon from '@mui/icons-material/Share';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionableInsight, TrafficImprovementStrategy } from '../../../api/llmInsightsGenerator';

interface ActionableInsightsDisplayProps {
  insights: ActionableInsight[];
  strategies?: TrafficImprovementStrategy[];
  onSaveInsight?: (insight: ActionableInsight) => void;
  onShareInsight?: (insight: ActionableInsight) => void;
  loading?: boolean;
  empty?: boolean;
}

const getEffortColor = (effort: 'easy' | 'medium' | 'complex'): string => {
  const colors: Record<string, string> = {
    easy: '#4caf50',
    medium: '#ff9800',
    complex: '#f44336',
  };
  return colors[effort];
};

const getEffortLabel = (effort: 'easy' | 'medium' | 'complex'): string => {
  const labels: Record<string, string> = {
    easy: 'Easy',
    medium: 'Medium',
    complex: 'Complex',
  };
  return labels[effort];
};

const getImpactColor = (impact: 'high' | 'medium' | 'low'): string => {
  const colors: Record<string, string> = {
    high: '#d32f2f',
    medium: '#f57c00',
    low: '#388e3c',
  };
  return colors[impact];
};

export const ActionableInsightsDisplay: React.FC<ActionableInsightsDisplayProps> = ({
  insights,
  strategies,
  onSaveInsight,
  onShareInsight,
  loading = false,
  empty = false,
}) => {
  const [savedInsights, setSavedInsights] = useState<Set<string>>(new Set());
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [filterImpact, setFilterImpact] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [filterEffort, setFilterEffort] = useState<'all' | 'easy' | 'medium' | 'complex'>('all');

  const handleSaveInsight = (insight: ActionableInsight) => {
    const id = `${insight.title}-${insight.priority}`;
    setSavedInsights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    onSaveInsight?.(insight);
  };

  const handleShareInsight = (insight: ActionableInsight) => {
    const text = `🎯 ${insight.title}\n\n📊 Impact: ${insight.impact}\n⚙️ Effort: ${insight.effort}\n⏱️ Time: ${insight.timeToImplement}\n\n💡 ${insight.description}`;
    if (navigator.share) {
      navigator.share({
        title: 'SEO Insight',
        text,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(text);
    }
    onShareInsight?.(insight);
  };

  const filteredInsights = insights.filter(insight => {
    if (filterImpact !== 'all' && insight.impact !== filterImpact) return false;
    if (filterEffort !== 'all' && insight.effort !== filterEffort) return false;
    return true;
  });

  // Sort by priority (highest first)
  const sortedInsights = [...filteredInsights].sort((a, b) => b.priority - a.priority);

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="textSecondary">
          Generating insights...
        </Typography>
      </Box>
    );
  }

  if (empty || insights.length === 0) {
    return (
      <Alert severity="info">
        No insights generated yet. Run an audit or analysis to get personalized recommendations.
      </Alert>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <LightbulbIcon sx={{ fontSize: 32, color: '#fbc02d' }} />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Actionable Insights & Recommendations
            </Typography>
            <Badge
              badgeContent={filteredInsights.length}
              color="primary"
              sx={{ ml: 'auto' }}
            />
          </Box>
          <Typography variant="body2" color="textSecondary">
            {sortedInsights.length} prioritized recommendations to improve your organic traffic
          </Typography>
        </Box>

        {/* Traffic Impact Summary */}
        <Card sx={{ mb: 4, bgcolor: 'success.lighter', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                    Estimated Total Traffic Gain
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 600 }}>
                    +{sortedInsights.reduce((sum, i) => sum + i.estimatedTrafficGain, 0).toLocaleString()} visits/month
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                    Quick Wins Available
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 600 }}>
                    {sortedInsights.filter(i => i.effort === 'easy').length} easy implementations
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Filter by:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label="All"
              size="small"
              variant={filterImpact === 'all' && filterEffort === 'all' ? 'filled' : 'outlined'}
              onClick={() => {
                setFilterImpact('all');
                setFilterEffort('all');
              }}
            />
            <Chip
              label="High Impact"
              size="small"
              variant={filterImpact === 'high' ? 'filled' : 'outlined'}
              color={filterImpact === 'high' ? 'error' : 'default'}
              onClick={() => setFilterImpact('high')}
            />
            <Chip
              label="Easy to Implement"
              size="small"
              variant={filterEffort === 'easy' ? 'filled' : 'outlined'}
              color={filterEffort === 'easy' ? 'success' : 'default'}
              onClick={() => setFilterEffort('easy')}
            />
            <Chip
              label="Quick Wins"
              size="small"
              variant={filterImpact === 'high' && filterEffort === 'easy' ? 'filled' : 'outlined'}
              color={filterImpact === 'high' && filterEffort === 'easy' ? 'primary' : 'default'}
              onClick={() => {
                setFilterImpact('high');
                setFilterEffort('easy');
              }}
            />
          </Box>
        </Box>

        {/* Insights Grid */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <AnimatePresence>
            {sortedInsights.map((insight, idx) => {
              const insightId = `${insight.title}-${insight.priority}`;
              const isSaved = savedInsights.has(insightId);
              const effortScore = (insight.effort === 'easy' ? 30 : insight.effort === 'medium' ? 60 : 90);
              const impactScore = insight.priority * 10; // priority is 1-10

              return (
                <Grid item xs={12} md={6} key={idx}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        border: `2px solid ${getImpactColor(insight.impact)}`,
                        bgcolor: insight.impact === 'high' ? 'error.lighter' : 'background.paper',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          boxShadow: 3,
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <CardContent sx={{ flexGrow: 1 }}>
                        {/* Header */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {insight.title}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {insight.description}
                            </Typography>
                          </Box>
                          <Tooltip title={isSaved ? 'Remove bookmark' : 'Save insight'}>
                            <IconButton
                              size="small"
                              onClick={() => handleSaveInsight(insight)}
                              sx={{
                                color: isSaved ? '#fbc02d' : 'action.disabled',
                              }}
                            >
                              <BookmarkAddIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {/* Metrics */}
                        <Grid container spacing={1} sx={{ mb: 2 }}>
                          <Grid item xs={6}>
                            <Box>
                              <Typography variant="caption" color="textSecondary">
                                Impact
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <TrendingUpIcon
                                  sx={{
                                    fontSize: 16,
                                    color: getImpactColor(insight.impact),
                                  }}
                                />
                                <Chip
                                  label={insight.impact.toUpperCase()}
                                  size="small"
                                  sx={{
                                    bgcolor: getImpactColor(insight.impact),
                                    color: 'white',
                                  }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box>
                              <Typography variant="caption" color="textSecondary">
                                Effort
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <Chip
                                  label={getEffortLabel(insight.effort)}
                                  size="small"
                                  sx={{
                                    bgcolor: getEffortColor(insight.effort),
                                    color: 'white',
                                  }}
                                />
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Traffic Gain */}
                        <Box sx={{ mb: 2, p: 1.5, bgcolor: 'success.lighter', borderRadius: 1 }}>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Estimated Monthly Traffic Gain
                          </Typography>
                          <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 600 }}>
                            +{insight.estimatedTrafficGain.toLocaleString()} visits/month
                          </Typography>
                        </Box>

                        {/* Time to Implement */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <ScheduleIcon sx={{ fontSize: 18, color: 'action.disabled' }} />
                          <Typography variant="body2">
                            <strong>Implementation:</strong> {insight.timeToImplement}
                          </Typography>
                        </Box>

                        {/* Implementation Steps (Expandable) */}
                        <Accordion
                          onChange={() =>
                            setExpandedInsight(
                              expandedInsight === insightId ? null : insightId
                            )
                          }
                          sx={{
                            boxShadow: 'none',
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'transparent',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <FlagIcon sx={{ mr: 1, fontSize: 18 }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Implementation Steps
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <List sx={{ py: 0 }}>
                              {insight.steps.map((step: string, stepIdx: number) => (
                                <ListItem key={stepIdx} sx={{ py: 1, px: 0 }}>
                                  <ListItemIcon sx={{ minWidth: 32 }}>
                                    <CheckCircleIcon
                                      sx={{ fontSize: 18, color: '#4caf50' }}
                                    />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={step}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </AccordionDetails>
                        </Accordion>

                        {/* Tools/Resources */}
                        {insight.tools && insight.tools.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 0.5 }}>
                              Recommended Tools:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {insight.tools.map((tool: string, toolIdx: number) => (
                                <Chip key={toolIdx} label={tool} size="small" variant="outlined" />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {/* Priority Badge */}
                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="textSecondary">
                            Priority Score:
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(insight.priority * 10, 100)}
                            sx={{ flex: 1 }}
                          />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {insight.priority}/10
                          </Typography>
                        </Box>
                      </CardContent>

                      <Divider />

                      <CardActions>
                        <Button
                          size="small"
                          startIcon={<ShareIcon />}
                          onClick={() => handleShareInsight(insight)}
                        >
                          Share
                        </Button>
                        <Button
                          size="small"
                          startIcon={<OpenInNewIcon />}
                          href="#"
                          target="_blank"
                        >
                          Learn More
                        </Button>
                      </CardActions>
                    </Card>
                  </motion.div>
                </Grid>
              );
            })}
          </AnimatePresence>
        </Grid>

        {/* Traffic Improvement Strategies */}
        {strategies && strategies.length > 0 && (
          <Box sx={{ mt: 6 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              🚀 Traffic Improvement Strategies
            </Typography>

            <Grid container spacing={2}>
              {strategies.map((strategy, idx) => (
                <Grid item xs={12} md={6} key={idx}>
                  <Card
                    sx={{
                      border: `2px solid ${strategy.phase === 'quick_wins' ? '#4caf50' : strategy.phase === 'medium_term' ? '#2196f3' : '#ff9800'}`,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        {strategy.phase === 'quick_wins' && <FlagIcon sx={{ color: '#4caf50' }} />}
                        {strategy.phase === 'medium_term' && <ScheduleIcon sx={{ color: '#2196f3' }} />}
                        {strategy.phase === 'long_term' && <TrendingUpIcon sx={{ color: '#ff9800' }} />}
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {strategy.title}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {strategy.description}
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 0.5 }}>
                          Key Actions:
                        </Typography>
                        <Stack spacing={0.5}>
                          {strategy.keyActions.map((action: string, actionIdx: number) => (
                            <Box key={actionIdx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <ArrowRightIcon sx={{ fontSize: 16, mt: 0.3, flexShrink: 0 }} />
                              <Typography variant="body2">{action}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                      <Box sx={{ mt: 2, p: 1, bgcolor: 'primary.lighter', borderRadius: 1 }}>
                        <Typography variant="caption" color="textSecondary" display="block">
                          Timeframe: {strategy.timeframe}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Expected ROI: {strategy.expectedROI}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>
    </motion.div>
  );
};

export default ActionableInsightsDisplay;
