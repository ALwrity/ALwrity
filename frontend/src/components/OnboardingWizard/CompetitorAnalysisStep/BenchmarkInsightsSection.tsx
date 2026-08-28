import React, { useState } from 'react';
import {
  Box, Typography, Paper, Chip, Collapse, IconButton, Tooltip, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Button, CircularProgress,
} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import InsightsIcon from '@mui/icons-material/Insights';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FlagIcon from '@mui/icons-material/Flag';
import LayersIcon from '@mui/icons-material/Layers';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// ----- helpers -----

const fmt = (v: any, digits = 1): string => {
  const n = Number(v);
  if (v === null || v === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
};

const hostname = (url: string): string => {
  if (!url) return '';
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
};

const velocityLabel = (v: any): string => {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  // publishing_velocity is emitted as pages-per-day; round sensibly.
  return n >= 1 ? `${n.toFixed(1)}/day` : `${(n * 30).toFixed(1)}/mo`;
};

const labelify = (key: string): string =>
  key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// ----- internal building blocks -----

const Metric: React.FC<{ label: string; value: React.ReactNode; sub?: string; accent?: string; highlight?: boolean }> = ({
  label, value, sub, accent = '#6C5CE7', highlight,
}) => (
  <Paper
    elevation={0}
    sx={{
      p: 1.5, borderRadius: 2, textAlign: 'center',
      bgcolor: highlight ? '#EEF2FF' : '#f8fafc',
      border: `1px solid ${highlight ? '#c7d2fe' : '#e2e8f0'}`,
    }}
  >
    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="h6" sx={{ color: accent, fontWeight: 700, lineHeight: 1.1 }}>
      {value}
    </Typography>
    {sub && <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>{sub}</Typography>}
  </Paper>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; count?: number }> = ({ icon, title, count }) => (
  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
    {icon}
    {title}
    {typeof count === 'number' && (
      <Chip size="small" label={count} sx={{ height: 18, fontSize: '0.7rem', bgcolor: '#eef2ff', color: '#4338ca' }} />
    )}
  </Typography>
);

// ----- main component -----

interface BenchmarkInsightsSectionProps {
  report: any;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const BenchmarkInsightsSection: React.FC<BenchmarkInsightsSectionProps> = ({ report, onRefresh, isRefreshing }) => {
  const [expanded, setExpanded] = useState(true);

  // Render placeholder when no report exists — allows user to run the benchmark
  if (!report) {
    return (
      <Paper sx={{ p: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsightsIcon sx={{ color: '#6C5CE7' }} />
            Benchmark Insights
          </Typography>
          {onRefresh && (
            <Button
              size="small"
              variant="outlined"
              startIcon={isRefreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
              onClick={onRefresh}
              disabled={isRefreshing}
              sx={{
                borderColor: '#667eea',
                color: '#667eea',
                textTransform: 'none',
                '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' }
              }}
            >
              {isRefreshing ? 'Running...' : 'Run Sitemap Benchmark'}
            </Button>
          )}
        </Box>
        <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
          No benchmark report yet. Click "Run Sitemap Benchmark" to analyze your site against competitors.
        </Typography>
      </Paper>
    );
  }

  // Report exists — show full insights

  const user = report.user?.summary || {};
  const summaries = report.competitors?.summaries || {};
  const errors = report.competitors?.errors || {};
  const bm = report.benchmark || {};

  const competitorArr = Object.entries(summaries).map(([url, info]: [string, any]) => ({ url, ...(info || {}) }))
    .filter((c) => c?.total_urls !== undefined && c?.total_urls !== null);
  const competitorCount = Object.keys(summaries).length + Object.keys(errors).length;

  // Aggregate competitor medians for the comparison cards.
  const totals = competitorArr.map((c) => Number(c.total_urls) || 0).filter((n) => n > 0);
  const velocities = competitorArr.map((c) => Number(c.publishing_velocity)).filter((n) => !Number.isNaN(n));
  const depths = competitorArr.map((c) => Number(c.average_path_depth)).filter((n) => !Number.isNaN(n));
  const median = (arr: number[]) => {
    if (!arr.length) return undefined;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const compMedianUrls = median(totals);
  const compMedianSpeed = median(velocities);
  const compMedianDepth = median(depths);

  const opps = bm.opportunities || [];
  const missingSections = bm.gaps?.missing_sections || [];
  const leaders = bm.competitor_section_leaders || [];

  const hasUser = Object.keys(user).length > 0 && user.total_urls !== undefined;

  return (
    <Box mt={3} mb={1}>
      <Paper sx={{ p: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
        {/* Header + expand/collapse */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsightsIcon sx={{ color: '#6C5CE7' }} />
            Benchmark Insights
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            {onRefresh && (
              <Button
                size="small"
                variant="outlined"
                startIcon={isRefreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
                onClick={onRefresh}
                disabled={isRefreshing}
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': { borderColor: '#5a6fd8', bgcolor: 'rgba(102,126,234,0.04)' }
                }}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Sitemap Benchmark'}
              </Button>
            )}
            <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
              <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Compact competitor chips summary */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {competitorArr.map((c) => (
            <Chip
              key={c.url}
              size="small"
              label={`${hostname(c.url)} · ${c.total_urls ?? '?'}`}
              icon={<CheckCircleIcon sx={{ fontSize: 16, color: '#10b981' }} />}
              color="success"
              variant="filled"
              title={`${hostname(c.url)}: ${c.total_urls} URLs${
                c.average_path_depth != null ? ` · depth ${fmt(c.average_path_depth)}` : ''
              }${c.publishing_velocity != null ? ` · ${velocityLabel(c.publishing_velocity)}` : ''}`}
            />
          ))}
          {Object.entries(errors).map(([url, err]: [string, any]) => (
            <Chip
              key={`err-${url}`}
              size="small"
              label={hostname(url)}
              icon={<span style={{ fontSize: 13 }}>❌</span>}
              color="error"
              variant="outlined"
              title={typeof err === 'string' ? err : 'Analysis failed'}
            />
          ))}
        </Box>

        <Collapse in={expanded}>
          <Box display="flex" flexDirection="column" gap={3}>
            {/* 1. User vs Competitors comparison */}
            {hasUser && (
              <Box>
                <SectionTitle icon={<CompareArrowsIcon sx={{ color: '#3b82f6' }} />} title="Your Site vs Competitors" />
                <Box display="grid" gridTemplateColumns={{ xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={1.5}>
                  <Metric
                    label="Total URLs"
                    value={user.total_urls ?? '—'}
                    sub={compMedianUrls ? `Comp median: ${Math.round(compMedianUrls)}` : 'No competitor data'}
                    highlight={Boolean(compMedianUrls && Number(user.total_urls) < compMedianUrls * 0.8)}
                  />
                  <Metric
                    label="Publishing Velocity"
                    value={velocityLabel(user.publishing_velocity)}
                    sub={compMedianSpeed !== undefined ? `Comp median: ${velocityLabel(compMedianSpeed)}` : 'No competitor data'}
                    highlight={Boolean(compMedianSpeed !== undefined && Number(user.publishing_velocity) < compMedianSpeed * 0.75)}
                  />
                  <Metric
                    label="Avg Path Depth"
                    value={fmt(user.average_path_depth)}
                    sub={compMedianDepth !== undefined ? `Comp median: ${fmt(compMedianDepth)}` : 'No competitor data'}
                    highlight={Boolean(compMedianDepth !== undefined && Number(user.average_path_depth) < compMedianDepth - 0.5)}
                  />
                  <Metric label="Sections" value={bm.user_sections_count ?? '—'} sub={`${competitorCount} competitor(s) analyzed`} />
                </Box>
              </Box>
            )}

            {/* 2. Opportunities */}
            {opps.length > 0 && (
              <Box>
                <SectionTitle icon={<TrendingUpIcon sx={{ color: '#f59e0b' }} />} title="Opportunities" count={opps.length} />
                <Box display="flex" flexDirection="column" gap={1}>
                  {opps.map((o: any, i: number) => {
                    const m: any = o.metrics || {};
                    const meta: [string, any][] = Object.entries(m);
                    return (
                      <Paper key={i} elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: '#fffbeb', border: '1px solid #fde68a' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#92400e', mb: 1 }}>{o.title}</Typography>
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {meta.map(([k, v]) => (
                            <Chip key={k} size="small" label={`${labelify(k)}: ${v}`} sx={{ bgcolor: '#fff', border: '1px solid #fde68a', color: '#92400e' }} />
                          ))}
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* 3. Content gaps (missing sections) */}
            {missingSections.length > 0 && (
              <Box>
                <SectionTitle icon={<FlagIcon sx={{ color: '#ef4444' }} />} title="Content Gaps (sections competitors cover, you don't)" count={missingSections.length} />
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {missingSections.map((g: any, i: number) => (
                    <Tooltip
                      key={i}
                      title={`Present in ${g.competitor_count ?? '?'}/${competitorCount} competitor(s) · ${g.total_url_count ?? 0} URLs`}
                    >
                      <Chip
                        size="small"
                        label={g.section}
                        variant="outlined"
                        sx={{ borderColor: '#fecaca', color: '#b91c1c', bgcolor: '#fff' }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            )}

            {/* 4. Section leaders */}
            {leaders.length > 0 && (
              <Box>
                <SectionTitle icon={<LayersIcon sx={{ color: '#8b5cf6' }} />} title="Competitor Section Leaders" count={leaders.length} />
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                        <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Competitor</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Total URLs</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Sections</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Avg Depth</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Publishing</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leaders.map((l: any, i: number) => (
                        <TableRow key={i} hover sx={{ '&:last-child td': { border: 0 } }}>
                          <TableCell sx={{ color: '#1e293b', fontWeight: 600 }}>{hostname(l.competitor_url)}</TableCell>
                          <TableCell align="right" sx={{ color: '#475569' }}>{l.total_urls ?? '—'}</TableCell>
                          <TableCell align="right" sx={{ color: '#475569' }}>{l.sections_count ?? '—'}</TableCell>
                          <TableCell align="right" sx={{ color: '#475569' }}>{fmt(l.average_path_depth)}</TableCell>
                          <TableCell align="right" sx={{ color: '#475569' }}>{velocityLabel(l.publishing_velocity)}{l.span_days ? ` · ${l.span_days}d` : ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* 5. Raw per-competitor detail */}
            {competitorArr.length > 0 && (
              <Box>
                <SectionTitle icon={<CompareArrowsIcon sx={{ color: '#94a3b8' }} />} title="Per-Competitor Detail" count={competitorArr.length} />
                <Box display="flex" flexDirection="column" gap={1.5}>
                  {competitorArr.map((c) => (
                    <Paper key={c.url} elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', mb: 0.75 }}>
                        {hostname(c.url)}
                      </Typography>
                      {c.file_types && Object.keys(c.file_types).length > 0 && (
                        <Typography variant="body2" sx={{ color: '#475569' }}>
                          <strong>File types:</strong> {Object.entries(c.file_types).map(([k, v]) => `${k} (${v})`).join(', ')}
                        </Typography>
                      )}
                      {c.priority_distribution && Object.keys(c.priority_distribution).length > 0 && (
                        <Box mt={1}>
                          <Typography variant="body2" sx={{ color: '#475569' }}>
                            <strong>Priority:</strong> {Object.entries(c.priority_distribution).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </Typography>
                        </Box>
                      )}
                      {c.changefreq_distribution && Object.keys(c.changefreq_distribution).length > 0 && (
                        <Box mt={0.5}>
                          <Typography variant="body2" sx={{ color: '#475569' }}>
                            <strong>Change frequency:</strong> {Object.entries(c.changefreq_distribution).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </Typography>
                        </Box>
                      )}
                      {c.trends && c.trends.length > 0 && (
                        <Box mt={0.5}>
                          <Typography variant="body2" sx={{ color: '#059669', fontWeight: 600 }}>
                            <strong>Trend:</strong> {c.trends.join(', ')}
                          </Typography>
                        </Box>
                      )}
                      {c.monthly_distribution && Object.keys(c.monthly_distribution).length > 0 && (
                        <Box mt={0.5}>
                          <Typography variant="body2" sx={{ color: '#475569' }}>
                            <strong>Monthly (last 12):</strong> {Object.entries(c.monthly_distribution).map(([k, v]) => `${k.split('-')[1]}/${k.slice(2,2)}: ${v}`).join(', ')}
                          </Typography>
                        </Box>
                      )}
                      {c.yearly_distribution && Object.keys(c.yearly_distribution).length > 0 && (
                        <Box mt={0.5}>
                          <Typography variant="body2" sx={{ color: '#475569' }}>
                            <strong>Yearly:</strong> {Object.entries(c.yearly_distribution).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </Typography>
                        </Box>
                      )}
                      {c.top_url_patterns && Object.keys(c.top_url_patterns).length > 0 && (
                        <Box mt={1}>
                          <Typography variant="overline" sx={{ color: '#94a3b8', fontWeight: 700 }}>Top sections</Typography>
                          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                            {Object.entries(c.top_url_patterns).slice(0, 12).map(([k, v]) => (
                              <Chip key={k} size="small" variant="outlined" label={`${k} (${v})`} sx={{ borderColor: '#e2e8f0', color: '#475569', bgcolor: '#f8fafc' }} />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Box>
              </Box>
            )}

            {/* Empty state when only competitor summaries exist with no detail */}
            {!hasUser && opponentCountNone(opps, missingSections, leaders, competitorArr) && (
              <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                Analysis running in background — detailed insights will appear here when complete.
              </Typography>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

// helper: true when none of the detail sections have content
const opponentCountNone = (...arrs: any[][]): boolean => arrs.every((a) => !a || a.length === 0);
