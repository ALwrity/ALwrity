/**
 * Personalized Recommendations Component
 * Shows recommendations based on user's onboarding data and preferences.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import VideoLibrary from '@mui/icons-material/VideoLibrary';
import Campaign from '@mui/icons-material/Campaign';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { motion } from 'framer-motion';
import { useProductMarketing } from '../../hooks/useProductMarketing';
import { useCampaignCreator } from '../../hooks/useCampaignCreator';
import { useNavigate } from 'react-router-dom';

const MotionCard = motion.create(Card);

interface PersonalizedRecommendationsProps {
  variant?: 'product_marketing' | 'campaign_creator';
}

export const PersonalizedRecommendations: React.FC<PersonalizedRecommendationsProps> = ({
  variant = 'product_marketing',
}) => {
  const navigate = useNavigate();
  
  // Always call both hooks (React rules)
  const productMarketingHook = useProductMarketing();
  const campaignCreatorHook = useCampaignCreator();
  
  // Select the appropriate hook based on variant
  const { getRecommendations, recommendations, isLoadingRecommendations } = 
    variant === 'product_marketing' 
      ? productMarketingHook 
      : campaignCreatorHook;
  
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!hasLoaded && !isLoadingRecommendations && !recommendations) {
      getRecommendations().catch(console.error);
      setHasLoaded(true);
    }
  }, [hasLoaded, isLoadingRecommendations, recommendations, getRecommendations]);

  if (isLoadingRecommendations) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (!recommendations) {
    return null;
  }

  const { templates, channels, asset_types, industry, reasoning } = recommendations;

  return (
    <Paper
      sx={{
        p: 3,
        mb: 3,
        background: 'rgba(124, 58, 237, 0.05)',
        border: '1px solid rgba(124, 58, 237, 0.2)',
        borderRadius: 2,
      }}
    >
      <Stack spacing={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <AutoAwesome sx={{ color: '#c4b5fd' }} />
          <Typography variant="h6" fontWeight={700}>
            Recommended for You
          </Typography>
        </Box>

        {reasoning && (
          <Alert severity="info" icon={<TrendingUp />}>
            <Typography variant="body2">{reasoning}</Typography>
          </Alert>
        )}

        {/* Recommended Templates */}
        {templates && templates.length > 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
              Recommended Templates
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {templates.map((templateId: string, idx: number) => (
                <Chip
                  key={idx}
                  label={templateId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  size="small"
                  icon={<PhotoLibrary />}
                  sx={{
                    background: 'rgba(124, 58, 237, 0.2)',
                    color: '#c4b5fd',
                    border: '1px solid rgba(124, 58, 237, 0.3)',
                    cursor: 'pointer',
                    '&:hover': {
                      background: 'rgba(124, 58, 237, 0.3)',
                    },
                  }}
                  onClick={() => {
                    // Navigate to template or apply template
                    navigate(`/campaign-creator/photoshoot?template=${templateId}`);
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Recommended Platforms */}
        {channels && channels.length > 0 && variant === 'campaign_creator' && (
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
              Recommended Platforms
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {channels.map((channel: string, idx: number) => (
                <Chip
                  key={idx}
                  label={channel.charAt(0).toUpperCase() + channel.slice(1)}
                  size="small"
                  icon={<Campaign />}
                  sx={{
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#93c5fd',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Quick Actions */}
        <Grid container spacing={2}>
          {variant === 'product_marketing' && (
            <>
              <Grid item xs={12} sm={6} md={4}>
                <MotionCard
                  whileHover={{ scale: 1.02 }}
                  sx={{
                    cursor: 'pointer',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                  }}
                  onClick={() => navigate('/campaign-creator/photoshoot')}
                >
                  <CardContent>
                    <Stack spacing={1} alignItems="center">
                      <PhotoLibrary sx={{ color: '#6ee7b7', fontSize: 32 }} />
                      <Typography variant="body2" fontWeight={600}>
                        Product Photos
                      </Typography>
                      <Typography variant="caption" color="text.secondary" textAlign="center">
                        Generate product images
                      </Typography>
                    </Stack>
                  </CardContent>
                </MotionCard>
              </Grid>
              {asset_types && asset_types.includes('product_videos') && (
                <Grid item xs={12} sm={6} md={4}>
                  <MotionCard
                    whileHover={{ scale: 1.02 }}
                    sx={{
                      cursor: 'pointer',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}
                    onClick={() => navigate('/campaign-creator/video')}
                  >
                    <CardContent>
                      <Stack spacing={1} alignItems="center">
                        <VideoLibrary sx={{ color: '#93c5fd', fontSize: 32 }} />
                        <Typography variant="body2" fontWeight={600}>
                          Product Videos
                        </Typography>
                        <Typography variant="caption" color="text.secondary" textAlign="center">
                          Create product videos
                        </Typography>
                      </Stack>
                    </CardContent>
                  </MotionCard>
                </Grid>
              )}
            </>
          )}
          
          {variant === 'campaign_creator' && channels && channels.length > 0 && (
            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<Campaign />}
                fullWidth
                onClick={() => {
                  // This would trigger campaign creation with recommended channels pre-selected
                  // For now, just show a message
                  alert(`Creating campaign with recommended platforms: ${channels.join(', ')}`);
                }}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  },
                }}
              >
                Start Campaign with Recommended Platforms
              </Button>
            </Grid>
          )}
        </Grid>
      </Stack>
    </Paper>
  );
};
