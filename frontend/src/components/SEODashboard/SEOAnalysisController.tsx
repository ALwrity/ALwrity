/**
 * SEO Analysis Controller Component
 * Main component that orchestrates enterprise audit and GSC analysis
 * with LLM insights generation and traffic improvement strategies
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Grid,
  Tab,
  Tabs,
  Paper,
  Chip,
  Stack,
  LinearProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DownloadIcon from '@mui/icons-material/Download';
import { motion, AnimatePresence } from 'framer-motion';
import { enterpriseSeoAPI, EnterpriseAuditResult, GSCAnalysisResult } from '../../api/enterpriseSeoApi';
import { llmInsightsGenerator } from '../../api/llmInsightsGenerator';
import { EnterpriseAuditResults } from './components/EnterpriseAuditResults';
import { GSCAnalysisResults } from './components/GSCAnalysisResults';
import { ActionableInsightsDisplay } from './components/ActionableInsightsDisplay';
import { AIVisibilitySection } from './components/AIVisibilitySection';

interface AnalysisStep {
  label: string;
  description: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index} style={{ width: '100%' }}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const analysisSteps: AnalysisStep[] = [
  { label: 'Website Input', description: 'Enter your website URL' },
  { label: 'Enterprise Audit', description: 'Comprehensive SEO audit' },
  { label: 'GSC Analysis', description: 'Search performance analysis' },
  { label: 'Insights', description: 'AI-powered recommendations' },
  { label: 'Review', description: 'Review results and strategy' },
];

export const SEOAnalysisController: React.FC = () => {
  // UI State
  const [activeStep, setActiveStep] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);

  // Analysis State
  const [auditResult, setAuditResult] = useState<EnterpriseAuditResult | null>(null);
  const [gscResult, setGscResult] = useState<GSCAnalysisResult | null>(null);
  const [insights, setInsights] = useState<any[]>([]);

  // Loading & Error State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Dialog State
  const [openOptionsDialog, setOpenOptionsDialog] = useState(false);
  const [options, setOptions] = useState({
    includeContentAnalysis: true,
    includeCompetitiveAnalysis: true,
    generateExecutiveReport: true,
    dateRangeDays: 90,
  });

  // Validation
  const isUrlValid = websiteUrl && websiteUrl.startsWith('http');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  /**
   * Execute enterprise audit
   */
  const handleStartAudit = async () => {
    if (!isUrlValid) {
      setError('Please enter a valid website URL starting with http:// or https://');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(20);
    setActiveStep(1);

    try {
      // Execute enterprise audit
      console.log('Starting enterprise audit for', websiteUrl);
      const auditResponse = await enterpriseSeoAPI.executeEnterpriseAudit(websiteUrl, {
        competitors: competitors.filter(c => c.trim()),
        targetKeywords: targetKeywords.filter(k => k.trim()),
        includeContentAnalysis: options.includeContentAnalysis,
        includeCompetitiveAnalysis: options.includeCompetitiveAnalysis,
        generateExecutiveReport: options.generateExecutiveReport,
      });

      if (!auditResponse.success) {
        throw new Error(auditResponse.message || 'Audit failed');
      }

      setAuditResult(auditResponse.data);
      setProgress(50);
      setActiveStep(2);

      // Execute GSC analysis
      console.log('Starting GSC analysis for', websiteUrl);
      const gscResponse = await enterpriseSeoAPI.analyzeGSCSearchPerformance(websiteUrl, {
        dateRangeDays: options.dateRangeDays,
        includeOpportunities: true,
        includeCompetitive: true,
      });

      if (!gscResponse.success) {
        throw new Error(gscResponse.message || 'GSC analysis failed');
      }

      setGscResult(gscResponse.data);
      setProgress(75);
      setActiveStep(3);

      // Skip insights generation for now - user can generate manually
      setProgress(100);
      setActiveStep(4);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      console.error('Analysis error:', err);
      setError(errorMsg);
      setActiveStep(activeStep);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate AI-powered insights
   */
  const handleGenerateInsights = async () => {
    if (!auditResult && !gscResult) {
      setError('No analysis results available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let insightResults = [];

      if (auditResult) {
        const auditInsights = await llmInsightsGenerator.generateEnterpriseAuditInsights(
          auditResult,
          { currentMonthlyTraffic: 1000 } // TODO: Get from user
        );
        insightResults.push(...auditInsights.insights);
      }

      if (gscResult) {
        const gscInsights = await llmInsightsGenerator.generateGSCAnalysisInsights(
          gscResult,
          { currentMonthlyTraffic: 1000 } // TODO: Get from user
        );
        insightResults.push(...gscInsights.insights);
      }

      setInsights(insightResults);
      setActiveStep(4);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate insights';
      console.error('Insights generation error:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Download report
   */
  const handleDownloadReport = () => {
    const reportData = {
      website: websiteUrl,
      timestamp: new Date().toISOString(),
      audit: auditResult,
      gscAnalysis: gscResult,
      insights: insights,
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seo-analysis-${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Reset analysis
   */
  const handleReset = () => {
    setWebsiteUrl('');
    setCompetitors([]);
    setTargetKeywords([]);
    setAuditResult(null);
    setGscResult(null);
    setInsights([]);
    setError(null);
    setProgress(0);
    setActiveStep(0);
    setTabValue(0);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <AssessmentIcon sx={{ fontSize: 32 }} color="primary" />
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              Enterprise SEO Analysis
            </Typography>
          </Box>
          <Typography variant="body2" color="textSecondary">
            Comprehensive audit with AI-powered insights to improve organic traffic and rankings
          </Typography>
        </Box>

        {/* Progress Indicator */}
        {loading && (
          <Card sx={{ mb: 3, bgcolor: 'info.lighter' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <CircularProgress size={24} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {activeStep === 1 && 'Running enterprise audit...'}
                  {activeStep === 2 && 'Analyzing search performance...'}
                  {activeStep === 3 && 'Generating insights...'}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} />
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Alert
                severity="error"
                onClose={() => setError(null)}
                sx={{ mb: 3 }}
                action={
                  <Button color="inherit" size="small" onClick={() => setError(null)}>
                    DISMISS
                  </Button>
                }
              >
                {error}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stepper */}
        <Paper sx={{ mb: 4, p: 2 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {analysisSteps.map((step, index) => (
              <Step key={index}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {/* Main Content */}
        <Grid container spacing={3}>
          {/* Left Panel: Input & Controls */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Analysis Configuration
                </Typography>

                {/* URL Input */}
                <TextField
                  fullWidth
                  label="Website URL"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  size="small"
                  sx={{ mb: 2 }}
                  disabled={loading}
                  helperText="Include http:// or https://"
                />

                {/* Competitors Input */}
                <TextField
                  fullWidth
                  label="Competitor URLs (comma-separated)"
                  placeholder="https://competitor1.com, https://competitor2.com"
                  multiline
                  rows={2}
                  value={competitors.join(', ')}
                  onChange={(e) => setCompetitors(e.target.value.split(',').map(c => c.trim()))}
                  size="small"
                  sx={{ mb: 2 }}
                  disabled={loading}
                />

                {/* Keywords Input */}
                <TextField
                  fullWidth
                  label="Target Keywords (comma-separated)"
                  placeholder="keyword1, keyword2, keyword3"
                  multiline
                  rows={2}
                  value={targetKeywords.join(', ')}
                  onChange={(e) => setTargetKeywords(e.target.value.split(',').map(k => k.trim()))}
                  size="small"
                  sx={{ mb: 3 }}
                  disabled={loading}
                />

                {/* Control Buttons */}
                <Stack spacing={1}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleStartAudit}
                    disabled={!isUrlValid || loading}
                  >
                    {loading ? 'Running...' : 'Start Analysis'}
                  </Button>

                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() => setOpenOptionsDialog(true)}
                    disabled={loading}
                  >
                    Analysis Options
                  </Button>

                  {(auditResult || gscResult) && (
                    <>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<AutoAwesomeIcon />}
                        onClick={handleGenerateInsights}
                        disabled={loading}
                      >
                        Generate Insights
                      </Button>

                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownloadReport}
                        disabled={loading}
                      >
                        Download Report
                      </Button>

                      <Button
                        fullWidth
                        variant="outlined"
                        color="secondary"
                        startIcon={<RefreshIcon />}
                        onClick={handleReset}
                        disabled={loading}
                      >
                        New Analysis
                      </Button>
                    </>
                  )}
                </Stack>

                {/* Quick Stats */}
                {(auditResult || gscResult) && (
                  <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Quick Stats
                    </Typography>
                    <Stack spacing={1}>
                      {auditResult && (
                        <Chip
                          icon={<AssessmentIcon />}
                          label={`Audit Score: ${auditResult.executive_summary.overall_score}`}
                          variant="outlined"
                          size="small"
                        />
                      )}
                      {gscResult && (
                        <Chip
                          icon={<TrendingUpIcon />}
                          label={`Clicks: ${gscResult.performance_overview.clicks.toLocaleString()}`}
                          variant="outlined"
                          size="small"
                        />
                      )}
                      {insights.length > 0 && (
                        <Chip
                          icon={<AutoAwesomeIcon />}
                          label={`${insights.length} Insights Generated`}
                          variant="outlined"
                          size="small"
                          color="success"
                        />
                      )}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Right Panel: Results */}
          <Grid item xs={12} md={9}>
            {!auditResult && !gscResult ? (
              <Card sx={{ textAlign: 'center', py: 8 }}>
                <CardContent>
                  <AssessmentIcon sx={{ fontSize: 64, color: 'action.disabled', mb: 2 }} />
                  <Typography variant="h6" color="textSecondary">
                    No analysis yet
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    Enter a website URL and click "Start Analysis" to begin
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Box>
                {/* Tabs */}
                <Paper sx={{ mb: 2 }}>
                  <Tabs value={tabValue} onChange={handleTabChange}>
                    {auditResult && <Tab label="Enterprise Audit" />}
                    {gscResult && <Tab label="GSC Analysis" />}
                    {insights.length > 0 && <Tab label="AI Insights" />}
                    <Tab label="AI Overview Insights" />
                  </Tabs>
                </Paper>

                {/* Tab Content */}
                <TabPanel value={tabValue} index={0}>
                  {auditResult && (
                    <EnterpriseAuditResults
                      auditResult={auditResult}
                      insights={insights}
                      onGenerateInsights={handleGenerateInsights}
                      onDownloadReport={handleDownloadReport}
                    />
                  )}
                </TabPanel>

                {auditResult && gscResult && (
                  <TabPanel value={tabValue} index={1}>
                    {gscResult && (
                      <GSCAnalysisResults
                        analysisResult={gscResult}
                        insights={insights}
                        onGenerateInsights={handleGenerateInsights}
                        onDownloadReport={handleDownloadReport}
                      />
                    )}
                  </TabPanel>
                )}

                {!auditResult && gscResult && (
                  <TabPanel value={tabValue} index={0}>
                    {gscResult && (
                      <GSCAnalysisResults
                        analysisResult={gscResult}
                        insights={insights}
                        onGenerateInsights={handleGenerateInsights}
                        onDownloadReport={handleDownloadReport}
                      />
                    )}
                  </TabPanel>
                )}

                {/* AI Overview Insights — always last tab */}
                {(() => {
                  const aioIndex = (auditResult ? 1 : 0) + (gscResult ? 1 : 0) + (insights.length > 0 ? 1 : 0);
                  return (
                    <TabPanel value={tabValue} index={aioIndex}>
                      <AIVisibilitySection
                        gscConnected={!!gscResult}
                        siteUrl={websiteUrl}
                        onConnectGSC={() => setActiveStep(0)}
                      />
                    </TabPanel>
                  );
                })()}
              </Box>
            )}
          </Grid>
        </Grid>
      </motion.div>

      {/* Options Dialog */}
      <Dialog open={openOptionsDialog} onClose={() => setOpenOptionsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Analysis Options</DialogTitle>
        <DialogContent sx={{ py: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Include Content Analysis</Typography>
              <input
                type="checkbox"
                checked={options.includeContentAnalysis}
                onChange={(e) => setOptions({ ...options, includeContentAnalysis: e.target.checked })}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Include Competitive Analysis</Typography>
              <input
                type="checkbox"
                checked={options.includeCompetitiveAnalysis}
                onChange={(e) => setOptions({ ...options, includeCompetitiveAnalysis: e.target.checked })}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Generate Executive Report</Typography>
              <input
                type="checkbox"
                checked={options.generateExecutiveReport}
                onChange={(e) => setOptions({ ...options, generateExecutiveReport: e.target.checked })}
              />
            </Box>
            <TextField
              label="GSC Analysis Period (days)"
              type="number"
              value={options.dateRangeDays}
              onChange={(e) => setOptions({ ...options, dateRangeDays: parseInt(e.target.value) })}
              inputProps={{ min: 7, max: 365 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenOptionsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SEOAnalysisController;
