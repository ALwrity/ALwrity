import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import Instagram from '@mui/icons-material/Instagram';
import LinkedIn from '@mui/icons-material/LinkedIn';
import Facebook from '@mui/icons-material/Facebook';
import Twitter from '@mui/icons-material/Twitter';
import YouTube from '@mui/icons-material/YouTube';
import Pinterest from '@mui/icons-material/Pinterest';
import MusicNote from '@mui/icons-material/MusicNote';
import { motion } from 'framer-motion';
import { GlassyCard } from '../ImageStudio/ui/GlassyCard';
import { SectionHeader } from '../ImageStudio/ui/SectionHeader';
import { useCampaignCreator } from '../../hooks/useCampaignCreator';

interface ChannelPackBuilderProps {
  channels: string[];
  onChannelPackReady?: (packs: any) => void;
}

const channelIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram />,
  linkedin: <LinkedIn />,
  facebook: <Facebook />,
  twitter: <Twitter />,
  youtube: <YouTube />,
  pinterest: <Pinterest />,
  tiktok: <MusicNote />,
};

export const ChannelPackBuilder: React.FC<ChannelPackBuilderProps> = ({
  channels,
  onChannelPackReady,
}) => {
  const { getChannelPack, channelPack, isLoadingChannelPack, error } = useCampaignCreator();
  const [selectedChannel, setSelectedChannel] = useState<string>(channels[0] || 'instagram');
  const [channelPacks, setChannelPacks] = useState<Record<string, any>>({});

  useEffect(() => {
    // Load packs for all channels
    channels.forEach((channel) => {
      loadChannelPack(channel);
    });
  }, [channels]);

  const loadChannelPack = async (channel: string) => {
    try {
      const pack = await getChannelPack(channel);
      setChannelPacks((prev) => ({ ...prev, [channel]: pack }));
    } catch (err) {
      // Error handled in hook
    }
  };

  const currentPack = channelPacks[selectedChannel];

  return (
    <GlassyCard sx={{ p: 4 }}>
      <SectionHeader
        title="Channel Packs"
        subtitle="Platform-specific templates and optimization settings"
        sx={{ mb: 3 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Channel Tabs */}
      <Tabs
        value={selectedChannel}
        onChange={(_, value) => setSelectedChannel(value)}
        sx={{ mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {channels.map((channel) => {
          const icon = channelIcons[channel];
          return (
            <Tab
              key={channel}
              label={channel.charAt(0).toUpperCase() + channel.slice(1)}
              value={channel}
              icon={icon ? <>{icon}</> : undefined}
              iconPosition="start"
            />
          );
        })}
      </Tabs>

      {/* Channel Pack Content */}
      {isLoadingChannelPack && !currentPack ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : currentPack ? (
        <Stack spacing={3}>
          {/* Templates */}
          {currentPack.templates && currentPack.templates.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Recommended Templates
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {currentPack.templates.slice(0, 3).map((template: any, index: number) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Card
                      sx={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <CardContent>
                        <Stack spacing={1}>
                          <Typography variant="body1" fontWeight={600}>
                            {template.name}
                          </Typography>
                          <Chip label={template.dimensions} size="small" />
                          <Typography variant="caption" color="text.secondary">
                            {template.aspect_ratio} • {template.quality}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* Formats */}
          {currentPack.formats && currentPack.formats.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Platform Formats
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {currentPack.formats.map((format: any, index: number) => (
                  <Grid item xs={6} sm={4} key={index}>
                    <Paper
                      sx={{
                        p: 2,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {format.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format.width} × {format.height}
                        </Typography>
                        <Chip label={format.ratio} size="small" />
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* Copy Framework */}
          {currentPack.copy_framework && Object.keys(currentPack.copy_framework).length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Copy Framework
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Stack spacing={1}>
                  {Object.entries(currentPack.copy_framework).map(([key, value]) => (
                    <Box key={key}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        {key.replace('_', ' ').toUpperCase()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {String(value)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Box>
          )}

          {/* Optimization Tips */}
          {currentPack.optimization_tips && currentPack.optimization_tips.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Optimization Tips
              </Typography>
              <Stack spacing={1}>
                {currentPack.optimization_tips.map((tip: string, index: number) => (
                  <Alert key={index} severity="info" sx={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                    {tip}
                  </Alert>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      ) : (
        <Alert severity="info">No pack data available for {selectedChannel}</Alert>
      )}
    </GlassyCard>
  );
};

