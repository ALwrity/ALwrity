import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TimelineIcon from '@mui/icons-material/Timeline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { motion } from 'framer-motion';
import { EducationalModalProps } from '../types/contentStrategy.types';

const EducationalModal: React.FC<EducationalModalProps> = ({
  open,
  onClose,
  educationalContent,
  generationProgress,
  onReviewStrategy
}) => {
  // Note: Removed debug logging to prevent infinite re-renders
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(102, 126, 234, 0.1)',
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none'
        }
      }}>
        <Box display="flex" alignItems="center" gap={2} sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ 
            p: 1, 
            borderRadius: 2, 
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <SchoolIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              {educationalContent?.title || 'AI Strategy Generation'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
              Creating your comprehensive content strategy
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 4 }}>
        {educationalContent ? (
          <Box>
            {/* Enhanced Progress Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Box sx={{ mb: 4 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea', mb: 0.5 }}>
                      Progress: {generationProgress}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Step {Math.ceil(generationProgress / 10)} of 8 • {Math.ceil((100 - generationProgress) / 10)} steps remaining
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#667eea' }}>
                      {generationProgress}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Complete
                    </Typography>
                  </Box>
                </Box>
                
                {/* Enhanced Progress Bar with Glitch Effect */}
                <Box sx={{ position: 'relative', mb: 1 }}>
                  <Box sx={{ 
                    height: 12, 
                    borderRadius: 6, 
                    background: 'linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 100%)',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                    position: 'relative'
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${generationProgress}%` }}
                      transition={{ 
                        duration: 0.8, 
                        ease: "easeOut",
                        delay: 0.2
                      }}
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 50%, #667eea 100%)',
                        borderRadius: 6,
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Glitch Effect Overlay */}
                      <motion.div
                        animate={{
                          x: [0, -2, 2, 0],
                          opacity: [0.8, 1, 0.8]
                        }}
                        transition={{
                          duration: 0.1,
                          repeat: Infinity,
                          repeatType: "reverse"
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                          borderRadius: 6
                        }}
                      />
                      
                      {/* Shimmer Effect */}
                      <motion.div
                        animate={{
                          x: ['-100%', '100%']
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                          borderRadius: 6
                        }}
                      />
                    </motion.div>
                  </Box>
                  
                  {/* Progress Markers */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    mt: 1,
                    px: 1
                  }}>
                    {[0, 25, 50, 75, 100].map((marker) => (
                      <Box key={marker} sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%',
                        background: generationProgress >= marker ? '#667eea' : '#e0e0e0',
                        boxShadow: generationProgress >= marker ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none',
                        transition: 'all 0.3s ease'
                      }} />
                    ))}
                  </Box>
                </Box>
              </Box>
            </motion.div>

            {/* Enhanced Educational Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Grid container spacing={3}>
                {/* Main Content */}
                <Grid item xs={12} lg={8}>
                  {educationalContent.description && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom sx={{ 
                        fontWeight: 600, 
                        color: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <LightbulbIcon sx={{ fontSize: 20 }} />
                        What's Happening
                      </Typography>
                      <Typography variant="body1" sx={{ 
                        lineHeight: 1.7, 
                        color: 'text.primary',
                        fontWeight: 500
                      }}>
                        {educationalContent.description}
                      </Typography>
                    </Box>
                  )}

                  {educationalContent.details && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom sx={{ 
                        fontWeight: 600, 
                        color: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <TimelineIcon sx={{ fontSize: 20 }} />
                        Current Activities
                      </Typography>
                      <Box sx={{ 
                        background: 'rgba(102, 126, 234, 0.05)', 
                        borderRadius: 3, 
                        p: 2,
                        border: '1px solid rgba(102, 126, 234, 0.1)'
                      }}>
                        <List dense sx={{ py: 0 }}>
                          {educationalContent.details.map((detail: string, index: number) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.5, delay: 0.1 * index }}
                            >
                              <ListItem sx={{ py: 1, px: 0 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <Box sx={{ 
                                    p: 0.5, 
                                    borderRadius: 1, 
                                    background: 'rgba(102, 126, 234, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    <FiberManualRecordIcon sx={{ 
                                      fontSize: 8, 
                                      color: '#667eea' 
                                    }} />
                                  </Box>
                                </ListItemIcon>
                                <ListItemText 
                                  primary={detail} 
                                  primaryTypographyProps={{ 
                                    variant: 'body2', 
                                    sx: { 
                                      fontWeight: 500, 
                                      lineHeight: 1.5,
                                      color: 'text.primary'
                                    } 
                                  }}
                                />
                              </ListItem>
                            </motion.div>
                          ))}
                        </List>
                      </Box>
                    </Box>
                  )}

                  {educationalContent.ai_prompt_preview && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom sx={{ 
                        fontWeight: 600, 
                        color: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <AutoAwesomeIcon sx={{ fontSize: 20 }} />
                        AI Processing
                      </Typography>
                      <Box sx={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: 3, 
                        p: 2.5,
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <Box sx={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
                          pointerEvents: 'none'
                        }} />
                        <Typography variant="body2" sx={{ 
                          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                          fontSize: '0.875rem',
                          lineHeight: 1.6,
                          position: 'relative',
                          zIndex: 1
                        }}>
                          {educationalContent.ai_prompt_preview}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Grid>

                {/* Sidebar with Insights and Info */}
                <Grid item xs={12} lg={4}>
                  <Box sx={{ 
                    background: 'rgba(102, 126, 234, 0.02)', 
                    borderRadius: 3, 
                    p: 3,
                    border: '1px solid rgba(102, 126, 234, 0.1)',
                    height: 'fit-content'
                  }}>
                    <Typography variant="h6" gutterBottom sx={{ 
                      fontWeight: 600, 
                      color: '#667eea',
                      mb: 2
                    }}>
                      Insights & Information
                    </Typography>

                    {educationalContent.insight && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ 
                          fontWeight: 600, 
                          color: '#4caf50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1
                        }}>
                          <LightbulbIcon sx={{ fontSize: 16 }} />
                          Key Insight
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          lineHeight: 1.6,
                          color: 'text.secondary',
                          fontWeight: 500
                        }}>
                          {educationalContent.insight}
                        </Typography>
                      </Box>
                    )}

                    {educationalContent.estimated_time && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ 
                          fontWeight: 600, 
                          color: '#ff9800',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1
                        }}>
                          <ScheduleIcon sx={{ fontSize: 16 }} />
                          Time Estimate
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          lineHeight: 1.6,
                          color: 'text.secondary',
                          fontWeight: 500
                        }}>
                          {educationalContent.estimated_time}
                        </Typography>
                      </Box>
                    )}

                    {educationalContent.achievement && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ 
                          fontWeight: 600, 
                          color: '#4caf50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1
                        }}>
                          <CheckCircleIcon sx={{ fontSize: 16 }} />
                          Achievement
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          lineHeight: 1.6,
                          color: 'text.secondary',
                          fontWeight: 500
                        }}>
                          {educationalContent.achievement}
                        </Typography>
                      </Box>
                    )}

                    {educationalContent.next_step && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ 
                          fontWeight: 600, 
                          color: '#9c27b0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1
                        }}>
                          <TrendingUpIcon sx={{ fontSize: 16 }} />
                          Next Step
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          lineHeight: 1.6,
                          color: 'text.secondary',
                          fontWeight: 500
                        }}>
                          {educationalContent.next_step}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>
              </Grid>

              {/* Summary for completion */}
              {educationalContent.summary && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <Box sx={{ 
                    mt: 4, 
                    p: 3, 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 3,
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <Box sx={{ 
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
                      pointerEvents: 'none'
                    }} />
                    <Typography variant="h6" gutterBottom sx={{ 
                      fontWeight: 700,
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <AutoAwesomeIcon />
                      Strategy Generation Summary
                    </Typography>
                    <Grid container spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
                      {Object.entries(educationalContent.summary).map(([key, value]) => (
                        <Grid item xs={6} md={3} key={key}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                              {value as string}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 500 }}>
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </motion.div>
              )}
            </motion.div>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ color: '#667eea', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#667eea' }}>
              Initializing Strategy Generation
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Preparing AI models and analyzing your data...
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 3, 
        pt: 0,
        justifyContent: 'center'
      }}>
        {generationProgress >= 100 ? (
          // Show "Next: Review Strategy and Create Calendar" button when generation is complete
          <Button
            variant="contained"
            onClick={onReviewStrategy}
            sx={{ 
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)'
              },
              transition: 'all 0.3s ease'
            }}
            startIcon={<AutoAwesomeIcon />}
          >
            Next: Review Strategy and Create Calendar
          </Button>
        ) : (
          // Show "Close" button during generation
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{ 
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              borderColor: 'rgba(102, 126, 234, 0.3)',
              color: '#667eea',
              '&:hover': {
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.05)'
              }
            }}
          >
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EducationalModal; 