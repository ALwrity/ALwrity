/**
 * Channel Bible editor — shared by Video Creator Plan and Studio Hub modal.
 * Parent owns fetch/save/apply; this file is the single UI surface for fields.
 */

import React, { useCallback } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  InputLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import type { YouTubeChannelBible } from '../../../services/youtubeApi';
import { helperSx, inputSx, labelSx } from '../styles';

export type ChannelBiblePanelVariant = 'accordion' | 'standalone';

export interface ChannelBiblePanelProps {
  bible: YouTubeChannelBible | null;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  disabled?: boolean;
  planAvatarUrl?: string | null;
  /** accordion = Plan step; standalone = Studio Hub modal (always expanded). */
  variant?: ChannelBiblePanelVariant;
  /** When false, hides Apply (Hub has no live Plan draft to apply). Default true. */
  showApplyToVideo?: boolean;
  onChange: (bible: YouTubeChannelBible) => void;
  onSave: () => void;
  onApplyToThisVideo?: () => void;
}

const EMPTY_HINT = 'Save your channel defaults so the next video starts with your niche, audience, style, and CTA.';

const TEXT_FIELDS: Array<{
  key: keyof YouTubeChannelBible;
  label: string;
  placeholder: string;
  helperText?: string;
  multiline?: boolean;
}> = [
  {
    key: 'channel_name',
    label: 'Channel name (optional)',
    placeholder: "Example: 'Tech Explained with Sarah' or 'Budget Travel Diaries'",
    helperText: 'Optional display name for your channel identity.',
  },
  {
    key: 'niche',
    label: 'Niche',
    placeholder: "Example: 'AI tools for founders' or 'Budget travel and solo backpacking'",
    helperText: 'Your channel topic — reused as the default niche for every new video.',
  },
  {
    key: 'target_audience',
    label: 'Target audience',
    placeholder: "Example: 'Tech-savvy professionals aged 25-40, interested in productivity tools'",
    helperText: 'Who your channel speaks to. Prefills Target Audience on Plan Step.',
    multiline: true,
  },
  {
    key: 'default_video_goal',
    label: 'Default video goal',
    placeholder: "Example: 'Educate viewers on AI basics and drive 500 subscribers'",
    helperText: 'Default Primary Goal for new videos.',
  },
  {
    key: 'default_cta',
    label: 'Default CTA',
    placeholder: "Example: 'Subscribe for weekly tips' or 'Download the free checklist in the description'",
    helperText: 'Closing call-to-action line the planner should lean on.',
  },
  {
    key: 'brand_style',
    label: 'Brand style',
    placeholder: "Example: 'Modern minimalist, tech-forward, clean with blue accents'",
    helperText: 'Visual aesthetic reused for avatar, scenes, and tone.',
  },
  {
    key: 'visual_style_guide',
    label: 'Visual style guide',
    placeholder: "Example: 'neon-lit Tokyo alley, rainy night, cinematic bokeh' or 'bright, clean, modern office space'",
    helperText: 'Mood, lighting, and scene direction for generated visuals.',
    multiline: true,
  },
  {
    key: 'tone',
    label: 'Tone',
    placeholder: "Example: 'Friendly and conversational' or 'Authoritative but approachable'",
    helperText: 'How your channel sounds across scripts and narration.',
  },
];

function isEmptyIdentity(bible: YouTubeChannelBible): boolean {
  return ![bible.niche, bible.target_audience, bible.brand_style, bible.default_cta]
    .some((value) => Boolean((value || '').trim()));
}

export const ChannelBiblePanel: React.FC<ChannelBiblePanelProps> = ({
  bible,
  loading = false,
  saving = false,
  error = null,
  disabled = false,
  planAvatarUrl,
  variant = 'accordion',
  showApplyToVideo = true,
  onChange,
  onSave,
  onApplyToThisVideo,
}) => {
  const standalone = variant === 'standalone';

  const handleField = useCallback(
    (key: keyof YouTubeChannelBible, value: string) => {
      if (!bible) return;
      try {
        onChange({ ...bible, [key]: value });
      } catch (err) {
        console.error('[ChannelBiblePanel] onChange failed', err);
      }
    },
    [bible, onChange],
  );

  const handleSave = useCallback(() => {
    console.info('[ChannelBiblePanel] Save channel defaults', {
      variant,
      hasNiche: Boolean(bible?.niche?.trim()),
      hasAudience: Boolean(bible?.target_audience?.trim()),
      hasStyle: Boolean(bible?.brand_style?.trim()),
      hasCta: Boolean(bible?.default_cta?.trim()),
      hasAvatar: Boolean(bible?.default_avatar_url?.trim()),
    });
    onSave();
  }, [bible, onSave, variant]);

  const handleApply = useCallback(() => {
    if (!onApplyToThisVideo) {
      console.warn('[ChannelBiblePanel] Apply requested but no handler provided');
      return;
    }
    console.info('[ChannelBiblePanel] Apply to this video', {
      hasNiche: Boolean(bible?.niche?.trim()),
      hasAudience: Boolean(bible?.target_audience?.trim()),
      hasStyle: Boolean(bible?.brand_style?.trim()),
      hasCta: Boolean(bible?.default_cta?.trim()),
    });
    onApplyToThisVideo();
  }, [bible, onApplyToThisVideo]);

  const handleUsePlanAvatar = useCallback(() => {
    if (!bible) return;
    const url = (planAvatarUrl || '').trim();
    handleField('default_avatar_url', url);
  }, [bible, handleField, planAvatarUrl]);

  if (!bible && !loading) {
    return (
      <Alert severity="warning" sx={{ mb: 1 }}>
        {error ||
          (standalone
            ? 'Could not load channel bible. Fix the error and try again.'
            : 'Could not load channel bible. You can still plan this video.')}
      </Alert>
    );
  }

  const formBody = (
    <>
      {loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Loading channel defaults…
        </Typography>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {bible && isEmptyIdentity(bible) && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {EMPTY_HINT}
        </Alert>
      )}
      {bible && (
        <Stack spacing={1.5}>
          {TEXT_FIELDS.map((field) => (
            <Box key={String(field.key)}>
              <InputLabel sx={{ ...labelSx, mb: 0.5 }}>{field.label}</InputLabel>
              <TextField
                fullWidth
                size="small"
                placeholder={field.placeholder}
                value={String(bible[field.key] ?? '')}
                onChange={(event) => handleField(field.key, event.target.value)}
                disabled={disabled || saving}
                multiline={field.multiline}
                rows={field.multiline ? 2 : 1}
                helperText={field.helperText}
                sx={inputSx}
                FormHelperTextProps={{ sx: helperSx }}
              />
            </Box>
          ))}
          <Box>
            <InputLabel sx={{ ...labelSx, mb: 0.5 }}>Default avatar URL</InputLabel>
            <TextField
              fullWidth
              size="small"
              value={bible.default_avatar_url || ''}
              InputProps={{ readOnly: true }}
              placeholder={
                standalone
                  ? 'Set default avatar from Video Creator Plan, or paste after uploading there'
                  : 'Upload an avatar on Plan Step, then click Use current Plan avatar below'
              }
              helperText="URL only — reuse your brand avatar or the avatar from this video."
              sx={inputSx}
              FormHelperTextProps={{ sx: helperSx }}
            />
            <Button
              size="small"
              sx={{ mt: 0.75, textTransform: 'none' }}
              disabled={disabled || saving || !planAvatarUrl}
              onClick={handleUsePlanAvatar}
            >
              Use current Plan avatar
            </Button>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={disabled || saving || loading}
              sx={{ textTransform: 'none' }}
            >
              {saving ? 'Saving…' : 'Save channel defaults'}
            </Button>
            {showApplyToVideo ? (
              <Button
                variant="outlined"
                onClick={handleApply}
                disabled={disabled || loading || !bible || !onApplyToThisVideo}
                sx={{ textTransform: 'none' }}
              >
                Apply to this video
              </Button>
            ) : null}
          </Stack>
        </Stack>
      )}
    </>
  );

  if (standalone) {
    return (
      <Box
        sx={{
          borderRadius: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          p: 2,
          bgcolor: '#fff',
        }}
        data-testid="channel-bible-standalone"
      >
        {formBody}
      </Box>
    );
  }

  return (
    <Accordion
      disableGutters
      disabled={disabled || loading}
      sx={{
        borderRadius: 2,
        '&:before': { display: 'none' },
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        mb: 0.5,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%', pr: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} color="#111827" sx={{ flex: 1 }}>
            Channel Bible
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Niche • Audience • Style • CTA • Avatar
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>{formBody}</AccordionDetails>
    </Accordion>
  );
};
