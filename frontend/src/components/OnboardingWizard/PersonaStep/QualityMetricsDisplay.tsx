import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Tooltip,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  HelpOutline as HelpOutlineIcon,
  Lightbulb as LightbulbIcon,
  RecordVoiceOver as RecordVoiceOverIcon,
  CompareArrows as CompareArrowsIcon,
  Tune as TuneIcon,
  Spellcheck as SpellcheckIcon,
  Insights as InsightsIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList
} from 'recharts';

interface QualityMetrics {
  overall_score: number;
  style_consistency?: number;
  brand_alignment?: number;
  platform_optimization?: number;
  engagement_potential?: number;
  core_completeness?: number;
  platform_consistency?: number;
  linguistic_quality?: number;
  recommendations: string[];
  weights?: {
    core_completeness?: number;
    platform_consistency?: number;
    platform_optimization?: number;
    linguistic_quality?: number;
  };
}

interface QualityMetricsDisplayProps {
  metrics: QualityMetrics;
  /** The full core persona (for the new `confidence` + `what_was_missing` badge). */
  corePersona?: any;
}

interface MetricInfo {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  weight: number;
  weightLabel: string;
  description: string;
  whyItMatters: string;
  howDerived: string;
  icon: React.ReactNode;
  accent: string;
}

const scoreBand = (v: number): { label: string; color: string; bg: string } => {
  if (v >= 90) return { label: 'Excellent', color: '#047857', bg: 'linear-gradient(90deg, #10b981 0%, #059669 100%)' };
  if (v >= 80) return { label: 'Strong', color: '#0f766e', bg: 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)' };
  if (v >= 70) return { label: 'Good', color: '#b45309', bg: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' };
  if (v >= 60) return { label: 'Fair', color: '#c2410c', bg: 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)' };
  return { label: 'Needs work', color: '#b91c1c', bg: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)' };
};

const MetricTooltipBody: React.FC<{ info: MetricInfo }> = ({ info }) => (
  <Box sx={{ p: 1, maxWidth: 320 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Box sx={{ color: info.accent, display: 'flex' }}>{info.icon}</Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e1b4b' }}>
        {info.label}
      </Typography>
      <Chip
        size="small"
        label={`${Math.round(info.weight * 100)}% weight`}
        sx={{
          height: 18,
          fontSize: '0.65rem',
          fontWeight: 700,
          bgcolor: `${info.accent}15`,
          color: info.accent,
        }}
      />
    </Stack>
    <Typography variant="caption" sx={{ color: '#475569', display: 'block', mb: 1, lineHeight: 1.5 }}>
      <strong>What it measures:</strong> {info.description}
    </Typography>
    <Typography variant="caption" sx={{ color: '#475569', display: 'block', mb: 1, lineHeight: 1.5 }}>
      <strong>Why it matters:</strong> {info.whyItMatters}
    </Typography>
    <Typography variant="caption" sx={{ color: '#475569', display: 'block', lineHeight: 1.5 }}>
      <strong>How we calculate it:</strong> {info.howDerived}
    </Typography>
  </Box>
);

export const QualityMetricsDisplay: React.FC<QualityMetricsDisplayProps> = ({ metrics, corePersona }) => {
  const isNewMetrics = metrics.core_completeness !== undefined;
  const w = metrics.weights || {};

  const metricInfos: MetricInfo[] = isNewMetrics
    ? [
        {
          key: 'core_completeness',
          label: 'Brand Voice Accuracy',
          shortLabel: 'Brand Voice',
          value: metrics.core_completeness || 0,
          weight: w.core_completeness ?? 0.30,
          weightLabel: '30% of overall',
          description:
            'How completely we captured the essential elements of your brand voice, writing style, content characteristics, and target audience.',
          whyItMatters:
            'A complete core persona ensures every piece of content sounds authentically like your brand — not generic AI text.',
          howDerived:
            'Checks for the presence of all four required sections (writing style, content characteristics, brand voice, target audience) and gives a +10 boost when linguistic analysis is highly complete (>0.8).',
          icon: <RecordVoiceOverIcon sx={{ fontSize: 16 }} />,
          accent: '#7C3AED',
        },
        {
          key: 'platform_consistency',
          label: 'Platform Consistency',
          shortLabel: 'Consistency',
          value: metrics.platform_consistency || 0,
          weight: w.platform_consistency ?? 0.25,
          weightLabel: '25% of overall',
          description:
            'How well your core brand keywords carry through into every platform-specific adaptation (LinkedIn, Twitter, Blog, etc.).',
          whyItMatters:
            'Your audience should recognize your brand whether they see you on LinkedIn, on your blog, or in a tweet. Consistency builds trust.',
          howDerived:
            'For each platform, we measure the overlap between the platform persona keywords and your core brand keywords. We then average across all platforms (10 points per matching keyword, capped at 100).',
          icon: <CompareArrowsIcon sx={{ fontSize: 16 }} />,
          accent: '#EC4899',
        },
        {
          key: 'platform_optimization',
          label: 'Platform Optimization',
          shortLabel: 'Optimization',
          value: metrics.platform_optimization || 0,
          weight: w.platform_optimization ?? 0.25,
          weightLabel: '25% of overall',
          description:
            'Whether each platform persona includes platform-specific optimizations, content guidelines, and engagement strategies.',
          whyItMatters:
            'A LinkedIn post and a tweet work very differently. Optimization ensures your AI knows the rules of each platform — length, tone, hashtag strategy, and more.',
          howDerived:
            'Each platform persona is checked for optimization keys (platform_optimizations, content_guidelines, engagement_strategies). 90 points if present, 60 if missing — averaged across all platforms.',
          icon: <TuneIcon sx={{ fontSize: 16 }} />,
          accent: '#0EA5E9',
        },
        {
          key: 'linguistic_quality',
          label: 'Linguistic Quality',
          shortLabel: 'Linguistics',
          value: metrics.linguistic_quality || 0,
          weight: w.linguistic_quality ?? 0.20,
          weightLabel: '20% of overall',
          description:
            'The sophistication of the writing signals we detected — style consistency, vocabulary richness, content coherence, and analysis completeness.',
          whyItMatters:
            'Higher linguistic quality means we can mirror your real voice more accurately, not just the surface-level topics you write about.',
          howDerived:
            'Averages four linguistic signals (analysis completeness, style consistency, vocabulary sophistication, content coherence) — each scored 0–1, then scaled to a 0–100 percentage.',
          icon: <SpellcheckIcon sx={{ fontSize: 16 }} />,
          accent: '#10B981',
        },
      ]
    : [
        {
          key: 'style_consistency',
          label: 'Style Consistency',
          shortLabel: 'Style',
          value: metrics.style_consistency || 0,
          weight: 0.25,
          weightLabel: '25% of overall',
          description: 'How consistent the writing style is across the samples we analyzed.',
          whyItMatters: 'Consistent style builds a recognizable voice for your readers.',
          howDerived: 'Measured by linguistic style analysis across the analyzed content.',
          icon: <SpellcheckIcon sx={{ fontSize: 16 }} />,
          accent: '#7C3AED',
        },
        {
          key: 'brand_alignment',
          label: 'Brand Voice Accuracy',
          shortLabel: 'Brand Voice',
          value: metrics.brand_alignment || 0,
          weight: 0.30,
          weightLabel: '30% of overall',
          description: 'How well the persona matches your stated brand attributes.',
          whyItMatters: 'Alignment with your brand guidelines ensures on-message content.',
          howDerived: 'Compared against the brand attributes you provided in earlier steps.',
          icon: <RecordVoiceOverIcon sx={{ fontSize: 16 }} />,
          accent: '#EC4899',
        },
        {
          key: 'platform_optimization',
          label: 'Platform Optimization',
          shortLabel: 'Optimization',
          value: metrics.platform_optimization || 0,
          weight: 0.25,
          weightLabel: '25% of overall',
          description: 'How well the persona is tailored for each chosen platform.',
          whyItMatters: 'Each platform has its own best practices — this score measures how well we followed them.',
          howDerived: 'Checks for platform-specific optimization keys in each platform persona.',
          icon: <TuneIcon sx={{ fontSize: 16 }} />,
          accent: '#0EA5E9',
        },
        {
          key: 'engagement_potential',
          label: 'Engagement Potential',
          shortLabel: 'Engagement',
          value: metrics.engagement_potential || 0,
          weight: 0.20,
          weightLabel: '20% of overall',
          description: 'How engaging the generated persona is likely to be for your audience.',
          whyItMatters: 'Engaging content gets read, shared, and acted on.',
          howDerived: 'Estimated from tone, hook strength, and call-to-action patterns.',
          icon: <InsightsIcon sx={{ fontSize: 16 }} />,
          accent: '#10B981',
        },
      ];

  const overall = metrics.overall_score || 0;
  const overallBand = scoreBand(overall);

  const overallChartData = [
    { name: 'Overall', value: overall, fill: overallBand.color }
  ];

  const barChartData = metricInfos.map((m) => ({
    name: m.shortLabel,
    score: m.value,
    fill: scoreBand(m.value).color,
  }));

  const topRecommendation = metrics.recommendations && metrics.recommendations.length > 0
    ? metrics.recommendations[0]
    : 'Your personas demonstrate excellent quality across all assessment criteria!';

  // Confidence / "what was missing" derived from the new persona schema.
  // We compute a structural completeness (in case the backend's
  // `confidence` field is missing — e.g. personas generated before the
  // schema upgrade) AND we also read `what_was_missing` for a chip list.
  const personaConfidence: number | null = (() => {
    if (!corePersona) return null;
    if (typeof corePersona.confidence === 'number') {
      return Math.max(0, Math.min(1, corePersona.confidence));
    }
    // Fallback: rough structural completeness (cheap heuristic)
    const fields = [
      corePersona?.identity?.persona_name,
      corePersona?.identity?.archetype,
      corePersona?.identity?.core_belief,
      corePersona?.identity?.brand_voice_description,
      corePersona?.tonal_range?.default_tone,
      corePersona?.linguistic_fingerprint?.lexical_features?.go_to_phrases,
      corePersona?.linguistic_fingerprint?.sentence_metrics?.average_sentence_length_words,
      corePersona?.stylistic_constraints?.punctuation,
    ];
    const filled = fields.filter((f) => {
      if (f == null) return false;
      if (typeof f === 'string') return f.trim().length > 0;
      if (Array.isArray(f)) return f.length > 0;
      if (typeof f === 'object') return Object.keys(f).length > 0;
      return true;
    }).length;
    return filled / fields.length;
  })();
  const whatWasMissing: string[] = Array.isArray(corePersona?.what_was_missing)
    ? corePersona.what_was_missing
    : [];
  const evidenceField: any = corePersona?.evidence;
  const hasEvidence = evidenceField && typeof evidenceField === 'object' && Object.keys(evidenceField).length > 0;
  const confidencePct = personaConfidence != null ? Math.round(personaConfidence * 100) : null;
  const confidenceBand = (() => {
    if (confidencePct == null) return { label: '—', color: '#94a3b8', bg: '#f1f5f9' };
    if (confidencePct >= 80) return { label: 'High confidence', color: '#047857', bg: 'linear-gradient(90deg, #10b981 0%, #059669 100%)' };
    if (confidencePct >= 60) return { label: 'Medium confidence', color: '#b45309', bg: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' };
    return { label: 'Low confidence', color: '#b91c1c', bg: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)' };
  })();

  return (
    <Box>
      {/* Confidence badge — drives the user to plug gaps if low */}
      {confidencePct != null && (
        <Box
          sx={{
            mb: 2,
            p: 1.75,
            borderRadius: 3,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Chip
              size="small"
              label={`${confidencePct}% ${confidenceBand.label}`}
              sx={{
                fontWeight: 700,
                background: confidenceBand.bg,
                color: 'white',
                fontSize: '0.75rem',
                height: 26,
              }}
            />
            <Typography variant="caption" sx={{ color: '#475569', fontSize: '0.75rem' }}>
              {confidencePct >= 80
                ? 'Your brand voice is grounded in rich, multi-source data.'
                : confidencePct >= 60
                ? 'Your brand voice is decent but could be sharper. See gaps below.'
                : 'Your brand voice is data-thin. Plug the gaps below to make it sound more like you.'}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {whatWasMissing.length > 0 && (
              <Tooltip
                arrow
                placement="top"
                title={
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                      What the AI couldn't find
                    </Typography>
                    {whatWasMissing.map((m, i) => (
                      <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                        • {m}
                      </Typography>
                    ))}
                  </Box>
                }
              >
                <Chip
                  size="small"
                  icon={<InfoIcon sx={{ fontSize: 14 }} />}
                  label={`${whatWasMissing.length} data gap${whatWasMissing.length === 1 ? '' : 's'}`}
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: '#fef3c7',
                    color: '#92400e',
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            )}
            {hasEvidence && (
              <Tooltip
                arrow
                placement="top"
                title={
                  <Box sx={{ maxWidth: 280 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                      How we built your persona
                    </Typography>
                    {evidenceField.persona_name_basis && (
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        <strong>Name:</strong> {evidenceField.persona_name_basis}
                      </Typography>
                    )}
                    {evidenceField.archetype_basis && (
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        <strong>Archetype:</strong> {evidenceField.archetype_basis}
                      </Typography>
                    )}
                    {evidenceField.tone_basis && (
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        <strong>Tone:</strong> {evidenceField.tone_basis}
                      </Typography>
                    )}
                  </Box>
                }
              >
                <Chip
                  size="small"
                  icon={<HelpOutlineIcon sx={{ fontSize: 14 }} />}
                  label="Why this voice?"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: '#ede9fe',
                    color: '#5b21b6',
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            )}
          </Stack>
        </Box>
      )}

      {/* Top row: Overall score (radial) + key insights */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        sx={{
          p: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%)',
          border: '1px solid #e9d5ff',
          mb: 2.5,
        }}
      >
        {/* Overall radial chart */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: '100%', md: 220 },
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="75%"
              outerRadius="100%"
              data={overallChartData}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar
                background
                dataKey="value"
                cornerRadius={20}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                lineHeight: 1,
                background: overallBand.bg,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {overall}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#6b7280', mt: 0.5 }}>
              OUT OF 100
            </Typography>
            <Chip
              size="small"
              label={overallBand.label}
              sx={{
                mt: 0.75,
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'white',
                background: overallBand.bg,
              }}
            />
          </Box>
        </Box>

        {/* Overall explanation */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="overline" sx={{ fontWeight: 700, color: '#7C3AED', letterSpacing: 1 }}>
              Overall Quality Score
            </Typography>
            <Tooltip
              arrow
              placement="top"
              title={
                <Box sx={{ p: 0.5, maxWidth: 300 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 700 }}>
                    How this is calculated
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    Overall = (Brand Voice × 30%) + (Consistency × 25%) + (Optimization × 25%) + (Linguistics × 20%)
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    Each sub-score is a 0–100 percentage. The weighted sum gives the final overall score.
                  </Typography>
                </Box>
              }
            >
              <HelpOutlineIcon sx={{ fontSize: 14, color: '#9ca3af', cursor: 'help' }} />
            </Tooltip>
          </Stack>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e1b4b', mb: 1 }}>
            {overallBand.label === 'Excellent' && 'Outstanding brand voice — ready to power your content'}
            {overallBand.label === 'Strong' && 'Strong brand voice — small tweaks will make it even better'}
            {overallBand.label === 'Good' && 'Solid foundation — a few areas can be sharpened'}
            {overallBand.label === 'Fair' && 'Good start — focus on the recommendations below'}
            {overallBand.label === 'Needs work' && 'Foundational — regenerate with more brand inputs to improve'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#4b5563', lineHeight: 1.6, mb: 1.5 }}>
            {topRecommendation}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<InsightsIcon sx={{ fontSize: 14 }} />}
              label={`Weighted average of ${metricInfos.length} sub-scores`}
              size="small"
              sx={{ height: 24, fontSize: '0.7rem', bgcolor: '#ede9fe', color: '#5b21b6', fontWeight: 600 }}
            />
            <Chip
              icon={<LightbulbIcon sx={{ fontSize: 14 }} />}
              label="Hover any metric for the 'why' and 'how'"
              size="small"
              sx={{ height: 24, fontSize: '0.7rem', bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600 }}
            />
          </Stack>
        </Box>
      </Stack>

      {/* Middle row: compact bar chart + legend rows */}
      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          mb: 2.5,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <InsightsIcon sx={{ fontSize: 18, color: '#7C3AED' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e1b4b' }}>
              Score Breakdown
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: '#6b7280' }}>
            {metricInfos.length} sub-scores that roll up into the overall
          </Typography>
        </Stack>

        {/* Bar chart */}
        <Box sx={{ height: 160, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barChartData}
              layout="vertical"
              margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
              barCategoryGap={10}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                width={88}
              />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} background={{ fill: '#f3f4f6' }}>
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="score"
                  position="right"
                  formatter={(v: any) => `${v}`}
                  style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Detailed list with tooltips */}
        <Stack spacing={1.25}>
          {metricInfos.map((info) => {
            const band = scoreBand(info.value);
            return (
              <Tooltip
                key={info.key}
                arrow
                placement="right"
                title={<MetricTooltipBody info={info} />}
              >
                <Box
                  sx={{
                    p: 1.25,
                    pl: 1.5,
                    borderRadius: 2,
                    border: '1px solid #f3f4f6',
                    background: '#fafafa',
                    cursor: 'help',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      background: `${info.accent}08`,
                      borderColor: `${info.accent}40`,
                      transform: 'translateX(2px)',
                    },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1.5,
                        background: `${info.accent}15`,
                        color: info.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {info.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, color: '#1e1b4b' }}
                        >
                          {info.label}
                        </Typography>
                        <HelpOutlineIcon sx={{ fontSize: 12, color: '#9ca3af' }} />
                      </Stack>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#6b7280',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {info.description}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 80, textAlign: 'right' }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, color: band.color, lineHeight: 1.2 }}
                      >
                        {info.value}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '0.65rem' }}>
                        {info.weightLabel}
                      </Typography>
                    </Box>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={info.value}
                    sx={{
                      mt: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: '#f3f4f6',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 2,
                        background: band.bg,
                      },
                    }}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
      </Box>

      {/* Bottom: All recommendations */}
      {metrics.recommendations && metrics.recommendations.length > 0 && (
        <Box
          sx={{
            p: 2.5,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1px solid #fde68a',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <LightbulbIcon sx={{ fontSize: 18, color: '#d97706' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#78350f' }}>
              {metrics.recommendations.length === 1
                ? 'Recommendation'
                : `${metrics.recommendations.length} Recommendations`}
            </Typography>
            <Tooltip
              arrow
              title={
                <Typography variant="caption">
                  Recommendations are generated automatically based on which sub-scores are below their target thresholds (85+ for voice and optimization, 80+ for consistency and linguistics).
                </Typography>
              }
            >
              <HelpOutlineIcon sx={{ fontSize: 14, color: '#a16207', cursor: 'help' }} />
            </Tooltip>
          </Stack>
          <Stack spacing={1}>
            {metrics.recommendations.map((rec, i) => {
              const isPositive = rec.toLowerCase().includes('excellent');
              return (
                <Stack
                  key={i}
                  direction="row"
                  alignItems="flex-start"
                  spacing={1.25}
                >
                  <Box
                    sx={{
                      mt: 0.25,
                      flexShrink: 0,
                      color: isPositive ? '#059669' : '#d97706',
                      display: 'flex',
                    }}
                  >
                    {isPositive ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <WarningIcon sx={{ fontSize: 16 }} />}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ color: '#374151', lineHeight: 1.55, fontSize: '0.85rem' }}
                  >
                    {rec}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default QualityMetricsDisplay;
