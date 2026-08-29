import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExploreIcon from '@mui/icons-material/Explore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SearchIcon from '@mui/icons-material/Search';
import StoreIcon from '@mui/icons-material/Store';
import SpeedIcon from '@mui/icons-material/Speed';
import FlagIcon from '@mui/icons-material/Flag';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../shared/styled';
import { apiClient } from '../../../api/client';

interface ScoringBreakdown {
  gap_size: number;
  volume: number;
  trend: number;
  intent: number;
  competition: number;
}

interface GapItem {
  topic: string;
  roi_score: number;
  priority: 'high' | 'medium' | 'low';
  recommended_action: string;
  scoring: ScoringBreakdown;
  sif_gap?: any;
  serp_evidence?: {
    competitors_found: Array<{ domain: string; title: string; url: string; snippet: string }>;
    competitor_count: number;
    domains_with_content: string[];
  } | null;
  competitor_content?: any;
}

interface GapRadarData {
  gaps: GapItem[];
  summary: {
    total_topics_analyzed: number;
    high_priority: number;
    medium_priority: number;
    low_priority: number;
  };
  error?: string;
  message?: string;
}

interface ContentBrief {
  titles: string[];
  outline: Array<{ heading: string; key_points: string[] }>;
  keywords: string[];
  angle: string;
  word_count: number;
}

const priorityColor = (p: string): string => {
  switch (p) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    default: return '#22c55e';
  }
};

const roiBarColor = (score: number): string => {
  if (score >= 0.6) return '#22c55e';
  if (score >= 0.3) return '#f59e0b';
  return '#ef4444';
};

const roiLabel = (score: number): string => {
  if (score >= 0.6) return 'High Opportunity';
  if (score >= 0.3) return 'Moderate Opportunity';
  return 'Low Priority';
};

const scoringConfig = [
  { key: 'gap_size', label: 'Gap Size', icon: <SearchIcon sx={{ fontSize: 14 }} />, color: '#90CAF9' },
  { key: 'volume', label: 'Search Volume', icon: <TrendingUpIcon sx={{ fontSize: 14 }} />, color: '#22c55e' },
  { key: 'trend', label: 'Trend Momentum', icon: <SpeedIcon sx={{ fontSize: 14 }} />, color: '#f59e0b' },
  { key: 'intent', label: 'Intent Score', icon: <FlagIcon sx={{ fontSize: 14 }} />, color: '#CE93D8' },
  { key: 'competition', label: 'Competition', icon: <StoreIcon sx={{ fontSize: 14 }} />, color: '#ef4444' },
];

const ContentGapRadarCard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<GapRadarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);
  const [briefResult, setBriefResult] = useState<{ brief: ContentBrief; asset_id: number | null } | null>(null);

  const fetchData = useCallback(async (bypassCache = false) => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (bypassCache) params.bypass_cache = 'true';
      const resp = await apiClient.get('/api/seo-dashboard/content-gap-radar', { params });
      setData(resp.data);
      if (resp.data.error) setError(resp.data.error);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load content gap radar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateContent = useCallback(async (gap: GapItem) => {
    try {
      setGeneratingTopic(gap.topic);
      setBriefResult(null);
      const resp = await apiClient.post('/api/seo-dashboard/content-gap-radar/generate-content', {
        topic: gap.topic,
        recommended_action: gap.recommended_action,
        scoring: gap.scoring,
        serp_evidence: gap.serp_evidence,
        sif_gap: gap.sif_gap,
      });
      setBriefResult(resp.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to generate content brief');
    } finally {
      setGeneratingTopic(null);
    }
  }, []);

  const handleOpenBlogWriter = useCallback(() => {
    if (briefResult?.asset_id) {
      navigate('/blog-writer', { state: { restoreBlogAssetId: briefResult.asset_id } });
    } else {
      navigate('/blog-writer');
    }
  }, [briefResult, navigate]);

  const handleCopyBrief = useCallback(() => {
    if (!briefResult?.brief) return;
    const b = briefResult.brief;
    const text = [
      `## Content Brief\n`,
      `### Titles\n${b.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`,
      `### Angle\n${b.angle}\n`,
      `### Keywords\n${b.keywords.join(', ')}\n`,
      `### Outline\n${b.outline.map(s => `- ${s.heading}\n${s.key_points.map(kp => `  - ${kp}`).join('\n')}`).join('\n')}`,
      `\nTarget: ~${b.word_count} words`,
    ].join('\n');
    navigator.clipboard.writeText(text);
  }, [briefResult]);

  if (loading && !data) {
    return (
      <GlassCard sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1, display: 'block' }}>
          Scanning content gaps...
        </Typography>
      </GlassCard>
    );
  }

  const hasGaps = data?.gaps && data.gaps.length > 0;
  const summary = data?.summary;

  return (
    <Box sx={{ mb: 4 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <ExploreIcon sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="h6" fontWeight={700} sx={{ color: 'white', flex: 1 }}>
          Content Gap Radar
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => fetchData(true)}
          disabled={loading}
          sx={{
            color: 'rgba(255,255,255,0.7)',
            borderColor: 'rgba(255,255,255,0.2)',
            fontSize: '0.7rem',
            '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          {loading ? 'Scanning...' : 'Refresh'}
        </Button>
      </Box>

      {error && !hasGaps && (
        <GlassCard sx={{ p: 3, mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>{error}</Typography>
        </GlassCard>
      )}

      {data?.message && !hasGaps && (
        <GlassCard sx={{ p: 3, mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>{data.message}</Typography>
        </GlassCard>
      )}

      {loading && hasGaps && (
        <LinearProgress sx={{ mb: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#2196F3' } }} />
      )}

      {summary && summary.total_topics_analyzed > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 2 }}>
          <GlassCard sx={{ p: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Topics Analyzed</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: 'white' }}>{summary.total_topics_analyzed}</Typography>
          </GlassCard>
          <GlassCard sx={{ p: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>High Priority</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#ef4444' }}>{summary.high_priority}</Typography>
          </GlassCard>
          <GlassCard sx={{ p: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Medium Priority</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#f59e0b' }}>{summary.medium_priority}</Typography>
          </GlassCard>
          <GlassCard sx={{ p: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Low Priority</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#22c55e' }}>{summary.low_priority}</Typography>
          </GlassCard>
        </Box>
      )}

      {hasGaps && data!.gaps.map((gap, i) => (
        <Accordion
          key={gap.topic}
          defaultExpanded={i === 0}
          disableGutters
          elevation={0}
          sx={{
            bgcolor: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px !important',
            mb: 1,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />}>
            <Box sx={{ width: '100%', mr: 1 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'white', flex: 1 }}>
                  {gap.topic}
                </Typography>
                <Chip
                  label={gap.priority}
                  size="small"
                  sx={{
                    height: 18, fontSize: '0.6rem', fontWeight: 700,
                    bgcolor: `${priorityColor(gap.priority)}22`,
                    color: priorityColor(gap.priority),
                  }}
                />
                <Chip
                  label={`ROI ${(gap.roi_score * 100).toFixed(0)}%`}
                  size="small"
                  sx={{
                    height: 18, fontSize: '0.6rem', fontWeight: 700,
                    bgcolor: `${roiBarColor(gap.roi_score)}22`,
                    color: roiBarColor(gap.roi_score),
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={generatingTopic === gap.topic ? <CircularProgress size={12} /> : <AutoAwesomeIcon />}
                  onClick={(e) => { e.stopPropagation(); generateContent(gap); }}
                  disabled={generatingTopic !== null}
                  sx={{
                    height: 24, minWidth: 0, px: 1, fontSize: '0.6rem', fontWeight: 600,
                    color: '#CE93D8',
                    borderColor: 'rgba(206,147,216,0.3)',
                    whiteSpace: 'nowrap',
                    '&:hover': { borderColor: '#CE93D8', bgcolor: 'rgba(206,147,216,0.08)' },
                  }}
                >
                  {generatingTopic === gap.topic ? 'Generating...' : 'Create Content'}
                </Button>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Box sx={{ flex: 1, height: 4, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ width: `${Math.min(gap.roi_score * 100, 100)}%`, height: '100%', bgcolor: roiBarColor(gap.roi_score), borderRadius: 2 }} />
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0, fontSize: '0.6rem' }}>
                  {roiLabel(gap.roi_score)}
                </Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 1.5, fontStyle: 'italic' }}>
              {gap.recommended_action}
            </Typography>

            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 0.5, display: 'block' }}>
              Scoring Breakdown
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, mb: 1.5 }}>
              {scoringConfig.map((s) => {
                const val = (gap.scoring as any)[s.key] ?? 0;
                return (
                  <Box key={s.key} sx={{ textAlign: 'center', p: 0.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
                    <Box display="flex" justifyContent="center" alignItems="center" gap={0.3} mb={0.3}>
                      {s.icon}
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.55rem' }}>{s.label}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700} sx={{ color: s.color, fontSize: '0.8rem' }}>
                      {(val * 100).toFixed(0)}%
                    </Typography>
                    <Box sx={{ height: 2, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 1, mt: 0.3, overflow: 'hidden' }}>
                      <Box sx={{ width: `${val * 100}%`, height: '100%', bgcolor: s.color, borderRadius: 1 }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {gap.serp_evidence && gap.serp_evidence.competitors_found?.length > 0 && (
              <>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 0.5, display: 'block' }}>
                  Competitors Ranking — {gap.serp_evidence.competitor_count} results across {gap.serp_evidence.domains_with_content?.length || 0} domains
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  {gap.serp_evidence.domains_with_content?.slice(0, 5).map((d: string) => (
                    <Chip key={d} label={d} size="small" sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'rgba(33,150,243,0.12)', color: '#90CAF9' }} />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                  {gap.serp_evidence.competitors_found.slice(0, 3).map((c: any, ci: number) => (
                    <Box key={ci} sx={{ p: 0.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
                      <Typography variant="caption" fontWeight={600} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        {c.title || c.domain}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontSize: '0.55rem' }}>
                        {c.snippet?.slice(0, 120)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}

            {gap.sif_gap && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                SIF gap: {gap.sif_gap.priority} priority &middot; confidence {((gap.sif_gap.confidence ?? 0) * 100).toFixed(0)}% &middot; delta {((gap.sif_gap.coverage_delta ?? 0) * 100).toFixed(1)}%
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Content Brief Dialog */}
      <Dialog
        open={briefResult !== null}
        onClose={() => setBriefResult(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#1a1a2e', color: 'white', border: '1px solid rgba(255,255,255,0.1)' },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <AutoAwesomeIcon sx={{ color: '#CE93D8', fontSize: 20 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
            Content Brief
          </Typography>
          <IconButton size="small" onClick={() => setBriefResult(null)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        {briefResult && (
          <DialogContent sx={{ pt: 1 }}>
            {/* Headline options */}
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 0.5, display: 'block', fontWeight: 600 }}>
              HEADLINE OPTIONS
            </Typography>
            <Box sx={{ mb: 2 }}>
              {briefResult.brief.titles.map((t, i) => (
                <Typography key={i} variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 0.3 }}>
                  {i + 1}. {t}
                </Typography>
              ))}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

            {/* Writing angle */}
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 0.5, display: 'block', fontWeight: 600 }}>
              STRATEGIC ANGLE
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2, lineHeight: 1.6 }}>
              {briefResult.brief.angle}
            </Typography>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

            {/* Target keywords */}
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 0.5, display: 'block', fontWeight: 600 }}>
              TARGET KEYWORDS
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {briefResult.brief.keywords.map((kw) => (
                <Chip key={kw} label={kw} size="small" sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(206,147,216,0.12)', color: '#CE93D8' }} />
              ))}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />

            {/* Outline */}
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 0.5, display: 'block', fontWeight: 600 }}>
              OUTLINE — ~{briefResult.brief.word_count} words
            </Typography>
            {briefResult.brief.outline.map((section, i) => (
              <Box key={i} sx={{ mb: 1.5, p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={600} sx={{ color: 'rgba(255,255,255,0.8)', mb: 0.5 }}>
                  {section.heading}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {section.key_points.map((kp, j) => (
                    <Typography key={j} variant="caption" component="li" sx={{ color: 'rgba(255,255,255,0.5)', display: 'list-item', mb: 0.2 }}>
                      {kp}
                    </Typography>
                  ))}
                </Box>
              </Box>
            ))}
          </DialogContent>
        )}

        <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyBrief}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(255,255,255,0.2)',
              fontSize: '0.75rem',
              '&:hover': { borderColor: 'rgba(255,255,255,0.4)' },
            }}
          >
            Copy Brief
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleOpenBlogWriter}
            sx={{
              bgcolor: '#CE93D8',
              color: '#1a1a2e',
              fontSize: '0.75rem',
              fontWeight: 700,
              '&:hover': { bgcolor: '#BA68C8' },
            }}
          >
            Open in Blog Writer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentGapRadarCard;
