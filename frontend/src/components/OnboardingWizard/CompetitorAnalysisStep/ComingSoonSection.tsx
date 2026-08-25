import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Tooltip,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CheckIcon from '@mui/icons-material/Check';
import InsightsIcon from '@mui/icons-material/Insights';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import AIIcon from '@mui/icons-material/AutoAwesome';
import { apiClient, longRunningApiClient } from '../../../api/client';
import { SitemapBenchmarkResults } from './SitemapBenchmarkResults';
import { StrategicInsightsResults } from './StrategicInsightsResults';

export const ComingSoonSection: React.FC<{ missingData?: boolean }> = ({ missingData = false }) => {
  const [openModal, setOpenModal] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [scheduledStatus, setScheduledStatus] = useState<any>(null);
  const [sitemapBenchmarkRunning, setSitemapBenchmarkRunning] = useState(false);
  const [sitemapBenchmarkError, setSitemapBenchmarkError] = useState<string | null>(null);
  const [sitemapBenchmarkData, setSitemapBenchmarkData] = useState<any>(null);
  const [loadingBenchmarkData, setLoadingBenchmarkData] = useState(false);
  const [isLongRunning, setIsLongRunning] = useState(false);
  const [strategicInsightsRunning, setStrategicInsightsRunning] = useState(false);
  const [strategicInsightsError, setStrategicInsightsError] = useState<string | null>(null);
  const [strategicInsightsData, setStrategicInsightsData] = useState<any>(null);
  // const [loadingStrategicHistory, setLoadingStrategicHistory] = useState(false);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await apiClient.get('/api/onboarding/step3/scheduled-tasks-status');
        setScheduledStatus(res.data);
        
        // If report is available, fetch the full data
        if (res.data?.competitive_sitemap_benchmarking?.report?.available) {
          fetchBenchmarkData();
        }
      } catch {
        setScheduledStatus(null);
      }
    };

    const loadHistory = async () => {
      // setLoadingStrategicHistory(true);
      try {
        const res = await apiClient.get('/api/seo-dashboard/strategic-insights/history');
        if (res.data?.history?.length > 0) {
          setStrategicInsightsData(res.data.history[0]); // Show latest
        }
      } catch (e) {
        console.error("Failed to fetch strategic insights history", e);
      } finally {
        // setLoadingStrategicHistory(false);
      }
    };

    loadStatus();
    loadHistory();
  }, []);

  const fetchBenchmarkData = async () => {
    setLoadingBenchmarkData(true);
    try {
      const res = await apiClient.get('/api/onboarding/step3/sitemap-benchmark-report');
      setSitemapBenchmarkData(res.data);
    } catch (e) {
      console.error("Failed to fetch benchmark report", e);
    } finally {
      setLoadingBenchmarkData(false);
    }
  };

  const deepStatus = scheduledStatus?.deep_competitor_analysis;
  const deepBulb = deepStatus?.bulb || 'unknown';
  const deepReason = deepStatus?.reason;
  const deepTask = deepStatus?.task;

  const sitemapStatus = scheduledStatus?.competitive_sitemap_benchmarking;
  const sitemapBulb = sitemapStatus?.bulb || 'unknown';
  const sitemapReason = sitemapStatus?.reason;
  const sitemapReport = sitemapStatus?.report;

  const getBulbColor = (bulb: string) => {
    if (bulb === 'green') return '#22c55e';
    if (bulb === 'red') return '#ef4444';
    return '#94a3b8';
  };

  const getFeatureStatusLabel = (featureId: string, fallback: string) => {
    if (featureId === 'sitemap-benchmarking') {
      if (sitemapReport?.available) return 'Report Ready (No AI)';
      return 'Available (No AI)';
    }
    return fallback;
  };

  const runSitemapBenchmark = async () => {
    setSitemapBenchmarkError(null);
    setSitemapBenchmarkRunning(true);
    setIsLongRunning(false);
    try {
      await longRunningApiClient.post('/api/seo/competitive-sitemap-benchmarking/run', { max_competitors: 5 });
      
      // Poll for completion with adaptive backoff
      let attempts = 0;
      const maxAttempts = 60; // Adjusted for ~10-12 mins (matching backend timeout)
      let currentInterval = 2000;
      
      const poll = async () => {
        try {
          attempts++;
          
          // Mark as long running after ~2 minutes (approx 30 attempts)
          if (attempts > 30) {
            setIsLongRunning(true);
          }

          const res = await apiClient.get('/api/onboarding/step3/scheduled-tasks-status');
          setScheduledStatus(res.data);
          
          // Check status flag
          const reportAvailable = res.data?.competitive_sitemap_benchmarking?.report?.available;
          const reportStatus = res.data?.competitive_sitemap_benchmarking?.report?.status;
          const reportError = res.data?.competitive_sitemap_benchmarking?.report?.error;
          let reportFetched = false;

          // Check for failure
          if (reportStatus === 'failed' || reportError) {
            setSitemapBenchmarkRunning(false);
            setSitemapBenchmarkError(reportError || "Benchmark failed during execution.");
            return; // Stop polling
          }

          // If available, try to fetch data
          if (reportAvailable && !sitemapBenchmarkData) {
            try {
              const reportRes = await apiClient.get('/api/onboarding/step3/sitemap-benchmark-report');
              if (reportRes?.data) {
                setSitemapBenchmarkData(reportRes.data);
                reportFetched = true;
              }
            } catch {
              // Report might be saving or transient error
            }
          }

          if (reportAvailable || reportFetched) {
            if (!reportFetched && !sitemapBenchmarkData) {
              await fetchBenchmarkData();
            }
            setOpenModal(false); // Close modal on success
            setSitemapBenchmarkRunning(false);
            setIsLongRunning(false);
            
            // Focus on results
            setTimeout(() => {
              const element = document.getElementById('sitemap-benchmark-results');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 500);
            return; // Stop polling
          } else if (attempts >= maxAttempts) {
            setSitemapBenchmarkRunning(false);
            setIsLongRunning(false);
            setSitemapBenchmarkError("Benchmark timed out (10 mins limit). It may still be running in the background.");
            return;
          }

          // Adaptive backoff: Slow down polling over time
          if (attempts > 5) currentInterval = 4000;   // After ~10s, slow to 4s
          if (attempts > 15) currentInterval = 8000;  // After ~50s, slow to 8s
          if (attempts > 25) currentInterval = 15000; // After ~2m, slow to 15s

          setTimeout(poll, currentInterval);

        } catch (e) {
          console.error("Polling error", e);
          // Continue polling on error, but maybe wait longer
          setTimeout(poll, currentInterval + 1000);
        }
      };

      // Start polling
      setTimeout(poll, currentInterval);
      
    } catch (e: any) {
      setSitemapBenchmarkError(e?.response?.data?.detail || e?.message || 'Failed to run benchmark');
      setSitemapBenchmarkRunning(false);
    }
  };

  const runStrategicInsights = async () => {
    setStrategicInsightsError(null);
    setStrategicInsightsRunning(true);
    try {
      const res = await apiClient.post('/api/seo-dashboard/strategic-insights/run');
      if (res.data?.success) {
        setStrategicInsightsData(res.data.report);
        setOpenModal(false);
        // Focus on results
        setTimeout(() => {
          const element = document.getElementById('strategic-insights-results');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      }
    } catch (e: any) {
      setStrategicInsightsError(e?.response?.data?.detail || e?.message || 'Failed to run strategic insights');
    } finally {
      setStrategicInsightsRunning(false);
    }
  };

  const features = [
    {
      id: 'deep-competitor-analysis',
      title: 'Deep Competitor Analysis',
      description: 'We dig deep into your competitors\' strategies so you don\'t have to.',
      icon: <SearchIcon />,
      status: 'Auto-scheduled',
      color: '#3b82f6',
      details: [
        'Uncover their top-performing content and keywords',
        'Identify their unique selling propositions (USPs)',
        'Spot gaps in their content strategy you can exploit',
        'Analyze their publishing frequency and patterns',
        'Get a clear roadmap to outperform them'
      ]
    },
    {
      id: 'sitemap-benchmarking',
      title: 'Competitive Sitemap Benchmarking',
      description: 'See exactly how your website stacks up against the market leaders.',
      icon: <AnalyticsIcon />,
      status: 'Available (No AI)',
      color: '#10b981',
      details: [
        'Visualize your content volume vs. competitors',
        'Compare site structure and ease of navigation',
        'Check if you are publishing enough content',
        'Find missing categories your competitors have',
        'Get instant, data-backed improvement ideas'
      ]
    },
    {
      id: 'ai-competitive-insights',
      title: 'AI-Powered Competitive Insights',
      description: 'Turn raw data into a winning game plan with AI.',
      icon: <InsightsIcon />,
      status: 'Planned',
      color: '#8b5cf6',
      details: [
        'Receive a personalized "Winning Moves" report',
        'Understand the business impact of your strategy',
        'Get specific content ideas to steal market share',
        'Identify your true competitive advantages',
        'Build a roadmap for long-term growth'
      ]
    }
  ];

  const handleFeatureClick = (featureId: string) => {
    setSelectedFeature(featureId);
    setOpenModal(true);
  };

  const selectedFeatureData = features.find(f => f.id === selectedFeature);

  return (
    <>
      <Box sx={{ mt: 4, mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', mb: 1.5 }}>
          🔍 Scheduled Tasks
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748b', mb: 4, fontSize: '1.1rem' }}>
          Long-running analyses that run automatically after onboarding
        </Typography>

        <Grid container spacing={2}>
          {features.map((feature) => (
            <Grid item xs={12} md={4} key={feature.id}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: '2px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                    borderColor: feature.color,
                    '& .feature-icon': {
                      transform: 'scale(1.1)',
                      backgroundColor: `${feature.color}20`
                    }
                  }
                }}
                onClick={() => handleFeatureClick(feature.id)}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      className="feature-icon"
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        backgroundColor: `${feature.color}15`,
                        color: feature.color,
                        mr: 2,
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                          {feature.title}
                        </Typography>
                      {feature.id === 'deep-competitor-analysis' && (
                          <Tooltip title={deepReason || 'Scheduled automatically after onboarding completion'}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: getBulbColor(deepBulb),
                                boxShadow: `0 0 0 4px ${getBulbColor(deepBulb)}20`
                              }}
                            />
                          </Tooltip>
                        )}
                      {feature.id === 'sitemap-benchmarking' && (
                        <Tooltip title={sitemapReport?.available ? `Last run: ${sitemapReport?.last_run || 'available'}` : (sitemapReason || 'Run anytime (No AI)')}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: getBulbColor(sitemapBulb),
                              boxShadow: `0 0 0 4px ${getBulbColor(sitemapBulb)}20`
                            }}
                          />
                        </Tooltip>
                      )}
                      </Box>
                      <Chip
                        label={getFeatureStatusLabel(feature.id, feature.status)}
                        size="small"
                        icon={feature.status === 'Auto-scheduled' ? <CheckCircleIcon sx={{ '&&': { color: feature.color, fontSize: '1rem' } }} /> : undefined}
                        sx={{
                          backgroundColor: feature.status === 'Auto-scheduled' ? '#ecfdf5' : `${feature.color}20`,
                          color: feature.status === 'Auto-scheduled' ? '#059669' : feature.color,
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          height: 24,
                          border: feature.status === 'Auto-scheduled' ? '1px solid #a7f3d0' : 'none',
                          '& .MuiChip-label': {
                            px: 1.5
                          }
                        }}
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body1" sx={{ color: '#64748b', mb: 3, lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>

                  <Button
                    variant="outlined"
                    size="medium"
                    sx={{
                      borderColor: feature.color,
                      color: feature.color,
                      fontWeight: 600,
                      px: 3,
                      py: 1,
                      borderRadius: 2,
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: `${feature.color}15`,
                        borderColor: feature.color,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Alert 
          severity="info" 
          sx={{ 
            mt: 4, 
            backgroundColor: '#f0f9ff',
            border: '2px solid #0ea5e9',
            borderRadius: 3,
            '& .MuiAlert-icon': {
              color: '#0ea5e9',
              fontSize: '1.5rem'
            }
          }}
        >
          <Typography variant="body1" sx={{ color: '#0c4a6e', fontWeight: 500 }}>
            <strong>What's Next:</strong> These advanced competitor analysis features will be available in upcoming releases. 
            Your current competitor research provides valuable insights to get started!
          </Typography>
        </Alert>
      </Box>

      {sitemapReport?.available && sitemapBenchmarkData && (
        <Box id="sitemap-benchmark-results" sx={{ mt: 4, animation: 'fadeIn 0.5s ease-out' }}>
          <SitemapBenchmarkResults 
            data={{
              user: sitemapBenchmarkData.user,
              competitors: sitemapBenchmarkData.competitors,
              timestamp: sitemapBenchmarkData.timestamp,
              benchmark: sitemapBenchmarkData.benchmark || {}
            }} 
          />
        </Box>
      )}

      {strategicInsightsData && (
        <Box id="strategic-insights-results" sx={{ mt: 4 }}>
          <StrategicInsightsResults report={strategicInsightsData} />
        </Box>
      )}

      {/* Feature Details Modal */}
      <Dialog
        open={openModal}
        onClose={(event, reason) => {
          if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
            setOpenModal(false);
          } else if (!sitemapBenchmarkRunning) {
             setOpenModal(false);
          }
        }}
        disableEscapeKeyDown={sitemapBenchmarkRunning}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            borderRadius: 3,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }}
      >
        <DialogTitle sx={{ pb: 2, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {selectedFeatureData && (
              <>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: `${selectedFeatureData.color}15`,
                    color: selectedFeatureData.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {selectedFeatureData.icon}
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                    {selectedFeatureData.title}
                  </Typography>
                  <Chip
                    label={selectedFeatureData.status}
                    size="medium"
                    sx={{
                      backgroundColor: `${selectedFeatureData.color}15`,
                      color: selectedFeatureData.color,
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}
                  />
                </Box>
              </>
            )}
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ backgroundColor: '#ffffff', p: 3 }}>
          {selectedFeatureData && (
            <>
              <Typography variant="body1" sx={{ color: '#64748b', mb: 4, fontSize: '1.2rem', lineHeight: 1.7, fontWeight: 500 }}>
                {selectedFeatureData.description}
              </Typography>

              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, color: '#1e293b', fontSize: '1.3rem' }}>
                Key Features:
              </Typography>

              <List sx={{ pl: 0 }}>
                {selectedFeatureData.details.map((detail, index) => (
                  <ListItem key={index} sx={{ pl: 0, py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon sx={{ color: selectedFeatureData.color, fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={detail}
                      primaryTypographyProps={{
                        variant: 'body1',
                        color: '#374151',
                        fontWeight: 600,
                        fontSize: '1.05rem',
                        lineHeight: 1.6
                      }}
                    />
                  </ListItem>
                ))}
              </List>

              {selectedFeatureData.id === 'deep-competitor-analysis' && (
                <Box sx={{ mt: 3, p: 3, backgroundColor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1e293b', fontSize: '1.1rem' }}>
                    How It Works:
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.7 }}>
                    Once you finish onboarding, Alwrity automatically starts analyzing the competitors we found. 
                    We compare your website's performance against theirs to find hidden opportunities. 
                    You'll see the results in your SEO Dashboard, including a breakdown of what makes them successful and how you can do better.
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ color: '#334155', fontWeight: 600 }}>
                      Status:
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                      {deepBulb === 'red'
                        ? (deepReason || "Not eligible yet. No competitors found.")
                        : "Eligible. This will run automatically after onboarding."}
                    </Typography>
                    {deepTask?.exists && (
                      <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                        {deepTask.last_status
                          ? `Last run: ${deepTask.last_status}${deepTask.last_run ? ` at ${deepTask.last_run}` : ''}`
                          : (deepTask.next_execution ? `Next scheduled: ${deepTask.next_execution}` : `Task status: ${deepTask.status || 'unknown'}`)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}

              {selectedFeatureData.id === 'sitemap-benchmarking' && (
                <Box sx={{ mt: 3, p: 3, backgroundColor: '#f0f9ff', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1e293b', fontSize: '1.1rem' }}>
                    Why This Matters:
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.7 }}>
                    We scan competitor websites to understand how they organize their content and how often they publish. 
                    This shows you exactly where you need to improve to match or beat the market leaders.
                  </Typography>

                  {sitemapBenchmarkRunning && (
                    <Box sx={{ mt: 3, mb: 2 }}>
                      <LinearProgress />
                      <Typography variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center', color: '#64748b' }}>
                        {isLongRunning 
                          ? "This is taking longer than usual. Large websites can take a few minutes..." 
                          : "Analyzing competitor websites... please wait."}
                      </Typography>
                    </Box>
                  )}

                  {loadingBenchmarkData ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : sitemapReport?.available ? (
                     <Box sx={{ mt: 2 }}>
                       <Alert severity="success">
                         Benchmark Report is ready! Close this window to view the detailed analysis below.
                       </Alert>
                     </Box>
                   ) : (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: '#334155', fontWeight: 700 }}>
                        Status:
                      </Typography>
                      <Typography variant="body2" sx={{ color: sitemapReport?.status === 'failed' ? '#ef4444' : '#64748b', mt: 0.5 }}>
                        {sitemapReport?.available 
                          ? 'Report is ready.' 
                          : sitemapReport?.status === 'failed'
                            ? `Failed: ${sitemapReport?.error || 'Unknown error'}`
                            : sitemapReport?.status === 'processing'
                              ? 'Analysis in progress...'
                              : 'No report yet. You can run it now (No AI).'}
                      </Typography>
                      {sitemapReport?.last_run && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#64748b' }}>
                          Last run: {sitemapReport.last_run}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {sitemapBenchmarkError && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#ef4444' }}>
                      {sitemapBenchmarkError}
                    </Typography>
                  )}
                </Box>
              )}

              {selectedFeatureData.id === 'ai-competitive-insights' && (
                <Box sx={{ mt: 3, p: 3, backgroundColor: '#f0f9ff', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1e293b', fontSize: '1.1rem' }}>
                    The "Winning Moves" Advantage:
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.7 }}>
                    We turn millions of data points into a clear "Winning Moves" report. 
                    See exactly which content will drive the most traffic and revenue, 
                    and get a step-by-step plan to steal market share from your competitors.
                  </Typography>

                  {strategicInsightsRunning && (
                    <Box sx={{ mt: 3, mb: 2 }}>
                      <LinearProgress />
                      <Typography variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center', color: '#64748b' }}>
                        Our AI is analyzing market shifts and competitor moves... this takes about 30-45 seconds.
                      </Typography>
                    </Box>
                  )}

                  {strategicInsightsError && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#ef4444', textAlign: 'center' }}>
                      {strategicInsightsError}
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          {selectedFeatureData?.id === 'sitemap-benchmarking' && (
            <Button
              onClick={runSitemapBenchmark}
              variant="contained"
              disabled={sitemapBenchmarkRunning}
              startIcon={sitemapBenchmarkRunning ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{
                backgroundColor: '#10b981',
                '&:hover': { backgroundColor: '#059669' },
                textTransform: 'none',
                fontWeight: 700
              }}
            >
              {sitemapBenchmarkRunning ? 'Running Benchmark...' : 'Run Benchmark Now (No AI)'}
            </Button>
          )}
          {selectedFeatureData?.id === 'ai-competitive-insights' && (
              <Button
                onClick={runStrategicInsights}
                variant="contained"
                disabled={strategicInsightsRunning || missingData}
                startIcon={strategicInsightsRunning ? <CircularProgress size={20} color="inherit" /> : <AIIcon />}
                sx={{
                  backgroundColor: '#8b5cf6',
                  '&:hover': { backgroundColor: '#7c3aed' },
                  textTransform: 'none',
                  fontWeight: 700
                }}
              >
                {strategicInsightsRunning ? 'Generating Winning Moves...' : (missingData ? 'Complete Step 2 First' : 'Run AI Analysis Now')}
              </Button>
            )}
          <Button 
            onClick={() => setOpenModal(false)}
            variant="contained"
            sx={{
              backgroundColor: '#3b82f6',
              px: 4,
              py: 1,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)',
              '&:hover': {
                backgroundColor: '#2563eb',
                boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.5)',
              }
            }}
          >
            Got it, thanks!
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ComingSoonSection;
