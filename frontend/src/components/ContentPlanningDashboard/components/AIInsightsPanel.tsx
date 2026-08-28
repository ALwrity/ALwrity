import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { motion, AnimatePresence } from 'framer-motion';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';
import { contentPlanningApi } from '../../../services/contentPlanningApi';

const AIInsightsPanel: React.FC = () => {
  const { 
    aiInsights, 
    aiRecommendations, 
    loading, 
    error,
    loadAIInsights,
    loadAIRecommendations
  } = useContentPlanningStore();
  
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    loadAIData();
  }, []);

  const loadAIData = async () => {
    try {
      setDataLoading(true);
      
      // Load AI insights and recommendations
      await Promise.all([
        loadAIInsights(),
        loadAIRecommendations()
      ]);
    } catch (error) {
      console.error('Error loading AI data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadAIData();
  };

  const handleForceRefresh = async () => {
    try {
      setDataLoading(true);
      
      // Force refresh AI insights and recommendations
      await Promise.all([
        contentPlanningApi.getAIAnalyticsWithRefresh(undefined, true), // Force refresh
        contentPlanningApi.getGapAnalysesWithRefresh(undefined, true) // Force refresh
      ]);
      
      // Reload data from store
      await Promise.all([
        loadAIInsights(),
        loadAIRecommendations()
      ]);
    } catch (error) {
      console.error('Error force refreshing AI data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const toggleInsightExpansion = (insightId: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightId)) {
      newExpanded.delete(insightId);
    } else {
      newExpanded.add(insightId);
    }
    setExpandedInsights(newExpanded);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <TrendingUpIcon color="success" />;
      case 'opportunity':
        return <LightbulbIcon color="primary" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'trend':
        return <AssessmentIcon color="info" />;
      default:
        return <CheckCircleIcon color="success" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'performance':
        return 'success';
      case 'opportunity':
        return 'primary';
      case 'warning':
        return 'warning';
      case 'trend':
        return 'info';
      default:
        return 'default';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3
      }
    }
  };

  const cardVariants = {
    initial: { scale: 1 },
    hover: { 
      scale: 1.02,
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.98 }
  };

  return (
    <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <LightbulbIcon sx={{ mr: 1 }} />
          AI Insights
        </Typography>
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <IconButton 
            onClick={handleRefresh} 
            disabled={dataLoading}
            size="small"
          >
            <RefreshIcon />
          </IconButton>
        </motion.div>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {dataLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* AI Insights */}
          {aiInsights && aiInsights.length > 0 && (
            <motion.div variants={itemVariants}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Recent Insights ({aiInsights.length})
                </Typography>
                
                <AnimatePresence>
                  {aiInsights.map((insight, index) => (
                    <motion.div
                      key={insight.id}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      custom={index}
                    >
                      <motion.div
                        variants={cardVariants}
                        initial="initial"
                        whileHover="hover"
                        whileTap="tap"
                      >
                        <Card 
                          sx={{ 
                            mb: 2, 
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              boxShadow: 3,
                              borderColor: 'primary.main'
                            }
                          }} 
                          onClick={() => toggleInsightExpansion(insight.id)}
                        >
                          <CardContent sx={{ py: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                  {getInsightIcon(insight.type)}
                                </ListItemIcon>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    {insight.title}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <Chip 
                                      label={insight.type} 
                                      color={getTypeColor(insight.type)}
                                      size="small"
                                    />
                                    <Chip 
                                      label={insight.priority} 
                                      color={getPriorityColor(insight.priority)}
                                      size="small"
                                    />
                                  </Box>
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(insight.created_at).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              </Box>
                              <motion.div
                                animate={{ rotate: expandedInsights.has(insight.id) ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <IconButton size="small">
                                  <ExpandMoreIcon />
                                </IconButton>
                              </motion.div>
                            </Box>
                            
                            <AnimatePresence>
                              {expandedInsights.has(insight.id) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <Divider sx={{ my: 1 }} />
                                  <Typography variant="body2" color="text.secondary">
                                    {insight.description}
                                  </Typography>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Box>
            </motion.div>
          )}

          {/* AI Recommendations */}
          {aiRecommendations && aiRecommendations.length > 0 && (
            <motion.div variants={itemVariants}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  AI Recommendations ({aiRecommendations.length})
                </Typography>
                
                <AnimatePresence>
                  {aiRecommendations.map((recommendation, index) => (
                    <motion.div
                      key={recommendation.id}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      custom={index}
                    >
                      <motion.div
                        variants={cardVariants}
                        initial="initial"
                        whileHover="hover"
                        whileTap="tap"
                      >
                        <Card 
                          sx={{ 
                            mb: 2, 
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              boxShadow: 3,
                              borderColor: 'primary.main'
                            }
                          }} 
                          onClick={() => toggleInsightExpansion(recommendation.id)}
                        >
                          <CardContent sx={{ py: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                  <AssessmentIcon color="primary" />
                                </ListItemIcon>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    {recommendation.title}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                    <Chip 
                                      label={recommendation.type} 
                                      color="primary"
                                      size="small"
                                    />
                                    <Chip 
                                      label={`${(recommendation.confidence * 100).toFixed(0)}% confidence`} 
                                      color="success"
                                      size="small"
                                    />
                                  </Box>
                                  <Typography variant="caption" color="text.secondary">
                                    Status: {recommendation.status}
                                  </Typography>
                                </Box>
                              </Box>
                              <motion.div
                                animate={{ rotate: expandedInsights.has(recommendation.id) ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <IconButton size="small">
                                  <ExpandMoreIcon />
                                </IconButton>
                              </motion.div>
                            </Box>
                            
                            <AnimatePresence>
                              {expandedInsights.has(recommendation.id) && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <Divider sx={{ my: 1 }} />
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {recommendation.description}
                                  </Typography>
                                  
                                  {recommendation.reasoning && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                      <strong>Reasoning:</strong> {recommendation.reasoning}
                                    </Typography>
                                  )}
                                  
                                  {recommendation.action_items && recommendation.action_items.length > 0 && (
                                    <Box>
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        <strong>Action Items:</strong>
                                      </Typography>
                                      <List dense>
                                        {recommendation.action_items.map((action, actionIndex) => (
                                          <motion.div
                                            key={actionIndex}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: actionIndex * 0.1 }}
                                          >
                                            <ListItem sx={{ py: 0 }}>
                                              <ListItemIcon sx={{ minWidth: 30 }}>
                                                <CheckCircleIcon color="success" fontSize="small" />
                                              </ListItemIcon>
                                              <ListItemText 
                                                primary={action}
                                                primaryTypographyProps={{ variant: 'body2' }}
                                              />
                                            </ListItem>
                                          </motion.div>
                                        ))}
                                      </List>
                                    </Box>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Box>
            </motion.div>
          )}

          {/* No Data State */}
          {(!aiInsights || aiInsights.length === 0) && (!aiRecommendations || aiRecommendations.length === 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  <LightbulbIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                </motion.div>
                <Typography variant="body2" color="text.secondary">
                  No AI insights available yet.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Run content analysis to generate insights.
                </Typography>
              </Box>
            </motion.div>
          )}
        </motion.div>
      )}
    </Box>
  );
};

export default AIInsightsPanel; 