/**
 * IntentResultsDisplay Component
 * 
 * Displays intent-driven research results organized by deliverable type.
 * Shows statistics, quotes, case studies, trends, etc. in a structured format.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Link,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircle';
import TrendIcon from '@mui/icons-material/TrendingUp';
import QuoteIcon from '@mui/icons-material/FormatQuote';
import StatsIcon from '@mui/icons-material/BarChart';
import CaseStudyIcon from '@mui/icons-material/School';
import IdeaIcon from '@mui/icons-material/Lightbulb';
import OpenIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningIcon from '@mui/icons-material/Warning';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownIcon from '@mui/icons-material/ArrowDownward';
import {
  IntentDrivenResearchResponse,
  DELIVERABLE_DISPLAY,
} from '../../types/intent.types';
import { TrendsChart } from './TrendsChart';
import { TrendsExport } from './TrendsExport';

interface IntentResultsDisplayProps {
  result: IntentDrivenResearchResponse;
  hideHeader?: boolean;
}

export const IntentResultsDisplay: React.FC<IntentResultsDisplayProps> = ({ result, hideHeader = false }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [topicsTabIndex, setTopicsTabIndex] = useState(0);
  const [queriesTabIndex, setQueriesTabIndex] = useState(0);

  // Build available tabs based on what we have
  const tabs = [
    { id: 'summary', label: 'Summary', icon: <IdeaIcon />, count: 0 },
    ...(result.statistics.length > 0 ? [{ id: 'statistics', label: 'Statistics', icon: <StatsIcon />, count: result.statistics.length }] : []),
    ...(result.expert_quotes.length > 0 ? [{ id: 'quotes', label: 'Expert Quotes', icon: <QuoteIcon />, count: result.expert_quotes.length }] : []),
    ...(result.case_studies.length > 0 ? [{ id: 'case_studies', label: 'Case Studies', icon: <CaseStudyIcon />, count: result.case_studies.length }] : []),
    ...(result.trends.length > 0 ? [{ id: 'trends', label: 'Trends', icon: <TrendIcon />, count: result.trends.length }] : []),
    { id: 'sources', label: 'Sources', icon: <OpenIcon />, count: result.sources.length },
  ];

  const currentTab = tabs[tabIndex]?.id || 'summary';

  return (
    <Box>
      {/* Executive Summary Banner */}
      {result.executive_summary && (
        <Alert 
          severity="success" 
          icon={<CheckIcon />}
          sx={{ mb: 3, borderRadius: 2 }}
        >
          <Typography variant="body1">{result.executive_summary}</Typography>
        </Alert>
      )}

      {/* Primary Answer */}
      {result.primary_answer && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Typography variant="subtitle2" gutterBottom>
            Answer to Your Question:
          </Typography>
          <Typography variant="body1" fontWeight={500}>
            {result.primary_answer}
          </Typography>
        </Paper>
      )}

      {/* Tabs */}
      <Tabs
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((tab, idx) => (
          <Tab
            key={tab.id}
            icon={tab.icon}
            iconPosition="start"
            label={
              <Box display="flex" alignItems="center" gap={0.5}>
                {tab.label}
                {tab.count > 0 && (
                  <Chip size="small" label={tab.count} color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                )}
              </Box>
            }
            sx={{ minHeight: 48, textTransform: 'none' }}
          />
        ))}
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ minHeight: 300 }}>
        {/* Summary Tab */}
        {currentTab === 'summary' && (
          <Box>
            {/* Key Takeaways */}
            {result.key_takeaways.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom color="primary">
                  ✨ Key Takeaways
                </Typography>
                <List>
                  {result.key_takeaways.map((takeaway, idx) => (
                    <ListItem key={idx} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CheckIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={takeaway} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Best Practices */}
            {result.best_practices.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom color="primary">
                  📋 Best Practices
                </Typography>
                <List>
                  {result.best_practices.map((practice, idx) => (
                    <ListItem key={idx} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <IdeaIcon color="info" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={practice} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Suggested Content Outline */}
            {result.suggested_outline.length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom color="primary">
                  📝 Suggested Content Outline
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <List dense>
                    {result.suggested_outline.map((item, idx) => (
                      <ListItem key={idx}>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            )}

            {/* Definitions */}
            {Object.keys(result.definitions).length > 0 && (
              <Box mb={3}>
                <Typography variant="h6" gutterBottom color="primary">
                  📖 Key Definitions
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(result.definitions).map(([term, definition], idx) => (
                    <Grid item xs={12} md={6} key={idx}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            {term}
                          </Typography>
                          <Typography variant="body2">{definition}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        )}

        {/* Statistics Tab */}
        {currentTab === 'statistics' && (
          <Grid container spacing={2}>
            {result.statistics.map((stat, idx) => (
              <Grid item xs={12} md={6} key={idx}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="flex-start" gap={1}>
                      <StatsIcon color="primary" />
                      <Box flex={1}>
                        <Typography variant="body1" fontWeight={500}>
                          {stat.statistic}
                        </Typography>
                        {stat.value && (
                          <Chip label={stat.value} color="primary" size="small" sx={{ mt: 0.5 }} />
                        )}
                        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          {stat.context}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1} mt={1}>
                          <Link href={stat.url} target="_blank" rel="noopener" variant="caption">
                            {stat.source} <OpenIcon sx={{ fontSize: 12 }} />
                          </Link>
                          <Chip
                            size="small"
                            label={`${Math.round(stat.credibility * 100)}% credible`}
                            color={stat.credibility > 0.8 ? 'success' : 'warning'}
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Expert Quotes Tab */}
        {currentTab === 'quotes' && (
          <Box>
            {result.expert_quotes.map((quote, idx) => (
              <Card key={idx} variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" gap={2}>
                    <QuoteIcon color="primary" sx={{ fontSize: 40, opacity: 0.5 }} />
                    <Box>
                      <Typography variant="body1" fontStyle="italic" mb={1}>
                        "{quote.quote}"
                      </Typography>
                      <Typography variant="subtitle2" color="primary">
                        — {quote.speaker}
                        {quote.title && `, ${quote.title}`}
                        {quote.organization && ` at ${quote.organization}`}
                      </Typography>
                      <Link href={quote.url} target="_blank" rel="noopener" variant="caption">
                        Source: {quote.source} <OpenIcon sx={{ fontSize: 12 }} />
                      </Link>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Case Studies Tab */}
        {currentTab === 'case_studies' && (
          <Box>
            {result.case_studies.map((cs, idx) => (
              <Accordion key={idx} defaultExpanded={idx === 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {cs.title}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      {cs.organization}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Challenge</Typography>
                      <Typography variant="body2">{cs.challenge}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Solution</Typography>
                      <Typography variant="body2">{cs.solution}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Outcome</Typography>
                      <Typography variant="body2">{cs.outcome}</Typography>
                    </Grid>
                  </Grid>
                  {cs.key_metrics.length > 0 && (
                    <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                      {cs.key_metrics.map((metric, i) => (
                        <Chip key={i} label={metric} size="small" color="success" variant="outlined" />
                      ))}
                    </Box>
                  )}
                  <Box mt={2}>
                    <Link href={cs.url} target="_blank" rel="noopener" variant="caption">
                      Read full case study <OpenIcon sx={{ fontSize: 12 }} />
                    </Link>
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {/* Trends Tab */}
        {currentTab === 'trends' && (
          <Box>
            {/* Google Trends Data Section */}
            {result.google_trends_data && (
              <Box mb={3}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendIcon color="primary" />
                    Google Trends Analysis
                  </Typography>
                  <TrendsExport
                    trendsData={result.google_trends_data}
                    aiTrends={result.trends}
                    keywords={result.google_trends_data.keywords}
                  />
                </Box>
                
                {/* Interest Over Time - Advanced Chart */}
                {result.google_trends_data.interest_over_time.length > 0 && (
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Interest Over Time
                        </Typography>
                        <Chip
                          size="small"
                          label={`${result.google_trends_data.timeframe} • ${result.google_trends_data.geo}`}
                          sx={{ backgroundColor: '#f0f9ff', color: '#0369a1' }}
                        />
                      </Box>
                      <Box data-trends-chart>
                        <TrendsChart
                          data={result.google_trends_data}
                          height={300}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* Interest by Region */}
                {result.google_trends_data.interest_by_region.length > 0 && (
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PublicIcon fontSize="small" />
                        Interest by Region
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Region</TableCell>
                              <TableCell align="right">Interest</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {result.google_trends_data.interest_by_region.slice(0, 10).map((region: any, idx: number) => {
                              const geoKey = Object.keys(region).find(k => k.includes('geo') || k.includes('name'));
                              const regionName = region.geoName || (geoKey ? region[geoKey] : null) || 'Unknown';
                              const value = Object.values(region).find(v => typeof v === 'number' && v !== null) as number || 0;
                              
                              return (
                                <TableRow key={idx}>
                                  <TableCell>{regionName}</TableCell>
                                  <TableCell align="right">
                                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                                      <Box
                                        sx={{
                                          width: 60,
                                          height: 8,
                                          backgroundColor: '#e5e7eb',
                                          borderRadius: 1,
                                          overflow: 'hidden',
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            width: `${value}%`,
                                            height: '100%',
                                            backgroundColor: '#10b981',
                                          }}
                                        />
                                      </Box>
                                      <Typography variant="body2" fontWeight={500}>
                                        {value}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Related Topics */}
                {(result.google_trends_data.related_topics.top.length > 0 || result.google_trends_data.related_topics.rising.length > 0) && (
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Related Topics
                      </Typography>
                      <Tabs 
                        value={topicsTabIndex} 
                        onChange={(_, newValue) => setTopicsTabIndex(newValue)}
                        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <Tab label={`Top (${result.google_trends_data.related_topics.top.length})`} />
                        <Tab label={`Rising (${result.google_trends_data.related_topics.rising.length})`} />
                      </Tabs>
                      {topicsTabIndex === 0 && (
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {result.google_trends_data.related_topics.top.slice(0, 15).map((topic: any, idx: number) => {
                            const topicTitle = topic.topic_title || topic.title || topic[Object.keys(topic)[0]] || 'Unknown';
                            const value = topic.value || '';
                            return (
                              <Chip
                                key={idx}
                                label={value ? `${topicTitle} (${value})` : topicTitle}
                                size="small"
                                sx={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}
                              />
                            );
                          })}
                        </Box>
                      )}
                      {topicsTabIndex === 1 && (
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {result.google_trends_data.related_topics.rising.slice(0, 15).map((topic: any, idx: number) => {
                            const topicTitle = topic.topic_title || topic.title || topic[Object.keys(topic)[0]] || 'Unknown';
                            const value = topic.value || '';
                            return (
                              <Chip
                                key={idx}
                                label={value ? `${topicTitle} (${value})` : topicTitle}
                                size="small"
                                icon={<ArrowUpIcon />}
                                sx={{ backgroundColor: '#dcfce7', color: '#166534' }}
                              />
                            );
                          })}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Related Queries */}
                {(result.google_trends_data.related_queries.top.length > 0 || result.google_trends_data.related_queries.rising.length > 0) && (
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SearchIcon fontSize="small" />
                        Related Queries
                      </Typography>
                      <Tabs 
                        value={queriesTabIndex} 
                        onChange={(_, newValue) => setQueriesTabIndex(newValue)}
                        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <Tab label={`Top (${result.google_trends_data.related_queries.top.length})`} />
                        <Tab label={`Rising (${result.google_trends_data.related_queries.rising.length})`} />
                      </Tabs>
                      {queriesTabIndex === 0 && (
                        <List dense>
                          {result.google_trends_data.related_queries.top.slice(0, 15).map((query: any, idx: number) => {
                            const queryText = query.query || query[Object.keys(query)[0]] || 'Unknown';
                            return (
                              <ListItem key={idx} sx={{ py: 0.5, '&:hover': { backgroundColor: '#f9fafb' } }}>
                                <ListItemText
                                  primary={queryText}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      )}
                      {queriesTabIndex === 1 && (
                        <List dense>
                          {result.google_trends_data.related_queries.rising.slice(0, 15).map((query: any, idx: number) => {
                            const queryText = query.query || query[Object.keys(query)[0]] || 'Unknown';
                            return (
                              <ListItem key={idx} sx={{ py: 0.5, '&:hover': { backgroundColor: '#f9fafb' } }}>
                                <ListItemIcon sx={{ minWidth: 24 }}>
                                  <ArrowUpIcon color="success" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={queryText}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            );
                          })}
                        </List>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}

            {/* AI-Extracted Trends */}
            {result.trends.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IdeaIcon color="primary" />
                  AI-Extracted Trends
                </Typography>
                <Grid container spacing={2}>
                  {result.trends.map((trend, idx) => (
                    <Grid item xs={12} md={6} key={idx}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <TrendIcon
                              color={trend.direction === 'growing' ? 'success' : trend.direction === 'declining' ? 'error' : 'info'}
                            />
                            <Typography variant="subtitle1" fontWeight={500}>
                              {trend.trend}
                            </Typography>
                            <Chip
                              size="small"
                              label={trend.direction}
                              color={trend.direction === 'growing' ? 'success' : trend.direction === 'declining' ? 'error' : 'info'}
                            />
                            {trend.interest_score !== undefined && (
                              <Chip
                                size="small"
                                label={`Interest: ${Math.round(trend.interest_score)}`}
                                sx={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                              />
                            )}
                          </Box>
                          {trend.impact && (
                            <Typography variant="body2" color="text.secondary" mb={1}>
                              Impact: {trend.impact}
                            </Typography>
                          )}
                          {trend.timeline && (
                            <Typography variant="caption" color="text.secondary">
                              Timeline: {trend.timeline}
                            </Typography>
                          )}
                          {trend.regional_interest && Object.keys(trend.regional_interest).length > 0 && (
                            <Box mt={1}>
                              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                Top Regions:
                              </Typography>
                              <Box display="flex" flexWrap="wrap" gap={0.5}>
                                {Object.entries(trend.regional_interest)
                                  .sort(([, a], [, b]) => b - a)
                                  .slice(0, 5)
                                  .map(([region, score]) => (
                                    <Chip
                                      key={region}
                                      label={`${region}: ${Math.round(score)}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  ))}
                              </Box>
                            </Box>
                          )}
                          <Box mt={1}>
                            <Typography variant="caption" color="text.secondary">Evidence:</Typography>
                            <List dense>
                              {trend.evidence.slice(0, 3).map((e, i) => (
                                <ListItem key={i} sx={{ py: 0, pl: 1 }}>
                                  <ListItemText primary={`• ${e}`} primaryTypographyProps={{ variant: 'caption' }} />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* No trends message */}
            {result.trends.length === 0 && !result.google_trends_data && (
              <Alert severity="info">
                No trends data available. Trends will appear here when your research includes trend analysis.
              </Alert>
            )}
          </Box>
        )}

        {/* Sources Tab */}
        {currentTab === 'sources' && (
          <List>
            {result.sources.map((source, idx) => (
              <ListItem
                key={idx}
                component="a"
                href={source.url}
                target="_blank"
                rel="noopener"
                sx={{ 
                  borderBottom: '1px solid', 
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <ListItemText
                  primary={source.title}
                  secondary={
                    <Box>
                      {source.excerpt && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {source.excerpt}
                        </Typography>
                      )}
                      <Box display="flex" gap={1} mt={0.5}>
                        {source.content_type && (
                          <Chip size="small" label={source.content_type} variant="outlined" />
                        )}
                        <Chip
                          size="small"
                          label={`${Math.round(source.relevance_score * 100)}% relevant`}
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`${Math.round(source.credibility_score * 100)}% credible`}
                          color={source.credibility_score > 0.8 ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  }
                />
                <OpenIcon color="action" />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {/* Gaps Identified */}
      {result.gaps_identified.length > 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Gaps Identified:
          </Typography>
          <List dense>
            {result.gaps_identified.map((gap, idx) => (
              <ListItem key={idx} sx={{ py: 0 }}>
                <ListItemText primary={`• ${gap}`} />
              </ListItem>
            ))}
          </List>
          {result.follow_up_queries.length > 0 && (
            <Box mt={1}>
              <Typography variant="caption" color="text.secondary">
                Suggested follow-up: {result.follow_up_queries.slice(0, 2).join(', ')}
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      {/* Confidence */}
      <Box mt={2} display="flex" justifyContent="flex-end">
        <Chip
          label={`Research confidence: ${Math.round(result.confidence * 100)}%`}
          color={result.confidence > 0.8 ? 'success' : result.confidence > 0.6 ? 'warning' : 'error'}
          variant="outlined"
        />
      </Box>
    </Box>
  );
};

export default IntentResultsDisplay;
