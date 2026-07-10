/**
 * LinkedInResearchStep — Onboarding Step 1 for LinkedIn onboarding type.
 *
 * Runs the consolidated growth engine analysis (single LLM call) and
 * shows the user what ALwrity discovered about their industry:
 *   - Brand scorecard (5 dimensions)
 *   - Trending topics in their industry
 *   - Content gaps to differentiate
 *   - Network suggestions (creators worth connecting with)
 *
 * When the user clicks "Continue", the data is serialized and sent to
 * the backend's step-2 completion endpoint, which the LinkedIn
 * strategy uses to persist research data and generate the persona.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
  Lightbulb as LightbulbIcon,
  AccountCircle as AccountIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { linkedInGrowthApi, type ConsolidatedGrowthResponse } from '../../services/linkedInGrowthApi';

interface LinkedInResearchStepProps {
  onContinue: (stepData?: any) => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
  onValidationChange?: (isValid: boolean) => void;
  onDataReady?: (getData: () => any) => void;
}

const LinkedInResearchStep: React.FC<LinkedInResearchStepProps> = ({
  onContinue,
  updateHeaderContent,
  onValidationChange,
  onDataReady,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<ConsolidatedGrowthResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await linkedInGrowthApi.analyzeAll();
      setData(res);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Could not load growth insights. Make sure LinkedIn is connected and profile was analyzed.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    updateHeaderContent({
      title: 'Industry Research',
      description:
        'ALwrity analyzed your industry and profile to discover trending topics, content gaps, and creators worth following. Review the findings, then continue.',
    });
  }, [updateHeaderContent]);

  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  // Validation: once data is loaded, the step is valid
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(!!data);
    }
  }, [data, onValidationChange]);

  // Register data collector for the wizard
  useEffect(() => {
    if (onDataReady) {
      onDataReady(() => ({
        research_depth: 'Comprehensive',
        content_types: ['LinkedIn Posts', 'Articles', 'Carousels'],
        auto_research: true,
        factual_content: true,
        industry_context: data?.trending?.industry,
        growth_summary: data
          ? {
              trending_industry: data.trending?.industry,
              trending_topics_count: data.trending?.trending_topics?.length || 0,
              content_gaps_count: data.content_gaps?.gaps?.length || 0,
              network_suggestions_count: data.network_suggestions?.suggestions?.length || 0,
              viral_patterns_count: data.viral_analysis?.patterns?.length || 0,
              brand_scorecard_overall: data.brand_scorecard?.overall_score,
              generated_at: data.generated_at,
            }
          : null,
      }));
    }
  }, [onDataReady, data]);

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  const renderBrandScorecard = () => {
    const score = data?.brand_scorecard;
    if (!score) return null;
    const scoreColor = score.overall_score >= 75 ? '#16a34a' : score.overall_score >= 50 ? '#f59e0b' : '#dc2626';
    return (
      <Card sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TrendingIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Brand Scorecard
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2 }}>
            <Typography variant="h3" fontWeight={800} sx={{ color: scoreColor }}>
              {score.overall_score}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              / 100
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {score.dimensions?.map((dim) => (
              <Box key={dim.dimension}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">{dim.dimension}</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {dim.score}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={dim.score}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: dim.score >= 75 ? '#16a34a' : dim.score >= 50 ? '#f59e0b' : '#dc2626',
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
          {score.top_recommendation && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Top recommendation
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {score.top_recommendation}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderTrendingTopics = () => {
    const trending = data?.trending;
    if (!trending || !trending.trending_topics?.length) return null;
    return (
      <Card sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TrendingIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Trending in {trending.industry || 'Your Industry'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {trending.trending_topics.slice(0, 3).map((topic, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Typography variant="h6" color="primary">
                  {topic.emoji}
                </Typography>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {topic.topic}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {topic.why_now}
                  </Typography>
                  {topic.suggested_hook && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                      Hook: {topic.suggested_hook}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderContentGaps = () => {
    const gaps = data?.content_gaps?.gaps;
    if (!gaps || !gaps.length) return null;
    return (
      <Card sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LightbulbIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Content Gaps to Differentiate
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {gaps.slice(0, 3).map((gap, idx) => (
              <Box key={idx}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {gap.gap_topic}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {gap.why_it_matters}
                </Typography>
                {gap.suggested_angle && (
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                    Angle: {gap.suggested_angle}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderNetworkSuggestions = () => {
    const suggestions = data?.network_suggestions?.suggestions;
    if (!suggestions || !suggestions.length) return null;
    return (
      <Card sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AccountIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Creators Worth Connecting With
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {suggestions.slice(0, 3).map((s, idx) => (
              <Box key={idx}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {s.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.title} · {s.company}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {s.why_connect}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 420 }}>
          Running consolidated growth analysis… This single AI call generates all 7 research sections in one LLM round-trip (may take 30-60 seconds).
        </Typography>
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
        <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          onClick={() => fetchData(true)}
          startIcon={refreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
          disabled={refreshing}
        >
          Retry Analysis
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', py: 2 }}>
      {error && (
        <Alert severity="warning" sx={{ width: '100%', maxWidth: 500, mb: 2 }}>
          Some sections failed to load: {error}
        </Alert>
      )}

      {/* Stat strip */}
      {data && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          <Chip label={`${data.trending?.trending_topics?.length || 0} trending topics`} size="small" color="primary" variant="outlined" />
          <Chip label={`${data.content_gaps?.gaps?.length || 0} content gaps`} size="small" color="primary" variant="outlined" />
          <Chip label={`${data.network_suggestions?.suggestions?.length || 0} creators`} size="small" color="primary" variant="outlined" />
          <Chip label={`${data.viral_analysis?.patterns?.length || 0} viral patterns`} size="small" color="primary" variant="outlined" />
        </Box>
      )}

      {renderBrandScorecard()}
      {renderTrendingTopics()}
      {renderContentGaps()}
      {renderNetworkSuggestions()}

      {data && (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Typography variant="caption" color="text.disabled">
            Generated {new Date(data.generated_at).toLocaleString()}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => fetchData(true)}
            startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </Box>
      )}

      <Divider sx={{ width: '100%', my: 2 }} />

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 500 }}>
        Click "Continue" to proceed. The backend will persist these research findings and use them to generate your LinkedIn-specific persona.
      </Typography>
    </Box>
  );
};

export default LinkedInResearchStep;