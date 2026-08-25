/**
 * AI Overview Insights Section
 * Shows AI Overview detection analysis from GSC data.
 * If GSC is not connected, shows a connect prompt.
 */

import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button,
  TextField, Slider, Stack, Alert, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, CircularProgress,
  Tooltip, Collapse, IconButton,
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MouseIcon from '@mui/icons-material/Mouse';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { motion } from 'framer-motion';
import { useAIVisibilityInsights } from '../../../hooks/useAIVisibilityInsights';
import { AIOThresholdInput } from '../../../api/aiVisibility';

interface AIVisibilitySectionProps {
  gscConnected: boolean;
  siteUrl?: string;
  onConnectGSC?: () => void;
}

const cardHover = {
  whileHover: { y: -4, transition: { duration: 0.2 } },
};

export const AIVisibilitySection: React.FC<AIVisibilitySectionProps> = ({
  gscConnected,
  siteUrl,
  onConnectGSC,
}) => {
  const {
    loading, error, result,
    thresholds, runAnalysis, setThreshold, resetThresholds, reset,
  } = useAIVisibilityInsights();

  const [showThresholds, setShowThresholds] = useState(false);

  const summaryCards = useMemo(() => {
    if (!result?.summary) return [];
    const s = result.summary;
    return [
      {
        icon: <WarningIcon sx={{ fontSize: 32 }} />,
        label: 'Keywords in AI Overviews',
        value: s.aio_impacted_keywords,
        sub: `${((s.aio_impacted_keywords / (s.total_keywords_analyzed || 1)) * 100).toFixed(1)}% of total`,
        color: '#ef4444',
        bg: '#fef2f2',
      },
      {
        icon: <VisibilityIcon sx={{ fontSize: 32 }} />,
        label: 'Zero-Click Impressions',
        value: s.aio_zero_click_impressions.toLocaleString(),
        sub: `${((s.aio_zero_click_impressions / (s.total_impressions || 1)) * 100).toFixed(1)}% of total`,
        color: '#f59e0b',
        bg: '#fffbeb',
      },
      {
        icon: <TrendingDownIcon sx={{ fontSize: 32 }} />,
        label: 'Estimated Traffic Lost',
        value: `${s.aio_estimated_traffic_loss.toLocaleString()} clicks`,
        sub: 'based on 8% estimated target CTR',
        color: '#3b82f6',
        bg: '#eff6ff',
      },
    ];
  }, [result]);

  const handleRunAnalysis = async () => {
    if (siteUrl) {
      await runAnalysis(siteUrl);
    }
  };

  if (!gscConnected) {
    return (
      <Card sx={{ borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <PsychologyIcon sx={{ fontSize: 64, color: 'action.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            AI Overview Insights
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
            Connect Google Search Console to discover which keywords may be impacted
            by Google AI Overviews and find opportunities to optimize for AI visibility.
          </Typography>
          {onConnectGSC && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={onConnectGSC}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            >
              Connect GSC for AI Overview Insights
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Card sx={{ borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)', mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PsychologyIcon sx={{ color: '#667eea' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                AI Overview Insights
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() => setShowThresholds(!showThresholds)}
                endIcon={showThresholds ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              >
                Thresholds
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleRunAnalysis}
                disabled={loading || !siteUrl}
                startIcon={loading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                {loading ? 'Analyzing...' : result ? 'Re-run' : 'Run Analysis'}
              </Button>
            </Stack>
          </Stack>

          {/* Threshold configuration */}
          <Collapse in={showThresholds}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                AI Overview Detection Thresholds
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    Min Impressions (impacted)
                  </Typography>
                  <Slider
                    size="small"
                    value={thresholds.impacted_min_impressions}
                    onChange={(_, v) => setThreshold('impacted_min_impressions', v as number)}
                    min={0}
                    max={5000}
                    step={100}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    Max Position (impacted)
                  </Typography>
                  <Slider
                    size="small"
                    value={thresholds.impacted_max_position}
                    onChange={(_, v) => setThreshold('impacted_max_position', v as number)}
                    min={1}
                    max={20}
                    step={0.5}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    Max CTR % (impacted)
                  </Typography>
                  <Slider
                    size="small"
                    value={thresholds.impacted_max_ctr}
                    onChange={(_, v) => setThreshold('impacted_max_ctr', v as number)}
                    min={0.1}
                    max={20}
                    step={0.1}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    Min Impressions (opportunity)
                  </Typography>
                  <Slider
                    size="small"
                    value={thresholds.opportunity_min_impressions}
                    onChange={(_, v) => setThreshold('opportunity_min_impressions', v as number)}
                    min={0}
                    max={5000}
                    step={100}
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    Position Range (opportunity)
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      type="number"
                      value={thresholds.opportunity_min_position}
                      onChange={(e) => setThreshold('opportunity_min_position', parseFloat(e.target.value) || 4)}
                      sx={{ width: 70 }}
                      inputProps={{ min: 1, max: 100, step: 0.5 }}
                    />
                    <Typography variant="caption">to</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={thresholds.opportunity_max_position}
                      onChange={(e) => setThreshold('opportunity_max_position', parseFloat(e.target.value) || 10)}
                      sx={{ width: 70 }}
                      inputProps={{ min: 1, max: 100, step: 0.5 }}
                    />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="text.secondary">
                    Min CTR % (opportunity)
                  </Typography>
                  <Slider
                    size="small"
                    value={thresholds.opportunity_min_ctr}
                    onChange={(_, v) => setThreshold('opportunity_min_ctr', v as number)}
                    min={0.1}
                    max={20}
                    step={0.1}
                    valueLabelDisplay="auto"
                  />
                </Grid>
              </Grid>
              <Button size="small" onClick={resetThresholds} sx={{ mt: 1 }}>
                Reset to Defaults
              </Button>
            </Paper>
          </Collapse>

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Summary Cards */}
          {summaryCards.length > 0 && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {summaryCards.map((card, i) => (
                <Grid item xs={12} md={4} key={i}>
                  <motion.div {...cardHover}>
                    <Paper
                      sx={{
                        p: 2.5,
                        borderRadius: 2,
                        background: card.bg,
                        border: `1px solid ${card.color}20`,
                      }}
                    >
                      <Box sx={{ color: card.color, mb: 1 }}>{card.icon}</Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {card.value}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', mt: 0.5 }}>
                        {card.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        {card.sub}
                      </Typography>
                    </Paper>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Analysis overview */}
          {result?.summary && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Keywords Analyzed</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {result.summary.total_keywords_analyzed.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Total Impressions</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {result.summary.total_impressions.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Avg CTR</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {result.summary.average_ctr}%
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Avg Position</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {result.summary.average_position}
                  </Typography>
                </Grid>
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Date range: {result.summary.date_range.start} to {result.summary.date_range.end}
              </Typography>
            </Paper>
          )}

          {/* Impacted Keywords Table */}
          {result?.impacted_keywords && result.impacted_keywords.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon sx={{ color: '#ef4444', fontSize: 18 }} />
                Top AI Overview Impacted Keywords
                <Chip label={result.impacted_keywords.length} size="small" color="error" />
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Keyword</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Impressions</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Position</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>CTR</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Est. Traffic Loss</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.impacted_keywords.slice(0, 10).map((kw, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={kw.keyword}>
                            <span>{kw.keyword}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">{kw.impressions.toLocaleString()}</TableCell>
                        <TableCell align="right">{kw.position}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${kw.ctr}%`}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444' }}>
                            +{(kw.estimated_traffic_loss || 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Opportunity Keywords Table */}
          {result?.opportunity_keywords && result.opportunity_keywords.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon sx={{ color: '#22c55e', fontSize: 18 }} />
                AI Overview Optimization Opportunities
                <Chip label={result.opportunity_keywords.length} size="small" color="success" />
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Keyword</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Impressions</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Position</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>CTR</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Recommendation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.opportunity_keywords.slice(0, 10).map((kw, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={kw.keyword}>
                            <span>{kw.keyword}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">{kw.impressions.toLocaleString()}</TableCell>
                        <TableCell align="right">{kw.position}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${kw.ctr}%`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', color: '#475569', maxWidth: 300 }}>
                          {kw.recommendation || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Recommendations */}
          {result?.recommendations && result.recommendations.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, background: '#f8fafc' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <LightbulbIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Recommendations
                </Typography>
              </Stack>
              {result.recommendations.map((rec, i) => (
                <Typography
                  key={i}
                  variant="body2"
                  sx={{ color: '#475569', mb: 0.75, pl: 2, borderLeft: '3px solid #667eea' }}
                >
                  {rec}
                </Typography>
              ))}
            </Paper>
          )}

          {/* Empty state */}
          {!loading && !result && !error && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <PsychologyIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Click "Run Analysis" to detect AI Overview impact signals
                from your GSC data.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
