import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import DescriptionIcon from '@mui/icons-material/Description';
import { GlassCard } from '../../shared/styled';
import { apiClient } from '../../../api/client';

interface KeywordGapItem {
  keyword: string;
  position: number;
  impressions: number;
  current_ctr: number;
  clicks: number;
  estimated_traffic_if_page1: number;
  gap_from_page1: number;
}

interface QuickWinItem {
  keyword: string;
  position: number;
  impressions: number;
  current_ctr: number;
  clicks: number;
  estimated_traffic_gain: number;
  reason: string;
}

interface ContentOpportunityItem {
  type: 'Content Optimization' | 'Content Enhancement';
  keyword: string;
  opportunity: string;
  potential_impact: 'High' | 'Medium';
  current_position: number;
  current_ctr: number;
  impressions: number;
  clicks: number;
  estimated_traffic_gain: number;
  priority: 'High' | 'Medium';
  suggested_format: string;
}

interface PageOpportunityItem {
  page: string;
  page_title: string;
  impressions: number;
  clicks: number;
  current_ctr: number;
  current_position: number;
  reason: string;
}

interface KeywordGapSummary {
  site_url: string;
  date_range: { start: string; end: string };
  total_keywords_analyzed: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
  avg_position: number;
  ctr_vs_benchmark: number;
  health_score: number;
  keyword_distribution: {
    positions_1_3: number;
    positions_4_10: number;
    positions_11_20: number;
    positions_21_plus: number;
  };
  top_keywords: Array<{ keyword: string; impressions: number; clicks: number; position: number; ctr: number }>;
}

interface KeywordGapData {
  keyword_gaps: KeywordGapItem[];
  quick_wins: QuickWinItem[];
  content_opportunities: ContentOpportunityItem[];
  page_opportunities: PageOpportunityItem[];
  summary: KeywordGapSummary | Record<string, never>;
  error?: string;
}

const scoreColor = (score: number): string => {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
};

const initialExpanded = (items: unknown[] | undefined | null): string | false => {
  return items && items.length > 0 ? 'panel-0' : false;
};

const CategorySection: React.FC<{
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}> = ({ icon, title, count, color, children, defaultExpanded = false }) => (
  <Accordion
    defaultExpanded={defaultExpanded}
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
      <Box display="flex" alignItems="center" gap={1.5}>
        {icon}
        <Typography variant="subtitle2" fontWeight={600} sx={{ color: 'white' }}>
          {title}
        </Typography>
        <Chip
          label={count}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            bgcolor: `${color}22`,
            color,
          }}
        />
      </Box>
    </AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}>
      {children}
    </AccordionDetails>
  </Accordion>
);

const KeywordGapAnalysis: React.FC = () => {
  const [data, setData] = useState<KeywordGapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await apiClient.get('/api/seo-dashboard/keyword-gaps');
        setData(resp.data);
        setError(resp.data.error || null);
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Failed to load keyword gap data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <GlassCard sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <TrendingUpIcon sx={{ fontSize: 20 }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: 'white' }}>
            Keyword Gap Analysis
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          {error}
        </Typography>
        {error.includes('Connect Google Search Console') && (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mt: 1, display: 'block' }}>
            Connect GSC in the platform status menu above.
          </Typography>
        )}
      </GlassCard>
    );
  }

  if (!data) return null;

  const summary = data.summary as KeywordGapSummary;
  const hasData = summary?.total_keywords_analyzed > 0;

  return (
    <Box sx={{ mb: 4 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <TrendingUpIcon sx={{ color: 'white', fontSize: 20 }} />
        <Typography variant="h6" fontWeight={700} sx={{ color: 'white' }}>
          Keyword Gap Analysis
        </Typography>
        {hasData && (
          <Chip
            label={`${summary.total_keywords_analyzed} keywords`}
            size="small"
            sx={{ bgcolor: 'rgba(33,150,243,0.15)', color: '#90CAF9', height: 20, fontSize: '0.65rem' }}
          />
        )}
      </Box>

      {hasData && (
        <>
          {/* Summary Metrics */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 2 }}>
            <GlassCard sx={{ p: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Health Score
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: scoreColor(summary.health_score) }}>
                {summary.health_score}
              </Typography>
            </GlassCard>
            <GlassCard sx={{ p: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Avg. Position
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: 'white' }}>
                {summary.avg_position}
              </Typography>
            </GlassCard>
            <GlassCard sx={{ p: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Total Clicks
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: '#2196F3' }}>
                {summary.total_clicks.toLocaleString()}
              </Typography>
            </GlassCard>
            <GlassCard sx={{ p: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                CTR vs Benchmark
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: summary.ctr_vs_benchmark >= 0 ? '#22c55e' : '#ef4444' }}
              >
                {summary.ctr_vs_benchmark >= 0 ? '+' : ''}{summary.ctr_vs_benchmark}%
              </Typography>
            </GlassCard>
          </Box>

          {/* Keyword Distribution */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`Top 3: ${summary.keyword_distribution.positions_1_3}`}
              size="small"
              sx={{ bgcolor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
            />
            <Chip
              label={`Page 1: ${summary.keyword_distribution.positions_4_10}`}
              size="small"
              sx={{ bgcolor: 'rgba(33,150,243,0.15)', color: '#90CAF9' }}
            />
            <Chip
              label={`Page 2: ${summary.keyword_distribution.positions_11_20}`}
              size="small"
              sx={{ bgcolor: 'rgba(255,152,0,0.15)', color: '#FFB74D' }}
            />
            <Chip
              label={`Page 3+: ${summary.keyword_distribution.positions_21_plus}`}
              size="small"
              sx={{ bgcolor: 'rgba(244,67,54,0.15)', color: '#EF9A9A' }}
            />
          </Box>
        </>
      )}

      {/* Keyword Gaps */}
      <CategorySection
        icon={<SpeedIcon sx={{ fontSize: 18, color: '#f59e0b' }} />}
        title="Keyword Gaps"
        count={data.keyword_gaps?.length || 0}
        color="#f59e0b"
        defaultExpanded={data.keyword_gaps?.length > 0}
      >
        {data.keyword_gaps?.length > 0 ? (
          data.keyword_gaps.map((gap, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                py: 1, borderBottom: i < data.keyword_gaps.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} sx={{ color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gap.keyword}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  #{gap.position} &middot; {gap.impressions.toLocaleString()} impressions &middot; {gap.current_ctr}% CTR
                </Typography>
              </Box>
              <Tooltip title={`Estimated traffic if page 1`}>
                <Chip
                  label={`+${gap.estimated_traffic_if_page1}`}
                  size="small"
                  sx={{ ml: 1, bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}
                />
              </Tooltip>
            </Box>
          ))
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            No keyword gaps identified. Your rankings look solid.
          </Typography>
        )}
      </CategorySection>

      {/* Quick Wins */}
      <CategorySection
        icon={<LightbulbIcon sx={{ fontSize: 18, color: '#22c55e' }} />}
        title="Quick Wins"
        count={data.quick_wins?.length || 0}
        color="#22c55e"
        defaultExpanded={data.quick_wins?.length > 0}
      >
        {data.quick_wins?.length > 0 ? (
          data.quick_wins.map((win, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                py: 1, borderBottom: i < data.quick_wins.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                  {win.keyword}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  {win.reason}
                </Typography>
              </Box>
              <Chip
                label={`+${win.estimated_traffic_gain} clicks`}
                size="small"
                sx={{ ml: 1, bgcolor: 'rgba(34,197,94,0.15)', color: '#22c55e', fontWeight: 600, flexShrink: 0 }}
              />
            </Box>
          ))
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            No quick wins identified.
          </Typography>
        )}
      </CategorySection>

      {/* Content Opportunities */}
      <CategorySection
        icon={<DescriptionIcon sx={{ fontSize: 18, color: '#90CAF9' }} />}
        title="Content Opportunities"
        count={data.content_opportunities?.length || 0}
        color="#90CAF9"
        defaultExpanded={data.content_opportunities?.length > 0}
      >
        {data.content_opportunities?.length > 0 ? (
          data.content_opportunities.map((opp, i) => (
            <Box
              key={i}
              sx={{
                py: 1, borderBottom: i < data.content_opportunities.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="body2" fontWeight={600} sx={{ color: 'white' }}>
                  {opp.keyword}
                </Typography>
                <Chip
                  label={opp.priority}
                  size="small"
                  sx={{
                    height: 18, fontSize: '0.6rem', fontWeight: 700,
                    bgcolor: opp.priority === 'High' ? 'rgba(245,158,11,0.15)' : 'rgba(33,150,243,0.15)',
                    color: opp.priority === 'High' ? '#f59e0b' : '#90CAF9',
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 0.5 }}>
                {opp.opportunity}
              </Typography>
              <Box display="flex" gap={1}>
                <Chip label={opp.type} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }} />
                <Chip label={opp.suggested_format} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }} />
              </Box>
            </Box>
          ))
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            No content opportunities found.
          </Typography>
        )}
      </CategorySection>

      {/* Page Opportunities */}
      <CategorySection
        icon={<LightbulbIcon sx={{ fontSize: 18, color: '#CE93D8' }} />}
        title="Page Opportunities"
        count={data.page_opportunities?.length || 0}
        color="#CE93D8"
        defaultExpanded={data.page_opportunities?.length > 0}
      >
        {data.page_opportunities?.length > 0 ? (
          data.page_opportunities.map((page, i) => (
            <Box
              key={i}
              sx={{
                py: 1, borderBottom: i < data.page_opportunities.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <Typography variant="body2" fontWeight={600} sx={{ color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {page.page_title || page.page}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block', mb: 0.5 }}>
                {page.reason}
              </Typography>
              <Box display="flex" gap={1} alignItems="center">
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  {page.impressions.toLocaleString()} impressions &middot; {page.current_ctr}% CTR
                </Typography>
              </Box>
            </Box>
          ))
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            No page opportunities identified.
          </Typography>
        )}
      </CategorySection>
    </Box>
  );
};

export default KeywordGapAnalysis;
