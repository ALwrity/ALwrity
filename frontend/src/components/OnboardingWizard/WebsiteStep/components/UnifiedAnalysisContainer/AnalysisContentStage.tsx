/**
 * AnalysisContentStage
 * Renders the correct existing sub-component for the active [domain × tab] intersection.
 * Modularized to keep file size under 500 lines.
 */
import React from 'react';
import type { DomainKey, TabKey } from './types';
import type { StyleAnalysis } from '../AnalysisResultsDisplay';

import OverviewStage from './stages/OverviewStage';
import BrandStage from './stages/BrandStage';
import AudienceStage from './stages/AudienceStage';
import ContentStage from './stages/ContentStage';
import SEOStage from './stages/SEOStage';
import SitemapStage from './stages/SitemapStage';
import FootprintStage from './stages/FootprintStage';
import { EmptyState } from './stages/SharedComponents';

interface AnalysisContentStageProps {
  activeDomain: DomainKey;
  activeTab: TabKey;
  analysis: StyleAnalysis;
  crawlResult: any;
  domainName: string;
  isEditable: boolean;
  onUpdate: (section: string, field: string, value: any) => void;
  onSave?: () => void;
  onRunSEOAudit?: (url: string) => Promise<any>;
  refineControls?: React.ReactNode;
}

const AnalysisContentStage: React.FC<AnalysisContentStageProps> = ({
  activeDomain,
  activeTab,
  analysis,
  crawlResult,
  domainName,
  isEditable,
  onUpdate,
  onRunSEOAudit,
  refineControls,
}) => {
  if (activeDomain === 'overview') {
    return (
      <OverviewStage
        activeTab={activeTab}
        analysis={analysis}
        domainName={domainName}
        isEditable={isEditable}
        onUpdate={onUpdate}
      />
    );
  }

  if (activeDomain === 'brand') {
    return (
      <BrandStage
        activeTab={activeTab}
        analysis={analysis}
        domainName={domainName}
        isEditable={isEditable}
        onUpdate={onUpdate}
        refineControls={refineControls}
      />
    );
  }

  if (activeDomain === 'audience') {
    return (
      <AudienceStage
        activeTab={activeTab}
        analysis={analysis}
        domainName={domainName}
        isEditable={isEditable}
        onUpdate={onUpdate}
        refineControls={refineControls}
      />
    );
  }

  if (activeDomain === 'content') {
    return (
      <ContentStage
        activeTab={activeTab}
        analysis={analysis}
        domainName={domainName}
        isEditable={isEditable}
        onUpdate={onUpdate}
        refineControls={refineControls}
      />
    );
  }

  if (activeDomain === 'seo') {
    return (
      <SEOStage
        activeTab={activeTab}
        analysis={analysis}
        domainName={domainName}
        onRunSEOAudit={onRunSEOAudit}
      />
    );
  }

  if (activeDomain === 'sitemap') {
    return (
      <SitemapStage
        activeTab={activeTab}
        analysis={analysis}
        domainName={domainName}
      />
    );
  }

  if (activeDomain === 'footprint') {
    return (
      <FootprintStage
        activeTab={activeTab}
        crawlResult={crawlResult}
      />
    );
  }

  return <EmptyState message="Select a domain from the sidebar to begin." />;
};

export default AnalysisContentStage;
export { EmptyState };
