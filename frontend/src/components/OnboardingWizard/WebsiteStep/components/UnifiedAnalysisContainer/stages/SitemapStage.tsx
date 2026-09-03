import React from 'react';
import { Box, Typography } from '@mui/material';
import SitemapAnalysisSection from '../../SitemapAnalysisSection';
import { EmptyState } from './SharedComponents';
import type { StyleAnalysis } from '../types';
import type { TabKey } from '../types';

interface SitemapStageProps {
  activeTab: TabKey;
  analysis: StyleAnalysis;
  domainName: string;
}

const safeStr = (val: any): string => {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(safeStr).join(', ');
  if (typeof val === 'object') return val.name || val.title || val.label || JSON.stringify(val).slice(0, 80);
  return String(val);
};

const SitemapStage: React.FC<SitemapStageProps> = ({
  activeTab,
  analysis,
  domainName,
}) => {
  if (activeTab === 'insights') {
    if (!analysis.sitemap_analysis)
      return <EmptyState message="No sitemap intelligence available." />;
    return (
      <Box sx={{ p: 2 }}>
        <SitemapAnalysisSection
          sitemapAnalysis={analysis.sitemap_analysis}
          domainName={domainName}
        />
      </Box>
    );
  }

  if (activeTab === 'refine_actions' || activeTab === 'guidelines') {
    const aiInsights = analysis.sitemap_analysis?.ai_insights;
    if (!aiInsights) return <EmptyState message="No sitemap action items available." />;
    return (
      <Box sx={{ p: 3 }}>
        {aiInsights.growth_recommendations?.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#15803D', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              Growth Recommendations
            </Typography>
            {aiInsights.growth_recommendations.slice(0, 5).map((r: string, i: number) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>• {r}</Typography>
            ))}
          </Box>
        )}
        {analysis.sitemap_analysis?.seo_recommendations?.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1D4ED8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              SEO Recommendations
            </Typography>
            {analysis.sitemap_analysis.seo_recommendations.slice(0, 5).map((r: any, i: number) => (
              <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>• {typeof r === 'string' ? r : r?.message ?? ''}</Typography>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  return null;
};

export default SitemapStage;
export { safeStr };
