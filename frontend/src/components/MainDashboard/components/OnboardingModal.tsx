import React from 'react';
import {
  Box,
  Typography,
  Modal,
  Paper,
  Button,
  IconButton,
  Divider,
  LinearProgress,
  Avatar,
  Stack,
  Chip
} from '@mui/material';
import { motion } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import OnboardingIcon from '@mui/icons-material/PersonAdd';
import CheckIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PsychologyIcon from '@mui/icons-material/Psychology';

// Onboarding Modal Component
const OnboardingModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  // Mock onboarding data - in real app, this would come from database
  const onboardingData = {
    userProfile: {
      name: 'John Doe',
      company: 'TechCorp Inc.',
      role: 'Marketing Manager',
      completion: 85
    },
    preferences: {
      contentTypes: ['Blog Posts', 'Social Media', 'Email Campaigns'],
      platforms: ['LinkedIn', 'Facebook', 'Twitter'],
      tone: 'Professional',
      frequency: 'Daily'
    },
    goals: {
      primary: 'Increase brand awareness',
      secondary: 'Generate leads',
      metrics: ['Engagement Rate', 'Click-through Rate', 'Conversion Rate']
    },
    aiAnalysis: {
      score: 8.5,
      insights: [
        'Strong foundation with clear goals and preferences',
        'Content strategy well-aligned with target audience',
        'Consider expanding to Instagram for better reach',
        'Email campaigns could benefit from A/B testing'
      ],
      recommendations: [
        'Set up automated content scheduling',
        'Implement advanced analytics tracking',
        'Create content templates for consistency',
        'Establish brand voice guidelines'
      ]
    }
  };

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
            width: { xs: '95%', sm: '90%', md: '80%', lg: '70%' },
            maxWidth: 800,
            maxHeight: '90vh',
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
              background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
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
                <OnboardingIcon sx={{ fontSize: 24 }} />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Onboarding Status
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Complete your setup to unlock full potential
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Overall Progress
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {onboardingData.userProfile.completion}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={onboardingData.userProfile.completion}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: 'white',
                    borderRadius: 4
                  }
                }}
              />
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ p: 3 }}>
            {/* User Profile Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#2E7D32' }}>
                👤 User Profile
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Name</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{onboardingData.userProfile.name}</Typography>
                </Box>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Company</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{onboardingData.userProfile.company}</Typography>
                </Box>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Role</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{onboardingData.userProfile.role}</Typography>
                </Box>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Completion</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#4CAF50' }}>{onboardingData.userProfile.completion}%</Typography>
                </Box>
              </Box>
            </Box>

            {/* Preferences Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#2E7D32' }}>
                ⚙️ Preferences
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Content Types</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {onboardingData.preferences.contentTypes.map((type, idx) => (
                      <Chip key={idx} label={type} size="small" sx={{ backgroundColor: '#E3F2FD', color: '#1976D2' }} />
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Platforms</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {onboardingData.preferences.platforms.map((platform, idx) => (
                      <Chip key={idx} label={platform} size="small" sx={{ backgroundColor: '#E8F5E8', color: '#2E7D32' }} />
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Tone</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{onboardingData.preferences.tone}</Typography>
                </Box>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Frequency</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{onboardingData.preferences.frequency}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Goals Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#2E7D32' }}>
                🎯 Goals
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Primary Goal</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{onboardingData.goals.primary}</Typography>
                </Box>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Secondary Goal</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{onboardingData.goals.secondary}</Typography>
                </Box>
                <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 2, boxShadow: 1, gridColumn: { xs: '1', md: '1 / -1' } }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Key Metrics</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {onboardingData.goals.metrics.map((metric, idx) => (
                      <Chip key={idx} label={metric} size="small" sx={{ backgroundColor: '#FFF3E0', color: '#F57C00' }} />
                    ))}
                  </Stack>
                </Box>
              </Box>
            </Box>

            {/* AI Analysis Section */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#2E7D32' }}>
                🤖 AI Analysis
              </Typography>
              <Box sx={{ p: 3, backgroundColor: 'white', borderRadius: 2, boxShadow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PsychologyIcon sx={{ color: '#9C27B0', mr: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Analysis Score: {onboardingData.aiAnalysis.score}/10
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#2E7D32' }}>
                    Key Insights:
                  </Typography>
                  {onboardingData.aiAnalysis.insights.map((insight, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                      <CheckIcon sx={{ color: '#4CAF50', fontSize: 16, mr: 1, mt: 0.5 }} />
                      <Typography variant="body2">{insight}</Typography>
                    </Box>
                  ))}
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#2E7D32' }}>
                    Recommendations:
                  </Typography>
                  {onboardingData.aiAnalysis.recommendations.map((rec, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                      <TrendingUpIcon sx={{ color: '#FF9800', fontSize: 16, mr: 1, mt: 0.5 }} />
                      <Typography variant="body2">{rec}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>

            {/* Settings Button */}
            <Divider sx={{ my: 3 }} />
            <Box sx={{ textAlign: 'center' }}>
              <Button
                variant="contained"
                startIcon={<SettingsIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)',
                  color: 'white',
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)',
                    boxShadow: '0 6px 16px rgba(156, 39, 176, 0.4)'
                  }
                }}
              >
                Edit Onboarding Data
              </Button>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                Configure your preferences and goals in the Settings page
              </Typography>
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Modal>
  );
};

export default OnboardingModal;
