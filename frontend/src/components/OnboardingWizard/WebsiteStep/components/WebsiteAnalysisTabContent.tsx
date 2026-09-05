import React from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Tabs,
  Tab,
  Card,
  CardContent,
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { extractDomainName } from '../utils/websiteUtils';
// Extracted components
import { StyleAnalysis } from './UnifiedAnalysisContainer/types';
import UnifiedAnalysisContainer from './UnifiedAnalysisContainer/index';
import WebsiteIntegrationsSection from './WebsiteIntegrationsSection';
import { BackgroundSetupCard } from '../BackgroundSetupCard';
import PlatformAnalytics from '../../../shared/PlatformAnalytics';

interface WebsiteAnalysisTabContentProps {
  website: string;
  setWebsite: (url: string) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  analysis: StyleAnalysis | null;
  crawlResult: any;
  domainName: string;
  useAnalysisForGenAI: boolean;
  setUseAnalysisForGenAI: (use: boolean) => void;
  analysisWarning: string | null;
  handleAnalyze: () => void;
  handleAnalysisUpdate: (updatedAnalysis: StyleAnalysis) => void;
  saveAnalysis: (analysis: StyleAnalysis) => Promise<boolean>;
  handleIntegrationChange: (data: any) => void;
  connectedPlatforms: string[];
  setConnectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;

  // Zero-Waste Smart Inline Alert additions
  existingAnalysis: any;
  handleLoadExistingConfirm: () => void;
  handleStartFresh: () => void;

  // Viewed tabs tracking
  viewedTabs: Record<number, boolean>;
  setViewedTabs: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

const WebsiteAnalysisTabContent: React.FC<WebsiteAnalysisTabContentProps> = ({
  website,
  setWebsite,
  loading,
  error,
  success,
  analysis,
  crawlResult,
  domainName,
  useAnalysisForGenAI,
  setUseAnalysisForGenAI,
  analysisWarning,
  handleAnalyze,
  handleAnalysisUpdate,
  saveAnalysis,
  handleIntegrationChange,
  connectedPlatforms,
  setConnectedPlatforms,
  existingAnalysis,
  handleLoadExistingConfirm,
  handleStartFresh,
  viewedTabs,
  setViewedTabs,
}) => {
  const analyticsPlatforms = ['gsc', 'bing'];
  const dashboardRef = React.useRef<HTMLDivElement | null>(null);
  const [activeSubTab, setActiveSubTab] = React.useState<number>(0);
  const [bgTasksStats, setBgTasksStats] = React.useState<{ enabled: number; total: number }>({ enabled: 7, total: 7 });

  React.useEffect(() => {
    const dashboardEl = dashboardRef.current;
    if (!analysis || !dashboardEl) return;

    const timer = window.setTimeout(() => {
      dashboardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [analysis]);

  return (
    <>
      {/* Input Section */}
      <Box sx={{ position: 'relative', mb: 2 }}>
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
              borderRadius: 3,
              bgcolor: '#F8FAFC',
              pr: '136px',
              '& fieldset': { borderColor: '#CBD5E1' },
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
            background: analysis
              ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
              : 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: analysis
              ? '0 2px 8px rgba(245, 158, 11, 0.3)'
              : '0 2px 8px rgba(59, 130, 246, 0.3)',
            zIndex: 1,
            '&:hover': {
              background: analysis
                ? 'linear-gradient(135deg, #D97706 0%, #B45309 100%)'
                : 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
              boxShadow: analysis
                ? '0 4px 12px rgba(245, 158, 11, 0.4)'
                : '0 4px 12px rgba(59, 130, 246, 0.4)',
            },
            '&.Mui-disabled': {
              background: analysis
                ? 'rgba(245, 158, 11, 0.3)'
                : 'rgba(59, 130, 246, 0.3)',
              color: 'rgba(255,255,255,0.5)',
            },
          }}
        >
          {loading ? 'Analyzing...' : analysis ? 'Re-Analyze' : 'Analyze'}
        </Button>
      </Box>

      {/* Zero-Waste Inline Smart Banner */}
      {existingAnalysis && !analysis && !loading && (
        <Box 
          sx={{ 
            mt: 2,
            mb: 1, 
            p: 2, 
            bgcolor: '#EFF6FF', 
            border: '1px solid #BFDBFE', 
            borderRadius: 2, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: 2,
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <HistoryIcon sx={{ color: '#2563EB' }} />
            <Box>
              <Typography variant="body2" sx={{ color: '#1E293B', fontWeight: 600 }}>
                Previous analysis found for <strong>{extractDomainName(website)}</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: '#475569' }}>
                Completed on {existingAnalysis.analysis_date ? new Date(existingAnalysis.analysis_date).toLocaleDateString() : 'a previous session'}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleLoadExistingConfirm}
              startIcon={<HistoryIcon />}
              sx={{
                whiteSpace: 'nowrap',
                borderColor: '#BFDBFE',
                color: '#2563EB',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { borderColor: '#3B82F6', bgcolor: '#EFF6FF' }
              }}
            >
              Load Saved Analysis
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={handleStartFresh}
              sx={{ color: '#64748B', textTransform: 'none', fontWeight: 500 }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      )}

      {/* Start Fresh Reset Option (Active Analysis loaded) */}
      {analysis && !loading && (
        <Box display="flex" justifyContent="flex-end" sx={{ mt: 1, mb: 2 }}>
          <Button
            variant="text"
            size="small"
            onClick={handleStartFresh}
            sx={{ 
              color: '#64748B', 
              textTransform: 'none',
              fontSize: '0.8rem',
              fontWeight: 500,
              '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' }
            }}
          >
            Reset & Analyze Another Website
          </Button>
        </Box>
      )}

      {/* Success / Error Alerts */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {success && !(success.toLowerCase().includes('previous analysis') || success.toLowerCase().includes('loaded previous')) && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
          {success}
        </Alert>
      )}

      {/* Website Analysis Results */}
      {analysis && (
        <Box sx={{ mt: 4, mb: 3 }}>
          {/* Hint Alert - guides user and hides once all tabs are viewed */}
          {!(viewedTabs[0] && viewedTabs[1] && viewedTabs[2]) && (
            <Alert 
              severity="info" 
              sx={{ 
                mb: 3, 
                borderRadius: 3,
                bgcolor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1E40AF',
                '& .MuiAlert-icon': { color: '#3B82F6' },
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.05)',
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              💡 <strong>Hint:</strong> Please explore all three tabs (<strong>Brand Intelligence</strong>, <strong>Connect Platforms</strong>, and <strong>Smart Background</strong>) to unlock the <strong>"ALwrity Your Growth"</strong> button and proceed.
            </Alert>
          )}

          {/* Master Card Container */}
          <Card
            elevation={0}
            sx={{
              border: '3px solid transparent',
              borderTop: 'none',
              background: 'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%) border-box',
              borderRadius: '0 0 24px 24px', // Rounded bottom corners
              overflow: 'visible', // Let tabs overlap cleanly
              bgcolor: '#FFFFFF',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              '@keyframes borderShine': {
                '0%': {
                  boxShadow: '0 -4px 12px rgba(139, 92, 246, 0.15), 0 0 8px rgba(236, 72, 153, 0.1)',
                },
                '50%': {
                  boxShadow: '0 -4px 20px rgba(139, 92, 246, 0.3), 0 0 15px rgba(236, 72, 153, 0.2)',
                },
                '100%': {
                  boxShadow: '0 -4px 12px rgba(139, 92, 246, 0.15), 0 0 8px rgba(236, 72, 153, 0.1)',
                },
              }
            }}
          >
            {/* Card Header with Integrated Tabs */}
            <Box
              sx={{
                position: 'relative',
                bgcolor: '#F8FAFC', // Match inactive tab background to completely hide white background gaps
                p: 0,
                mx: '-3px', // Align perfectly with the Master Card's 3px left/right borders
                marginTop: '-3px', // Align perfectly with the Master Card's top edge
              }}
            >
              <Tabs 
                value={activeSubTab} 
                onChange={(e, newValue) => {
                  setActiveSubTab(newValue);
                  setViewedTabs(prev => ({ ...prev, [newValue]: true }));
                }}
                variant="fullWidth"
                sx={{
                  width: '100%',
                  '& .MuiTabs-indicator': {
                    display: 'none', // Hide default indicator since we have custom gradient border
                  },
                  '& .MuiTabs-flexContainer': {
                    alignItems: 'stretch',
                    width: '100%',
                  }
                }}
              >
                {/* Tab 1: Brand Intelligence Dashboard Header */}
                <Tab 
                  value={0}
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, textAlign: 'center', py: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AutoAwesomeIcon sx={{ color: activeSubTab === 0 ? '#7C3AED' : '#64748B', fontSize: 20 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: activeSubTab === 0 ? '#1E293B' : '#475569', lineHeight: 1.2, textTransform: 'none' }}>
                          Brand Intelligence Dashboard
                        </Typography>
                        {viewedTabs[0] && <CheckCircleIcon sx={{ color: '#22C55E', fontSize: 16 }} />}
                      </Box>
                      <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'none', display: { xs: 'none', md: 'block' } }}>
                        AI Analysis Complete — navigate domains on the left, switch lenses above.
                      </Typography>
                    </Box>
                  }
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 3,
                    py: 2,
                    minWidth: 'auto',
                    textTransform: 'none',
                    position: 'relative',
                    borderRadius: '24px 24px 0 0', // Rounded top corners
                    transition: 'all 0.3s ease',
                    ...(activeSubTab === 0 ? {
                      background: 'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%) border-box',
                      border: '3px solid transparent',
                      borderBottom: '1px solid #E2E8F0', // Continuous dividing grey line under active tab
                      animation: 'borderShine 3s infinite ease-in-out', // Pulsing border shine
                      zIndex: 2,
                    } : {
                      background: 'linear-gradient(#F8FAFC, #F8FAFC) padding-box, linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%) border-box',
                      borderBottom: '3px solid transparent', // Bottom gradient line under inactive tabs
                      borderLeft: 'none',
                      borderTop: 'none',
                      borderRight: 'none',
                      zIndex: 1,
                    }),
                    '&:hover': {
                      bgcolor: activeSubTab === 0 ? '#FFFFFF' : '#F1F5F9',
                    }
                  }}
                />

                {/* Tab 2: Connect Platforms */}
                <Tab 
                  value={1}
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, textAlign: 'center', py: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinkIcon sx={{ color: activeSubTab === 1 ? '#2563EB' : '#64748B', fontSize: 18 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: activeSubTab === 1 ? '#1E293B' : '#475569', lineHeight: 1.2, textTransform: 'none' }}>
                          Connect Website Platforms
                        </Typography>
                        {viewedTabs[1] && <CheckCircleIcon sx={{ color: '#22C55E', fontSize: 16 }} />}
                      </Box>
                      <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'none', display: { xs: 'none', md: 'block' } }}>
                        Connect your website and analytics platforms to enable AI-powered content publishing and insights.
                      </Typography>
                    </Box>
                  }
                  sx={{
                    px: 3,
                    py: 2,
                    minWidth: 'auto',
                    textTransform: 'none',
                    position: 'relative',
                    borderRadius: '24px 24px 0 0', // Rounded top corners
                    transition: 'all 0.3s ease',
                    ...(activeSubTab === 1 ? {
                      background: 'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%) border-box',
                      border: '3px solid transparent',
                      borderBottom: '1px solid #E2E8F0', // Continuous dividing grey line under active tab
                      animation: 'borderShine 3s infinite ease-in-out', // Pulsing border shine
                      zIndex: 2,
                    } : {
                      background: 'linear-gradient(#F8FAFC, #F8FAFC) padding-box, linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%) border-box',
                      borderBottom: '3px solid transparent', // Bottom gradient line under inactive tabs
                      borderLeft: 'none',
                      borderTop: 'none',
                      borderRight: 'none',
                      zIndex: 1,
                    }),
                    '&:hover': {
                      bgcolor: activeSubTab === 1 ? '#FFFFFF' : '#F1F5F9',
                    }
                  }}
                />

                {/* Tab 3: Smart Background */}
                <Tab 
                  value={2}
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, textAlign: 'center', py: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SettingsIcon sx={{ color: activeSubTab === 2 ? '#2563EB' : '#64748B', fontSize: 18 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: activeSubTab === 2 ? '#1E293B' : '#475569', lineHeight: 1.2, textTransform: 'none' }}>
                          Smart Background Setup
                        </Typography>
                        {viewedTabs[2] && <CheckCircleIcon sx={{ color: '#22C55E', fontSize: 16 }} />}
                      </Box>
                      <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'none', display: { xs: 'none', md: 'block' } }}>
                        {bgTasksStats.enabled} of {bgTasksStats.total} tasks enabled — these run in the background to keep your brand intelligence fresh.
                      </Typography>
                    </Box>
                  }
                  sx={{
                    px: 3,
                    py: 2,
                    textTransform: 'none',
                    minWidth: 'auto',
                    position: 'relative',
                    borderRadius: '24px 24px 0 0', // Rounded top corners
                    transition: 'all 0.3s ease',
                    ...(activeSubTab === 2 ? {
                      background: 'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%) border-box',
                      border: '3px solid transparent',
                      borderBottom: '1px solid #E2E8F0', // Continuous dividing grey line under active tab
                      animation: 'borderShine 3s infinite ease-in-out', // Pulsing border shine
                      zIndex: 2,
                    } : {
                      background: 'linear-gradient(#F8FAFC, #F8FAFC) padding-box, linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #3B82F6 100%) border-box',
                      borderBottom: '3px solid transparent', // Bottom gradient line under inactive tabs
                      borderLeft: 'none',
                      borderTop: 'none',
                      borderRight: 'none',
                      zIndex: 1,
                    }),
                    '&:hover': {
                      bgcolor: activeSubTab === 2 ? '#FFFFFF' : '#F1F5F9',
                    }
                  }}
                />
              </Tabs>
            </Box>

            {/* Card Content */}
            <CardContent sx={{ p: 0 }}>
              {/* Tab 1 Content */}
              {activeSubTab === 0 && (
                <Box
                  ref={dashboardRef}
                  data-testid="unified-container-wrapper"
                  sx={{ animation: 'fadeIn 0.5s ease-in' }}
                >
                  <UnifiedAnalysisContainer
                    analysis={analysis}
                    crawlResult={crawlResult}
                    domainName={domainName}
                    useAnalysisForGenAI={useAnalysisForGenAI}
                    onUseAnalysisChange={setUseAnalysisForGenAI}
                    onAnalysisUpdate={handleAnalysisUpdate}
                    warning={analysisWarning || undefined}
                    onSave={() => saveAnalysis(analysis)}
                    hideOuterCard={true}
                  />
                </Box>
              )}

              {/* Tab 2 Content */}
              {activeSubTab === 1 && (
                <Box sx={{ p: 0, animation: 'fadeIn 0.5s ease-in' }}>
                  <WebsiteIntegrationsSection
                    websiteUrl={website}
                    onIntegrationChange={handleIntegrationChange}
                    connectedPlatforms={connectedPlatforms}
                    setConnectedPlatforms={setConnectedPlatforms}
                    variant="embedded"
                  />
                </Box>
              )}

              {/* Tab 3 Content */}
              {activeSubTab === 2 && (
                <Box sx={{ p: 0, animation: 'fadeIn 0.5s ease-in' }}>
                  <BackgroundSetupCard
                    websiteUrl={website}
                    brandAnalysis={analysis.brand_analysis}
                    seoAudit={analysis.seo_audit}
                    variant="embedded"
                    onConfigChange={(tasks) => {
                      if (tasks) {
                        const taskIds = Object.keys(tasks);
                        const enabled = taskIds.filter(id => tasks[id].enabled).length;
                        setBgTasksStats({ enabled, total: taskIds.length });
                      }
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Platform Analytics */}
      {analysis && activeSubTab === 1 && (connectedPlatforms.includes('gsc') || connectedPlatforms.includes('bing')) && (
        <Box sx={{ mt: 3, animation: 'fadeIn 0.5s ease-in' }}>
          <PlatformAnalytics
            platforms={analyticsPlatforms}
            showSummary
            refreshInterval={0}
            siteUrl={website}
          />
        </Box>
      )}
    </>
  );
};

export default WebsiteAnalysisTabContent;
