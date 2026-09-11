import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useOnboardingStyles } from './common/useOnboardingStyles';
import { SocialMediaPresenceSection, CompetitorsGrid } from './WebsiteStep/components';
import type { Competitor } from './WebsiteStep/components';
import ResearchStepBackgroundSetupModal from './CompetitorAnalysisStep/ResearchStepBackgroundSetupModal';
import { SifIndexingPanel } from './common/SifIndexingPanel';
import { ContentPillarsSection } from './CompetitorAnalysisStep/ContentPillarsSection';
import { BenchmarkInsightsSection } from './CompetitorAnalysisStep/BenchmarkInsightsSection';
import { StrategicInsightsSection } from './CompetitorAnalysisStep/StrategicInsightsSection';
import { InsightsModals } from './CompetitorAnalysisStep/InsightsModals';
import { ProgressModal } from './CompetitorAnalysisStep/ProgressModal';
import { useCompetitorDiscovery } from './CompetitorAnalysisStep/useCompetitorDiscovery';
import { useCompetitorResearchWorkflow } from './CompetitorAnalysisStep/useCompetitorResearchWorkflow';
import { CompetitorAnalysisHeader } from './CompetitorAnalysisStep/CompetitorAnalysisHeader';
import { labelify, renderStringList } from './CompetitorAnalysisStep/competitorStepUiHelpers';
import { OnboardingDialogCloseButton } from './common/OnboardingDialogCloseButton';

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
  onContinue,
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

  // UI state (modals, header, sitemap, social discovery) — stays in parent
  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  // Seed from initialData so the persisted sitemap/strategic insights render
  // immediately and don't trigger an unnecessary AI call on back-navigation.
  const [sitemapAnalysis, setSitemapAnalysis] = useState<any>(initialData?.sitemapAnalysis ?? null);
  const [isAnalyzingSitemap, setIsAnalyzingSitemap] = useState(false);
  const [isDiscoveringSocial, setIsDiscoveringSocial] = useState(false);
  const [missingData, setMissingData] = useState(false);
  const [showBenchmarksModal, setShowBenchmarksModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showPublishingModal, setShowPublishingModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [backgroundSetupOpen, setBackgroundSetupOpen] = useState(false);

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

  // Data-fetching hook — manages competitors, social media, pillars, analysis state
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

  // Check for missing data
  useEffect(() => {
    // Wait a bit to ensure Wizard has finished initializing its stepData
    const timer = setTimeout(() => {
      const propUserUrl = userUrl || '';
      const localStorageUrl = localStorage.getItem('website_url') || '';
      const onboardingContextUrl = (window as any).onboardingContext?.websiteUrl || '';
      
      // Also check initialData if available
      const initialDataUrl = initialData?.website || initialData?.website_url || '';
      
      const finalUserUrl = propUserUrl || localStorageUrl || onboardingContextUrl || initialDataUrl || '';
      
      if (!finalUserUrl) {
        console.warn('CompetitorAnalysisStep: No website URL found (prop, local, context, or initialData).');
        setMissingData(true);
      } else {
        console.log('CompetitorAnalysisStep: Valid website URL found:', finalUserUrl);
        setMissingData(false);
        // Ensure website_url is in localStorage for other parts of the step to use
        if (!localStorage.getItem('website_url')) {
          localStorage.setItem('website_url', finalUserUrl);
        }
      }
    }, 1000); // Increased timeout to 1s to allow for slower data loading
    
    return () => clearTimeout(timer);
  }, [userUrl, initialData]);

  const handleShowHighlights = (competitor: Competitor) => {
    setSelectedCompetitor(competitor);
    setShowHighlightsModal(true);
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
      <CompetitorAnalysisHeader
        isAnalyzing={isAnalyzing}
        onRunFreshAnalysis={() => startCompetitorDiscovery(true)}
        onOpenBackgroundSetup={() => setBackgroundSetupOpen(true)}
      />

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

      {/* Social Media Accounts Section (always visible) */}
      <SocialMediaPresenceSection 
        socialMediaAccounts={socialMediaAccounts} 
        onUpdateAccounts={handleUpdateSocialAccounts}
        onRefresh={discoverSocialMedia}
        isRefreshing={isDiscoveringSocial}
      />

      {/* Competitors Grid Section (always visible) */}
      <CompetitorsGrid 
        competitors={competitors}
        onShowHighlights={handleShowHighlights}
        onRemoveCompetitor={handleRemoveCompetitor}
        onAddCompetitor={handleAddCompetitor}
      />

      {benchmarkError && (
        <Alert severity="warning" sx={{ mt: 2 }} onClose={() => setBenchmarkError(null)}>
          {benchmarkError}
        </Alert>
      )}

      {/* Content Pillars Section */}
      <ContentPillarsSection data={contentPillars} isLoading={isLoadingPillars} error={error} onRefresh={refreshContentPillars} />

      {/* Competitor Sitemap Benchmark — enriched insights */}
      <Box mt={4} mb={3}>
        <BenchmarkInsightsSection
          report={benchmarkReport}
          onRefresh={runSitemapBenchmark}
          isRefreshing={isRunningBenchmark}
        />
      </Box>

      {/* Strategic Content Opportunities Section */}
      {competitors.length > 0 && (
        <StrategicInsightsSection
          sitemapAnalysis={sitemapAnalysis}
          isAnalyzingSitemap={isAnalyzingSitemap}
          onRefreshStrategy={() => startSitemapAnalysis(true)}
          onShowBenchmarks={() => setShowBenchmarksModal(true)}
          onShowStrategy={() => setShowStrategyModal(true)}
          onShowPublishing={() => setShowPublishingModal(true)}
          onShowStructure={() => setShowStructureModal(true)}
        />
      )}

      {/* Insight Modals */}
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

      {/* Progress Modal */}
      <ProgressModal
        open={showProgressModal}
        progress={analysisProgress}
        step={analysisStep}
      />

      {/* Competitor analysis modal — shows the full data persisted by the backend */}
      <Dialog
        open={showHighlightsModal}
        onClose={() => setShowHighlightsModal(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedCompetitor && (
          <>
            <DialogTitle
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 1,
                pr: 1.5,
              }}
            >
              <Box>
                <Typography variant="h6" component="span" fontWeight={700} sx={{ color: '#0B1220' }}>
                  {selectedCompetitor.title || selectedCompetitor.domain}
                </Typography>
                <Typography variant="caption" component="div" sx={{ color: '#6B7280', mt: 0.5 }}>
                  {selectedCompetitor.domain}
                </Typography>
              </Box>
              <OnboardingDialogCloseButton onClick={() => setShowHighlightsModal(false)} />
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2.5}>
                {/* Top-line chips */}
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`${Math.round(selectedCompetitor.relevance_score * 100)}% match`}
                    sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600, border: '1px solid #bbf7d0' }}
                  />
                  {selectedCompetitor.competitive_insights?.threat_level && (
                    <Chip
                      size="small"
                      label={`Threat: ${selectedCompetitor.competitive_insights.threat_level}`}
                      sx={{
                        bgcolor:
                          selectedCompetitor.competitive_insights.threat_level === 'high'
                            ? '#fef2f2' : selectedCompetitor.competitive_insights.threat_level === 'low'
                            ? '#f0fdf4' : '#fffbeb',
                        color:
                          selectedCompetitor.competitive_insights.threat_level === 'high'
                            ? '#b91c1c' : selectedCompetitor.competitive_insights.threat_level === 'low'
                            ? '#15803d' : '#b45309',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor:
                          selectedCompetitor.competitive_insights.threat_level === 'high'
                            ? '#fecaca' : selectedCompetitor.competitive_insights.threat_level === 'low'
                            ? '#bbf7d0' : '#fde68a',
                      }}
                    />
                  )}
                  {selectedCompetitor.published_date && (
                    <Chip
                      size="small"
                      label={`Published: ${new Date(selectedCompetitor.published_date).toLocaleDateString()}`}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22, borderColor: '#E5E7EB', color: '#6B7280' }}
                    />
                  )}
                </Box>

                {/* Summary */}
                {selectedCompetitor.summary && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                      Summary
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#4B5563' }}>
                      {selectedCompetitor.summary}
                    </Typography>
                  </Box>
                )}

                {/* Business / audience / market share */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                    Business & Audience
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {selectedCompetitor.competitive_insights?.business_model &&
                      selectedCompetitor.competitive_insights.business_model !== 'unknown' && (
                        <Chip size="small" label={`Model: ${selectedCompetitor.competitive_insights.business_model}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                    {selectedCompetitor.competitive_insights?.target_audience &&
                      selectedCompetitor.competitive_insights.target_audience !== 'unknown' && (
                        <Chip size="small" label={`Audience: ${selectedCompetitor.competitive_insights.target_audience}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                    {selectedCompetitor.competitive_insights?.market_share_estimate &&
                      selectedCompetitor.competitive_insights.market_share_estimate !== 'unknown' && (
                        <Chip size="small" label={`Market share: ${selectedCompetitor.competitive_insights.market_share_estimate}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                  </Box>
                </Box>

                {/* Strengths */}
                {selectedCompetitor.competitive_insights.competitive_strengths &&
                  selectedCompetitor.competitive_insights.competitive_strengths.length > 0 && (
                    renderStringList('Competitive Strengths', selectedCompetitor.competitive_insights.competitive_strengths)
                  )}

                {/* Weaknesses */}
                {selectedCompetitor.competitive_insights.competitive_weaknesses &&
                  selectedCompetitor.competitive_insights.competitive_weaknesses.length > 0 && (
                    renderStringList('Competitive Weaknesses', selectedCompetitor.competitive_insights.competitive_weaknesses)
                  )}

                {/* Differentiation opportunities */}
                {selectedCompetitor.competitive_insights.differentiation_opportunities &&
                  selectedCompetitor.competitive_insights.differentiation_opportunities.length > 0 && (
                    renderStringList('Differentiation Opportunities', selectedCompetitor.competitive_insights.differentiation_opportunities)
                  )}

                {/* Market positioning */}
                {selectedCompetitor.market_positioning && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                      Market Positioning
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {Object.entries(selectedCompetitor.market_positioning)
                        .filter(([, v]) => v && v !== 'unknown')
                        .map(([k, v]) => (
                          <Chip key={k} size="small" label={`${labelify(k)}: ${v}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                        ))}
                      {(!selectedCompetitor.market_positioning || 
                        !Object.values(selectedCompetitor.market_positioning).some((v) => v && v !== 'unknown')) && (
                        <Typography variant="body2" color="text.secondary">No market positioning data available.</Typography>
                      )}
                    </Box>
                  </Box>
                )}

                {/* Content insights */}
                {selectedCompetitor.content_insights && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                      Content Insights
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {selectedCompetitor.content_insights.content_focus && (
                        <Chip size="small" label={`Focus: ${selectedCompetitor.content_insights.content_focus}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                      {selectedCompetitor.content_insights.target_audience && (
                        <Chip size="small" label={`Audience: ${selectedCompetitor.content_insights.target_audience}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                      {selectedCompetitor.content_insights.content_quality && (
                        <Chip size="small" label={`Quality: ${selectedCompetitor.content_insights.content_quality}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                      {selectedCompetitor.content_insights.publishing_frequency && (
                        <Chip size="small" label={`Frequency: ${selectedCompetitor.content_insights.publishing_frequency}`} variant="outlined" sx={{ fontSize: '0.72rem', borderColor: '#d1d5db', color: '#374151' }} />
                      )}
                    </Box>
                    {selectedCompetitor.content_insights.content_types &&
                      selectedCompetitor.content_insights.content_types.length > 0 && (
                      <Typography variant="body2" sx={{ color: '#4B5563', mt: 0.75 }}>
                        <strong>Content types:</strong> {selectedCompetitor.content_insights.content_types.join(', ')}
                      </Typography>
                    )}
                  </Box>
                )}

                <Divider />

                {/* Highlights */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                    Key Highlights
                  </Typography>
                  {selectedCompetitor.highlights && selectedCompetitor.highlights.length > 0 ? (
                    <Box>
                      {selectedCompetitor.highlights.map((highlight, index) => (
                        <Box
                          key={index}
                          sx={{
                            p: 1.5,
                            mb: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            backgroundColor: 'background.paper'
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">{highlight}</Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No highlights available.</Typography>
                  )}
                </Box>

                {/* Subpages */}
                {selectedCompetitor.subpages && selectedCompetitor.subpages.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
                      Subpages ({selectedCompetitor.subpages.length})
                    </Typography>
                    <Stack spacing={0.5}>
                      {selectedCompetitor.subpages.map((sp, i) => (
                        <Typography key={i} variant="body2" sx={{ color: '#4B5563', wordBreak: 'break-all' }}>
                          • {sp}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>

      <ResearchStepBackgroundSetupModal
        open={backgroundSetupOpen}
        onClose={() => setBackgroundSetupOpen(false)}
      />

      <SifIndexingPanel />

    </Box>
  );
};

export default CompetitorAnalysisStep;
