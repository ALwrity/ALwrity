import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Stack, Button, Chip, TextField, Alert, CircularProgress,
} from '@mui/material';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { getAuthTokenGetter, getApiUrl } from '../../../../../api/client';
import { testDriveApi, TestVoiceResponse } from '../../../../../api/onboarding/testDriveApi';

// Hardcoded sample scripts (no backend needed)
const VOICE_SAMPLE_SCRIPTS = [
  {
    id: 'linkedin',
    label: 'LinkedIn intro',
    text:
      "Hi, I'm [Name]. I help marketers turn data into decisions. Connect with me to talk about brand voice.",
  },
  {
    id: 'podcast',
    label: 'Podcast opener',
    text:
      "Welcome back to the show. Today we're diving into something I've been thinking about for a while — the future of brand voice in the age of AI.",
  },
  {
    id: 'blog',
    label: 'Blog teaser',
    text:
      "Most AI writing sounds the same. Yours doesn't have to. In this post, I'll show you how to build a brand voice that actually sounds like you.",
  },
];

const MAX_CHARS = 500;

interface VoiceTabProps {
  hasVoiceClone: boolean;
}

export const VoiceTab: React.FC<VoiceTabProps> = ({ hasVoiceClone }) => {
  const [text, setText] = useState(VOICE_SAMPLE_SCRIPTS[0].text);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestVoiceResponse | null>(null);
  const [authAudioSrc, setAuthAudioSrc] = useState<string | null>(null);

  const charCount = text.length;
  const overLimit = charCount > MAX_CHARS;

  // Build an authenticated URL the <audio> element can hit
  useEffect(() => {
    let cancelled = false;
    const raw = result?.audio_base64
      ? `data:${result?.format || 'audio/mpeg'};base64,${result.audio_base64}`
      : result?.audio_url || null;
    if (!raw) {
      setAuthAudioSrc(null);
      return;
    }
    if (!raw.startsWith('/api/')) {
      setAuthAudioSrc(raw);
      return;
    }
    (async () => {
      try {
        const tokenGetter = getAuthTokenGetter();
        if (!tokenGetter) {
          if (!cancelled) setAuthAudioSrc(raw);
          return;
        }
        const token = await tokenGetter();
        if (cancelled) return;
        if (!token) {
          setAuthAudioSrc(raw);
          return;
        }
        const absolute = raw.startsWith('/') ? `${getApiUrl()}${raw}` : raw;
        const sep = absolute.includes('?') ? '&' : '?';
        setAuthAudioSrc(`${absolute}${sep}token=${encodeURIComponent(token)}`);
      } catch {
        if (!cancelled) setAuthAudioSrc(raw);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const handleSpeak = async () => {
    if (!text.trim() || overLimit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await testDriveApi.testVoice({ text: text.trim() });
      if (resp.success) {
        setResult(resp);
      } else {
        setError(resp.message || 'Voice synthesis failed.');
      }
    } catch (e: any) {
      setError(e?.message || 'Voice synthesis failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasVoiceClone) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0EA5E9 0%, #7dd3fc 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            boxShadow: '0 8px 20px -5px rgba(14, 165, 233, 0.4)',
          }}
        >
          <RecordVoiceOverIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e1b4b', mb: 1 }}>
          Voice Clone not ready yet
        </Typography>
        <Typography variant="body2" sx={{ color: '#6b7280', maxWidth: 360, mx: 'auto' }}>
          Record your voice on the <strong>Voice Clone</strong> tab, then come back here to test
          it with your own text.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e1b4b', mb: 1 }}>
          Type what you'd like your voice to read
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 0.75 }}>
          {VOICE_SAMPLE_SCRIPTS.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              size="small"
              onClick={() => setText(s.text)}
              clickable
              sx={{
                fontWeight: 600,
                fontSize: '0.7rem',
                background: text === s.text ? '#0EA5E9' : '#f1f5f9',
                color: text === s.text ? 'white' : '#475569',
                '&:hover': { background: text === s.text ? '#0284c7' : '#e2e8f0' },
              }}
            />
          ))}
        </Stack>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type the text you want your cloned voice to speak…"
          error={overLimit}
          helperText={
            overLimit
              ? `Too long — ${charCount}/${MAX_CHARS} characters`
              : `${charCount}/${MAX_CHARS} characters`
          }
          sx={{
            '& .MuiOutlinedInput-root': { fontSize: '0.875rem', bgcolor: '#ffffff' },
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleSpeak}
          disabled={loading || !text.trim() || overLimit}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
          sx={{
            background: 'linear-gradient(135deg, #0EA5E9 0%, #0284c7 100%)',
            color: 'white',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 2,
            px: 3,
            '&:hover': { background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' },
            '&.Mui-disabled': { background: '#94a3b8', color: 'white' },
          }}
        >
          {loading ? 'Synthesizing…' : 'Speak it'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {result && (result.audio_url || result.audio_base64) && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid #bae6fd',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <RecordVoiceOverIcon sx={{ fontSize: 16, color: '#0EA5E9' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Your voice — preview
            </Typography>
            {result.engine && (
              <Chip
                size="small"
                label={result.engine}
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#0EA5E915', color: '#0c4a6e' }}
              />
            )}
          </Stack>
          <audio
            controls
            src={authAudioSrc || undefined}
            style={{ width: '100%', height: 36 }}
          />
          <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 1 }}>
            Fresh synthesis with your stored voice clone. Type a new script to hear it again.
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

export default VoiceTab;
