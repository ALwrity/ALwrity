import React, { useState, useEffect } from 'react';
import BusinessDescriptionStep from './BusinessDescriptionStep';
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
  DialogContentText
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Business as BusinessIcon
} from '@mui/icons-material';

// Extracted components
import { AnalysisResultsDisplay, AnalysisProgressDisplay } from './WebsiteStep/components';
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
import { onboardingCache, WebsiteIntakeCache } from '../../services/onboardingCache';

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
  const [showBusinessForm, setShowBusinessForm] = useState(false);
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

  // Notify parent when validation state changes
  useEffect(() => {
    const isValid = !!(website.trim() && analysis);
    console.log('WebsiteStep: Validation check:', { website: website.trim(), analysis: !!analysis, isValid });
    if (onValidationChange) {
      console.log('WebsiteStep: Calling onValidationChange with:', isValid);
      onValidationChange(isValid);
    }
  }, [website, analysis, onValidationChange]);

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

  // Register data collector so the Wizard footer button is the single gate to step 3
  useEffect(() => {
    if (onDataReady) {
      onDataReady(() => {
        const fixedUrl = fixUrlFormat(website);
        return {
          website: fixedUrl || website,
          domainName,
          analysis,
          crawlResult,
          useAnalysisForGenAI,
        };
      });
    }
  }, [onDataReady, website, domainName, analysis, crawlResult, useAnalysisForGenAI]);

  // Conditional rendering for business description form - now handled inline via toggle
  /*
  if (showBusinessForm) {
    return (
      <BusinessDescriptionStep
        onBack={() => {
          console.log('⬅️ Going back to website form...');
          setShowBusinessForm(false);
        }}
        onContinue={(businessData: any) => {
          console.log('➡️ Business info completed, proceeding to next step...');
          
          // Prepare step data combining website and business data
          const stepData = {
            website: fixUrlFormat(website),
            domainName: domainName,
            analysis: analysis,
            useAnalysisForGenAI: useAnalysisForGenAI,
            businessData: businessData
          };
          
          // Store in localStorage for Step 3 (Competitor Analysis)
          const fixedUrl = fixUrlFormat(website);
          if (fixedUrl) {
            localStorage.setItem('website_url', fixedUrl);
            localStorage.setItem('website_analysis_data', JSON.stringify(analysis));
          }
          
          onContinue(stepData);
        }}
      />
    );
  }
  */

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
          background: 'linear-gradient(45deg, #2563EB 30%, #7C3AED 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Let AI Learn Your Brand Voice
        </Typography>
      </Box>

      {/* Input Card */}
      <Paper elevation={0} sx={{
        mb: 2,
        p: 2.5,
        borderRadius: 3,
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
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
                bgcolor: '#F9FAFB',
                pr: '136px',
                '& fieldset': { borderColor: '#E5E7EB' },
                '&:hover fieldset': { borderColor: '#7C3AED' },
                '&.Mui-focused fieldset': { borderColor: '#7C3AED', borderWidth: 2 },
              },
              '& .MuiInputLabel-root': {
                color: '#6B7280',
                fontWeight: 500,
                '&.Mui-focused': { color: '#7C3AED' },
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
              bgcolor: '#7C3AED',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.875rem',
              boxShadow: 'none',
              zIndex: 1,
              '&:hover': {
                bgcolor: '#6D28D9',
                boxShadow: 'none',
              },
              '&.Mui-disabled': {
                bgcolor: '#A78BFA',
                color: 'rgba(255,255,255,0.85)',
              },
            }}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </Button>
        </Box>
      </Paper>

      {/* No Website Option */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        {!showBusinessForm ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
              Don't have a live website yet?
            </Typography>
            <Button
              onClick={() => {
                console.log('🔄 Expanding business description form...');
                setShowBusinessForm(true);
              }}
              startIcon={<BusinessIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                color: '#7C3AED',
                fontSize: '0.9rem',
                '&:hover': { bgcolor: 'transparent', color: '#6D28D9' },
              }}
            >
              Describe your business manually instead
            </Button>
          </>
        ) : (
          <Box sx={{
            textAlign: 'left',
            animation: 'fadeIn 0.5s ease-out'
          }}>
             <BusinessDescriptionStep
                onBack={() => {
                  console.log('⬅️ Collapsing business form...');
                  setShowBusinessForm(false);
                }}
                onContinue={(businessData: any) => {
                  console.log('➡️ Business info completed, proceeding to next step...');

                  // Prepare step data combining website and business data
                  const stepData = {
                    website: fixUrlFormat(website),
                    domainName: domainName,
                    analysis: analysis,
                    useAnalysisForGenAI: useAnalysisForGenAI,
                    businessData: businessData
                  };

                  const cachedIntake = onboardingCache.getStepData(2) as WebsiteIntakeCache | undefined;
                  onboardingCache.saveStepData(2, {
                    ...cachedIntake,
                    website: fixUrlFormat(website),
                    analysis: analysis,
                    businessInfo: businessData,
                    hasWebsite: false
                  });

                  // Store in localStorage for Step 3 (Competitor Analysis)
                  const fixedUrl = fixUrlFormat(website);
                  if (fixedUrl) {
                    localStorage.setItem('website_url', fixedUrl);
                    localStorage.setItem('website_analysis_data', JSON.stringify(analysis));
                  }

                  onContinue(stepData);
                }}
              />
          </Box>
        )}
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => setShowBusinessForm(true)}>
              ENTER MANUALLY
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
        <Box sx={{ animation: 'fadeIn 0.8s ease-in' }}>
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

      {/* Analysis Progress Modal */}
      <Dialog
        open={isProgressModalOpen}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(16,24,40,0.12)',
            bgcolor: '#F9FAFB',
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
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon color="primary" />
            Previous Analysis Found
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            We found a previous analysis for this website from{' '}
            {existingAnalysis?.analysis_date ? 
              new Date(existingAnalysis.analysis_date).toLocaleDateString() : 
              'a previous session'
            }.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            Would you like to load the previous analysis or perform a new one?
          </DialogContentText>
          {existingAnalysis?.summary && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Previous Analysis Summary:
              </Typography>
              {existingAnalysis.summary.writing_style?.tone && (
                <Typography variant="body2" color="textSecondary">
                  Tone: {existingAnalysis.summary.writing_style.tone}
                </Typography>
              )}
              {existingAnalysis.summary.target_audience?.expertise_level && (
                <Typography variant="body2" color="textSecondary">
                  Target Audience: {existingAnalysis.summary.target_audience.expertise_level}
                </Typography>
              )}
              {existingAnalysis.summary.content_type?.primary_type && (
                <Typography variant="body2" color="textSecondary">
                  Content Type: {existingAnalysis.summary.content_type.primary_type}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmationDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleLoadExistingConfirm} variant="outlined" startIcon={<HistoryIcon />}>
            Load Previous
          </Button>
          <Button onClick={handleNewAnalysis} variant="contained" startIcon={<AnalyticsIcon />}>
            New Analysis
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WebsiteStep;
