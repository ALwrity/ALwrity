import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Modal,
  Paper,
  Button,
  IconButton,
  Divider,
  Avatar,
  Stack
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import TodayIcon from '@mui/icons-material/Today';
import TextIcon from '@mui/icons-material/TextFields';
import ImageIcon from '@mui/icons-material/Image';
import AudioIcon from '@mui/icons-material/AudioFile';
import VideoIcon from '@mui/icons-material/VideoFile';
import CloseIcon from '@mui/icons-material/Close';
import FacebookIcon from '@mui/icons-material/Facebook';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import WebsiteIcon from '@mui/icons-material/Language';
import AlwrityIcon from '@mui/icons-material/AutoAwesome';
import { useNavigate } from 'react-router-dom';
import EnhancedTodayChip from './EnhancedTodayChip';
  import { TodayTask } from '../../../types/workflow';
  
  // Today Modal Component
const TodayModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const navigate = useNavigate();

  const tasks = [
    {
      id: 'facebook',
      title: "Post 'ALwrity AI Content Generation' on Facebook",
      platform: 'Facebook',
      icon: FacebookIcon,
      color: '#1877F2',
      enabled: true,
      action: () => navigate('/facebook-writer')
    },
    {
      id: 'website',
      title: 'Write a Blog on "AI Image generation prompts" for wix website',
      platform: 'Website',
      icon: WebsiteIcon,
      color: '#FF6B35',
      enabled: false,
      action: () => {}
    },
    {
      id: 'linkedin',
      title: "Write & Post on LinkedIn on 'AI Agents frameworks latest news'",
      platform: 'LinkedIn',
      icon: LinkedInIcon,
      color: '#0077B5',
      enabled: true,
      action: () => navigate('/linkedin-studio')
    }
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3 }}
      >
        <Paper
          elevation={24}
          sx={{
            width: { xs: '95%', sm: '90%', md: '600px' },
            maxHeight: '80vh',
            overflow: 'auto',
            borderRadius: 3,
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            position: 'relative'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)',
              color: 'white',
              borderRadius: '12px 12px 0 0',
              position: 'relative'
            }}
          >
            <IconButton
              onClick={onClose}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  mr: 2,
                  width: 48,
                  height: 48
                }}
              >
                <TodayIcon sx={{ fontSize: 24 }} />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Today's Tasks
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  AI-powered content generation for today
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: '#1565C0' }}>
              🚀 Ready to Generate Content
            </Typography>
            
            <Stack spacing={2}>
              {tasks.map((task, index) => {
                const IconComponent = task.icon;
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <Paper
                      elevation={2}
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        border: `2px solid ${task.enabled ? task.color : '#E0E0E0'}`,
                        backgroundColor: task.enabled ? 'white' : '#F5F5F5',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: `0 8px 24px ${task.color}20`
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <Avatar
                          sx={{
                            backgroundColor: task.enabled ? task.color : '#BDBDBD',
                            width: 40,
                            height: 40
                          }}
                        >
                          <IconComponent sx={{ fontSize: 20, color: 'white' }} />
                        </Avatar>
                        
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                            {task.title}
                          </Typography>
                          <Chip
                            label={task.platform}
                            size="small"
                            sx={{
                              backgroundColor: task.enabled ? `${task.color}20` : '#E0E0E0',
                              color: task.enabled ? task.color : '#757575',
                              fontWeight: 500
                            }}
                          />
                        </Box>
                        
                        <Button
                          variant="contained"
                          startIcon={<AlwrityIcon />}
                          onClick={task.action}
                          disabled={!task.enabled}
                          sx={{
                            background: task.enabled 
                              ? `linear-gradient(135deg, ${task.color} 0%, ${task.color}CC 100%)`
                              : '#E0E0E0',
                            color: 'white',
                            px: 3,
                            py: 1,
                            borderRadius: 2,
                            fontWeight: 600,
                            textTransform: 'none',
                            boxShadow: task.enabled 
                              ? `0 4px 12px ${task.color}40`
                              : 'none',
                            '&:hover': task.enabled ? {
                              background: `linear-gradient(135deg, ${task.color}CC 0%, ${task.color} 100%)`,
                              boxShadow: `0 6px 16px ${task.color}50`
                            } : {},
                            '&:disabled': {
                              backgroundColor: '#E0E0E0',
                              color: '#9E9E9E'
                            }
                          }}
                        >
                          ALwrity it
                        </Button>
                      </Box>
                    </Paper>
                  </motion.div>
                );
              })}
            </Stack>

            <Divider sx={{ my: 3 }} />
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                💡 Tip: Use ALwrity's AI to generate engaging content tailored to each platform
              </Typography>
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Modal>
  );
};

// Enhanced Chip Component for Generate Pillar
const GenerateChip: React.FC<{
  chip: any;
  delay?: number;
  onTodayClick?: () => void;
}> = ({ chip, delay = 0, onTodayClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Effect to handle animation timing
  useEffect(() => {
    // Only proceed if there are bubbles to show
    if (!chip.bubbles || chip.bubbles.length === 0) return;

    // Reset bubble index when chip changes
    setCurrentIndex(0);
    
    // Start interval to cycle through bubbles
    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        // If we've reached the end, reset to 0
        if (prev >= (chip.bubbles?.length || 0) - 1) return 0;
        return prev + 1;
      });
    }, 3000); // Change bubble every 3 seconds
    
    return () => clearInterval(interval);
  }, [chip.bubbles]); // Only re-run when bubbles change

  const IconComponent = chip.icon;

  const navigate = useNavigate();
  
  const handleClick = () => {
    if (chip.label === 'Today' && onTodayClick) {
      onTodayClick();
    } else if (chip.label === 'Video') {
      // Navigate to YouTube Creator
      navigate('/youtube-creator');
    }
  };

  return (
    <Tooltip
      title={
        chip.bubbles && chip.bubbles.length > 0 ? (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              {chip.label}
            </Typography>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Typography variant="caption" sx={{ color: 'white' }}>
                  {chip.bubbles[currentIndex]}
                </Typography>
              </motion.div>
            </AnimatePresence>
          </Box>
        ) : chip.label
      }
      arrow
      placement="top"
    >
      <Box
        sx={{
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          '&:hover': {
            transform: 'translateY(-4px) scale(1.05)',
            '& .chip-glow': {
              opacity: 1,
              transform: 'scale(1.2)'
            },
            '& .chip-shadow': {
              opacity: 0.6,
              transform: 'translateY(8px) scale(1.1)'
            }
          }
        }}
        onClick={handleClick}
      >
        {/* Glow Effect */}
        <Box
          className="chip-glow"
          sx={{
            position: 'absolute',
            top: -8,
            left: -8,
            right: -8,
            bottom: -8,
            background: chip.gradient || chip.color,
            borderRadius: '20px',
            opacity: 0,
            transition: 'all 0.4s ease',
            filter: 'blur(12px)',
            zIndex: -2
          }}
        />
        
        {/* Shadow Effect */}
        <Box
          className="chip-shadow"
          sx={{
            position: 'absolute',
            top: 4,
            left: 2,
            right: -2,
            bottom: -4,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '16px',
            opacity: 0.3,
            transition: 'all 0.4s ease',
            filter: 'blur(8px)',
            zIndex: -1
          }}
        />

        {/* Main Chip */}
        <Chip
          icon={<IconComponent sx={{ fontSize: 14 }} />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                {chip.label}
              </Typography>
              {chip.value && (
                <Box
                  sx={{
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    color: chip.color,
                    borderRadius: '50%',
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {chip.value}
                </Box>
              )}
            </Box>
          }
          size="small"
          sx={{
            background: `linear-gradient(135deg, 
              rgba(255,255,255,0.25) 0%, 
              rgba(255,255,255,0.1) 50%, 
              rgba(255,255,255,0.05) 100%)`,
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 600,
            height: 28,
            minWidth: 100,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              transition: 'left 0.6s ease',
              zIndex: 1
            },
            '&:hover::before': {
              left: '100%'
            },
            '& .MuiChip-label': {
              px: 1,
              zIndex: 2,
              position: 'relative'
            },
            '& .MuiChip-icon': {
              zIndex: 2,
              position: 'relative'
            },
            '&:hover': {
              background: `linear-gradient(135deg, 
                rgba(255,255,255,0.35) 0%, 
                rgba(255,255,255,0.2) 50%, 
                rgba(255,255,255,0.1) 100%)`,
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: `0 8px 32px ${chip.color}40, 
                          0 4px 16px rgba(0,0,0,0.1),
                          inset 0 1px 0 rgba(255,255,255,0.3)`
            }
          }}
        />
      </Box>
    </Tooltip>
  );
};

// Generate Pillar Chips Component
const GeneratePillarChips: React.FC<{
  index: number;
  isHovered?: boolean;
}> = ({ index, isHovered = false }) => {
  const navigate = useNavigate();
  
  // Generate pillar Today tasks
  const generateTodayTasks: TodayTask[] = [
    {
      id: 'facebook-post',
      pillarId: 'generate',
      title: "Post 'ALwrity AI Content Generation' on Facebook",
      description: 'Create and publish engaging Facebook content',
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 20,
      actionType: 'navigate' as const,
      actionUrl: '/facebook-writer',
      icon: FacebookIcon,
      color: '#1877F2',
      enabled: true,
      action: () => navigate('/facebook-writer')
    },
    {
      id: 'blog-post',
      pillarId: 'generate',
      title: 'Write Blog on "AI Image Generation Prompts"',
      description: 'Create comprehensive blog post for website',
      status: 'pending' as const,
      priority: 'medium' as const,
      estimatedTime: 30,
      actionType: 'navigate' as const,
      actionUrl: '/blog-writer',
      icon: WebsiteIcon,
      color: '#FF6B35',
      enabled: false,
      action: () => {}
    },
    {
      id: 'linkedin-post',
      pillarId: 'generate',
      title: "Write & Post on LinkedIn 'AI Agents Frameworks'",
      description: 'Create professional LinkedIn content',
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 15,
      actionType: 'navigate' as const,
      actionUrl: '/linkedin-studio',
      icon: LinkedInIcon,
      color: '#0077B5',
      enabled: true,
      action: () => navigate('/linkedin-studio')
    },
    {
      id: 'youtube-video',
      pillarId: 'generate',
      title: 'Create YouTube Video with AI',
      description: 'Generate AI-powered YouTube videos from your ideas',
      status: 'pending' as const,
      priority: 'high' as const,
      estimatedTime: 25,
      actionType: 'navigate' as const,
      actionUrl: '/youtube-creator',
      icon: VideoIcon,
      color: '#E91E63',
      enabled: true,
      action: () => navigate('/youtube-creator')
    }
  ];

  // Generate pillar chips data
  const generateChips = {
    text: {
      label: 'Text',
      icon: TextIcon,
      color: '#4CAF50',
      gradient: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
      bubbles: ['Blog posts', 'Social media', 'Email content']
    },
    image: {
      label: 'Image',
      icon: ImageIcon,
      color: '#FF9800',
      gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
      bubbles: ['Visual content', 'Infographics', 'Social images']
    },
    audio: {
      label: 'Audio',
      icon: AudioIcon,
      color: '#9C27B0',
      gradient: 'linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)',
      bubbles: ['Podcast scripts', 'Voice content', 'Audio ads']
    },
    video: {
      label: 'Video',
      icon: VideoIcon,
      color: '#E91E63',
      gradient: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)',
      bubbles: ['Video scripts', 'YouTube content', 'Social videos']
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        flexGrow: 1,
        justifyContent: isHovered ? 'center' : 'flex-start'
      }}
    >
      {/* Today Chip - Always Visible */}
      <EnhancedTodayChip
        pillarId="generate"
        pillarTitle="Generate"
        pillarColor="#1565C0"
        tasks={generateTodayTasks}
        delay={index * 5}
      />
      
      {/* Video Chip - Always Visible (Primary Action) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{ marginTop: '8px' }}
      >
        <GenerateChip chip={generateChips.video} delay={index * 5 + 1} />
      </motion.div>
      
      {/* More Options Indicator */}
      {!isHovered && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ alignSelf: 'center', marginTop: '8px' }}
        >
          <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.7, color: 'white' }}>
            ⋯
          </Typography>
        </motion.div>
      )}
      
      {/* Content Type Chips - Progressive Disclosure */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <GenerateChip chip={generateChips.text} delay={index * 5 + 1} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <GenerateChip chip={generateChips.image} delay={index * 5 + 2} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <GenerateChip chip={generateChips.audio} delay={index * 5 + 3} />
              </motion.div>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default GeneratePillarChips;
