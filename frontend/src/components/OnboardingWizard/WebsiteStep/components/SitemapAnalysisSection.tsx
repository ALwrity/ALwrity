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

const renderMarkdown = (md: string): React.ReactNode[] => {
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    // Headers
    if (line.startsWith('## ')) {
      nodes.push(<Typography key={i} variant="subtitle2" sx={{ fontWeight: 600, mt: 1, mb: 0.5 }}>{line.replace(/^## /, '')}</Typography>);
      i++; continue;
    }
    // Table: header row followed by separator then data rows
    if (line.startsWith('|') && i + 2 < lines.length && lines[i + 1]?.trim().startsWith('|')) {
      const headerRow = line.split('|').filter(c => c.trim());
      const dataRows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        dataRows.push(lines[j].split('|').filter(c => c.trim()));
        j++;
      }
      nodes.push(
        <Box key={i} className="md-table" sx={{ mb: 1 }}>
          <Box className="md-table-header">
            {headerRow.map((h, hi) => (
              <Box key={hi} className="md-cell">{(h || '').replace(/\*\*(.+?)\*\*/g, '$1')}</Box>
            ))}
          </Box>
          {dataRows.map((row, ri) => (
            <Box key={ri} className="md-table-row">
              {row.map((cell, ci) => (
                <Box key={ci} className="md-cell">{(cell || '').replace(/\*\*(.+?)\*\*/g, '$1')}</Box>
              ))}
            </Box>
          ))}
        </Box>
      );
      i = j;
      continue;
    }
    // Regular text with bold
    nodes.push(
      <Typography key={i} variant="body2" sx={{ mb: 0.25 }}>
        {line.split(/(\*\*[^*]+\*\*)/g).map((part, pi) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={pi}>{part.slice(2, -2)}</strong>
            : part
        )}
      </Typography>
    );
    i++;
  }
  return nodes;
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
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            AI Insight
          </Typography>
          <Box sx={{ 
            fontSize: '0.8125rem', lineHeight: 1.6,
            maxHeight: '450px', overflowY: 'auto',
            '& .md-table': { border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden', mb: 0.5 },
            '& .md-table-header': { display: 'flex', bgcolor: '#f0f4f8', borderBottom: '2px solid #cbd5e1', px: 1, py: 0.75, fontWeight: 700, fontSize: '0.75rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' },
            '& .md-table-row': { display: 'flex', px: 1, py: 0.6, borderBottom: '1px solid #f1f5f9', fontSize: '0.78125rem' },
            '& .md-table-row:last-child': { borderBottom: 'none' },
            '& .md-table-row:nth-of-type(odd)': { bgcolor: '#f8fafc' },
            '& .md-cell': { flex: 1, px: 0.75 },
            '& .md-cell:first-child': { fontWeight: 600 },
          }}>
            {renderMarkdown(ai_insights.summary)}
          </Box>
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
