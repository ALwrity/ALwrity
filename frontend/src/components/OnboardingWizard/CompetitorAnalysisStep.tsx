import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert, Button, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useOnboardingStyles } from './common/useOnboardingStyles';
import { SocialMediaPresenceSection } from './WebsiteStep/components';
import type { Competitor } from './WebsiteStep/components';
import { InsightsModals } from './CompetitorAnalysisStep/InsightsModals';
import { ProgressModal } from './CompetitorAnalysisStep/ProgressModal';
import { useCompetitorDiscovery } from './CompetitorAnalysisStep/useCompetitorDiscovery';
import { useCompetitorResearchWorkflow } from './CompetitorAnalysisStep/useCompetitorResearchWorkflow';
import { CompetitorAnalysisHeader } from './CompetitorAnalysisStep/CompetitorAnalysisHeader';
import { CompetitorHighlightsDialog } from './CompetitorAnalysisStep/CompetitorHighlightsDialog';
import { ResearchStepUnifiedDashboard } from './CompetitorAnalysisStep/ResearchStepUnifiedDashboard';
import { ResearchStepLegacyStack } from './CompetitorAnalysisStep/ResearchStepLegacyStack';
import {
  SHOW_LEGACY_RESEARCH_STACK,
  SHOW_UNIFIED_RESEARCH_DASHBOARD,
} from './CompetitorAnalysisStep/researchDashboardFlags';

interface CompetitorAnalysisStepProps {
  onContinue: (researchData?: any) => void;
  onBack: () => void;
  userUrl: string;
  industryContext?: string;
  onDataReady?: (getData: () => any) => void;
  onValidationChange?: (isValid: boolean) => void;
  initialData?: any;
  researchStepCompleted?: boolean;
  backendResearchHasData?: boolean;
  onResearchSessionChange?: (payload: Record<string, unknown>) => void;
}

const CompetitorAnalysisStep: React.FC<CompetitorAnalysisStepProps> = ({
  onBack,
  userUrl,
  industryContext,
  onDataReady,
  onValidationChange,
  initialData,
  researchStepCompleted = false,
  backendResearchHasData = false,
  onResearchSessionChange,
}) => {
  const classes = useOnboardingStyles();

  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [sitemapAnalysis, setSitemapAnalysis] = useState<any>(initialData?.sitemapAnalysis ?? null);
  const [isAnalyzingSitemap, setIsAnalyzingSitemap] = useState(false);
  const [isDiscoveringSocial, setIsDiscoveringSocial] = useState(false);
  const [missingData, setMissingData] = useState(false);
  const [showBenchmarksModal, setShowBenchmarksModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showPublishingModal, setShowPublishingModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const sitemapAutoTriggered = React.useRef(false);
  const crawlSocialMediaRef = React.useRef<Record<string, string>>({});

  const mergeCrawlSocialMedia = React.useCallback((exaData: Record<string, any>) => {
    const merged = { ...exaData };
    for (const [platform, url] of Object.entries(crawlSocialMediaRef.current)) {
      const existing = merged[platform];
      if (!existing || String(existing).trim() === '' || String(existing).trim() === '1' || String(existing).toLowerCase() === 'true') {
        merged[platform] = url;
      }
    }
    return merged;
  }, []);

  const {
    competitors, setCompetitors,
    socialMediaAccounts, setSocialMediaAccounts,
    researchSummary,
    contentPillars,
    isLoadingPillars,
    error, setError,
    isAnalyzing,
    analysisProgress, analysisStep,
    showProgressModal,
    isRestoring,
    startCompetitorDiscovery,
    updateCacheWithSitemapAnalysis,
    refreshContentPillars,
  } = useCompetitorDiscovery({
    userUrl,
    industryContext,
    initialData,
    sitemapAnalysis,
    mergeCrawlSocialMedia,
    researchStepCompleted,
    backendResearchHasData,
    onResearchSessionChange,
  });

  const {
    discoverSocialMedia,
    startSitemapAnalysis,
    benchmarkReport,
    isRunningBenchmark,
    benchmarkError,
    setBenchmarkError,
    runSitemapBenchmark,
    handleUpdateSocialAccounts,
    handleRemoveCompetitor,
    handleAddCompetitor,
  } = useCompetitorResearchWorkflow({
    userUrl,
    industryContext,
    initialData,
    missingData,
    onDataReady,
    onValidationChange,
    mergeCrawlSocialMedia,
    competitors,
    setCompetitors,
    socialMediaAccounts,
    setSocialMediaAccounts,
    researchSummary,
    isAnalyzing,
    setError,
    updateCacheWithSitemapAnalysis,
    sitemapAnalysis,
    setSitemapAnalysis,
    isAnalyzingSitemap,
    setIsAnalyzingSitemap,
    isDiscoveringSocial,
    setIsDiscoveringSocial,
    sitemapAutoTriggered,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const propUserUrl = userUrl || '';
      const localStorageUrl = localStorage.getItem('website_url') || '';
      const onboardingContextUrl = (window as any).onboardingContext?.websiteUrl || '';
      const initialDataUrl = initialData?.website || initialData?.website_url || '';
      const finalUserUrl = propUserUrl || localStorageUrl || onboardingContextUrl || initialDataUrl || '';

      if (!finalUserUrl) {
        console.warn('CompetitorAnalysisStep: No website URL found (prop, local, context, or initialData).');
        setMissingData(true);
      } else {
        console.log('CompetitorAnalysisStep: Valid website URL found:', finalUserUrl);
        setMissingData(false);
        if (!localStorage.getItem('website_url')) {
          localStorage.setItem('website_url', finalUserUrl);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [userUrl, initialData]);

  const handleShowHighlights = (competitor: Competitor) => {
    setSelectedCompetitor(competitor);
    setShowHighlightsModal(true);
  };

  const dashboardProps = {
    competitors,
    contentPillars,
    isLoadingPillars,
    pillarsError: error,
    benchmarkReport,
    isRunningBenchmark,
    sitemapAnalysis,
    isAnalyzingSitemap,
    onShowHighlights: handleShowHighlights,
    onRemoveCompetitor: handleRemoveCompetitor,
    onAddCompetitor: handleAddCompetitor,
    onRefreshPillars: refreshContentPillars,
    onRunBenchmark: runSitemapBenchmark,
    onRefreshStrategy: () => startSitemapAnalysis(true),
    onShowBenchmarks: () => setShowBenchmarksModal(true),
    onShowStrategy: () => setShowStrategyModal(true),
    onShowPublishing: () => setShowPublishingModal(true),
    onShowStructure: () => setShowStructureModal(true),
  };

  if (isRestoring && competitors.length === 0 && !error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', mt: 8 }}>
        <CircularProgress size={36} sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Loading your saved competitor research...
        </Typography>
      </Box>
    );
  }

  if (missingData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', mt: 8 }}>
        <Typography variant="h5" color="error" gutterBottom>
          Missing Website URL
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          We couldn't find the website URL to analyze. This might happen if the page was refreshed and session data was lost.
        </Typography>
        <Button variant="contained" onClick={onBack}>
          Return to Website Step
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={classes.container}>
      <CompetitorAnalysisHeader />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => startCompetitorDiscovery(true)}
            sx={{ ml: 2 }}
          >
            Retry
          </Button>
        </Alert>
      )}

      <SocialMediaPresenceSection
        socialMediaAccounts={socialMediaAccounts}
        onUpdateAccounts={handleUpdateSocialAccounts}
        onRefresh={discoverSocialMedia}
        isRefreshing={isDiscoveringSocial}
        onRunFreshAnalysis={() => startCompetitorDiscovery(true)}
        isAnalyzing={isAnalyzing}
      />

      {benchmarkError && (
        <Alert severity="warning" sx={{ mt: 2, mb: 2 }} onClose={() => setBenchmarkError(null)}>
          {benchmarkError}
        </Alert>
      )}

      {SHOW_UNIFIED_RESEARCH_DASHBOARD && (
        <ResearchStepUnifiedDashboard {...dashboardProps} />
      )}

      {SHOW_LEGACY_RESEARCH_STACK && (
        <ResearchStepLegacyStack {...dashboardProps} />
      )}

      <InsightsModals
        sitemapAnalysis={sitemapAnalysis}
        showBenchmarks={showBenchmarksModal}
        showStrategy={showStrategyModal}
        showPublishing={showPublishingModal}
        showStructure={showStructureModal}
        onCloseBenchmarks={() => setShowBenchmarksModal(false)}
        onCloseStrategy={() => setShowStrategyModal(false)}
        onClosePublishing={() => setShowPublishingModal(false)}
        onCloseStructure={() => setShowStructureModal(false)}
      />

      <ProgressModal
        open={showProgressModal}
        progress={analysisProgress}
        step={analysisStep}
      />

      <CompetitorHighlightsDialog
        open={showHighlightsModal}
        competitor={selectedCompetitor}
        onClose={() => setShowHighlightsModal(false)}
      />

    </Box>
  );
};

export default CompetitorAnalysisStep;
