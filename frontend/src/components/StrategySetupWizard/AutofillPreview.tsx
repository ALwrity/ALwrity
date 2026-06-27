import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Alert,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  AutoAwesome as AiIcon,
  Business as BusinessIcon,
  People as AudienceIcon,
  EmojiObjects as CompetitiveIcon,
  Article as ContentIcon,
  Analytics as PerformanceIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiClient } from '../../api/client';

interface AutofillPreviewProps {
  onDataLoaded?: (fields: Record<string, any>) => void;
}

const FIELD_CATEGORIES: { key: string; label: string; icon: React.ReactNode; fields: string[] }[] = [
  {
    key: 'business_context',
    label: 'Business Context',
    icon: <BusinessIcon />,
    fields: ['business_objectives', 'target_metrics', 'content_budget', 'team_size', 'implementation_timeline', 'market_share', 'competitive_position', 'performance_metrics'],
  },
  {
    key: 'audience_intelligence',
    label: 'Audience Intelligence',
    icon: <AudienceIcon />,
    fields: ['content_preferences', 'consumption_patterns', 'audience_pain_points', 'buying_journey', 'seasonal_trends', 'engagement_metrics'],
  },
  {
    key: 'competitive_intelligence',
    label: 'Competitive Intelligence',
    icon: <CompetitiveIcon />,
    fields: ['top_competitors', 'competitor_content_strategies', 'market_gaps', 'industry_trends', 'emerging_trends'],
  },
  {
    key: 'content_strategy',
    label: 'Content Strategy',
    icon: <ContentIcon />,
    fields: ['preferred_formats', 'content_mix', 'content_frequency', 'optimal_timing', 'quality_metrics', 'editorial_guidelines', 'brand_voice'],
  },
  {
    key: 'performance_analytics',
    label: 'Performance & Analytics',
    icon: <PerformanceIcon />,
    fields: ['traffic_sources', 'conversion_rates', 'content_roi_targets', 'ab_testing_capabilities'],
  },
];

const FIELD_LABELS: Record<string, string> = {
  business_objectives: 'Business Objectives',
  target_metrics: 'Target Metrics',
  content_budget: 'Content Budget',
  team_size: 'Team Size',
  implementation_timeline: 'Timeline',
  market_share: 'Market Share',
  competitive_position: 'Position',
  performance_metrics: 'Performance Metrics',
  content_preferences: 'Content Preferences',
  consumption_patterns: 'Consumption Patterns',
  audience_pain_points: 'Pain Points',
  buying_journey: 'Buying Journey',
  seasonal_trends: 'Seasonal Trends',
  engagement_metrics: 'Engagement Metrics',
  top_competitors: 'Top Competitors',
  competitor_content_strategies: 'Competitor Strategies',
  market_gaps: 'Market Gaps',
  industry_trends: 'Industry Trends',
  emerging_trends: 'Emerging Trends',
  preferred_formats: 'Preferred Formats',
  content_mix: 'Content Mix',
  content_frequency: 'Frequency',
  optimal_timing: 'Optimal Timing',
  quality_metrics: 'Quality Metrics',
  editorial_guidelines: 'Editorial Guidelines',
  brand_voice: 'Brand Voice',
  traffic_sources: 'Traffic Sources',
  conversion_rates: 'Conversion Rates',
  content_roi_targets: 'ROI Targets',
  ab_testing_capabilities: 'A/B Testing',
};

const SOURCE_COLORS: Record<string, string> = {
  ai_generated: 'secondary',
  website_analysis: 'primary',
  onboarding_session: 'success',
  competitor_analysis: 'warning',
  research_preferences: 'info',
  persona_data: 'error',
  unified: 'default',
};

const AutofillPreview: React.FC<AutofillPreviewProps> = ({ onDataLoaded }) => {
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, any>>({});
  const [sources, setSources] = useState<Record<string, string>>({});

  const loadAutofill = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.post('/api/content-planning/enhanced-strategies/strategies/autofill/generate');
      const data = res.data?.data;
      const fetchedFields = data?.fields || {};
      const fetchedSources = data?.sources || {};
      setFields(fetchedFields);
      setSources(fetchedSources);
      onDataLoaded?.(fetchedFields);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load autofill data');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      setError(null);
      const res = await apiClient.post('/api/content-planning/enhanced-strategies/strategies/autofill/regenerate-ai');
      const data = res.data?.data;
      const fetchedFields = data?.fields || {};
      const fetchedSources = data?.sources || {};
      setFields(fetchedFields);
      setSources(fetchedSources);
      onDataLoaded?.(fetchedFields);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to regenerate AI fields');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    loadAutofill();
  }, []);

  const formatValue = (field: any): string => {
    if (!field) return '—';
    const value = field.value ?? field;
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rectangular" height={120} sx={{ mt: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={120} sx={{ mt: 2, borderRadius: 2 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }} action={
        <Button size="small" startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={loadAutofill} disabled={loading}>
          {loading ? 'Retrying...' : 'Retry'}
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  const fieldCount = Object.keys(fields).length;

  if (fieldCount === 0) {
    return (
      <Alert severity="warning" sx={{ m: 3 }} action={
        <Button size="small" startIcon={<RefreshIcon />} onClick={loadAutofill}>
          Try Again
        </Button>
      }>
        <Typography variant="subtitle1" fontWeight={600}>No Strategy Inputs</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          No autofill data was returned. Make sure onboarding is complete, then try again.
        </Typography>
      </Alert>
    );
  }
  const aiCount = Object.values(sources).filter(s => s === 'ai_generated').length;
  const dbCount = fieldCount - aiCount;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <AiIcon color="secondary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700}>
          Strategy Inputs Preview
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Chip label={`${fieldCount}/30 fields`} size="small" color="primary" />
        <Chip label={`${dbCount} from onboarding`} size="small" color="success" variant="outlined" />
        <Chip label={`${aiCount} AI-enhanced`} size="small" color="secondary" variant="outlined" />
        <Button
          size="small"
          startIcon={regenerating ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleRegenerate}
          disabled={regenerating}
          sx={{ ml: 'auto' }}
        >
          {regenerating ? 'Regenerating...' : 'Regenerate AI'}
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These 30 strategic inputs are auto-populated from your onboarding data and AI analysis.
        All fields are read-only here. Review them, then proceed to strategy generation.
      </Typography>

      {FIELD_CATEGORIES.map((category) => {
        const categoryFields = category.fields.filter(f => fields[f] !== undefined);
        if (categoryFields.length === 0) return null;

        return (
          <Card variant="outlined" sx={{ mb: 2 }} key={category.key}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ color: 'primary.main' }}>{category.icon}</Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {category.label}
                </Typography>
                <Chip label={`${categoryFields.length}`} size="small" variant="outlined" />
              </Box>
              <Grid container spacing={1.5}>
                {categoryFields.map((fieldId) => {
                  const field = fields[fieldId];
                  const source = sources[fieldId] || 'unified';
                  const sourceColor = SOURCE_COLORS[source] || 'default';
                  return (
                    <Grid item xs={12} sm={6} md={4} key={fieldId}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: 'grey.50',
                          border: 1,
                          borderColor: 'divider',
                          height: '100%',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                          {FIELD_LABELS[fieldId] || fieldId}
                        </Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                          {formatValue(field)}
                        </Typography>
                        <Chip
                          label={source.replace(/_/g, ' ')}
                          size="small"
                          color={sourceColor as any}
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export default AutofillPreview;
