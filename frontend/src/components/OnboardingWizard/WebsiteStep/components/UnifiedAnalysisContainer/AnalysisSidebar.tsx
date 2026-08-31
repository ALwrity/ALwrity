import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
  Badge,
  Chip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import GroupIcon from '@mui/icons-material/Group';
import ArticleIcon from '@mui/icons-material/Article';
import SpeedIcon from '@mui/icons-material/Speed';
import MapIcon from '@mui/icons-material/Map';
import BusinessIcon from '@mui/icons-material/Business';
import type { DomainKey, DomainConfig, TabKey } from './types';
import { TAB_CORRESPONDING_DOMAINS } from './types';
import type { StyleAnalysis } from '../AnalysisResultsDisplay';

interface AnalysisSidebarProps {
  activeDomain: DomainKey;
  onDomainChange: (domain: DomainKey) => void;
  analysis: StyleAnalysis;
  crawlResult: any;
  activeTab: TabKey;
}

const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    key: 'overview',
    label: 'Overview',
    tooltip: 'Key insights summary, AI generation settings and confidence score.',
    hasData: (a) => !!(a.writing_style || a.target_audience || a.content_type || a.recommended_settings),
  },
  {
    key: 'brand',
    label: 'Brand Voice',
    tooltip: 'Brand voice, values, positioning, competitive differentiation, trust signals.',
    hasData: (a) => !!a.brand_analysis,
  },
  {
    key: 'audience',
    label: 'Audience',
    tooltip: 'Demographics, expertise level, psychographic profile, pain points and motivations.',
    hasData: (a) => !!a.target_audience,
  },
  {
    key: 'content',
    label: 'Content Profile',
    tooltip: 'Content characteristics, readability, content type and purpose.',
    hasData: (a) => !!(a.content_characteristics || a.content_type || a.content_strategy_insights),
  },
  {
    key: 'seo',
    label: 'SEO Audit',
    tooltip: 'Homepage SEO snapshot — meta, content, technical, performance and accessibility.',
    getBadge: (a) => {
      const issues = a.seo_audit?.summary?.critical_issues?.length;
      return issues > 0 ? issues : undefined;
    },
    hasData: (a) => !!a.seo_audit,
  },
  {
    key: 'sitemap',
    label: 'Sitemap Intel',
    tooltip: 'Site structure, content trends, publishing patterns and AI-driven gap analysis.',
    hasData: (a) => !!a.sitemap_analysis,
  },
  {
    key: 'footprint',
    label: 'Site Footprint',
    tooltip: 'Domain metadata, social media profiles and extracted brand/contact information.',
    hasData: (_, cr) => !!cr,
  },
];

const DOMAIN_ICONS: Record<DomainKey, React.ReactNode> = {
  overview: <DashboardIcon fontSize="small" />,
  brand: <RecordVoiceOverIcon fontSize="small" />,
  audience: <GroupIcon fontSize="small" />,
  content: <ArticleIcon fontSize="small" />,
  seo: <SpeedIcon fontSize="small" />,
  sitemap: <MapIcon fontSize="small" />,
  footprint: <BusinessIcon fontSize="small" />,
};

const DOMAIN_ACCENT: Record<DomainKey, string> = {
  overview: '#3B82F6',
  brand: '#8B5CF6',
  audience: '#10B981',
  content: '#F59E0B',
  seo: '#EF4444',
  sitemap: '#0EA5E9',
  footprint: '#6366F1',
};

const AnalysisSidebar: React.FC<AnalysisSidebarProps> = ({
  activeDomain,
  onDomainChange,
  analysis,
  crawlResult,
  activeTab,
}) => {
  // Filter configs based on tab correspondence
  const visibleConfigs = DOMAIN_CONFIGS.filter((cfg) =>
    TAB_CORRESPONDING_DOMAINS[activeTab].includes(cfg.key)
  );

  return (
    <Box
      data-testid="analysis-sidebar"
      sx={{
        width: 200,
        flexShrink: 0,
        borderRight: '1px solid #E2E8F0',
        bgcolor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        py: 1,
        minHeight: 480,
      }}
    >
      {visibleConfigs.map((cfg) => {
        const isActive = activeDomain === cfg.key;
        const hasData = cfg.hasData(analysis, crawlResult);
        const badge = cfg.getBadge?.(analysis);
        const accent = DOMAIN_ACCENT[cfg.key];

        return (
          <Tooltip key={cfg.key} title={cfg.tooltip} placement="right" arrow>
            <Box
              data-testid={`sidebar-domain-${cfg.key}`}
              onClick={() => onDomainChange(cfg.key)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 2,
                py: 1.1,
                mx: 1,
                mb: 0.25,
                borderRadius: 2,
                cursor: hasData ? 'pointer' : 'default',
                opacity: hasData ? 1 : 0.4,
                bgcolor: isActive ? `${accent}18` : 'transparent',
                borderLeft: isActive ? `3px solid ${accent}` : '3px solid transparent',
                transition: 'all 0.18s ease',
                '&:hover': hasData
                  ? {
                      bgcolor: `${accent}12`,
                      borderLeftColor: accent,
                    }
                  : {},
              }}
              role="button"
              aria-pressed={isActive}
              aria-label={cfg.label}
            >
              <Box
                sx={{
                  color: isActive ? accent : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {badge !== undefined ? (
                  <Badge
                    badgeContent={badge}
                    color="error"
                    sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}
                  >
                    {DOMAIN_ICONS[cfg.key]}
                  </Badge>
                ) : (
                  DOMAIN_ICONS[cfg.key]
                )}
              </Box>

              <Typography
                variant="body2"
                sx={{
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? accent : '#374151',
                  fontSize: '0.8rem',
                  lineHeight: 1.3,
                }}
              >
                {cfg.label}
              </Typography>

              {!hasData && (
                <Chip
                  label="—"
                  size="small"
                  sx={{ ml: 'auto', height: 16, fontSize: '0.6rem', bgcolor: '#F1F5F9' }}
                />
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export { DOMAIN_CONFIGS, DOMAIN_ACCENT };
export default AnalysisSidebar;
