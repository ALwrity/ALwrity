import React from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Divider,
  Chip,
  Tabs,
  Tab,
  Card,
  CardContent,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import LinkIcon from '@mui/icons-material/Link';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { extractDomainName } from '../utils/websiteUtils';
// Extracted components
import { StyleAnalysis } from './UnifiedAnalysisContainer/types';
import UnifiedAnalysisContainer from './UnifiedAnalysisContainer/index';
import WebsiteIntegrationsSection from './WebsiteIntegrationsSection';
import { BackgroundSetupCard } from '../BackgroundSetupCard';
import PlatformAnalytics from '../../../shared/PlatformAnalytics';
import WebsiteUrlActionBar from './WebsiteUrlActionBar';
import {
  folderTabCardSx,
  folderTabDashboardSpacingSx,
  folderTabHeaderSx,
  folderTabsContainerSx,
  getFolderTabSx,
} from './unifiedFolderTabStyles';

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
  dashboardFirstMode?: boolean;
  suppressDashboardScroll?: boolean;
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
  dashboardFirstMode = false,
  suppressDashboardScroll = false,
}) => {
  const analyticsPlatforms = ['gsc', 'bing'];
  const dashboardRef = React.useRef<HTMLDivElement | null>(null);
  const [activeSubTab, setActiveSubTab] = React.useState<number>(0);
  const [bgTasksStats, setBgTasksStats] = React.useState<{ enabled: number; total: number }>({ enabled: 7, total: 7 });

  React.useEffect(() => {
    const dashboardEl = dashboardRef.current;
    if (!analysis || !dashboardEl || suppressDashboardScroll) return;

    const timer = window.setTimeout(() => {
      dashboardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [analysis, suppressDashboardScroll]);

  const setupSection = (
    <Box data-testid="website-setup-section">
      {!dashboardFirstMode && (
        <WebsiteUrlActionBar
          website={website}
          setWebsite={setWebsite}
          loading={loading}
          hasAnalysis={!!analysis}
          onAnalyze={handleAnalyze}
          onAnalyzeNewWebsite={handleStartFresh}
        />
      )}

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
    </Box>
  );

  const dashboardSection = analysis ? (
    <Box
      sx={{
        ...folderTabDashboardSpacingSx(dashboardFirstMode),
        animation: dashboardFirstMode ? 'fadeIn 0.4s ease-out' : undefined,
      }}
      data-testid="unified-folder-tab-dashboard"
    >
          {/* Hint Alert - guides user and hides once all tabs are viewed */}
          {!(viewedTabs[0] && viewedTabs[1] && viewedTabs[2]) && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                mb: 3,
                animation: 'fadeIn 0.3s ease-out',
              }}
            >
              <LightbulbOutlinedIcon sx={{ color: '#F59E0B', fontSize: 22, flexShrink: 0 }} />
              <Box
                sx={{
                  bgcolor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  boxShadow: 'none',
                }}
              >
                <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500 }}>
                  Explore all 3 tabs to unlock your brand&apos;s growth engine! 🚀
                </Typography>
              </Box>
            </Box>
          )}

          {/* Master Card Container */}
          <Card elevation={0} sx={folderTabCardSx}>
            <Box sx={folderTabHeaderSx}>
              <Tabs
                value={activeSubTab}
                onChange={(e, newValue) => {
                  setActiveSubTab(newValue);
                  setViewedTabs(prev => ({ ...prev, [newValue]: true }));
                }}
                variant="fullWidth"
                sx={folderTabsContainerSx}
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
                  sx={getFolderTabSx(activeSubTab === 0, 0)}
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
                  sx={getFolderTabSx(activeSubTab === 1, 1)}
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
                  sx={getFolderTabSx(activeSubTab === 2, 2)}
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
  ) : null;

  return (
    <>
      {dashboardFirstMode && dashboardSection}
      {setupSection}
      {!dashboardFirstMode && dashboardSection}

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
