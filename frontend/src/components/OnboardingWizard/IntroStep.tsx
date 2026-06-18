import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Chip,
  LinearProgress,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import InsightsIcon from '@mui/icons-material/Insights';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface IntroStepProps {
  updateHeaderContent: (content: { title: string; description: string }) => void;
}

interface ProviderLimit {
  key: string;
  label: string;
  tooltip: string;
  color: string;
  icon: string;
}

const providerLimits: ProviderLimit[] = [
  { key: 'ai_text_generation_calls', label: 'AI Writing', icon: '✍️', color: '#6366f1', tooltip: 'AI text generation for blog posts, captions, emails, and ad copy. Each generation counts as one call.' },
  { key: 'gemini_calls', label: 'Gemini', icon: '🧠', color: '#4285f4', tooltip: "Google's AI model for text analysis, content research, and smart suggestions." },
  { key: 'openai_calls', label: 'OpenAI', icon: '🤖', color: '#10a37f', tooltip: 'GPT-powered content generation for writing, rewriting, and brainstorming ideas.' },
  { key: 'anthropic_calls', label: 'Anthropic', icon: '🔮', color: '#d97706', tooltip: "Claude AI — great for safe, well-reasoned content that needs a human-like touch." },
  { key: 'tavily_calls', label: 'Tavily', icon: '🔍', color: '#8b5cf6', tooltip: 'AI-powered web research. Finds relevant articles, data, and insights for your content.' },
  { key: 'exa_calls', label: 'Exa Search', icon: '🌐', color: '#06b6d4', tooltip: 'Smart search engine that finds relevant content, trends, and competitor pages.' },
  { key: 'firecrawl_calls', label: 'Firecrawl', icon: '🕸️', color: '#ef4444', tooltip: 'Website crawling — reads your site and competitor pages to learn your brand and market.' },
  { key: 'stability_calls', label: 'Image Gen', icon: '🎨', color: '#ec4899', tooltip: 'AI image generation for social media posts, ads, blog visuals, and brand assets.' },
  { key: 'video_calls', label: 'Video', icon: '🎬', color: '#f97316', tooltip: 'AI video generation and editing for short-form content, promos, and social clips.' },
  { key: 'audio_calls', label: 'Audio', icon: '🎵', color: '#14b8a6', tooltip: 'AI voice-over and audio generation for podcasts, narrations, and sound assets.' },
  { key: 'wavespeed_calls', label: 'WaveSpeed', icon: '⚡', color: '#a855f7', tooltip: 'High-speed AI inference — powers real-time content suggestions and instant rewrites.' },
];

const planTooltips: Record<string, string> = {
  'Your Plan': 'Your subscription plan decides how many AI actions you can take each month. Upgrade anytime for more capacity.',
  'Active': 'Your subscription is active — you can use all features included in your plan.',
  'Monthly Spend': 'Total cost of all AI services used this billing period. Resets each month.',
  'AI Writing Used': 'How many AI text generations (blog posts, emails, captions) you have used out of your monthly limit.',
  'Image Gen Used': 'How many AI image generations you have used out of your monthly limit.',
};

const platformSteps = [
  {
    id: 1,
    title: 'Connect your API Keys',
    icon: '🔑',
    detail: 'Wire your AI providers. Paste your existing API keys — no lock-in, no hidden fees. ALwrity uses them to generate, research, and create on your behalf.'
  },
  {
    id: 2,
    title: 'Teach ALwrity your Brand',
    icon: '🌐',
    detail: 'Point ALwrity to your website. It reads your pages like a smart assistant so every output — blog, email, social — sounds like you.'
  },
  {
    id: 3,
    title: 'Map your Market',
    icon: '🔍',
    detail: 'ALwrity scans your niche and competitors, then highlights the topics and keywords your audience is searching for. No more guessing what to create next.'
  },
  {
    id: 4,
    title: 'Define Your Persona & Voice',
    icon: '⚙️',
    detail: 'Describe your ideal customer and brand voice. ALwrity builds personas that guide every headline, caption, and CTA.'
  },
  {
    id: 5,
    title: 'Connect Your Channels',
    icon: '🔗',
    detail: 'Integrate with the platforms where your audience lives — blog, social, analytics. Insights and drafts flow where you already work.'
  },
  {
    id: 6,
    title: 'Launch Your Growth Engine',
    icon: '🚀',
    detail: 'ALwrity monitors what works, suggests next moves, and keeps your content engine running 24/7 — even when you are busy with clients or product.'
  }
];

const IntroStep: React.FC<IntroStepProps> = ({ updateHeaderContent }) => {
  const [showPlatformOverview, setShowPlatformOverview] = useState(false);
  const { subscription } = useSubscription();

  useEffect(() => {
    updateHeaderContent({
      title: 'ALwrity Onboarding',
      description: 'Set up your AI Marketing OS in under 2 minutes.'
    });
  }, [updateHeaderContent]);

  const plan = subscription?.plan || 'Free';
  const tier = subscription?.tier || 'free';
  const status = subscription?.active ? 'Active' : 'Inactive';
  const limits = subscription?.limits;
  const usage = subscription?.currentUsage || {};

  const usagePct = (used: number | undefined, limit: number | undefined): number => {
    if (!limit || limit === 0) return 0;
    return Math.min(100, Math.round(((used || 0) / limit) * 100));
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: { xs: 2, md: 3 }, py: 0.25, overflow: 'hidden' }}>
      {/* ── Product Narrative ── */}
      <Box sx={{ textAlign: 'center', mb: 0.75, mt: 0 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mb: 0 }}>
          <RocketLaunchIcon sx={{ color: '#667eea', fontSize: 24 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: '#1e293b' }}>
            ALwrity
          </Typography>
          <Chip
            label="AI Marketing OS"
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: 11,
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              borderRadius: 1,
              height: 20,
            }}
          />
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: '#475569',
            maxWidth: 600,
            mx: 'auto',
            lineHeight: 1.4,
            fontSize: 12.5,
          }}
        >
          The first AI-native operating system for growth marketing. Plan, create, publish, and optimize across every channel — from one place.
        </Typography>
      </Box>

      {/* ── Subscription & AI Limits ── */}
      <Grid container spacing={1} sx={{ flex: 1, minHeight: 0 }}>
        {/* Left: Plan Summary — compact */}
        <Grid item xs={12} md={4}>
          <Box
            sx={{
              height: '100%',
              borderRadius: 2.5,
              p: 1.25,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))',
              border: '1px solid rgba(99,102,241,0.15)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 13 }}>
              <AutoAwesomeIcon sx={{ fontSize: 16, color: '#667eea' }} />
              <Tooltip title={planTooltips['Your Plan']} arrow placement="top">
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, cursor: 'help' }}>
                  Your Plan
                  <InfoOutlinedIcon sx={{ fontSize: 12, color: '#94a3b8' }} />
                </Box>
              </Tooltip>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', lineHeight: 1, fontSize: 22 }}>
                {plan}
              </Typography>
              <Tooltip title={planTooltips['Active']} arrow placement="top">
                <Chip
                  label={status}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    fontSize: 10.5,
                    backgroundColor: status === 'Active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: status === 'Active' ? '#16a34a' : '#dc2626',
                    borderRadius: 1,
                    height: 18,
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              {[
                { label: 'Monthly Spend', value: `$${limits?.monthly_cost || 0}`, color: '#667eea', tooltip: planTooltips['Monthly Spend'] },
                { label: 'AI Writing Used', value: `${usagePct(usage.ai_text_generation_calls, limits?.ai_text_generation_calls)}%`, color: '#6366f1', tooltip: planTooltips['AI Writing Used'] },
                { label: 'Image Gen Used', value: `${usagePct(usage.stability_calls, limits?.stability_calls)}%`, color: '#ec4899', tooltip: planTooltips['Image Gen Used'] },
              ].map((item) => (
                <Tooltip key={item.label} title={item.tooltip} arrow placement="right">
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      p: 0.6,
                      borderRadius: 1,
                      background: 'white',
                      border: '1px solid rgba(226,232,240,0.5)',
                      cursor: 'help',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, display: 'flex', alignItems: 'center', gap: 0.3 }}>
                      {item.label}
                      <InfoOutlinedIcon sx={{ fontSize: 10, color: '#cbd5e1' }} />
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: item.color, fontSize: 11.5 }}>{item.value}</Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
        </Grid>

        {/* Right: AI Limits Grid — kept as-is, added tooltips */}
        <Grid item xs={12} md={8}>
          <Box
            sx={{
              height: '100%',
              borderRadius: 2.5,
              p: 1.25,
              background: 'rgba(248,250,252,0.8)',
              border: '1px solid rgba(226,232,240,0.8)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 13 }}>
              <PsychologyIcon sx={{ fontSize: 16, color: '#667eea' }} />
              <Tooltip title="Each AI service has a monthly limit based on your plan. These bars show how much you have used so far." arrow placement="top">
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, cursor: 'help' }}>
                  AI Service Limits
                  <InfoOutlinedIcon sx={{ fontSize: 12, color: '#94a3b8' }} />
                </Box>
              </Tooltip>
            </Typography>
            <Grid container spacing={0.8}>
              {providerLimits.map((provider) => {
                const limitVal = limits?.[provider.key as keyof typeof limits] as number | undefined;
                const usageVal = usage?.[provider.key as keyof typeof usage] as number | undefined;
                const pct = usagePct(usageVal, limitVal);
                return (
                  <Grid item xs={6} sm={4} key={provider.key}>
                    <Tooltip title={`${provider.tooltip}\n\nUsed: ${usageVal || 0} / ${limitVal || 'Unlimited'} (${pct}%)`} arrow placement="top">
                      <Box
                        sx={{
                          p: 0.6,
                          borderRadius: 1.5,
                          background: 'white',
                          border: '1px solid rgba(226,232,240,0.6)',
                          cursor: 'help',
                          transition: 'all 0.15s ease',
                          '&:hover': { borderColor: provider.color, boxShadow: `0 0 0 1px ${provider.color}20` },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2 }}>
                          <Typography variant="caption" sx={{ fontSize: 13, lineHeight: 1 }}>{provider.icon}</Typography>
                          <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600, color: '#475569', lineHeight: 1.2 }}>
                            {provider.label}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 2.5,
                            borderRadius: 2,
                            backgroundColor: 'rgba(226,232,240,0.5)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: pct >= 90 ? '#ef4444' : provider.color,
                              borderRadius: 2,
                            },
                          }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.1 }}>
                          <Typography variant="caption" sx={{ fontSize: 9, color: '#94a3b8' }}>
                            {usageVal || 0}/{limitVal || '∞'}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 600, color: pct >= 90 ? '#ef4444' : '#64748b' }}>
                            {pct}%
                          </Typography>
                        </Box>
                      </Box>
                    </Tooltip>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        </Grid>
      </Grid>

      {/* ── Know ALwrity Platform ── */}
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.25 }}>
        <Button
          variant="text"
          onClick={() => setShowPlatformOverview(true)}
          startIcon={<InsightsIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: '#667eea',
            fontSize: 12.5,
            '&:hover': { backgroundColor: 'rgba(102,126,234,0.08)' },
          }}
        >
          Know ALwrity Platform
        </Button>
      </Box>

      {/* ── Platform Overview Dialog ── */}
      <Dialog
        open={showPlatformOverview}
        onClose={() => setShowPlatformOverview(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            color: 'white',
            maxHeight: '90vh',
          },
        }}
      >
        <IconButton onClick={() => setShowPlatformOverview(false)} sx={{ position: 'absolute', right: 12, top: 12, color: 'rgba(255,255,255,0.7)' }}>
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mb: 0.5 }}>
            ALwrity — Your AI Marketing OS
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.7)', textAlign: 'center', mb: 3, maxWidth: 500, mx: 'auto', fontSize: 13 }}>
            Six focused steps in under 2 minutes. Each is skippable and editable later.
          </Typography>
          <Grid container spacing={1.5}>
            {platformSteps.map((step) => (
              <Grid item xs={12} sm={6} key={step.id}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(148,163,184,0.15)',
                    transition: 'all 0.2s ease',
                    '&:hover': { background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(148,163,184,0.3)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body1" sx={{ fontSize: 20, lineHeight: 1 }}>{step.icon}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'white', fontSize: 13 }}>
                      {step.title}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.7)', display: 'block', lineHeight: 1.4, fontSize: 11.5 }}>
                    {step.detail}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ textAlign: 'center', mt: 2.5 }}>
            <Button
              variant="contained"
              onClick={() => setShowPlatformOverview(false)}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                px: 4,
              }}
            >
              Got it — Start Setup
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default IntroStep;
