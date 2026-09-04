import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Scene, VideoPlan, youtubeApi } from '../../../services/youtubeApi';
import { useYouTubePublish } from '../../../hooks/useYouTubePublish';
import { toYouTubePublishAtIso, youtubeScheduleFieldSx, youtubeScheduleIsInvalid } from './youtubePublishSchedule';
import { youtubePublishSourceMeta } from '../../../hooks/youtubePublishLog';
import type { YouTubePublishMetadata } from './youtubePublishMetadata';
import {
  YouTubePublishAudienceFields,
  type YouTubeMadeForKidsChoice,
} from './YouTubePublishAudienceFields';
import { YouTubePublishThumbnailUpload } from './YouTubePublishThumbnailUpload';
import { youtubePublishDurationType, youtubePublishThumbnailAppliedMessage } from './youtubePublishThumbnail';
import { helperSx, inputSx, labelSx, selectMenuProps, selectSx, TEXT_PRIMARY, BACKGROUND } from '../styles';

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
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const durationType = youtubePublishDurationType(videoPlan?.duration_type);

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
      if (youtubeScheduleIsInvalid(scheduleLocal)) {
        console.warn("[YouTubePublishPanel] Publish skipped: invalid schedule");
        return;
      }
      const title = metadata?.title ?? publishTitle;
      const description = metadata?.description ?? publishDescription;
      const tags = metadata ? metadata.tags : ['alwrity', 'youtube', 'ai-video'];
      const restrictTo18 = madeForKids === false && ageRestricted;
      const effectivePrivacy = publishAt ? 'private' : privacy;
      const publishOptions = {
        description,
        tags,
        privacy_status: effectivePrivacy,
        publish_at: publishAt,
        made_for_kids: madeForKids,
        ...(restrictTo18 ? { age_restricted: true } : {}),
        ...(metadata ? { category_id: metadata.category_id } : {}),
      };
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
        selectedPrivacy: privacy,
        effectivePrivacy,
        madeForKids,
        ageRestricted: restrictTo18,
        hasThumbnail: Boolean(thumbnailFile),
        durationType,
        connected: youtube.connected,
        hasActiveChannel: Boolean(activeChannel),
      });
      if (thumbnailFile) {
        void (async () => {
          try {
            setThumbnailBusy(true);
            setThumbnailError(null);
            const uploaded = await youtubeApi.uploadPublishThumbnail(
              thumbnailFile,
              durationType,
            );
            youtube.publishToYouTube(videoUrl, title, {
              ...publishOptions,
              thumbnail_path: uploaded.thumbnail_path,
              duration_type: durationType,
            });
          } catch (uploadError) {
            console.error("[YouTubePublishPanel] Cover picture upload failed", {
              errorName: uploadError instanceof Error ? uploadError.name : "Error",
            });
            setThumbnailError(
              uploadError instanceof Error
                ? uploadError.message
                : "We could not save that picture. Try again or publish without it.",
            );
          } finally {
            setThumbnailBusy(false);
          }
        })();
        return;
      }
      youtube.publishToYouTube(videoUrl, title, publishOptions);
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
          <FormControl size="small" sx={{ minWidth: 200, flex: '0 0 auto' }}>
            <InputLabel id="yt-privacy-label" sx={labelSx}>
              Privacy
            </InputLabel>
            <Select
              labelId="yt-privacy-label"
              label="Privacy"
              value={privacy}
              onChange={(e) => {
                try {
                  const nextPrivacy = e.target.value as typeof privacy;
                  console.info("[YouTubePublishPanel] Privacy updated", { privacy: nextPrivacy });
                  setPrivacy(nextPrivacy);
                } catch (error) {
                  console.error("[YouTubePublishPanel] Privacy update failed", {
                    errorName: error instanceof Error ? error.name : "Error",
                  });
                }
              }}
              sx={{
                ...selectSx,
                '& .MuiSelect-select': {
                  color: TEXT_PRIMARY,
                  WebkitTextFillColor: TEXT_PRIMARY,
                  backgroundColor: BACKGROUND,
                  padding: '8.5px 14px',
                  fontSize: '0.9375rem',
                },
              }}
              MenuProps={selectMenuProps}
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
            InputLabelProps={{ shrink: true, sx: labelSx }}
            FormHelperTextProps={{ sx: helperSx }}
            value={scheduleLocal}
            onChange={(e) => {
              try {
                const nextSchedule = e.target.value;
                console.info("[YouTubePublishPanel] Schedule updated", {
                  hasSchedule: Boolean(nextSchedule.trim()),
                  hasValidPublishAt: Boolean(toYouTubePublishAtIso(nextSchedule)),
                });
                setScheduleLocal(nextSchedule);
              } catch (error) {
                console.error("[YouTubePublishPanel] Schedule update failed", {
                  errorName: error instanceof Error ? error.name : "Error",
                });
              }
            }}
            helperText={
              scheduleLocal
                ? 'YouTube keeps this private until this time (UTC converted), then publishes it.'
                : 'Leave empty to publish now'
            }
            sx={[inputSx, youtubeScheduleFieldSx]}
          />
        </Stack>

        <YouTubePublishThumbnailUpload
          durationType={durationType}
          disabled={youtube.publishState.publishing || thumbnailBusy}
          file={thumbnailFile}
          error={thumbnailError}
          onFileChange={(nextFile, nextError) => {
            setThumbnailFile(nextFile);
            setThumbnailError(nextError);
          }}
        />

        <YouTubePublishAudienceFields
          madeForKids={madeForKids}
          ageRestricted={ageRestricted}
          onMadeForKidsChange={(nextKids) => {
            try {
              setMadeForKids(nextKids);
              if (nextKids) {
                setAgeRestricted(false);
              }
            } catch (error) {
              console.error("[YouTubePublishPanel] Made for Kids update failed", {
                errorName: error instanceof Error ? error.name : "Error",
              });
            }
          }}
          onAgeRestrictedChange={(nextRestricted) => {
            try {
              setAgeRestricted(nextRestricted);
            } catch (error) {
              console.error("[YouTubePublishPanel] Age restriction update failed", {
                errorName: error instanceof Error ? error.name : "Error",
              });
            }
          }}
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
            thumbnailBusy ||
            madeForKids === null
          }
          startIcon={
            youtube.publishState.publishing || thumbnailBusy
              ? <CircularProgress size={16} sx={{ color: '#fff' }} />
              : undefined
          }
          sx={{ width: 'fit-content', fontWeight: 700 }}
        >
          {thumbnailBusy
            ? 'Saving cover picture...'
            : youtube.publishState.publishing
              ? 'Publishing…'
              : toYouTubePublishAtIso(scheduleLocal)
                ? 'Schedule on YouTube'
                : 'Publish to YouTube'}
        </Button>

        {(youtube.publishState.publishing || thumbnailBusy) && (
          <Stack spacing={1} sx={{ width: '100%' }}>
            <LinearProgress color="error" aria-label="Publish progress" />
            <Typography variant="body2" sx={helperSx}>
              {thumbnailBusy
                ? 'Saving your cover picture…'
                : youtube.publishState.progress ||
                  'Publishing to YouTube… This can take a minute.'}
            </Typography>
          </Stack>
        )}

        {youtube.publishState.videoUrl && (
          <Alert severity="success">
            Published successfully:{' '}
            <a href={youtube.publishState.videoUrl} target="_blank" rel="noopener noreferrer">
              Open on YouTube
            </a>
            {youtube.publishState.thumbnailApplied === true ? (
              <>
                <br />
                {youtubePublishThumbnailAppliedMessage(durationType)}
              </>
            ) : null}
          </Alert>
        )}

        {youtube.publishState.thumbnailError ? (
          <Alert severity="warning">{youtube.publishState.thumbnailError}</Alert>
        ) : youtube.publishState.thumbnailApplied === false ? (
          <Alert severity="warning">
            Your video published, but the cover picture could not be applied. Open YouTube Studio
            and add it from the video details page.
          </Alert>
        ) : null}

        {youtube.publishState.error && (
          <Alert severity="error">
            Publish failed: {youtube.publishState.error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};
