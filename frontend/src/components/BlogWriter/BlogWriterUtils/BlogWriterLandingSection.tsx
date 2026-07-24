import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import BlogWriterLanding from '../BlogWriterLanding';
import ManualResearchForm from '../ManualResearchForm';

interface BlogWriterLandingSectionProps {
  research: any;
  copilotKitAvailable: boolean;
  currentPhase: string;
  navigateToPhase: (phase: string) => void;
  onResearchComplete: (research: any) => void;
  onKeywordsChange?: (kw: string) => void;
  blogLengthRef?: React.MutableRefObject<string>;
  startResearchRef?: React.MutableRefObject<((keywords: string, blogLength?: string) => Promise<any>) | null>;
  restoreAttempted?: boolean;
  onBrainstormResult?: (result: import('../../../api/gscBrainstorm').BrainstormResult) => void;
  initialKeywords?: string;
  /** Restores a saved blog asset — powers the radial hero's Create/Remarket wedges. */
  onRestoreAsset?: (assetId: number) => void;
}

const VALID_PHASES = ['research', 'outline', 'content', 'seo', 'publish'];

export const BlogWriterLandingSection: React.FC<BlogWriterLandingSectionProps> = ({
  research,
  copilotKitAvailable,
  currentPhase,
  navigateToPhase,
  onResearchComplete,
  onKeywordsChange,
  blogLengthRef,
  startResearchRef,
  restoreAttempted = false,
  onBrainstormResult,
  initialKeywords,
  onRestoreAsset,
}) => {
  if (!research) {
    if (currentPhase === 'research') {
      return (
        <ManualResearchForm
          onResearchComplete={onResearchComplete}
          onKeywordsChange={onKeywordsChange}
          blogLengthRef={blogLengthRef}
          researchRef={startResearchRef}
          onBrainstormResult={onBrainstormResult}
          initialKeywords={initialKeywords}
        />
      );
    }

    if (currentPhase === '' || !VALID_PHASES.includes(currentPhase)) {
      return (
        <BlogWriterLanding 
          onStartWriting={() => {
            navigateToPhase('research');
          }}
          navigateToPhase={navigateToPhase}
          hasResearch={!!research}
          onRestoreAsset={onRestoreAsset}
        />
      );
    }

    if (restoreAttempted) {
      return (
        <BlogWriterLanding 
          onStartWriting={() => {
            navigateToPhase('research');
          }}
          navigateToPhase={navigateToPhase}
          hasResearch={!!research}
          onRestoreAsset={onRestoreAsset}
        />
      );
    }

    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center" 
        minHeight="300px"
        gap={2}
      >
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Restoring your work...
        </Typography>
      </Box>
    );
  }
  
  return null;
};

