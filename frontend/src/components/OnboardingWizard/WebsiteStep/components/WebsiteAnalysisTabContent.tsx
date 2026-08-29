import React from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import BusinessIcon from '@mui/icons-material/Business';

// Extracted components
import AnalysisResultsDisplay, { StyleAnalysis } from './AnalysisResultsDisplay';
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
}) => {
  const analyticsPlatforms = ['gsc', 'bing'];

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

      {/* Success / Error Alerts */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
          {success}
        </Alert>
      )}

      {/* Website Analysis Results */}
      {analysis && (
        <>
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
          <Box id="smart-background-setup" sx={{ mb: 3 }}>
            <BackgroundSetupCard 
              websiteUrl={website} 
              brandAnalysis={analysis.brand_analysis} 
              seoAudit={analysis.seo_audit} 
            />
          </Box>
        </>
      )}

      {/* Integrations Section */}
      {website && analysis && (
        <WebsiteIntegrationsSection
          websiteUrl={website}
          onIntegrationChange={handleIntegrationChange}
          connectedPlatforms={connectedPlatforms}
          setConnectedPlatforms={setConnectedPlatforms}
        />
      )}

      {/* Platform Analytics */}
      {(connectedPlatforms.includes('gsc') || connectedPlatforms.includes('bing')) && (
        <Box sx={{ mt: 3 }}>
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
