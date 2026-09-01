import React from 'react';
import { FootprintCrawlPanels, EmptyState } from './SharedComponents';
import type { TabKey } from '../types';

interface FootprintStageProps {
  activeTab: TabKey;
  crawlResult: any;
}

const FootprintStage: React.FC<FootprintStageProps> = ({
  activeTab,
  crawlResult,
}) => {
  if (!crawlResult) {
    return <EmptyState message="No site footprint data available." />;
  }
  return (
    <FootprintCrawlPanels
      crawlResult={crawlResult}
      showPlatformNudge={activeTab === 'refine_actions'}
    />
  );
};

export default FootprintStage;
