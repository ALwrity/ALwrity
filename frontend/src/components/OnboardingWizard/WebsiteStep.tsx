import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ExistingAnalysisDialog,
} from './WebsiteStep/components';
import type { StyleAnalysis } from './WebsiteStep/components/AnalysisResultsDisplay';

// Import API client for saving
import { apiClient } from '../../api/client';

// Extracted utilities
import {
  fixUrlFormat,
  checkExistingAnalysis,
  loadExistingAnalysis,
  performAnalysis,
  fetchLastAnalysis
} from './WebsiteStep/utils';

interface WebsiteStepProps {
  onContinue: (stepData?: any) => void;
  updateHeaderContent: (content: { title: string; description: string }) => void;
  onValidationChange?: (isValid: boolean) => void;
  onDataReady?: (getData: () => any) => void;
  initialData?: any;
  email?: string;
  onEmailChange?: (email: string) => void;
  backgroundTasks?: {
    tasks: Record<string, { status: string; started_at: string | null; progress_pct: number }>;
    total: number;
    completed_count: number;
    failed_count: number;
    all_done: boolean;
  } | null;
}

interface AnalysisProgress {
  step: number;
  message: string;
  subMessage?: string;
  completed: boolean;
}

interface ExistingAnalysis {
  exists: boolean;
  analysis_date?: string;
  analysis_id?: number;
  summary?: {
    writing_style?: any;
    target_audience?: any;
    content_type?: any;
  };
  error?: string;
}

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
  onEmailChange,
  backgroundTasks
}) => {
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [crawlResult, setCrawlResult] = useState<any>(null);
  const [existingAnalysis, setExistingAnalysis] = useState<ExistingAnalysis | null>(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [useAnalysisForGenAI, setUseAnalysisForGenAI] = useState(true);
  const [domainName, setDomainName] = useState<string>('');
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);
  const [activeTab, setActiveTab] = useState<'website' | 'linkedin' | 'youtube'>('website');
  const [integrationData, setIntegrationData] = useState<any>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [linkedinProfile, setLinkedinProfile] = useState<any>(null);
  const urlWasPreFilledRef = useRef(false);
  const { user } = useUser();
  const [email, setEmail] = useState<string>('');
  const [emailDigestOptIn, setEmailDigestOptIn] = useState<boolean>(true);
  const [userTimezone, setUserTimezone] = useState<string>('UTC');

  const linkedinConnected = connectedPlatforms.includes('linkedin');
  const youtubeConnected = connectedPlatforms.includes('youtube');

  // Fetch LinkedIn profile summary when connected or from initialData
  useEffect(() => {
    if (initialData?.linkedin_profile) {
      setLinkedinProfile(initialData.linkedin_profile);
      return;
    }
    if (!linkedinConnected) return;
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const { apiClient: client } = await import('../../api/client');
        const resp = await client.get('/api/linkedin-social/profile/summary');
        if (!cancelled && resp.data?.analyzed) {
          setLinkedinProfile(resp.data);
        }
      } catch (e) {
        console.debug('LinkedIn profile summary not yet available');
      }
    };
    const timer = setTimeout(fetchProfile, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [linkedinConnected, initialData?.linkedin_profile]);

  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress[]>([
    { step: 1, message: 'Validating website URL & connection', subMessage: 'Ensuring your site is accessible and ready for analysis', completed: false },
    { step: 2, message: 'Crawling website pages & structure', subMessage: 'Scanning public pages to map your content architecture', completed: false },
    { step: 3, message: 'Extracting content & SEO metadata', subMessage: 'Analyzing page titles, headings, body text, and meta descriptions', completed: false },
    { step: 4, message: 'Analyzing brand voice & tone', subMessage: 'Identifying your unique writing patterns, vocabulary, and emotional resonance', completed: false },
    { step: 5, message: 'Evaluating content characteristics', subMessage: 'Measuring readability, sentence structure, and content variety', completed: false },
    { step: 6, message: 'Identifying target audience signals', subMessage: 'Detecting audience expertise level, pain points, and content preferences', completed: false },
    { step: 7, message: 'Generating custom AI guidelines', subMessage: 'Building your brand playbook to guide future AI-generated content', completed: false }
  ]);

  useEffect(() => {
    // Update header content when component mounts
    updateHeaderContent({
      title: 'Let ALwrity Learn Your Brand',
      description: 'Let Alwrity analyze your website to understand your brand voice, writing style, and content characteristics. This helps us generate content that matches your existing tone and resonates with your audience.'
    });
  }, [updateHeaderContent]);

  // Get user email from Clerk
  useEffect(() => {
    if (user && !propEmail) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      const firstEmail = user.emailAddresses?.[0]?.emailAddress;
      const resolvedEmail = primaryEmail || firstEmail || '';
      if (resolvedEmail) setEmail(resolvedEmail);
    }
  }, [user, propEmail]);

  // Sync email from parent prop when it changes
  useEffect(() => {
    if (propEmail !== undefined && propEmail !== '') {
      setEmail(propEmail);
    }
  }, [propEmail]);

  // Notify parent when validation state changes (guard against infinite loops)
  const prevValidRef = useRef<boolean | null>(null);
  useEffect(() => {
    const hasWebsiteAnalysis = !!(website.trim() && analysis);
    const isValid = hasWebsiteAnalysis || linkedinConnected;
    if (isValid !== prevValidRef.current && onValidationChange) {
      prevValidRef.current = isValid;
      onValidationChange(isValid);
    }
  }, [website, analysis, linkedinConnected, onValidationChange]);

  useEffect(() => {
    // Prefill from last session analysis on mount
    const loadLastAnalysis = async () => {
      try {
        const result = await fetchLastAnalysis();
        if (result.success) {
          if (result.website) {
            setWebsite(result.website);
            urlWasPreFilledRef.current = true;
          }
          if (result.analysis) {
            setAnalysis(result.analysis);
          }
          if (result.domainName) {
            setDomainName(result.domainName);
          }
        }
      } catch (err) {
        // Silently fail - non-critical pre-fill
        console.warn('Could not pre-fill from last analysis (non-critical)');
      }
    };
    loadLastAnalysis();
  }, []);

  // Reset existing analysis check when URL changes significantly
  useEffect(() => {
    if (website.trim()) {
      setHasCheckedExisting(false);
      setExistingAnalysis(null);
      setShowConfirmationDialog(false);
    }
  }, [website]);

  // Check for existing analysis when URL changes
  useEffect(() => {
    if (website.trim() && !hasCheckedExisting) {
      const checkExisting = async () => {
        const fixedUrl = fixUrlFormat(website);
        if (fixedUrl) {
          console.log('WebsiteStep: Checking for existing analysis for URL:', fixedUrl);
          try {
            const result = await checkExistingAnalysis(fixedUrl);
            if (result.exists && result.analysis) {
              console.log('WebsiteStep: Found existing analysis, showing confirmation dialog');
              setExistingAnalysis(result.analysis);
              setShowConfirmationDialog(true);
            }
          } catch (err) {
            console.warn('WebsiteStep: Failed to check existing analysis', err);
          } finally {
            setHasCheckedExisting(true);
            urlWasPreFilledRef.current = false;
          }
        }
      };
      
      // Debounce: 300ms for user typing; 0ms for pre-filled URL
      const isPreFilled = urlWasPreFilledRef.current;
      const timeoutId = setTimeout(checkExisting, isPreFilled ? 0 : 300);
      return () => clearTimeout(timeoutId);
    }
  }, [website, hasCheckedExisting]);

  const handleLoadExisting = async (analysisId: number) => {
    const result = await loadExistingAnalysis(analysisId, website);
    if (result.success) {
      setDomainName(result.domainName || '');
      setAnalysis(result.analysis);
      setCrawlResult(result.crawlResult);
      setAnalysisWarning(result.warning || null);
      setSuccess('Loaded previous analysis successfully!');
    }
    return result;
  };

  const handleAnalyze = async () => {
    setError(null);
    setSuccess(null);
    setAnalysisWarning(null);
    setLoading(true);
    setAnalysis(null);
    setCrawlResult(null);
    
    // Reset progress
    setProgress(prev => prev.map(p => ({ ...p, completed: false })));

    try {
      // Validate and fix URL format
      const fixedUrl = fixUrlFormat(website);
      if (!fixedUrl) {
        setError('Please enter a valid website URL (starting with http:// or https://)');
        setLoading(false);
        return;
      }

      // Check for existing analysis
      const result = await checkExistingAnalysis(fixedUrl);
      if (result.exists && result.analysis) {
        setExistingAnalysis(result.analysis);
        setShowConfirmationDialog(true);
        setLoading(false);
        return;
      }

      // Proceed with new analysis
      setIsProgressModalOpen(true);
      const analysisResult = await performAnalysis(fixedUrl, updateProgress);
      if (analysisResult.success) {
        setDomainName(analysisResult.domainName || '');
        setAnalysis(analysisResult.analysis);
        setCrawlResult(analysisResult.crawlResult);
        setAnalysisWarning(analysisResult.warning || null);
        
        // Store in localStorage for Step 3 (Competitor Analysis)
        localStorage.setItem('website_url', fixedUrl);
        localStorage.setItem('website_analysis_data', JSON.stringify(analysisResult.analysis));
        
        if (analysisResult.warning) {
          setSuccess(`Website style analysis completed successfully! Note: ${analysisResult.warning}`);
        } else {
          setSuccess('Website style analysis completed successfully!');
        }
      } else {
        setError(analysisResult.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze website. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
      setTimeout(() => setIsProgressModalOpen(false), 1000);
    }
  };

  const updateProgress = (step: number, message: string, subMessage?: string) => {
    setProgress(prev => {
      const existing = prev.find(p => p.step === step);
      if (existing) {
        return prev.map(p => 
          p.step === step ? { ...p, message, subMessage: subMessage || p.subMessage, completed: true } : p
        );
      }
      return [...prev, { step, message, subMessage, completed: true }];
    });
  };

  const handleLoadExistingConfirm = async () => {
    if (!existingAnalysis?.analysis_id) {
      setShowConfirmationDialog(false);
      return;
    }

    setLoading(true);
    const result = await handleLoadExisting(existingAnalysis.analysis_id);
    setLoading(false);
    setShowConfirmationDialog(false);

    if (!result?.success || !result.analysis) {
      setError('Failed to load existing analysis. Please try a new analysis.');
      return;
    }

    const fixedUrl = fixUrlFormat(website);
    if (!fixedUrl) {
      setError('Website URL is missing or invalid. Please re-enter the URL.');
      return;
    }

    // Set the loaded analysis data for display
    setDomainName(result.domainName || domainName);
    setAnalysis(result.analysis);
    setSuccess('Previous analysis loaded successfully!');

    // Store in localStorage for Step 3 (Competitor Analysis)
    localStorage.setItem('website_url', fixedUrl);
    localStorage.setItem('website_analysis_data', JSON.stringify(result.analysis));
  };

  const handleNewAnalysis = async () => {
    setShowConfirmationDialog(false);
    setExistingAnalysis(null);
    setError(null);
    setSuccess(null);
    setAnalysisWarning(null);
    setAnalysis(null);
    setCrawlResult(null);
    setProgress(prev => prev.map(p => ({ ...p, completed: false })));

    if (website) {
      const fixedUrl = fixUrlFormat(website);
      if (fixedUrl) {
        setIsProgressModalOpen(true);
        setLoading(true);
        try {
          const analysisResult = await performAnalysis(fixedUrl, updateProgress);
          if (analysisResult.success) {
            setDomainName(analysisResult.domainName || '');
            setAnalysis(analysisResult.analysis);
            setCrawlResult(analysisResult.crawlResult);
            setAnalysisWarning(analysisResult.warning || null);

            localStorage.setItem('website_url', fixedUrl);
            localStorage.setItem('website_analysis_data', JSON.stringify(analysisResult.analysis));

            if (analysisResult.warning) {
              setSuccess(`Website style analysis completed successfully! Note: ${analysisResult.warning}`);
            } else {
              setSuccess('Website style analysis completed successfully!');
            }
          } else {
            setError(analysisResult.error || 'Analysis failed');
          }
        } catch (err) {
          console.error('Analysis error:', err);
          setError('Failed to analyze website. Please check your internet connection and try again.');
        } finally {
          setLoading(false);
          setTimeout(() => setIsProgressModalOpen(false), 1000);
        }
      }
    }
  };

  const saveAnalysis = async (currentAnalysis: StyleAnalysis) => {
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
  };

  const handleAnalysisUpdate = (updatedAnalysis: StyleAnalysis) => {
    setAnalysis(updatedAnalysis);
  };

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
  }, [onDataReady, website, domainName, analysis, crawlResult, useAnalysisForGenAI, integrationData, connectedPlatforms]);

  const hasWebsiteAnalysis = !!(website.trim() && analysis);

  return (
    <Box sx={{ 
      maxWidth: '100%',
      width: '100%',
      mx: 0,
      px: { xs: 1.5, md: 2 },
      pb: { xs: 1.5, md: 2 },
      pt: { xs: 0.375, md: 0.625 },
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
        setActiveTab={setActiveTab}
        hasWebsiteAnalysis={hasWebsiteAnalysis}
        linkedinConnected={linkedinConnected}
        youtubeConnected={youtubeConnected}
        backgroundTasks={backgroundTasks || null}
      />

      {/* Website Tab Content */}
      {activeTab === 'website' && (
        <WebsiteAnalysisTabContent
          website={website}
          setWebsite={setWebsite}
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
          handleAnalysisUpdate={handleAnalysisUpdate}
          saveAnalysis={saveAnalysis}
          handleIntegrationChange={handleIntegrationChange}
          connectedPlatforms={connectedPlatforms}
          setConnectedPlatforms={setConnectedPlatforms}
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

      {/* Confirmation Dialog for Existing Analysis */}
      <ExistingAnalysisDialog
        open={showConfirmationDialog}
        onClose={() => setShowConfirmationDialog(false)}
        existingAnalysis={existingAnalysis}
        handleLoadExistingConfirm={handleLoadExistingConfirm}
        handleNewAnalysis={handleNewAnalysis}
      />
    </Box>
  );
};

export default WebsiteStep;
