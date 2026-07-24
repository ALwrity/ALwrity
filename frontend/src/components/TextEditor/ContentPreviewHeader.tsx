import React from 'react';
import { MainContentPreviewHeader, ContentPreviewHeaderWithModals } from './ContentPreviewHeaderComponents/index';

interface ContentPreviewHeaderProps {
  researchSources?: any[];
  citations?: any[];
  searchQueries?: string[];
  qualityMetrics?: any;
  draft: string;
  assistantOn?: boolean;
  onAssistantToggle?: (enabled: boolean) => void;
  topic?: string;
  platform?: string;
}

// Main ContentPreviewHeader component - now just a wrapper that uses the extracted component
const ContentPreviewHeader: React.FC<ContentPreviewHeaderProps> = (props) => {
  return <MainContentPreviewHeader {...props} />;
};

// Export both the main component and the enhanced version with modals
export default ContentPreviewHeader;
export { ContentPreviewHeader, ContentPreviewHeaderWithModals };
