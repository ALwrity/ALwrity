/**
 * Campaign Preview Component
 * Shows a visual preview of what the campaign will look like based on user selections.
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import Campaign from '@mui/icons-material/Campaign';
import TrendingUp from '@mui/icons-material/TrendingUp';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import Description from '@mui/icons-material/Description';
import VideoLibrary from '@mui/icons-material/VideoLibrary';

interface CampaignPreviewProps {
  campaignName: string;
  goal: string;
  kpi?: string;
  channels: string[];
  productName?: string;
  productDescription?: string;
  goalOptions: Array<{ value: string; label: string; description: string }>;
  channelOptions: Array<{ value: string; label: string; icon: string }>;
}

export const CampaignPreview: React.FC<CampaignPreviewProps> = ({
  campaignName,
  goal,
  kpi,
  channels,
  productName,
  productDescription,
  goalOptions,
  channelOptions,
}) => {
  const goalLabel = goalOptions.find((g) => g.value === goal)?.label || goal;

  // Estimate asset counts per channel (rough estimate)
  const estimatedAssetsPerChannel = {
    instagram: { images: 3, videos: 1, text: 2 },
    linkedin: { images: 2, videos: 1, text: 3 },
    facebook: { images: 2, videos: 1, text: 2 },
    tiktok: { images: 1, videos: 2, text: 1 },
    twitter: { images: 2, videos: 0, text: 3 },
    pinterest: { images: 4, videos: 0, text: 1 },
    youtube: { images: 1, videos: 1, text: 2 },
  };

  const totalAssets = channels.reduce(
    (acc, channel) => {
      const counts = estimatedAssetsPerChannel[channel as keyof typeof estimatedAssetsPerChannel] || {
        images: 2,
        videos: 1,
        text: 2,
      };
      return {
        images: acc.images + counts.images,
        videos: acc.videos + counts.videos,
        text: acc.text + counts.text,
      };
    },
    { images: 0, videos: 0, text: 0 }
  );

  return (
    <Paper
      sx={{
        p: 3,
        background: 'rgba(124, 58, 237, 0.05)',
        border: '1px solid rgba(124, 58, 237, 0.2)',
        borderRadius: 2,
      }}
    >
      <Stack spacing={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <Campaign sx={{ color: '#c4b5fd' }} />
          <Typography variant="h6" fontWeight={700}>
            Campaign Preview
          </Typography>
        </Box>

        {/* Campaign Overview */}
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Campaign Name
          </Typography>
          <Typography variant="h6">{campaignName || 'Untitled Campaign'}</Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Goal */}
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Goal
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <TrendingUp sx={{ fontSize: 20, color: '#c4b5fd' }} />
            <Typography variant="body1" fontWeight={600}>
              {goalLabel}
            </Typography>
          </Box>
        </Box>

        {kpi && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Success Metric
              </Typography>
              <Typography variant="body2">{kpi}</Typography>
            </Box>
          </>
        )}

        {/* Platforms */}
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Platforms ({channels.length})
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {channels.map((channel) => {
              const channelInfo = channelOptions.find((c) => c.value === channel);
              return (
                <Chip
                  key={channel}
                  icon={<span>{channelInfo?.icon || '📱'}</span>}
                  label={channelInfo?.label || channel}
                  size="small"
                  sx={{
                    background: 'rgba(124, 58, 237, 0.2)',
                    color: '#c4b5fd',
                    border: '1px solid rgba(124, 58, 237, 0.3)',
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* Product Info */}
        {productName && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Product
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {productName}
              </Typography>
              {productDescription && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {productDescription.substring(0, 100)}
                  {productDescription.length > 100 ? '...' : ''}
                </Typography>
              )}
            </Box>
          </>
        )}

        {/* Estimated Content */}
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Estimated Content Pieces
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <Paper
                sx={{
                  p: 2,
                  textAlign: 'center',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <PhotoLibrary sx={{ color: '#93c5fd', fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight={700}>
                  {totalAssets.images}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Images
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper
                sx={{
                  p: 2,
                  textAlign: 'center',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                <VideoLibrary sx={{ color: '#6ee7b7', fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight={700}>
                  {totalAssets.videos}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Videos
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper
                sx={{
                  p: 2,
                  textAlign: 'center',
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.2)',
                }}
              >
                <Description sx={{ color: '#fbbf24', fontSize: 32, mb: 1 }} />
                <Typography variant="h5" fontWeight={700}>
                  {totalAssets.text}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Text Posts
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        {/* Preview Note */}
        <Box
          sx={{
            p: 2,
            background: 'rgba(124, 58, 237, 0.1)',
            borderRadius: 1,
            border: '1px dashed rgba(124, 58, 237, 0.3)',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            💡 AI will generate personalized content for each platform based on your brand style and campaign goal.
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
};
