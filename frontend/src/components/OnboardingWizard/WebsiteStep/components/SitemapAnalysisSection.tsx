import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  // Card,
  // CardContent,
  Chip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  // Divider,
  Alert,
  Paper,
  Tooltip,
  IconButton
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';

const safeStr = (val: any): string => {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(safeStr).join(', ');
  if (typeof val === 'object') return val.name || val.title || val.label || JSON.stringify(val).slice(0, 80);
  return String(val);
};

interface SitemapAnalysisSectionProps {
  sitemapAnalysis: any;
  domainName: string;
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
      id={`sitemap-tabpanel-${index}`}
      aria-labelledby={`sitemap-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SitemapAnalysisSection: React.FC<SitemapAnalysisSectionProps> = ({
  sitemapAnalysis,
  domainName
}) => {
  const [tabValue, setTabValue] = useState(0);

  if (!sitemapAnalysis) return null;

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const {
    structure_analysis,
    content_trends,
    publishing_patterns,
    ai_insights,
    seo_recommendations
  } = sitemapAnalysis;

  const fetchStats = (sitemapAnalysis as any).fetch_stats;

  return (
    <Box>
      {/* Compact header: title + subtitle + URL count in one row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapIcon color="primary" />
          <Typography variant="h6">
            Sitemap Analysis for {domainName}
          </Typography>
        </Box>
        <Tooltip title="The total count of indexable pages found. A higher count suggests more content authority, provided the quality is high.">
          <Chip
            label={`${sitemapAnalysis.total_urls || 0} URLs Found`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ cursor: 'help' }}
          />
        </Tooltip>
      </Box>
      {fetchStats && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1, mb: 2 }}>
          {fetchStats.urls_found} URLs collected
          {fetchStats.nested_fetched > 0 && ` · ${fetchStats.nested_fetched} sub-sitemaps fetched`}
          {fetchStats.nested_skipped > 0 && ` · ${fetchStats.nested_skipped} sub-sitemaps skipped`}
        </Typography>
      )}

      {/* AI Insights — structured cards */}
      {ai_insights && (
        <Paper variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LightbulbIcon color="primary" fontSize="small" /> AI Insights
          </Typography>
          {ai_insights.summary && (
            <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary', fontStyle: 'italic' }}>
              {ai_insights.summary.replace(/\*\*/g, '').replace(/## /g, '')}
            </Typography>
          )}
          <Grid container spacing={1.5}>
            {ai_insights.content_gaps && ai_insights.content_gaps.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Gaps</Typography>
                {ai_insights.content_gaps.slice(0, 3).map((g: any, i: number) => (
                  <Box key={i} sx={{ mt: 0.5, p: 0.75, bgcolor: '#faf5ff', borderRadius: 1, border: '1px solid #e9d5ff' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{safeStr(g.topic || g.action)}</Typography>
                      <Chip size="small" label={safeStr(g.priority || 'medium')} color={g.priority === 'high' ? 'error' : g.priority === 'low' ? 'default' : 'warning'} variant="outlined" />
                    </Box>
                    {g.keywords && <Typography variant="caption" color="text.secondary">Keywords: {safeStr(g.keywords)}</Typography>}
                    {g.impact && <Typography variant="caption" color="text.secondary">Impact: {safeStr(g.impact)}</Typography>}
                  </Box>
                ))}
              </Grid>
            )}
            {ai_insights.cannibalization && ai_insights.cannibalization.length > 0 && (
              <Grid item xs={12} md={6}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cannibalization</Typography>
                {ai_insights.cannibalization.slice(0, 3).map((c: any, i: number) => (
                  <Box key={i} sx={{ mt: 0.5, p: 0.75, bgcolor: '#fef2f2', borderRadius: 1, border: '1px solid #fecaca' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{safeStr(c.keyword)}</Typography>
                    <Typography variant="caption" color="text.secondary">{safeStr(c.overlapping_pages)} overlapping pages — {safeStr(c.recommendation)}</Typography>
                  </Box>
                ))}
              </Grid>
            )}
            {ai_insights.decay_alerts && ai_insights.decay_alerts.length > 0 && (
              <Grid item xs={12} md={6}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Decay</Typography>
                {ai_insights.decay_alerts.slice(0, 3).map((d: any, i: number) => (
                  <Box key={i} sx={{ mt: 0.5, p: 0.75, bgcolor: '#fffbeb', borderRadius: 1, border: '1px solid #fde68a' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{safeStr(d.signal || d.category)}</Typography>
                    <Typography variant="caption" color="text.secondary">{safeStr(d.action)}</Typography>
                  </Box>
                ))}
              </Grid>
            )}
            {ai_insights.publishing_calendar && ai_insights.publishing_calendar.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Publishing Calendar</Typography>
                <Box sx={{ mt: 0.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {ai_insights.publishing_calendar.slice(0, 6).map((pc: any, i: number) => (
                    <Chip key={i} size="small" label={`W${safeStr(pc.week)}: ${safeStr(pc.topic || pc.content_type)}`} variant="outlined" color={pc.priority === 'high' ? 'success' : 'default'} />
                  ))}
                </Box>
              </Grid>
            )}
            {ai_insights.seo_opportunities && ai_insights.seo_opportunities.length > 0 && (
              <Grid item xs={12} md={6}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SEO Opportunities</Typography>
                {ai_insights.seo_opportunities.slice(0, 3).map((s: any, i: number) => (
                  <Box key={i} sx={{ mt: 0.5, p: 0.75, bgcolor: '#eff6ff', borderRadius: 1, border: '1px solid #bfdbfe' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip size="small" label={safeStr(s.type)} variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                      <Chip size="small" label={safeStr(s.impact)} color={s.impact === 'high' ? 'error' : 'default'} variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 600 }}>{safeStr(s.finding || s.action)}</Typography>
                  </Box>
                ))}
              </Grid>
            )}
            {ai_insights.internal_linking && ai_insights.internal_linking.length > 0 && (
              <Grid item xs={12} md={6}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Internal Linking</Typography>
                {ai_insights.internal_linking.slice(0, 3).map((l: any, i: number) => (
                  <Box key={i} sx={{ mt: 0.5, p: 0.75, bgcolor: '#ecfeff', borderRadius: 1, border: '1px solid #a5f3fc' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{safeStr(l.from_section)} → {safeStr(l.to_section)}</Typography>
                    <Typography variant="caption" color="text.secondary">Anchor: "{safeStr(l.anchor_label)}" — {safeStr(l.reason)}</Typography>
                  </Box>
                ))}
              </Grid>
            )}
            {(ai_insights.growth_recommendations?.length > 0 || ai_insights.content_strategy?.length > 0) && (
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommendations</Typography>
                <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {ai_insights.growth_recommendations?.slice(0, 3).map((r: string, i: number) => (
                    <Typography key={`g${i}`} variant="caption">• {r}</Typography>
                  ))}
                  {ai_insights.content_strategy?.slice(0, 3).map((r: string, i: number) => (
                    <Typography key={`c${i}`} variant="caption">• {r}</Typography>
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="sitemap analysis tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<MapIcon fontSize="small" />} iconPosition="start" label={
            <Tooltip title="Analyze your site's architecture. A flat, logical structure helps search engines crawl efficiently and users find content.">
              <Box>Structure</Box>
            </Tooltip>
          } />
          <Tab icon={<TrendingUpIcon fontSize="small" />} iconPosition="start" label={
            <Tooltip title="Discover what topics you cover most and where you might have gaps compared to competitors.">
              <Box>Content Trends</Box>
            </Tooltip>
          } />
          <Tab icon={<ScheduleIcon fontSize="small" />} iconPosition="start" label={
            <Tooltip title="Understand your content velocity. Consistent publishing is a key signal for search engine freshness.">
              <Box>Publishing</Box>
            </Tooltip>
          } />
        </Tabs>

        {/* Structure Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" mb={1}>
                <Typography variant="subtitle2">URL Patterns</Typography>
                <Tooltip title="Consistent URL structures (e.g., /blog/, /product/) help search engines categorize your content type.">
                  <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(structure_analysis?.url_patterns || {}).map(([pattern, count]: [string, any]) => (
                  <Chip
                    key={pattern}
                    label={`${pattern}: ${count}`}
                    size="small"
                    sx={{
                      bgcolor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#1e293b !important',
                      fontWeight: 500,
                      '& .MuiChip-label': { color: '#1e293b !important' },
                    }}
                  />
                ))}
                {Object.keys(structure_analysis?.url_patterns || {}).length === 0 && (
                  <Typography variant="caption" color="text.secondary">No URL patterns detected</Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" mb={1}>
                <Typography variant="subtitle2">File Types</Typography>
                <Tooltip title="Ensure your sitemap primarily contains indexable HTML pages. Too many PDFs or images here might dilute ranking signals.">
                  <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(structure_analysis?.file_types || {}).map(([type, count]: [string, any]) => (
                  <Chip
                    key={type}
                    label={`${type}: ${count}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      bgcolor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#1e293b !important',
                      fontWeight: 500,
                      '& .MuiChip-label': { color: '#1e293b !important' },
                    }}
                  />
                ))}
                {Object.keys(structure_analysis?.file_types || {}).length === 0 && (
                  <Typography variant="caption" color="text.secondary">No file types detected</Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12}>
                <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Structure Quality</Typography>
                    <Tooltip title="Depth refers to clicks from the home page. Pages deeper than 3 clicks are harder for users and bots to find.">
                        <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                    </Tooltip>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Average Path Depth: {structure_analysis?.average_path_depth}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Max Path Depth: {structure_analysis?.max_path_depth}
                </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Content Trends Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Publishing Velocity</Typography>
                    <Tooltip title="Your content cadence. High velocity with high quality signals authority. Consistency matters more than bursts.">
                        <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                    </Tooltip>
                </Box>
                <Typography variant="h4" color="primary">
                    {content_trends?.publishing_velocity}
                    <Typography variant="caption" component="span" sx={{ ml: 1 }}>
                        pages/day
                    </Typography>
                </Typography>
            </Grid>
            <Grid item xs={12}>
                <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="subtitle2">Content Gaps (AI)</Typography>
                    <Tooltip title="Critical topics your competitors cover that you don't. Filling these gaps is the fastest way to improve topical authority.">
                        <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                    </Tooltip>
                </Box>
                <List dense>
                    {ai_insights?.content_gaps?.map((gap: any, idx: number) => (
                        <ListItem key={idx} alignItems="flex-start" sx={{ px: 0, py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 28 }}>
                                <WarningIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Box>
                                        <Typography variant="body2" fontWeight={600}>
                                            {gap.topic || gap.action || `Gap ${idx + 1}`}
                                        </Typography>
                                        {gap.keywords && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Keywords: {Array.isArray(gap.keywords) ? gap.keywords.join(', ') : String(gap.keywords)}
                                            </Typography>
                                        )}
                                        {gap.impact && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Impact: {String(gap.impact)}
                                            </Typography>
                                        )}
                                    </Box>
                                }
                                secondary={gap.recommendation || gap.rationale || null}
                            />
                            {gap.priority && (
                                <Chip
                                    size="small"
                                    label={String(gap.priority)}
                                    color={gap.priority === 'high' ? 'error' : gap.priority === 'low' ? 'default' : 'warning'}
                                    variant="outlined"
                                    sx={{ ml: 1, flexShrink: 0 }}
                                />
                            )}
                        </ListItem>
                    ))}
                    {(!ai_insights?.content_gaps || ai_insights.content_gaps.length === 0) && (
                        <Typography variant="caption" color="text.secondary">No content gaps detected</Typography>
                    )}
                </List>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Publishing Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={2}>
            {content_trends?.date_range && (
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">Publishing History</Typography>
                  <Tooltip title="Date range and cadence derived from sitemap lastmod entries.">
                    <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Earliest: {content_trends.date_range.earliest?.split('T')[0]}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Latest: {content_trends.date_range.latest?.split('T')[0]}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Span: {content_trends.date_range.span_days} days · {content_trends.total_dated_urls} dated URLs
                </Typography>
              </Grid>
            )}
            {publishing_patterns?.changefreq_distribution && Object.keys(publishing_patterns.changefreq_distribution).length > 0 && (
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">Change Frequency</Typography>
                  <Tooltip title="How often sitemap URLs claim to be updated.">
                    <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(publishing_patterns.changefreq_distribution).map(([freq, count]: [string, any]) => (
                    <Chip
                      key={freq}
                      size="small"
                      label={`${freq}: ${count}`}
                      sx={{
                        bgcolor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#1e293b !important',
                        fontWeight: 500,
                        '& .MuiChip-label': { color: '#1e293b !important' },
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            )}
            {publishing_patterns?.priority_distribution && Object.keys(publishing_patterns.priority_distribution).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Priority Distribution</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(publishing_patterns.priority_distribution).map(([k, v]) => (
                    <Chip
                      key={k}
                      size="small"
                      label={`${k}: ${v}`}
                      sx={{
                        bgcolor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#1e293b !important',
                        fontWeight: 500,
                        '& .MuiChip-label': { color: '#1e293b !important' },
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            )}
            {content_trends?.monthly_distribution && Object.keys(content_trends.monthly_distribution).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Monthly Distribution</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(content_trends.monthly_distribution).map(([month, count]: [string, any]) => (
                    <Chip
                      key={month}
                      size="small"
                      label={`${month}: ${count}`}
                      variant="outlined"
                      sx={{
                        bgcolor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#1e293b !important',
                        fontWeight: 500,
                        '& .MuiChip-label': { color: '#1e293b !important' },
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            )}
            {publishing_patterns?.optimization_opportunities && publishing_patterns.optimization_opportunities.length > 0 && (
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">Optimization Opportunities</Typography>
                  <Tooltip title="AI-generated steps to optimize your crawl budget and improve content discovery.">
                    <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Box>
                <List dense>
                  {publishing_patterns.optimization_opportunities.map((rec: any, idx: number) => (
                    <ListItem key={idx}>
                      <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary={safeStr(rec)} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}
            {seo_recommendations && seo_recommendations.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>SEO Recommendations</Typography>
                <List dense>
                  {seo_recommendations.map((rec: any, idx: number) => (
                    <ListItem key={idx}>
                      <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary={safeStr(rec)} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}
            {!publishing_patterns?.changefreq_distribution && !content_trends?.date_range && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ bgcolor: '#eff6ff', color: '#1e40af' }}>
                  <Typography variant="subtitle2" fontWeight="bold">Historical Intelligence</Typography>
                  <Typography variant="body2">
                    We're currently analyzing your publishing cadence based on recent data. Long-term strategic intelligence will populate as the full site audit completes.
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default SitemapAnalysisSection;
