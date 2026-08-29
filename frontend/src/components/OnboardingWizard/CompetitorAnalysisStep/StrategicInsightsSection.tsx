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
  Tooltip,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SearchIcon from '@mui/icons-material/Search';
import AutoFixHighIcon from '@mui/icons-material/AutoAwesome';
import BoltIcon from '@mui/icons-material/Bolt';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PeopleIcon from '@mui/icons-material/People';
import CampaignIcon from '@mui/icons-material/Campaign';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

const ACTION_VERBS = ['Target', 'Expand', 'Create', 'Build', 'Optimize', 'Capture', 'Scale', 'Launch'];

const PRIORITY_COLORS: Record<string, string> = {
  high: '#e11d48',
  medium: '#d97706',
  low: '#059669',
};

function opportunityTitle(item: any): string {
  if (typeof item?.topic === 'string') return item.topic;
  if (typeof item?.title === 'string') return item.title;
  if (typeof item?.action === 'string') return item.action;
  if (typeof item?.finding === 'string') return item.finding;
  if (typeof item?.name === 'string') return item.name;
  return JSON.stringify(item);
}

const OpportunityView: React.FC<{ item: any; verbIndex?: number }> = ({ item, verbIndex }) => {
  if (typeof item === 'string') {
    const label = verbIndex !== undefined ? `${ACTION_VERBS[verbIndex % ACTION_VERBS.length]} ${item}` : item;
    return <Typography variant="body2">{label}</Typography>;
  }
  if (typeof item !== 'object' || item === null) {
    return <Typography variant="body2">{String(item)}</Typography>;
  }
  const title = opportunityTitle(item);
  const priority = typeof item.priority === 'string' ? item.priority.toLowerCase() : undefined;
  const effort = typeof item.effort === 'string' ? item.effort : undefined;
  const impact = typeof item.impact === 'string' ? item.impact : undefined;
  const rationale = typeof item.rationale === 'string' ? item.rationale : undefined;

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          {title}
        </Typography>
        {priority && (
          <Chip
            label={priority}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'capitalize',
              color: 'white',
              bgcolor: PRIORITY_COLORS[priority] || '#64748b',
            }}
          />
        )}
      </Box>
      {(effort || impact) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {impact && <Chip size="small" variant="outlined" label={`Impact: ${impact}`} sx={{ height: 20, fontSize: '0.65rem' }} />}
          {effort && <Chip size="small" variant="outlined" label={`Effort: ${effort}`} sx={{ height: 20, fontSize: '0.65rem' }} />}
        </Box>
      )}
      {rationale && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {rationale}
        </Typography>
      )}
    </Box>
  );
};

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
                      {insights.content_gaps.map((gap: any, i: number) =>
                        typeof gap === 'string' ? (
                          <Chip key={i} label={gap} size="small" sx={{ bgcolor: 'white', border: '1px solid #fde68a', fontWeight: 500 }} />
                        ) : (
                          <OpportunityView key={i} item={gap} />
                        )
                      )}
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
                        {growthMoves.map((move: any, i: number) => (
                          <ListItem key={i} disableGutters sx={{ py: 0.75 }}>
                            <OpportunityView item={move} verbIndex={i} />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="caption" fontStyle="italic" color="#6b7280">Generating recommendations...</Typography>
                    );
                  })()}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* 5. Grounded opportunity cards (present only when populated) */}
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            {/* Quick Wins */}
            {insights?.quick_wins?.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', bgcolor: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: '#5b21b6', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <BoltIcon fontSize="small" sx={{ color: '#8b5cf6' }} /> Quick Wins
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#71717a' }}>
                      Fast, low-effort content actions you can execute within days.
                    </Typography>
                    <List dense disablePadding>
                      {insights.quick_wins.map((win: any, i: number) => (
                        <ListItem key={i} disableGutters sx={{ py: 0.75 }}>
                          <OpportunityView item={win} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Keyword & Topic Opportunities */}
            {insights?.keyword_topic_opportunities?.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', bgcolor: '#f0fdfa', border: '1px solid #99f6e4' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: '#134e4a', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LocalOfferIcon fontSize="small" sx={{ color: '#14b8a6' }} /> Keyword & Topic Opportunities
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#64748b' }}>
                      Topic + keyword pairs your site isn&apos;t covering yet, matched to existing clusters and competitor focus.
                    </Typography>
                    <List dense disablePadding>
                      {insights.keyword_topic_opportunities.map((opp: any, i: number) => (
                        <ListItem key={i} disableGutters sx={{ py: 0.75 }}>
                          <OpportunityView item={opp} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Audience-Fit Ideas */}
            {insights?.audience_fit_opportunities?.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', bgcolor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PeopleIcon fontSize="small" sx={{ color: '#3b82f6' }} /> Audience-Fit Ideas
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#64748b' }}>
                      Content matched to your target audience segments and interests from your onboarding research.
                    </Typography>
                    <List dense disablePadding>
                      {insights.audience_fit_opportunities.map((idea: any, i: number) => (
                        <ListItem key={i} disableGutters sx={{ py: 0.75 }}>
                          <OpportunityView item={idea} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Channel Playbook */}
            {insights?.channel_playbook?.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', bgcolor: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: '#9a3412', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CampaignIcon fontSize="small" sx={{ color: '#ea580c' }} /> Channel Playbook
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#78716c' }}>
                      Channel-specific guidance mapped to your preferred content channels.
                    </Typography>
                    <List dense disablePadding>
                      {insights.channel_playbook.map((entry: any, i: number) => {
                        const channel = typeof entry?.channel === 'string' ? entry.channel : JSON.stringify(entry);
                        const recs = Array.isArray(entry?.recommendations) ? entry.recommendations : [];
                        return (
                          <ListItem key={i} disableGutters sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 0.75 }}>
                            <Chip size="small" label={channel} sx={{ bgcolor: '#ffffff', border: '1px solid #fed7aa', fontWeight: 600, color: '#9a3412', mb: 0.5 }} />
                            {recs.map((rec: string, j: number) => (
                              <Box key={j} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.35, width: '100%' }}>
                                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#fdba74', mt: 0.6, flexShrink: 0 }} />
                                <Typography variant="caption" color="#431407">
                                  {rec}
                                </Typography>
                              </Box>
                            ))}
                          </ListItem>
                        );
                      })}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Pillar Expansion */}
            {insights?.pillar_expansion?.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%', bgcolor: '#fdf2f8', border: '1px solid #fbcfe8' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: '#831843', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AccountTreeIcon fontSize="small" sx={{ color: '#db2777' }} /> Pillar Expansion
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#71717a' }}>
                      Ways to deepen and expand your existing content pillars into new content.
                    </Typography>
                    <List dense disablePadding>
                      {insights.pillar_expansion.map((idea: any, i: number) => (
                        <ListItem key={i} disableGutters sx={{ py: 0.75 }}>
                          <OpportunityView item={idea} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
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
