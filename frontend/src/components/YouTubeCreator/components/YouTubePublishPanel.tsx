import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Scene, VideoPlan } from '../../../services/youtubeApi';
import { useYouTubePublish } from '../../../hooks/useYouTubePublish';

interface YouTubePublishPanelProps {
  videoUrl: string | null;
  scenes: Scene[];
  videoPlan: VideoPlan | null;
}

function buildVideoTitle(videoPlan: VideoPlan | null, scenes: Scene[]): string {
  const selectedTitle = videoPlan?.selected_title?.trim();
  if (selectedTitle) {
    return selectedTitle.slice(0, 100);
  }

  const summaryTitle = videoPlan?.video_summary?.trim();
  if (summaryTitle) {
    return summaryTitle.slice(0, 100);
  }

  const firstSceneTitle = scenes.find((scene) => scene.title)?.title?.trim();
  if (firstSceneTitle) {
    return firstSceneTitle.slice(0, 100);
  }

  return `ALwrity Video ${new Date().toISOString().slice(0, 10)}`;
}

function buildVideoDescription(videoPlan: VideoPlan | null): string {
  return videoPlan?.key_message?.trim() || 'Created with ALwrity YouTube Creator';
}

export const YouTubePublishPanel: React.FC<YouTubePublishPanelProps> = ({
  videoUrl,
  scenes,
  videoPlan,
}) => {
  const youtube = useYouTubePublish();
  const activeChannel = youtube.activeChannel;

  const publishTitle = useMemo(() => buildVideoTitle(videoPlan, scenes), [videoPlan, scenes]);
  const publishDescription = useMemo(() => buildVideoDescription(videoPlan), [videoPlan]);

  const handlePublish = () => {
    if (!videoUrl) return;
    youtube.publishToYouTube(videoUrl, publishTitle, {
      description: publishDescription,
      tags: ['alwrity', 'youtube', 'ai-video'],
    });
  };

  return (
    <Paper
      sx={{
        mt: 3,
        p: 3,
        backgroundColor: '#fff',
        border: '1px solid #f3f4f6',
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            5️⃣ Connect & Publish to YouTube
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Connect your YouTube account and publish the generated video directly from ALwrity.
          </Typography>
        </Box>

        {youtube.error && <Alert severity="error">{youtube.error}</Alert>}

        {youtube.connected && activeChannel ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Chip
              color="success"
              label={`Connected: ${activeChannel.channel_name}`}
              sx={{ fontWeight: 600 }}
            />
            <Button
              variant="outlined"
              color="error"
              onClick={() => youtube.disconnect(activeChannel.token_id)}
            >
              Disconnect
            </Button>
          </Stack>
        ) : (
          <Button
            variant="outlined"
            color="error"
            onClick={() => youtube.connect()}
            disabled={youtube.loading}
            startIcon={youtube.loading ? <CircularProgress size={16} /> : undefined}
            sx={{ width: 'fit-content' }}
          >
            {youtube.loading ? 'Connecting...' : 'Connect YouTube Account'}
          </Button>
        )}

        {!videoUrl && (
          <Alert severity="info">
            Complete final video rendering first. Publish will be enabled once the final video URL is available.
          </Alert>
        )}

        <Button
          variant="contained"
          color="error"
          onClick={handlePublish}
          disabled={!youtube.connected || !activeChannel || !videoUrl || youtube.publishState.publishing}
          startIcon={youtube.publishState.publishing ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : undefined}
          sx={{ width: 'fit-content', fontWeight: 700 }}
        >
          {youtube.publishState.publishing
            ? youtube.publishState.progress || 'Publishing...'
            : 'Publish to YouTube'}
        </Button>

        {youtube.publishState.videoUrl && (
          <Alert severity="success">
            Published successfully:{' '}
            <a href={youtube.publishState.videoUrl} target="_blank" rel="noopener noreferrer">
              Open on YouTube
            </a>
          </Alert>
        )}

        {youtube.publishState.error && (
          <Alert severity="error">
            Publish failed: {youtube.publishState.error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};
