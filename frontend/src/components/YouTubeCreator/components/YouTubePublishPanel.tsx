import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Scene, VideoPlan } from '../../../services/youtubeApi';
import { useYouTubePublish } from '../../../hooks/useYouTubePublish';
import { toYouTubePublishAtIso } from './youtubePublishSchedule';
import { youtubePublishSourceMeta } from '../../../hooks/youtubePublishLog';
import type { YouTubePublishMetadata } from './youtubePublishMetadata';
import {
  YouTubePublishAudienceFields,
  type YouTubeMadeForKidsChoice,
} from './YouTubePublishAudienceFields';
import { helperSx } from '../styles';

interface YouTubePublishPanelProps {
  videoUrl: string | null;
  scenes: Scene[];
  videoPlan: VideoPlan | null;
  metadata?: YouTubePublishMetadata;
  publishLine?: string | null;
  helperText?: string | null;
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
  metadata,
  publishLine,
  helperText,
}) => {
  const youtube = useYouTubePublish();
  const activeChannel = youtube.activeChannel;
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'unlisted'>('unlisted');
  const [scheduleLocal, setScheduleLocal] = useState('');
  const [madeForKids, setMadeForKids] = useState<YouTubeMadeForKidsChoice>(null);
  const [ageRestricted, setAgeRestricted] = useState(false);

  const publishTitle = useMemo(() => buildVideoTitle(videoPlan, scenes), [videoPlan, scenes]);
  const publishDescription = useMemo(() => buildVideoDescription(videoPlan), [videoPlan]);

  const handlePublish = () => {
    try {
      if (!videoUrl) {
        console.warn("[YouTubePublishPanel] Publish skipped: no video URL");
        return;
      }
      if (madeForKids === null) {
        console.warn("[YouTubePublishPanel] Publish skipped: Made for Kids not chosen");
        return;
      }
      const publishAt = toYouTubePublishAtIso(scheduleLocal);
      const title = metadata?.title ?? publishTitle;
      const description = metadata?.description ?? publishDescription;
      const tags = metadata ? metadata.tags : ['alwrity', 'youtube', 'ai-video'];
      const restrictTo18 = madeForKids === false && ageRestricted;
      console.info("[YouTubePublishPanel] Publish clicked", {
        ...youtubePublishSourceMeta(videoUrl),
        titleLength: title.length,
        descriptionLength: description.length,
        tagCount: tags.length,
        hasMetadata: Boolean(metadata),
        hasCategoryId: Boolean(metadata?.category_id),
        hasPublishLine: Boolean(publishLine),
        hasHelperText: Boolean(helperText),
        hasSchedule: Boolean(publishAt),
        privacy: publishAt ? "private" : privacy,
        madeForKids,
        ageRestricted: restrictTo18,
        connected: youtube.connected,
        hasActiveChannel: Boolean(activeChannel),
      });
      youtube.publishToYouTube(videoUrl, title, {
        description,
        tags,
        privacy_status: publishAt ? 'private' : privacy,
        publish_at: publishAt,
        made_for_kids: madeForKids,
        ...(restrictTo18 ? { age_restricted: true } : {}),
        ...(metadata ? { category_id: metadata.category_id } : {}),
      });
    } catch (error) {
      console.error("[YouTubePublishPanel] Publish click failed", {
        errorName: error instanceof Error ? error.name : "Error",
      });
    }
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
            Connect your YouTube account and publish or schedule the generated video. Scheduled
            uploads stay private until go-live (HITL).
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

        {publishLine ? (
          <Typography variant="body2" sx={{ ...helperSx, mt: 0, fontWeight: 600 }}>
            {publishLine}
          </Typography>
        ) : null}

        {helperText ? (
          <Alert severity="info">{helperText}</Alert>
        ) : !videoUrl ? (
          <Alert severity="info">
            Complete final video rendering first. Publish will be enabled once the final video URL is available.
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="yt-privacy-label">Privacy</InputLabel>
            <Select
              labelId="yt-privacy-label"
              label="Privacy"
              value={privacy}
              disabled={Boolean(scheduleLocal)}
              onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
            >
              <MenuItem value="unlisted">Unlisted</MenuItem>
              <MenuItem value="private">Private</MenuItem>
              <MenuItem value="public">Public</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="datetime-local"
            label="Schedule (optional)"
            InputLabelProps={{ shrink: true }}
            value={scheduleLocal}
            onChange={(e) => setScheduleLocal(e.target.value)}
            helperText={
              scheduleLocal
                ? 'Will upload as private until this time (UTC converted).'
                : 'Leave empty to publish now'
            }
            sx={{ minWidth: 240 }}
          />
        </Stack>

        <YouTubePublishAudienceFields
          madeForKids={madeForKids}
          ageRestricted={ageRestricted}
          onMadeForKidsChange={(nextKids) => {
            setMadeForKids(nextKids);
            if (nextKids) {
              setAgeRestricted(false);
            }
          }}
          onAgeRestrictedChange={setAgeRestricted}
        />

        <Button
          variant="contained"
          color="error"
          onClick={handlePublish}
          disabled={
            !youtube.connected ||
            !activeChannel ||
            !videoUrl ||
            youtube.publishState.publishing ||
            madeForKids === null
          }
          startIcon={youtube.publishState.publishing ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : undefined}
          sx={{ width: 'fit-content', fontWeight: 700 }}
        >
          {youtube.publishState.publishing
            ? youtube.publishState.progress || 'Publishing...'
            : scheduleLocal
              ? 'Schedule on YouTube'
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
