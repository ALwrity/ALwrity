/**
 * Enterprise Audit Results Component
 * Displays comprehensive enterprise SEO audit results with insights and recommendations
 */

import React, { useState, useEffect } from 'react';
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
  Button,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Skeleton,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import SearchIcon from '@mui/icons-material/Search';
import GavelIcon from '@mui/icons-material/Gavel';
import { motion } from 'framer-motion';
import { EnterpriseAuditResult, AIInsight, AuditIssue } from '../../../api/enterpriseSeoApi';

interface EnterpriseAuditResultsProps {
  auditResult?: EnterpriseAuditResult | null;
  loading?: boolean;
  error?: string | null;
  insights?: AIInsight[];
  onGenerateInsights?: () => Promise<void>;
  onDownloadReport?: () => void;
}

const getSeverityColor = (severity: 'critical' | 'high' | 'medium' | 'low'): string => {
  const colors: Record<string, string> = {
    critical: '#d32f2f',
    high: '#f57c00',
    medium: '#fbc02d',
    low: '#388e3c',
  };
  return colors[severity] || '#757575';
};

const getSeverityIcon = (severity: 'critical' | 'high' | 'medium' | 'low') => {
  if (severity === 'critical') return <ErrorIcon />;
  if (severity === 'high') return <WarningIcon />;
  return <CheckCircleIcon />;
};

const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
  const colors: Record<string, string> = {
    high: '#d32f2f',
    medium: '#f57c00',
    low: '#388e3c',
  };
  return colors[priority] || '#757575';
};

export const EnterpriseAuditResults: React.FC<EnterpriseAuditResultsProps> = ({
  auditResult,
  loading = false,
  error = null,
  insights = [],
  onGenerateInsights,
  onDownloadReport,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    executive: true,
    technical: false,
    content: false,
    keywords: false,
    competitive: false,
    insights: false,
    roadmap: false,
  });

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  if (loading || !auditResult) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" sx={{ mb: 2 }} height={40} />
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  const { executive_summary, technical_audit, on_page_analysis, keyword_research, competitive_analysis, ai_insights } = auditResult;

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
            Enterprise SEO Audit Report
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {auditResult.website_url} • {new Date(auditResult.audit_date).toLocaleDateString()}
          </Typography>
          {onDownloadReport && (
            <Button
              size="small"
              startIcon={<AssessmentIcon />}
              onClick={onDownloadReport}
              sx={{ mt: 1 }}
            >
              Download Report
            </Button>
          )}
        </Box>

        {/* Executive Summary Section */}
        <Accordion
          expanded={expandedSections.executive}
          onChange={() => handleSectionToggle('executive')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <AssessmentIcon color="primary" />
              <Typography variant="h6">Executive Summary</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Overall Score */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="textSecondary" gutterBottom>
                      Overall Score
                    </Typography>
                    <Box sx={{ position: 'relative', display: 'inline-flex', my: 2 }}>
                      <CircularProgress
                        variant="determinate"
                        value={executive_summary.overall_score}
                        size={100}
                        sx={{
                          color:
                            executive_summary.overall_score >= 80
                              ? '#388e3c'
                              : executive_summary.overall_score >= 60
                              ? '#f57c00'
                              : '#d32f2f',
                        }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="h4" component="div" color="textPrimary">
                          {executive_summary.overall_score}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Traffic Potential */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="textSecondary" gutterBottom>
                      Traffic Potential
                    </Typography>
                    <TrendingUpIcon sx={{ fontSize: 40, color: '#388e3c', my: 1 }} />
                    <Typography variant="h6">{executive_summary.estimated_traffic_potential}</Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Implementation Timeline */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="textSecondary" gutterBottom>
                      Implementation
                    </Typography>
                    <SpeedIcon sx={{ fontSize: 40, color: '#1976d2', my: 1 }} />
                    <Typography variant="h6">{executive_summary.timeframe_to_implement}</Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Critical Issues Count */}
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography color="textSecondary" gutterBottom>
                      Critical Issues
                    </Typography>
                    <ErrorIcon sx={{ fontSize: 40, color: '#d32f2f', my: 1 }} />
                    <Typography variant="h6">{executive_summary.critical_issues.length}</Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Key Findings */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Key Findings
                </Typography>
                <Stack spacing={1}>
                  {executive_summary.key_findings.map((finding, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 1.5,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                      }}
                    >
                      <CheckCircleIcon
                        sx={{ mt: 0.5, color: '#388e3c', flexShrink: 0 }}
                        fontSize="small"
                      />
                      <Typography variant="body2">{finding}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Grid>

              {/* Top Opportunities */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Top Opportunities
                </Typography>
                <Stack spacing={1}>
                  {executive_summary.top_opportunities.map((opp, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 1.5,
                        bgcolor: 'success.lighter',
                        border: '1px solid',
                        borderColor: 'success.main',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                      }}
                    >
                      <LightbulbIcon sx={{ mt: 0.5, color: '#fbc02d', flexShrink: 0 }} fontSize="small" />
                      <Typography variant="body2">{opp}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Technical Audit Section */}
        <Accordion
          expanded={expandedSections.technical}
          onChange={() => handleSectionToggle('technical')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <SpeedIcon color="primary" />
              <Typography variant="h6">Technical SEO Audit</Typography>
              <Chip
                label={`${technical_audit.issues.length} Issues`}
                size="small"
                color={technical_audit.issues.length > 0 ? 'error' : 'success'}
                variant="outlined"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Pages Audited
                </Typography>
                <Typography variant="h5">{technical_audit.pages_audited}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Average Score
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={technical_audit.avg_score}
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="h6">{technical_audit.avg_score}</Typography>
                </Box>
              </Grid>

              {/* Core Web Vitals */}
              {technical_audit.core_web_vitals && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Core Web Vitals
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography color="textSecondary" variant="caption" display="block">
                            LCP (Largest Contentful Paint)
                          </Typography>
                          <Typography variant="h6">{technical_audit.core_web_vitals.lcp}ms</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography color="textSecondary" variant="caption" display="block">
                            FID (First Input Delay)
                          </Typography>
                          <Typography variant="h6">{technical_audit.core_web_vitals.fid}ms</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Card>
                        <CardContent sx={{ textAlign: 'center' }}>
                          <Typography color="textSecondary" variant="caption" display="block">
                            CLS (Cumulative Layout Shift)
                          </Typography>
                          <Typography variant="h6">{technical_audit.core_web_vitals.cls}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Grid>
              )}

              {/* Issues Table */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Top Issues
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'background.paper' }}>
                        <TableCell>Issue Type</TableCell>
                        <TableCell>Severity</TableCell>
                        <TableCell>Affected Pages</TableCell>
                        <TableCell>Recommendation</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {technical_audit.issues.slice(0, 5).map((issue, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {getSeverityIcon(issue.severity)}
                              <Typography variant="body2">{issue.type}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={issue.severity}
                              size="small"
                              sx={{ bgcolor: getSeverityColor(issue.severity), color: 'white' }}
                            />
                          </TableCell>
                          <TableCell>{issue.affected_pages || 'N/A'}</TableCell>
                          <TableCell>
                            <Typography variant="caption">{issue.recommendation || issue.description}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Keyword Research Section */}
        <Accordion
          expanded={expandedSections.keywords}
          onChange={() => handleSectionToggle('keywords')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <SearchIcon color="primary" />
              <Typography variant="h6">Keyword Research</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Target Keywords */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Target Keywords
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'background.paper' }}>
                        <TableCell>Keyword</TableCell>
                        <TableCell align="right">Volume</TableCell>
                        <TableCell align="right">Difficulty</TableCell>
                        <TableCell align="right">Current Rank</TableCell>
                        <TableCell align="center">Trend</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {keyword_research.target_keywords.map((kw, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{kw.keyword}</TableCell>
                          <TableCell align="right">{kw.volume.toLocaleString()}</TableCell>
                          <TableCell align="right">{kw.difficulty}</TableCell>
                          <TableCell align="right">#{kw.current_ranking}</TableCell>
                          <TableCell align="center">
                            {kw.trend === 'up' && <TrendingUpIcon sx={{ color: '#388e3c' }} fontSize="small" />}
                            {kw.trend === 'down' && <TrendingUpIcon sx={{ color: '#d32f2f', transform: 'rotate(180deg)' }} fontSize="small" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Long Tail Opportunities */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Long Tail Opportunities
                </Typography>
                <Grid container spacing={1}>
                  {keyword_research.long_tail_opportunities.map((kw, idx) => (
                    <Grid item xs={12} sm={6} md={4} key={idx}>
                      <Card>
                        <CardContent>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {kw.keyword}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
                            Volume: {kw.volume.toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Opportunity Score: {kw.opportunity_score}/100
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* AI Insights Section */}
        <Accordion
          expanded={expandedSections.insights}
          onChange={() => handleSectionToggle('insights')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <LightbulbIcon color="primary" />
              <Typography variant="h6">AI-Powered Insights & Recommendations</Typography>
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
                        sx={{
                          bgcolor: getPriorityColor(insight.priority),
                          color: 'white',
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {insight.insight}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Implementation Difficulty: {insight.implementation_difficulty}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Estimated Impact: {insight.estimated_impact}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography color="textSecondary" sx={{ mb: 2 }}>
                  No insights generated yet. Generate AI-powered insights from the audit data.
                </Typography>
                {onGenerateInsights && (
                  <Button
                    variant="contained"
                    startIcon={<LightbulbIcon />}
                    onClick={onGenerateInsights}
                  >
                    Generate Insights
                  </Button>
                )}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Implementation Roadmap */}
        <Accordion
          expanded={expandedSections.roadmap}
          onChange={() => handleSectionToggle('roadmap')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <GavelIcon color="primary" />
              <Typography variant="h6">Implementation Roadmap</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* Phase 1: Quick Wins */}
              <Grid item xs={12} md={4}>
                <Card sx={{ border: '2px solid #4caf50' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#4caf50', fontWeight: 600 }}>
                      🚀 Phase 1: Quick Wins (1-2 weeks)
                    </Typography>
                    <Stack spacing={1}>
                      {auditResult.implementation_roadmap.phase1_quick_wins.map((item, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                          <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                          <Typography variant="body2">{item}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Phase 2: Medium Term */}
              <Grid item xs={12} md={4}>
                <Card sx={{ border: '2px solid #2196f3' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#2196f3', fontWeight: 600 }}>
                      📈 Phase 2: Medium Term (1-3 months)
                    </Typography>
                    <Stack spacing={1}>
                      {auditResult.implementation_roadmap.phase2_medium_term.map((item, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                          <CheckCircleIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                          <Typography variant="body2">{item}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Phase 3: Long Term */}
              <Grid item xs={12} md={4}>
                <Card sx={{ border: '2px solid #ff9800' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#ff9800', fontWeight: 600 }}>
                      🎯 Phase 3: Long Term (3+ months)
                    </Typography>
                    <Stack spacing={1}>
                      {auditResult.implementation_roadmap.phase3_long_term.map((item, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                          <CheckCircleIcon sx={{ color: '#ff9800', fontSize: 20 }} />
                          <Typography variant="body2">{item}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Box>
    </motion.div>
  );
};

export default EnterpriseAuditResults;
