import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Fade
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Business as BusinessIcon,
  LinkedIn as LinkedInIcon
} from '@mui/icons-material';

// Extracted components
import { AnalysisResultsDisplay, AnalysisProgressDisplay, WebsiteIntegrationsSection } from './WebsiteStep/components';
import type { StyleAnalysis } from './WebsiteStep/components/AnalysisResultsDisplay';
import PlatformSection from './common/PlatformSection';
import EmailSection from './common/EmailSection';
import PlatformAnalytics from '../shared/PlatformAnalytics';

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

const WebsiteStep: React.FC<WebsiteStepProps> = ({ onContinue, updateHeaderContent, onValidationChange, onDataReady }) => {
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
  const [activeTab, setActiveTab] = useState<'website' | 'linkedin'>('website');
  const [integrationData, setIntegrationData] = useState<any>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const { user } = useUser();
  const [email, setEmail] = useState<string>('');

  const linkedinConnected = connectedPlatforms.includes('linkedin');
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
      title: 'Analyze Your Website',
      description: 'Let Alwrity analyze your website to understand your brand voice, writing style, and content characteristics. This helps us generate content that matches your existing tone and resonates with your audience.'
    });
  }, [updateHeaderContent]);

  // Get user email from Clerk
  useEffect(() => {
    if (user) {
      const primaryEmail = user.primaryEmailAddress?.emailAddress;
      const firstEmail = user.emailAddresses?.[0]?.emailAddress;
      const resolvedEmail = primaryEmail || firstEmail || '';
      if (resolvedEmail) setEmail(resolvedEmail);
    }
  }, [user]);

  // Notify parent when validation state changes
  useEffect(() => {
    const hasWebsiteAnalysis = !!(website.trim() && analysis);
    const isValid = hasWebsiteAnalysis || linkedinConnected;
    console.log('WebsiteStep: Validation check:', { website: website.trim(), analysis: !!analysis, linkedinConnected, isValid });
    if (onValidationChange) {
      console.log('WebsiteStep: Calling onValidationChange with:', isValid);
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
          }
          if (result.analysis) {
            setAnalysis(result.analysis);
          }
        }
      } catch (error) {
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
          }
        }
      };
      
      // Debounce the check to avoid too many API calls
      const timeoutId = setTimeout(checkExisting, 1000);
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

    // DO NOT call onContinue() here - let user review the analysis first
    // User will click "Continue" button when ready to proceed
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
        };
      });
    }
  }, [onDataReady, website, domainName, analysis, crawlResult, useAnalysisForGenAI, integrationData, connectedPlatforms]);

  const hasWebsiteAnalysis = !!(website.trim() && analysis);

  const statusBulb = (active: boolean) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    bgcolor: active ? '#22c55e' : '#ef4444',
    boxShadow: active
      ? '0 0 6px rgba(34,197,94,0.6), 0 0 12px rgba(34,197,94,0.3)'
      : '0 0 6px rgba(239,68,68,0.6), 0 0 12px rgba(239,68,68,0.3)',
    transition: 'all 0.3s ease',
    flexShrink: 0,
  });

  return (
    <Box sx={{ 
      maxWidth: '100%',
      width: '100%',
      mx: 0,
      p: 2,
      '@keyframes fadeIn': {
        '0%': { opacity: 0, transform: 'translateY(10px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' }
      }
    }}>
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: 'center', animation: 'fadeIn 0.6s ease-out' }}>
        <Typography variant="h4" sx={{
          fontWeight: 700,
          mb: 1,
          background: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 50%, #1D4ED8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Let ALwrity Learn Your Brand
        </Typography>
      </Box>

      {/* Email Section */}
      <EmailSection email={email} onEmailChange={setEmail} />

      {/* Tab Bar */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
        <Button
          onClick={() => setActiveTab('website')}
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 1.5,
            px: 2,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.875rem',
            bgcolor: activeTab === 'website' ? '#2563EB' : '#E2E8F0',
            color: activeTab === 'website' ? '#FFFFFF' : '#475569',
            '&:hover': {
              bgcolor: activeTab === 'website' ? '#1D4ED8' : '#CBD5E1',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <Box sx={statusBulb(hasWebsiteAnalysis)} />
          <AnalyticsIcon sx={{ fontSize: 18 }} />
          Website Analysis
        </Button>
        <Button
          onClick={() => setActiveTab('linkedin')}
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 1.5,
            px: 2,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.875rem',
            bgcolor: activeTab === 'linkedin' ? '#0A66C2' : '#E2E8F0',
            color: activeTab === 'linkedin' ? '#FFFFFF' : '#475569',
            '&:hover': {
              bgcolor: activeTab === 'linkedin' ? '#004182' : '#CBD5E1',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <Box sx={statusBulb(linkedinConnected)} />
          <LinkedInIcon sx={{ fontSize: 18 }} />
          LinkedIn
        </Button>
      </Box>

      {/* Website Tab Content */}
      {activeTab === 'website' && (
        <>
          {/* Input Card */}
          <Paper elevation={0} sx={{
            mb: 2,
            p: 2.5,
            borderRadius: 3,
            border: '1px solid #CBD5E1',
            bgcolor: '#EFF6FF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(59, 130, 246, 0.05)',
          }}>
            <Box sx={{ position: 'relative' }}>
              <TextField
                label="Your website URL (e.g., www.example.com)"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                fullWidth
                placeholder="Enter your URL to instantly capture your brand voice."
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: '#F8FAFC',
                    pr: '136px',
                    '& fieldset': { borderColor: '#E2E8F0' },
                    '&:hover fieldset': { borderColor: '#3B82F6' },
                    '&.Mui-focused fieldset': { borderColor: '#3B82F6', borderWidth: 2 },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#64748B',
                    fontWeight: 500,
                    '&.Mui-focused': { color: '#2563EB' },
                  },
                  '& .MuiInputBase-input': {
                    color: '#1E293B',
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleAnalyze}
                disabled={!website || loading}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AnalyticsIcon />}
                  sx={{
                    position: 'absolute',
                    right: 6,
                    top: 6,
                    bottom: 6,
                    borderRadius: '10px',
                    textTransform: 'none',
                    px: 2.5,
                    py: 0,
                    background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                    zIndex: 1,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    },
                    '&.Mui-disabled': {
                      background: 'rgba(59, 130, 246, 0.3)',
                      color: 'rgba(255,255,255,0.5)',
                    },
                  }}
              >
                {loading ? 'Analyzing...' : 'Analyze'}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, pt: 1.5, borderTop: '1px solid #CBD5E1' }}>
              <Typography variant="caption" sx={{ color: '#2563EB', fontWeight: 600 }}>
                Connect Website Platforms
              </Typography>
              <Button
                disabled
                size="small"
                startIcon={<BusinessIcon />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  color: '#94A3B8',
                  fontWeight: 500,
                  borderRadius: '8px',
                }}
              >
                Business details — Coming soon
              </Button>
            </Box>
          </Paper>

          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 3 }}
              action={
                <Button color="inherit" size="small" disabled>
                  ENTER MANUALLY — COMING SOON
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          {analysis && (
            <Box sx={{ animation: 'fadeIn 0.8s ease-in', mb: 3 }}>
              <AnalysisResultsDisplay
                analysis={analysis}
                crawlResult={crawlResult}
                domainName={domainName}
                useAnalysisForGenAI={useAnalysisForGenAI}
                onUseAnalysisChange={setUseAnalysisForGenAI}
                onAnalysisUpdate={handleAnalysisUpdate}
                warning={analysisWarning || undefined}
                onSave={() => saveAnalysis(analysis)}
              />
            </Box>
          )}

          <WebsiteIntegrationsSection
            websiteUrl={website}
            onIntegrationChange={handleIntegrationChange}
            connectedPlatforms={connectedPlatforms}
            setConnectedPlatforms={setConnectedPlatforms}
          />

          {(connectedPlatforms.includes('gsc') || connectedPlatforms.includes('bing')) && (
            <Fade in timeout={800}>
              <Box sx={{ mt: 3 }}>
                <PlatformAnalytics
                  platforms={['gsc', 'bing']}
                  showSummary
                  refreshInterval={0}
                />
              </Box>
            </Fade>
          )}
        </>
      )}

      {/* LinkedIn Tab Content */}
      {activeTab === 'linkedin' && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: '1px solid #CBD5E1',
            bgcolor: '#EFF6FF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <PlatformSection
            title="LinkedIn"
            description="Connect your LinkedIn profile for professional content publishing."
            platforms={[
              {
                id: 'linkedin',
                name: 'LinkedIn',
                description: 'Connect your LinkedIn profile for professional content publishing',
                icon: <LinkedInIcon />,
                category: 'social',
                status: 'available',
                features: ['Professional posting', 'Network insights', 'Content optimization'],
                benefits: ['LinkedIn article publishing', 'Professional network analytics', 'B2B content insights'],
                isEnabled: true,
              },
            ]}
            filterPlatformIds={['linkedin']}
            connectedPlatforms={connectedPlatforms}
            gscSites={null}
            isLoading={false}
            onConnect={() => {}}
            setConnectedPlatforms={setConnectedPlatforms}
          />
        </Paper>
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
      <Dialog
        open={showConfirmationDialog}
        onClose={() => setShowConfirmationDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#EFF6FF',
            border: '1px solid #CBD5E1',
          }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon sx={{ color: '#2563EB' }} />
            <Typography sx={{ color: '#1E293B', fontWeight: 600 }}>Previous Analysis Found</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#475569' }}>
            We found a previous analysis for this website from{' '}
            {existingAnalysis?.analysis_date ? 
              new Date(existingAnalysis.analysis_date).toLocaleDateString() : 
              'a previous session'
            }.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: '#475569' }}>
            Would you like to load the previous analysis or perform a new one?
          </DialogContentText>
          {existingAnalysis?.summary && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#EFF6FF', borderRadius: 1, border: '1px solid #BFDBFE' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#1E40AF' }}>
                Previous Analysis Summary:
              </Typography>
              {existingAnalysis.summary.writing_style?.tone && (
                <Typography variant="body2" sx={{ color: '#1E293B' }}>
                  Tone: {existingAnalysis.summary.writing_style.tone}
                </Typography>
              )}
              {existingAnalysis.summary.target_audience?.expertise_level && (
                <Typography variant="body2" sx={{ color: '#1E293B' }}>
                  Target Audience: {existingAnalysis.summary.target_audience.expertise_level}
                </Typography>
              )}
              {existingAnalysis.summary.content_type?.primary_type && (
                <Typography variant="body2" sx={{ color: '#1E293B' }}>
                  Content Type: {existingAnalysis.summary.content_type.primary_type}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmationDialog(false)} sx={{ color: '#64748B' }}>
            Cancel
          </Button>
          <Button onClick={handleLoadExistingConfirm} variant="outlined" startIcon={<HistoryIcon />}
            sx={{ borderColor: '#BFDBFE', color: '#2563EB', '&:hover': { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' } }}>
            Load Previous
          </Button>
          <Button onClick={handleNewAnalysis} variant="contained" startIcon={<AnalyticsIcon />}
            sx={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)', '&:hover': { background: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)', boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)' } }}>
            New Analysis
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WebsiteStep;
