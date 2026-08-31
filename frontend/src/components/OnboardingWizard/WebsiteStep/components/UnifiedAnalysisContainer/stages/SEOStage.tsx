import React from 'react';
import { Box } from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SEOAuditSection from '../../SEOAuditSection';
import EnhancedGuidelinesSection from '../../EnhancedGuidelinesSection';
import SectionHeader from '../../SectionHeader';
import { EmptyState } from './SharedComponents';
import type { StyleAnalysis } from '../AnalysisResultsDisplay';
import type { TabKey } from '../types';

interface SEOStageProps {
  activeTab: TabKey;
  analysis: StyleAnalysis;
  domainName: string;
  onRunSEOAudit?: (url: string) => Promise<any>;
}

const SEOStage: React.FC<SEOStageProps> = ({
  activeTab,
  analysis,
  domainName,
  onRunSEOAudit,
}) => {
  if (activeTab === 'insights') {
    if (!analysis.seo_audit) return <EmptyState message="No SEO audit data available." />;
    return (
      <Box sx={{ p: 2 }}>
        <SectionHeader title="SEO Audit" icon={<AnalyticsIcon />} />
        <SEOAuditSection
          seoAudit={analysis.seo_audit}
          domainName={domainName}
          onRunAudit={onRunSEOAudit ? () => onRunSEOAudit(domainName) : undefined}
        />
      </Box>
    );
  }

  if (activeTab === 'refine_actions') {
    return (
      <Box sx={{ p: 2 }}>
        <EnhancedGuidelinesSection
          guidelines={{
            seo_optimization: analysis.guidelines?.seo_optimization,
            conversion_optimization: analysis.guidelines?.conversion_optimization,
          }}
          domainName={domainName}
        />
      </Box>
    );
  }

  if (activeTab === 'guidelines') {
    return (
      <Box sx={{ p: 2 }}>
        <EnhancedGuidelinesSection
          guidelines={{
            seo_optimization: analysis.guidelines?.seo_optimization,
          }}
          domainName={domainName}
          bestPractices={analysis.best_practices}
        />
      </Box>
    );
  }

  return null;
};

export default SEOStage;
