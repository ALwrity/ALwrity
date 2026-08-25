/**
 * GSC Analysis Results Component
 * Displays Google Search Console analysis with opportunities and insights
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Skeleton,
  Button,
  Alert,
  Tab,
  Tabs,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MouseIcon from '@mui/icons-material/Mouse';
import PsychologyIcon from '@mui/icons-material/Psychology';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SpeedIcon from '@mui/icons-material/Speed';
import { motion } from 'framer-motion';
import { GSCAnalysisResult, KeywordAnalysis, ContentOpportunity, AIInsight } from '../../../api/enterpriseSeoApi';

interface GSCAnalysisResultsProps {
  analysisResult?: GSCAnalysisResult | null;
  loading?: boolean;
  error?: string | null;
  insights?: AIInsight[];
  onGenerateInsights?: () => Promise<void>;
  onDownloadReport?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export const GSCAnalysisResults: React.FC<GSCAnalysisResultsProps> = ({
  analysisResult,
  loading = false,
  error = null,
  insights = [],
  onGenerateInsights,
  onDownloadReport,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    performance: true,
    keywords: false,
    opportunities: false,
    technical: false,
    competitive: false,
    insights: false,
  });
  const [tabValue, setTabValue] = useState(0);

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  if (loading || !analysisResult) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" sx={{ mb: 2 }} height={40} />
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  const {
    performance_overview,
    page_performance,
    keyword_analysis,
    content_opportunities,
    technical_signals,
    traffic_potential,
  } = analysisResult;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Box sx={{ py: 3 }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
            Google Search Console Analysis
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {analysisResult.site_url} • {new Date(analysisResult.analysis_date).toLocaleDateString()} •
            Last {analysisResult.analysis_period_days} days
          </Typography>
          {onDownloadReport && (
            <Button
              size="small"
              startIcon={<SearchIcon />}
              onClick={onDownloadReport}
              sx={{ mt: 1 }}
            >
              Download Report
            </Button>
          )}
        </Box>

        {/* Performance Overview Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <MouseIcon sx={{ fontSize: 32, color: '#1976d2', mb: 1 }} />
                <Typography color="textSecondary" variant="caption" display="block">
                  Total Clicks
                </Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {performance_overview.clicks.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <VisibilityIcon sx={{ fontSize: 32, color: '#388e3c', mb: 1 }} />
                <Typography color="textSecondary" variant="caption" display="block">
                  Total Impressions
                </Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {performance_overview.impressions.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <PsychologyIcon sx={{ fontSize: 32, color: '#f57c00', mb: 1 }} />
                <Typography color="textSecondary" variant="caption" display="block">
                  Average CTR
                </Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {(performance_overview.ctr * 100).toFixed(2)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <LocalOfferIcon sx={{ fontSize: 32, color: '#d32f2f', mb: 1 }} />
                <Typography color="textSecondary" variant="caption" display="block">
                  Avg Position
                </Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  #{performance_overview.avg_position.toFixed(1)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs for different analyses */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="analysis tabs">
            <Tab label="Performance" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="Keywords" id="tab-1" aria-controls="tabpanel-1" />
            <Tab label="Opportunities" id="tab-2" aria-controls="tabpanel-2" />
            <Tab label="Technical" id="tab-3" aria-controls="tabpanel-3" />
          </Tabs>
        </Box>

        {/* Tab 1: Performance Overview */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Top Keywords */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Top Performing Keywords
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.paper' }}>
                      <TableCell>Keyword</TableCell>
                      <TableCell align="right">Clicks</TableCell>
                      <TableCell align="right">Impressions</TableCell>
                      <TableCell align="right">CTR</TableCell>
                      <TableCell align="right">Position</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {performance_overview.top_keywords.map((kw: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SearchIcon sx={{ fontSize: 18, color: '#1976d2' }} />
                            {kw.keyword}
                          </Box>
                        </TableCell>
                        <TableCell align="right">{kw.volume}</TableCell>
                        <TableCell align="right">{kw.difficulty}</TableCell>
                        <TableCell align="right">{(kw.current_ranking / 100).toFixed(2)}%</TableCell>
                        <TableCell align="right">#{kw.current_ranking}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Top Performing Pages */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Top Performing Pages
              </Typography>
              <Grid container spacing={2}>
                {page_performance.slice(0, 5).map((page: any, idx: number) => (
                  <Grid item xs={12} sm={6} md={4} key={idx}>
                    <Card>
                      <CardContent>
                        <Tooltip title={page.url}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600, mb: 1 }}>
                            {new URL(page.url).pathname}
                          </Typography>
                        </Tooltip>
                        <Box sx={{ mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="textSecondary">
                              Score
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {page.score}
                            </Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={page.score} />
                        </Box>
                        <Chip
                          label={page.priority}
                          size="small"
                          color={page.priority === 'high' ? 'error' : page.priority === 'medium' ? 'warning' : 'success'}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Traffic Trend */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <TrendingUpIcon />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Traffic Trend
                    </Typography>
                  </Box>
                  <Typography variant="h5" sx={{ color: performance_overview.traffic_trend.includes('up') ? '#388e3c' : '#d32f2f' }}>
                    {performance_overview.traffic_trend}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: Keywords Analysis */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            {/* Opportunities Tab */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Keywords Ready for Ranking Improvement
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.paper' }}>
                      <TableCell>Keyword</TableCell>
                      <TableCell align="right">Volume</TableCell>
                      <TableCell align="right">Current Position</TableCell>
                      <TableCell align="right">Difficulty</TableCell>
                      <TableCell align="right">Opportunity Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {keyword_analysis.opportunities.map((kw: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{kw.keyword}</TableCell>
                        <TableCell align="right">{kw.volume.toLocaleString()}</TableCell>
                        <TableCell align="right">#{kw.current_ranking}</TableCell>
                        <TableCell align="right">{kw.difficulty}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(kw.opportunity_score, 100)}
                              sx={{ width: 50 }}
                            />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {kw.opportunity_score}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Declining Keywords */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Keywords Needing Attention
              </Typography>
              {keyword_analysis.declining_keywords.length > 0 ? (
                <Grid container spacing={2}>
                  {keyword_analysis.declining_keywords.map((kw: any, idx: number) => (
                    <Grid item xs={12} sm={6} key={idx}>
                      <Card sx={{ border: '1px solid #ff6f00' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <TrendingDownIcon sx={{ color: '#d32f2f' }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {kw.keyword}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="textSecondary">
                            Position: #{kw.current_ranking} • Volume: {kw.volume.toLocaleString()}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="success">No declining keywords detected</Alert>
              )}
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 3: Content Opportunities */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                High-Priority Content Opportunities ({content_opportunities.length})
              </Typography>
              <Stack spacing={2}>
                {content_opportunities.slice(0, 10).map((opp: any, idx: number) => (
                  <Card key={idx} sx={{ border: opp.priority === 'high' ? '2px solid #d32f2f' : '1px solid' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {opp.keyword}
                        </Typography>
                        <Chip
                          label={opp.priority}
                          size="small"
                          color={opp.priority === 'high' ? 'error' : opp.priority === 'medium' ? 'warning' : 'success'}
                        />
                      </Box>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Current Position
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            #{opp.current_position}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Impressions
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {opp.impressions.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Current CTR
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {(opp.ctr * 100).toFixed(2)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Est. Traffic Gain
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#388e3c' }}>
                            +{opp.estimated_traffic_gain}
                          </Typography>
                        </Grid>
                      </Grid>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Recommended Action:</strong> {opp.recommended_action}
                      </Typography>
                      <Chip
                        label={`Difficulty: ${opp.difficulty_score}`}
                        size="small"
                        variant="outlined"
                      />
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Grid>

            {/* Traffic Potential Summary */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Traffic Growth Potential
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="textSecondary" display="block">
                        Quick Wins
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {traffic_potential.low_hanging_fruit}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="textSecondary" display="block">
                        Medium Term
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {traffic_potential.medium_term_opportunities}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="caption" color="textSecondary" display="block">
                        Long Term Growth
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {traffic_potential.long_term_growth}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 4: Technical Signals */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <SpeedIcon sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
                  <Typography variant="caption" color="textSecondary" display="block">
                    Core Web Vitals
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1, color: '#388e3c' }}>
                    {technical_signals.core_web_vitals_score}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Mobile Usability Issues
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {technical_signals.mobile_usability_issues}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Indexing Issues
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {technical_signals.indexing_issues}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Security Issues
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {technical_signals.security_issues}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* AI Insights Section */}
        <Accordion
          expanded={expandedSections.insights}
          onChange={() => handleSectionToggle('insights')}
          sx={{ mt: 3 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <LightbulbIcon color="primary" />
              <Typography variant="h6">AI-Powered Insights</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {insights.length > 0 ? (
              <Stack spacing={2}>
                {insights.map((insight, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: insight.priority === 'high' ? '#d32f2f' : 'divider',
                      borderRadius: 1,
                      bgcolor: insight.priority === 'high' ? 'error.lighter' : 'background.paper',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {insight.category}
                      </Typography>
                      <Chip
                        label={insight.priority}
                        size="small"
                        color={insight.priority === 'high' ? 'error' : insight.priority === 'medium' ? 'warning' : 'success'}
                      />
                    </Box>
                    <Typography variant="body2">{insight.insight}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography color="textSecondary" sx={{ mb: 2 }}>
                  Generate AI-powered insights to get actionable recommendations.
                </Typography>
                {onGenerateInsights && (
                  <Button variant="contained" startIcon={<LightbulbIcon />} onClick={onGenerateInsights}>
                    Generate Insights
                  </Button>
                )}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>
    </motion.div>
  );
};

export default GSCAnalysisResults;
