import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  AutoAwesome as AutoFixHighIcon,
} from '@mui/icons-material';

const ACTION_VERBS = ['Target', 'Expand', 'Create', 'Build', 'Optimize', 'Capture', 'Scale', 'Launch'];

function safeText(item: any): string {
  if (typeof item === 'string') return item;
  if (typeof item?.action === 'string') return item.action;
  if (typeof item?.finding === 'string') return item.finding;
  if (typeof item?.type === 'string') return item.type;
  if (typeof item?.title === 'string') return item.title;
  return JSON.stringify(item);
}

interface StrategicInsightsSectionProps {
  sitemapAnalysis: any;
  isAnalyzingSitemap: boolean;
  onRefreshStrategy: () => void;
  onShowBenchmarks: () => void;
  onShowStrategy: () => void;
  onShowPublishing: () => void;
  onShowStructure: () => void;
}

export const StrategicInsightsSection: React.FC<StrategicInsightsSectionProps> = ({
  sitemapAnalysis,
  isAnalyzingSitemap,
  onRefreshStrategy,
  onShowBenchmarks,
  onShowStrategy,
  onShowPublishing,
  onShowStructure,
}) => {
  const insights = sitemapAnalysis?.analysis_data?.onboarding_insights;

  return (
    <Box mt={6} mb={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Tooltip title="Based on competitor analysis, these are specific recommendations to improve your SEO and content strategy.">
          <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c !important', display: 'flex', alignItems: 'center', cursor: 'help' }}>
            <LightbulbIcon sx={{ mr: 1, color: '#f59e0b' }} />
            Strategic Content Opportunities
            <InfoIcon sx={{ ml: 1, fontSize: 20, color: 'text.disabled' }} />
          </Typography>
        </Tooltip>
        <Button
          variant="outlined"
          size="small"
          startIcon={isAnalyzingSitemap ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          onClick={onRefreshStrategy}
          disabled={isAnalyzingSitemap}
          sx={{ borderColor: '#667eea', color: '#667eea', textTransform: 'none', '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' } }}
        >
          {isAnalyzingSitemap ? 'Refreshing...' : 'Refresh Strategy'}
        </Button>
      </Box>

      {isAnalyzingSitemap ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc', borderStyle: 'dashed', borderColor: '#cbd5e0' }}>
          <CircularProgress size={24} sx={{ mb: 2 }} />
          <Typography color="text.secondary">Analyzing competitive landscape for opportunities...</Typography>
        </Paper>
      ) : (
        <Box>
          {/* 1. Your Competitive Position */}
          {insights?.competitive_positioning && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ p: 1, bgcolor: 'white', borderRadius: '50%', color: '#0284c7', flexShrink: 0 }}>
                  <AssessmentIcon />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} color="#0c4a6e" gutterBottom>
                    Your Competitive Position
                  </Typography>
                  <Typography variant="body2" color="#0c4a6e">
                    {insights.competitive_positioning}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}

          <Grid container spacing={3}>
            {/* 2. Topics to Create */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', bgcolor: '#fffbeb', border: '1px solid #fde68a' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AutoFixHighIcon fontSize="small" sx={{ color: '#f59e0b' }} /> Topics to Create
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#78716c' }}>
                    Subjects your competitors cover that you don't yet — create content on these to capture new audience segments.
                  </Typography>
                  {insights?.content_gaps?.length > 0 ? (
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {insights.content_gaps.map((gap: string, i: number) => (
                        <Chip key={i} label={gap} size="small" sx={{ bgcolor: 'white', border: '1px solid #fde68a', fontWeight: 500 }} />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" fontStyle="italic" color="#78716c">No gaps detected yet.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 3. Growth Moves */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#166534', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingUpIcon fontSize="small" sx={{ color: '#22c55e' }} /> Growth Moves
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#6b7280' }}>
                    Prioritized actions to improve your content strategy and organic reach.
                  </Typography>
                  {(() => {
                    const growthMoves = [
                      ...(insights?.growth_opportunities || []),
                      ...(insights?.strategic_recommendations || []).slice(0, 2)
                    ];
                    return growthMoves.length > 0 ? (
                      <List dense disablePadding>
                        {growthMoves.map((move: any, i: number) => {
                          const text = safeText(move);
                          return (
                          <ListItem key={i} disableGutters sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                                {i + 1}
                              </Box>
                            </ListItemIcon>
                            <ListItemText primary={`${ACTION_VERBS[i % ACTION_VERBS.length]} ${text}`} primaryTypographyProps={{ variant: 'body2', color: '#166534' }} />
                          </ListItem>
                        )})}
                      </List>
                    ) : (
                      <Typography variant="caption" fontStyle="italic" color="#6b7280">Generating recommendations...</Typography>
                    );
                  })()}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* 4. Deeper Insights — secondary buttons */}
          <Box mt={3}>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mb: 1, fontSize: '0.7rem', letterSpacing: 1 }}>
              DEEPER INSIGHTS
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {insights?.industry_benchmarks?.length > 0 && (
                <Button size="small" variant="outlined" onClick={onShowBenchmarks} startIcon={<AssessmentIcon />} sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontSize: '0.75rem' }}>
                  Industry Benchmarks
                </Button>
              )}
              {sitemapAnalysis?.analysis_data?.ai_insights?.content_strategy?.length > 0 && (
                <Button size="small" variant="outlined" onClick={onShowStrategy} startIcon={<LightbulbIcon />} sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontSize: '0.75rem' }}>
                  Content Strategy & SEO
                </Button>
              )}
              {sitemapAnalysis?.analysis_data?.content_trends?.trends?.length > 0 && (
                <Button size="small" variant="outlined" onClick={onShowPublishing} startIcon={<TrendingUpIcon />} sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontSize: '0.75rem' }}>
                  Publishing Patterns
                </Button>
              )}
              {sitemapAnalysis?.analysis_data?.structure_analysis?.keyword_clusters && Object.keys(sitemapAnalysis.analysis_data.structure_analysis.keyword_clusters).length > 0 && (
                <Button size="small" variant="outlined" onClick={onShowStructure} startIcon={<SearchIcon />} sx={{ color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontSize: '0.75rem' }}>
                  Topics Your Site Covers
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
