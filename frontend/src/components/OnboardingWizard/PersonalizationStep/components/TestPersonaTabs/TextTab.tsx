import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Stack, Button, Chip, TextField, Alert, CircularProgress,
  Grid, Card, CardContent, IconButton, Tooltip, Collapse,
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import CheckIcon from '@mui/icons-material/Check';
import LockIcon from '@mui/icons-material/Lock';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { testDriveApi, TestTextResponse } from '../../../../../api/onboarding/testDriveApi';

const SAMPLE_PROMPTS = [
  {
    id: 'product',
    label: 'Product launch',
    prompt:
      "Write a LinkedIn post announcing our new AI scheduling tool that turns 1-hour weekly meetings into 5 minutes of focused work.",
  },
  {
    id: 'hiring',
    label: 'Hiring post',
    prompt:
      "Write a Twitter thread about why we're hiring our first content engineer and what we believe about content at our stage.",
  },
  {
    id: 'tip',
    label: 'Industry tip',
    prompt:
      "Write a blog intro about why most B2B content fails to drive pipeline — the unspoken reason nobody talks about.",
  },
  {
    id: 'opinion',
    label: 'Opinion',
    prompt:
      "Write a LinkedIn post arguing that brand voice matters more than SEO for early-stage companies. Take a clear stance.",
  },
];

const FEEDBACK_REASONS = [
  'Too formal',
  'Too casual',
  'Wrong tone',
  'Too long',
  "Doesn't match my style",
];

const MAX_PROMPT_CHARS = 1000;
const SESSION_LIMIT = 5;
const SESSION_COUNTER_KEY = 'test_drive_text_counter';

interface TextTabProps {
  /** The user's core persona (with identity / writing_style / brand_voice). */
  corePersona: any;
}

export const TextTab: React.FC<TextTabProps> = ({ corePersona }) => {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPTS[0].prompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestTextResponse | null>(null);
  const [usedCount, setUsedCount] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState<'with' | 'without' | null>(null);
  const [feedbackReasons, setFeedbackReasons] = useState<Record<'with' | 'without', string[]>>({
    with: [],
    without: [],
  });
  const [voted, setVoted] = useState<Record<'with' | 'without', 'up' | 'down' | null>>({
    with: null,
    without: null,
  });
  const [copyState, setCopyState] = useState<Record<'with' | 'without', boolean>>({
    with: false,
    without: false,
  });

  // Load session counter on mount
  useEffect(() => {
    try {
      const counter = sessionStorage.getItem(SESSION_COUNTER_KEY);
      if (counter) setUsedCount(parseInt(counter, 10) || 0);
    } catch (e) { /* ignore */ }
  }, []);

  const atLimit = usedCount >= SESSION_LIMIT;
  const promptOverLimit = prompt.length > MAX_PROMPT_CHARS;

  const bumpCounter = () => {
    setUsedCount((c) => {
      const next = c + 1;
      try {
        sessionStorage.setItem(SESSION_COUNTER_KEY, String(next));
      } catch (e) { /* ignore */ }
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || promptOverLimit || atLimit || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFeedbackOpen(null);
    setVoted({ with: null, without: null });
    setFeedbackReasons({ with: [], without: [] });
    try {
      // Extract a lean persona — only fields the system prompt cares about
      const leanPersona = corePersona
        ? {
            identity: corePersona.identity,
            writing_style: corePersona.writing_style,
            brand_voice: corePersona.brand_voice,
          }
        : {};
      const resp = await testDriveApi.testText({
        prompt: prompt.trim(),
        persona: leanPersona,
        platform: 'blog',
      });
      if (resp.success) {
        setResult(resp);
        bumpCounter();
      } else {
        setError(resp.message || 'Text generation failed.');
      }
    } catch (e: any) {
      setError(e?.message || 'Text generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (key: 'with' | 'without', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState((s) => ({ ...s, [key]: true }));
      setTimeout(() => setCopyState((s) => ({ ...s, [key]: false })), 1500);
    } catch (e) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopyState((s) => ({ ...s, [key]: true }));
        setTimeout(() => setCopyState((s) => ({ ...s, [key]: false })), 1500);
      } catch (err) {
        // give up
      }
      document.body.removeChild(textarea);
    }
  };

  const handleVote = (key: 'with' | 'without', vote: 'up' | 'down') => {
    setVoted((v) => ({ ...v, [key]: vote }));
    if (vote === 'down') {
      setFeedbackOpen(key);
    } else {
      setFeedbackOpen(null);
      // Store 👍 feedback in localStorage
      try {
        const key = `test_drive_feedback_thumbup_${Date.now()}`;
        const data = { side: key, prompt: prompt.slice(0, 200), ts: Date.now() };
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) { /* ignore */ }
    }
  };

  const handleReasonToggle = (side: 'with' | 'without', reason: string) => {
    setFeedbackReasons((prev) => {
      const list = prev[side] || [];
      const next = list.includes(reason)
        ? list.filter((r) => r !== reason)
        : [...list, reason];
      return { ...prev, [side]: next };
    });
  };

  const handleSubmitFeedback = () => {
    // Store 👎 feedback in localStorage (no backend per design)
    try {
      const stored = {
        side: feedbackOpen,
        reasons: feedbackReasons[feedbackOpen!] || [],
        prompt: prompt.slice(0, 200),
        ts: Date.now(),
      };
      const key = `test_drive_feedback_thumbdown_${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(stored));
    } catch (e) { /* ignore */ }
    setFeedbackOpen(null);
  };

  if (!corePersona) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED 0%, #a78bfa 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
            boxShadow: '0 8px 20px -5px rgba(124, 58, 237, 0.4)',
          }}
        >
          <ArticleIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e1b4b', mb: 1 }}>
          Brand Voice not ready yet
        </Typography>
        <Typography variant="body2" sx={{ color: '#6b7280', maxWidth: 360, mx: 'auto' }}>
          Generate a brand voice on the <strong>Brand Voice</strong> tab, then come back here to
          compare text written with vs without it.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Prompt input */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e1b4b' }}>
            Try a prompt
          </Typography>
          <Chip
            size="small"
            icon={atLimit ? <LockIcon sx={{ fontSize: 12 }} /> : undefined}
            label={`${usedCount} / ${SESSION_LIMIT} this session`}
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 700,
              bgcolor: atLimit ? '#fef3c7' : '#f5f3ff',
              color: atLimit ? '#92400e' : '#5b21b6',
            }}
          />
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 0.75 }}>
          {SAMPLE_PROMPTS.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              size="small"
              onClick={() => setPrompt(s.prompt)}
              clickable
              sx={{
                fontWeight: 600,
                fontSize: '0.7rem',
                background: prompt === s.prompt ? '#7C3AED' : '#f1f5f9',
                color: prompt === s.prompt ? 'white' : '#475569',
                '&:hover': { background: prompt === s.prompt ? '#6d28d9' : '#e2e8f0' },
              }}
            />
          ))}
        </Stack>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type a prompt — e.g. 'Write a LinkedIn post announcing our new product'"
          error={promptOverLimit}
          helperText={
            promptOverLimit
              ? `Too long — ${prompt.length}/${MAX_PROMPT_CHARS} characters`
              : `${prompt.length}/${MAX_PROMPT_CHARS} characters`
          }
          disabled={atLimit}
          sx={{
            '& .MuiOutlinedInput-root': { fontSize: '0.875rem', bgcolor: '#ffffff' },
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
          <Tooltip arrow title="Both versions are generated in parallel — with your brand voice, and without. Use the same prompt to compare.">
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ cursor: 'help' }}>
              <HelpOutlineIcon sx={{ fontSize: 12, color: '#9ca3af' }} />
              <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.65rem' }}>
                How does this work?
              </Typography>
            </Stack>
          </Tooltip>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim() || promptOverLimit || atLimit}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
            sx={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
              color: 'white',
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              '&:hover': { background: 'linear-gradient(135deg, #6d28d9 0%, #db2777 100%)' },
              '&.Mui-disabled': { background: '#94a3b8', color: 'white' },
            }}
          >
            {loading ? 'Generating both…' : 'Generate both'}
          </Button>
        </Stack>
      </Box>

      {atLimit && (
        <Alert severity="info" sx={{ borderRadius: 2, py: 0.5 }}>
          <Typography variant="caption">
            You've used all 5 generations for this session. Test in the Blog Writer to generate more.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Side-by-side results */}
      <Grid container spacing={1.5}>
        {(['without', 'with'] as const).map((side) => {
          const isWith = side === 'with';
          const text = isWith ? result?.with_voice : result?.without_voice;
          const accent = isWith ? '#7C3AED' : '#64748b';
          const gradient = isWith
            ? 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'
            : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)';
          const label = isWith ? 'With your voice' : 'Without your voice';
          const hasText = !!text;
          const isVoted = voted[side];
          const isCopied = copyState[side];

          return (
            <Grid item xs={12} md={6} key={side}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 2,
                  border: hasText
                    ? `1px solid ${isWith ? '#e9d5ff' : '#e2e8f0'}`
                    : '1px dashed #cbd5e1',
                  background: hasText
                    ? isWith
                      ? 'linear-gradient(135deg, #faf5ff 0%, #fdf4ff 100%)'
                      : '#f8fafc'
                    : '#ffffff',
                  minHeight: 200,
                }}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: 1,
                        background: gradient,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isWith ? <AutoAwesomeIcon sx={{ fontSize: 14 }} /> : <ArticleIcon sx={{ fontSize: 14 }} />}
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {label}
                    </Typography>
                    {isWith && hasText && (
                      <Chip
                        size="small"
                        label="Your brand"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          bgcolor: '#ede9fe',
                          color: '#5b21b6',
                        }}
                      />
                    )}
                  </Stack>

                  {loading ? (
                    <Box
                      sx={{
                        minHeight: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                      }}
                    >
                      <CircularProgress size={20} sx={{ color: accent }} />
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>
                        {isWith ? 'Writing with your voice…' : 'Writing generic…'}
                      </Typography>
                    </Box>
                  ) : !hasText ? (
                    <Box
                      sx={{
                        minHeight: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#9ca3af', textAlign: 'center', fontStyle: 'italic' }}>
                        {isWith
                          ? 'Your voice will appear here — using your archetype, tone, and style.'
                          : 'A generic AI version will appear here for comparison.'}
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#1f2937',
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.825rem',
                          maxHeight: 220,
                          overflow: 'auto',
                          pr: 0.5,
                        }}
                      >
                        {text}
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1, pt: 1, borderTop: '1px solid #e2e8f0' }}>
                        <Tooltip title="Copy" arrow>
                          <IconButton size="small" onClick={() => handleCopy(side, text!)} sx={{ color: isCopied ? '#10b981' : '#64748b' }}>
                            {isCopied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </Tooltip>
                        <Box sx={{ flex: 1 }} />
                        <Tooltip title={isVoted === 'up' ? 'You liked this' : 'Looks good'} arrow>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleVote(side, 'up')}
                              disabled={!!isVoted}
                              sx={{
                                color: isVoted === 'up' ? '#10b981' : '#9ca3af',
                                '&:hover': { color: '#10b981' },
                              }}
                            >
                              {isVoted === 'up' ? <ThumbUpIcon sx={{ fontSize: 16 }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Tell us what didn't sound like you" arrow>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleVote(side, 'down')}
                              disabled={!!isVoted}
                              sx={{
                                color: isVoted === 'down' ? '#ef4444' : '#9ca3af',
                                '&:hover': { color: '#ef4444' },
                              }}
                            >
                              {isVoted === 'down' ? <ThumbDownIcon sx={{ fontSize: 16 }} /> : <ThumbDownOutlinedIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>

                      <Collapse in={feedbackOpen === side} timeout={200}>
                        <Box sx={{ mt: 1, p: 1.25, borderRadius: 1.5, background: '#fef2f2', border: '1px solid #fecaca' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#7f1d1d', display: 'block', mb: 0.5 }}>
                            What didn't sound like you? (optional)
                          </Typography>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5, mb: 1 }}>
                            {FEEDBACK_REASONS.map((reason) => {
                              const selected = feedbackReasons[side].includes(reason);
                              return (
                                <Chip
                                  key={reason}
                                  label={reason}
                                  size="small"
                                  onClick={() => handleReasonToggle(side, reason)}
                                  sx={{
                                    fontSize: '0.65rem',
                                    height: 22,
                                    fontWeight: 600,
                                    bgcolor: selected ? '#fee2e2' : '#ffffff',
                                    color: selected ? '#7f1d1d' : '#475569',
                                    border: '1px solid',
                                    borderColor: selected ? '#fca5a5' : '#e2e8f0',
                                    '&:hover': { bgcolor: selected ? '#fecaca' : '#f8fafc' },
                                  }}
                                />
                              );
                            })}
                          </Stack>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              onClick={() => setFeedbackOpen(null)}
                              sx={{ textTransform: 'none', fontSize: '0.7rem' }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={handleSubmitFeedback}
                              sx={{
                                textTransform: 'none',
                                fontSize: '0.7rem',
                                bgcolor: '#7f1d1d',
                                '&:hover': { bgcolor: '#991b1b' },
                              }}
                            >
                              Send feedback
                            </Button>
                          </Stack>
                        </Box>
                      </Collapse>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
};

export default TextTab;
