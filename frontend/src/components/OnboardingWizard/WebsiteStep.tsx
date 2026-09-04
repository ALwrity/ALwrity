import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  Box,
  Dialog,
  DialogContent,
} from '@mui/material';

// Extracted components
import {
  WebsiteAnalysisTabContent,
  AnalysisProgressDisplay,
  OnboardingTabBar,
  YouTubeIntegrationTab,
  LinkedInIntegrationTab,
  WebsiteStepHeader,
} from './WebsiteStep/components';
import type { StyleAnalysis } from './WebsiteStep/components';

// Import API client for saving
import { apiClient } from '../../api/client';

// Extracted utilities
import { fixUrlFormat } from './WebsiteStep/utils';

// Constants and interfaces
import {
  WebsiteStepProps,
} from './WebsiteStep/utils/constants';

// Custom hooks
import { useWebsiteStepEffects } from './WebsiteStep/hooks/useWebsiteStepEffects';
import { useWebsiteAnalysis } from './WebsiteStep/hooks/useWebsiteAnalysis';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const WebsiteStep: React.FC<WebsiteStepProps> = ({ 
  onContinue, 
  updateHeaderContent, 
  onValidationChange, 
  onDataReady, 
  initialData,
  email: propEmail,
  backgroundTasks,
  onViewBackgroundResults,
  success: propSuccess,
  setSuccess: propSetSuccess,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [internalSuccess, setInternalSuccess] = useState<string | null>(null);

  const success = propSuccess !== undefined ? propSuccess : internalSuccess;
  const setSuccess = propSetSuccess !== undefined ? propSetSuccess : setInternalSuccess;

  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const [useAnalysisForGenAI, setUseAnalysisForGenAI] = useState(true);
  const [activeTab, setActiveTab] = useState<'website' | 'linkedin' | 'youtube'>('website');
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [integrationData, setIntegrationData] = useState<any>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const { user } = useUser();
  const [emailDigestOptIn, setEmailDigestOptIn] = useState<boolean>(true);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');

  const linkedinConnected = connectedPlatforms.includes('linkedin');
  const youtubeConnected = connectedPlatforms.includes('youtube');

  // Custom Hook managing Zero-Waste Inline Brand Analysis Engine
  const {
    website,
    setWebsite,
    loading,
    analysis,
    setAnalysis,
    crawlResult,
    existingAnalysis,
    domainName,
    isProgressModalOpen,
    progress,
    handleAnalyze,
    handleLoadExistingConfirm,
    handleStartFresh,
  } = useWebsiteAnalysis({
    setSuccess,
    setError,
    setAnalysisWarning,
  });

  // Use custom hook for LinkedIn profile summary, Clerk email, and validation changes
  const {
    linkedinProfile,
    setLinkedinProfile,
    email,
    setEmail,
  } = useWebsiteStepEffects({
    initialData,
    linkedinConnected,
    user,
    propEmail,
    website,
    analysis,
    onValidationChange,
  });

  useEffect(() => {
    // Update header content when component mounts
    updateHeaderContent({
      title: 'Let ALwrity Learn Your Brand',
      description: 'Let Alwrity analyze your website to understand your brand voice, writing style, and content characteristics. This helps us generate content that matches your existing tone and resonates with your audience.'
    });
  }, [updateHeaderContent]);

  const handleIntegrationChange = (data: any) => {
    setIntegrationData(data);
  };

  // Register data collector so the Wizard footer button is the single gate to step 3
  useEffect(() => {
    if (onDataReady) {
      onDataReady(() => {
        const fixedUrl = fixUrlFormat(website);
        const integrationsPayload = integrationData || {
          connectedPlatforms,
          updatedAt: new Date().toISOString(),
        };
        return {
          website: fixedUrl || website,
          domainName,
          analysis,
          crawlResult,
          useAnalysisForGenAI,
          integrations: integrationsPayload,
          email,
          emailDigestOptIn,
          userTimezone,
        };
      });
    }
  }, [onDataReady, website, domainName, analysis, crawlResult, useAnalysisForGenAI, integrationData, connectedPlatforms, email, emailDigestOptIn, userTimezone]);

  const hasWebsiteAnalysis = !!(website.trim() && analysis);

  return (
    <Box sx={{ 
      maxWidth: '100%',
      width: '100%',
      mx: 0,
      px: { xs: 1.5, md: 2 },
      pb: { xs: 1.5, md: 2 },
      pt: { xs: 0.375, md: 0.625 },
      position: 'relative',
      '@keyframes fadeIn': {
        '0%': { opacity: 0, transform: 'translateY(10px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' }
      }
    }}>
      {/* Header Title */}
      <WebsiteStepHeader />

      {/* Tab Bar */}
      <OnboardingTabBar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setHasUserInteracted(true);
        }}
        hasWebsiteAnalysis={hasWebsiteAnalysis}
        linkedinConnected={linkedinConnected}
        youtubeConnected={youtubeConnected}
        hasInput={hasUserInteracted || linkedinConnected || youtubeConnected || hasWebsiteAnalysis}
        backgroundTasks={backgroundTasks || null}
        onViewResults={onViewBackgroundResults}
      />

      {/* Website Tab Content */}
      {activeTab === 'website' && (
        <WebsiteAnalysisTabContent
          website={website}
          setWebsite={(url) => {
            setWebsite(url);
            if (url.trim() !== '') {
              setHasUserInteracted(true);
            }
          }}
          loading={loading}
          error={error}
          success={success}
          analysis={analysis}
          crawlResult={crawlResult}
          domainName={domainName}
          useAnalysisForGenAI={useAnalysisForGenAI}
          setUseAnalysisForGenAI={setUseAnalysisForGenAI}
          analysisWarning={analysisWarning}
          handleAnalyze={handleAnalyze}
          handleAnalysisUpdate={setAnalysis}
          saveAnalysis={async (currentAnalysis: StyleAnalysis) => {
            if (!currentAnalysis?.id) {
              console.warn('Cannot save analysis: Missing analysis ID');
              return false;
            }
            try {
              console.log('Saving analysis updates...', currentAnalysis);
              await apiClient.put(`/api/onboarding/style-detection/analysis/${currentAnalysis.id}`, currentAnalysis);
              console.log('Analysis updates saved successfully');
              return true;
            } catch (err) {
              console.error('Failed to save analysis updates:', err);
              return false;
            }
          }}
          handleIntegrationChange={handleIntegrationChange}
          connectedPlatforms={connectedPlatforms}
          setConnectedPlatforms={setConnectedPlatforms}
          existingAnalysis={existingAnalysis}
          handleLoadExistingConfirm={handleLoadExistingConfirm}
          handleStartFresh={handleStartFresh}
        />
      )}

      {/* LinkedIn Tab Content */}
      {activeTab === 'linkedin' && (
        <LinkedInIntegrationTab
          connectedPlatforms={connectedPlatforms}
          setConnectedPlatforms={setConnectedPlatforms}
          linkedinProfile={linkedinProfile}
          setLinkedinProfile={setLinkedinProfile}
        />
      )}

      {/* YouTube Tab Content */}
      {activeTab === 'youtube' && (
        <YouTubeIntegrationTab
          youtubeConnected={youtubeConnected}
          setConnectedPlatforms={setConnectedPlatforms}
          connectedPlatforms={connectedPlatforms}
        />
      )}

      {/* Analysis Progress Modal */}
      <Dialog
        open={isProgressModalOpen}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
            bgcolor: '#EFF6FF',
            border: '1px solid #CBD5E1',
          }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <AnalysisProgressDisplay loading={true} progress={progress} />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default WebsiteStep;
