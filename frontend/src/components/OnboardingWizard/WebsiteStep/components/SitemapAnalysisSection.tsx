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
import {
  Map as MapIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Lightbulb as LightbulbIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <MapIcon color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6">
          Sitemap Analysis for {domainName}
        </Typography>
        <Tooltip title="The total count of indexable pages found. A higher count suggests more content authority, provided the quality is high.">
          <Chip 
            label={`${sitemapAnalysis.total_urls || 0} URLs Found`} 
            size="small" 
            color="primary" 
            variant="outlined" 
            sx={{ ml: 2, cursor: 'help' }} 
          />
        </Tooltip>
      </Box>

      {/* AI Insights Summary */}
      {ai_insights?.summary && (
        <Alert icon={<LightbulbIcon />} severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            AI Insight
          </Typography>
          <Typography variant="body2">
            {ai_insights.summary}
          </Typography>
        </Alert>
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
                  <Chip key={pattern} label={`${pattern}: ${count}`} size="small" />
                ))}
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
                  <Chip key={type} label={`${type}: ${count}`} size="small" variant="outlined" />
                ))}
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
                    {ai_insights?.content_gaps?.map((gap: string, idx: number) => (
                        <ListItem key={idx}>
                            <ListItemIcon><WarningIcon color="warning" fontSize="small" /></ListItemIcon>
                            <ListItemText primary={gap} />
                        </ListItem>
                    ))}
                </List>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Publishing Tab */}
        <TabPanel value={tabValue} index={2}>
          <Alert severity="info" sx={{ mb: 2, bgcolor: '#eff6ff', color: '#1e40af' }}>
             <Typography variant="subtitle2" fontWeight="bold">Historical Intelligence</Typography>
             <Typography variant="body2">
                We're currently analyzing your publishing cadence based on recent data. Long-term strategic intelligence will populate as the full site audit completes.
             </Typography>
          </Alert>
          <Grid container spacing={2}>
                <Grid item xs={12}>
                    <Box display="flex" alignItems="center" mb={1}>
                        <Typography variant="subtitle2">Strategic Recommendations</Typography>
                        <Tooltip title="AI-generated steps to optimize your crawl budget and improve content discovery.">
                            <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                        </Tooltip>
                    </Box>
                    <List dense>
                        {ai_insights?.strategic_recommendations?.map((rec: string, idx: number) => (
                            <ListItem key={idx}>
                                <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                                <ListItemText primary={rec} />
                            </ListItem>
                        ))}
                    </List>
                </Grid>
                {publishing_patterns && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Publishing Patterns</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {publishing_patterns.priority_distribution && Object.entries(publishing_patterns.priority_distribution).map(([k, v]) => (
                        <Chip key={k} size="small" label={`${k}: ${v}`} variant="outlined" />
                      ))}
                    </Box>
                  </Grid>
                )}
                {seo_recommendations && seo_recommendations.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>SEO Recommendations</Typography>
                    <List dense>
                      {seo_recommendations.map((rec: string, idx: number) => (
                        <ListItem key={idx}>
                          <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                          <ListItemText primary={rec} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                )}
            </Grid>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default SitemapAnalysisSection;
