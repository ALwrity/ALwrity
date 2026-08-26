import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Chip,
  Card,
  CardContent,
  Tooltip,
  useTheme,
  Alert,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';
import DescriptionIcon from '@mui/icons-material/Description';
import TreeIcon from '@mui/icons-material/AccountTree';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CheckIcon from '@mui/icons-material/CheckCircle';

export interface BenchmarkMetrics {
  total_urls: number;
  publishing_velocity: number;
  average_path_depth: number;
  max_path_depth: number;
  top_url_patterns: Record<string, number>;
  file_types: Record<string, number>;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface Opportunity {
  type: string;
  title: string;
  items?: Array<{
    section: string;
    competitor_presence: number;
    competitor_url_count: number;
  }>;
  metrics?: Record<string, number>;
}

export interface BenchmarkData {
  user?: {
    summary: BenchmarkMetrics;
    error?: string;
  };
  competitors?: {
    summaries: Record<string, BenchmarkMetrics>;
    errors?: Record<string, string>;
  };
  // Support for potential flat structure (legacy or different service versions)
  user_summary?: BenchmarkMetrics;
  competitor_summaries?: Record<string, BenchmarkMetrics>;
  
  timestamp?: string;
  benchmark?: {
    website_url?: string;
    competitors_analyzed?: number;
    user_sections_count?: number;
    competitor_section_leaders?: Array<{
      competitor_url: string;
      total_urls: number;
      sections_count: number;
      publishing_velocity: number;
      average_path_depth?: number;
      lastmod_coverage?: number;
    }>;
    gaps?: {
      missing_sections?: Array<{
        section: string;
        competitor_presence: number;
        competitor_url_count: number;
      }>;
    };
    opportunities?: Array<Opportunity>;
    gaps_vs_competitors?: {
      missing_sections?: Array<{
        section: string;
        competitor_url_count: number;
        competitor_presence?: number;
      }>;
    };
    keyword_hints?: Array<{
      keyword: string;
      seen_in_url_patterns: boolean;
    }>;
  };
}

export interface Props {
  data: BenchmarkData;
}

export const SitemapBenchmarkResults: React.FC<Props> = ({ data }) => {
  const theme = useTheme();
  const { benchmark } = data;
  
  // Handle data mapping from potentially nested structure
  const user_summary = data.user_summary || data.user?.summary || {} as BenchmarkMetrics;
  const competitor_summaries = data.competitor_summaries || data.competitors?.summaries || {};
  const competitor_errors = data.competitors?.errors || {};
  const user_error = data.user?.error;

  // Calculate competitor averages
  const competitorUrls = Object.keys(competitor_summaries || {});
  const avgCompetitorUrls = competitorUrls.length > 0
    ? Math.round(competitorUrls.reduce((acc, url) => acc + (competitor_summaries[url]?.total_urls || 0), 0) / competitorUrls.length)
    : 0;

  const avgCompetitorVelocity = competitorUrls.length > 0
    ? parseFloat((competitorUrls.reduce((acc, url) => acc + (competitor_summaries[url]?.publishing_velocity || 0), 0) / competitorUrls.length).toFixed(2))
    : 0;

  const avgCompetitorDepth = competitorUrls.length > 0
    ? parseFloat((competitorUrls.reduce((acc, url) => acc + (competitor_summaries[url]?.average_path_depth || 0), 0) / competitorUrls.length).toFixed(2))
    : 0;

  const MetricCard = ({ title, userValue, competitorValue, icon, unit = '', description }: any) => {
    // const isBelowAvg = userValue < competitorValue;
    
    return (
      <Card 
        elevation={0}
        sx={{  
          height: '100%', 
          border: `1px solid #e2e8f0`,
          borderRadius: 3,
          bgcolor: '#f8fafc',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            bgcolor: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: theme.palette.primary.main + '10', color: theme.palette.primary.main, mr: 1.5, display: 'flex' }}>
                {icon}
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569' }}>
                {title}
              </Typography>
            </Box>
            <Tooltip title={description} arrow placement="top">
              <Box sx={{ cursor: 'help', color: '#94a3b8', display: 'flex' }}>
                <LightbulbIcon sx={{ fontSize: 18 }} />
              </Box>
            </Tooltip>
          </Box>
          
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b', mb: 0.5 }}>
              {userValue}{unit}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Site
            </Typography>
          </Box>

          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            pt: 2, 
            borderTop: `1px dashed #e2e8f0` 
          }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155' }}>
                {competitorValue}{unit}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Competitor Avg
              </Typography>
            </Box>
            <Chip 
              label={userValue >= competitorValue ? 'Above Avg' : 'Below Avg'} 
              size="small"
              sx={{ 
                height: 24,
                fontSize: '0.7rem',
                fontWeight: 700,
                bgcolor: userValue >= competitorValue ? '#ecfdf5' : '#fff7ed',
                color: userValue >= competitorValue ? '#059669' : '#c2410c',
                border: `1px solid ${userValue >= competitorValue ? '#a7f3d0' : '#ffedd5'}`,
                borderRadius: 1.5
              }}
            />
          </Box>
        </CardContent>
      </Card>
    );
  };

  const metricDescriptions = {
    volume: "Total number of indexed pages discovered in your sitemap compared to the average of your top competitors.",
    velocity: "Average number of new pages published per week, indicating how active the content strategy is.",
    depth: "Average number of clicks required to reach content from the homepage based on URL structure."
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <TrendingUpIcon sx={{ color: theme.palette.primary.main, fontSize: 28 }} /> 
          Benchmark Analysis
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748b' }}>
          Comparison based on <strong>{competitorUrls.length}</strong> competitor sitemaps.
        </Typography>
      </Box>

      {/* Main Metrics Row with Errors */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {/* Errors Area A (if exists) */}
        {(user_error || Object.keys(competitor_errors).length > 0) ? (
          <Grid item xs={12}>
            <Grid container spacing={3}>
              <Grid item xs={12} lg={4}>
                <Box sx={{ height: '100%' }}>
                  {user_error && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 3, border: '1px solid #fee2e2' }}>
                      <Typography variant="subtitle2" fontWeight="bold">User Sitemap Error:</Typography>
                      {user_error}
                    </Alert>
                  )}
                  {Object.keys(competitor_errors).length > 0 && (
                    <Alert 
                      severity="warning" 
                      sx={{ 
                        height: '100%',
                        borderRadius: 3, 
                        border: '1px solid #ffedd5',
                        bgcolor: '#fffaf5',
                        '& .MuiAlert-message': { width: '100%' }
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#9a3412' }}>
                        {Object.keys(competitor_errors).length} competitors could not be analyzed:
                      </Typography>
                      <Box sx={{ maxHeight: 150, overflowY: 'auto', pr: 1 }}>
                        <List dense disablePadding>
                          {Object.entries(competitor_errors).map(([url, error]) => (
                            <ListItem key={url} disablePadding sx={{ py: 0.5 }}>
                               <ListItemText 
                                  primary={url.replace('https://', '').replace('www.', '')} 
                                  secondary={String(error)} 
                                  primaryTypographyProps={{ variant: 'caption', fontWeight: 700, color: '#c2410c' }}
                                  secondaryTypographyProps={{ variant: 'caption', color: '#9a3412' }}
                                  sx={{ m: 0 }}
                               />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    </Alert>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} lg={8}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <MetricCard 
                      title="Content Volume" 
                      userValue={user_summary.total_urls || 0}
                      competitorValue={avgCompetitorUrls}
                      icon={<DescriptionIcon />}
                      description={metricDescriptions.volume}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <MetricCard 
                      title="Publishing Velocity" 
                      userValue={user_summary.publishing_velocity ? parseFloat(user_summary.publishing_velocity.toFixed(2)) : 0}
                      competitorValue={avgCompetitorVelocity}
                      icon={<SpeedIcon />}
                      unit=" /wk"
                      description={metricDescriptions.velocity}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <MetricCard 
                      title="Structure Depth" 
                      userValue={user_summary.average_path_depth ? parseFloat(user_summary.average_path_depth.toFixed(2)) : 0}
                      competitorValue={avgCompetitorDepth}
                      icon={<TreeIcon />}
                      unit=" clicks"
                      description={metricDescriptions.depth}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        ) : (
          <>
            <Grid item xs={12} md={4}>
              <MetricCard 
                title="Content Volume" 
                userValue={user_summary.total_urls || 0}
                competitorValue={avgCompetitorUrls}
                icon={<DescriptionIcon />}
                description={metricDescriptions.volume}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <MetricCard 
                title="Publishing Velocity" 
                userValue={user_summary.publishing_velocity ? parseFloat(user_summary.publishing_velocity.toFixed(2)) : 0}
                competitorValue={avgCompetitorVelocity}
                icon={<SpeedIcon />}
                unit=" /wk"
                description={metricDescriptions.velocity}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <MetricCard 
                title="Structure Depth" 
                userValue={user_summary.average_path_depth ? parseFloat(user_summary.average_path_depth.toFixed(2)) : 0}
                competitorValue={avgCompetitorDepth}
                icon={<TreeIcon />}
                unit=" clicks"
                description={metricDescriptions.depth}
              />
            </Grid>
          </>
        )}
      </Grid>

      {/* Industry Benchmarks Section */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LightbulbIcon sx={{ color: '#f59e0b' }} />
          Industry Benchmarks
        </Typography>

        <Paper 
          elevation={0} 
          sx={{ 
            p: 4, 
            borderRadius: 4, 
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff'
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3, color: '#334155' }}>
            Common competitor sections you may be missing
          </Typography>
          
          {(benchmark?.gaps?.missing_sections || benchmark?.gaps_vs_competitors?.missing_sections) && 
           (benchmark?.gaps?.missing_sections || benchmark?.gaps_vs_competitors?.missing_sections || []).length > 0 ? (
            <Grid container spacing={2}>
              {(benchmark?.gaps?.missing_sections || benchmark?.gaps_vs_competitors?.missing_sections || []).map((gap: any, index: number) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Box 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: '#f1f5f9', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CheckIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569', textTransform: 'capitalize' }}>
                        /{gap.section}
                      </Typography>
                    </Box>
                    <Tooltip title={`${gap.competitor_count || Math.round((gap.competitor_presence || 0) * competitorUrls.length)} out of ${competitorUrls.length} competitors have this section.`}>
                      <Chip 
                        label={`${Math.round((gap.competitor_presence || 0) * 100)}% Presence`}
                        size="small"
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#e2e8f0', color: '#64748b' }}
                      />
                    </Tooltip>
                  </Box>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 3, border: '1px dashed #e2e8f0' }}>
              <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 500 }}>
                No significant content gaps identified compared to your competitors.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Actionable Insights */}
      {benchmark?.opportunities && benchmark.opportunities.length > 0 && (
        <Box sx={{ mb: 6 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LightbulbIcon sx={{ color: '#f59e0b' }} />
            Strategic Insights
          </Typography>
          <Grid container spacing={2}>
            {benchmark.opportunities.map((opp: any, index: number) => (
              <Grid item xs={12} md={6} key={index}>
                <Paper 
                  elevation={0}
                  sx={{ 
                    p: 3, 
                    height: '100%', 
                    bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 3,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                    <Box sx={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: '50%', 
                      bgcolor: theme.palette.primary.main + '20',
                      color: theme.palette.primary.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.2
                    }}>
                      <Typography variant="caption" sx={{ fontWeight: 900 }}>!</Typography>
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: '#334155', lineHeight: 1.4 }}>
                      {opp.title}
                    </Typography>
                  </Box>
                  {opp.metrics && (
                    <Box sx={{ ml: 5, mt: 'auto', pt: 2, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {Object.entries(opp.metrics).map(([key, value]) => (
                        <Box key={key} sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
                          <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {(() => {
                              if (key.startsWith('user_')) {
                                return 'Your ' + key.replace('user_', '').replace(/_/g, ' ');
                              }
                              if (key.includes('competitor_median_')) {
                                return 'Competitor Avg ' + key.replace('competitor_median_', '').replace(/_/g, ' ');
                              }
                              return key.replace(/_/g, ' ');
                            })()}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569' }}>
                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Competitor Leaders Table */}
      {benchmark?.competitor_section_leaders && benchmark.competitor_section_leaders.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: '#1e293b' }}>
            <DescriptionIcon color="info" fontSize="small" />
            Top Competitor Stats
          </Typography>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Competitor</TableCell>
                  <Tooltip title="Total number of pages found in the sitemap" arrow>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'help' }}>Total URLs</TableCell>
                  </Tooltip>
                  <Tooltip title="Number of distinct URL path sections (e.g., /blog/, /products/)" arrow>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'help' }}>Sections</TableCell>
                  </Tooltip>
                  <Tooltip title="Average new pages published per week" arrow>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'help' }}>Velocity/wk</TableCell>
                  </Tooltip>
                  <Tooltip title="Average URL path depth (clicks from root)" arrow>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'help' }}>Avg Depth</TableCell>
                  </Tooltip>
                  <Tooltip title="Percentage of URLs with valid last-modified dates" arrow>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'help' }}>Date Coverage</TableCell>
                  </Tooltip>
                </TableRow>
              </TableHead>
              <TableBody>
                {benchmark.competitor_section_leaders.map((comp, idx) => (
                  <TableRow key={idx} sx={{ bgcolor: '#ffffff', '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#334155' }}>
                      <Tooltip title={comp.competitor_url}>
                        <span>{new URL(comp.competitor_url).hostname}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#475569' }}>{comp.total_urls}</TableCell>
                    <TableCell align="right" sx={{ color: '#475569' }}>{comp.sections_count}</TableCell>
                    <TableCell align="right" sx={{ color: '#475569' }}>{comp.publishing_velocity?.toFixed(1) || '-'}</TableCell>
                    <TableCell align="right" sx={{ color: '#475569' }}>{comp.average_path_depth?.toFixed(1) || '-'}</TableCell>
                    <TableCell align="right" sx={{ color: '#475569' }}>
                      {comp.lastmod_coverage ? `${(comp.lastmod_coverage * 100).toFixed(0)}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Competitor Content Strategy Patterns (formerly Content Gaps) */}
      {((benchmark?.gaps_vs_competitors?.missing_sections && benchmark.gaps_vs_competitors.missing_sections.length > 0) || 
        (benchmark?.gaps?.missing_sections && benchmark.gaps.missing_sections.length > 0)) && (
        <Box sx={{ mb: 4 }}>
           <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: '#0f172a' }}>
            <TrendingUpIcon color="primary" fontSize="small" />
            Competitor Content Strategy Patterns
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: '800px' }}>
            The following content categories appear frequently across your competitors' websites but are missing from yours. 
            Consider creating content in these areas to capture similar traffic and improve your competitive positioning.
          </Typography>
          <Grid container spacing={2}>
            {(benchmark?.gaps?.missing_sections || benchmark?.gaps_vs_competitors?.missing_sections || [])
              .filter((gap: any) => gap.section && gap.section.length > 3) // Filter out short sections like language codes (/es, /fr)
              .map((gap: any, index: number) => {
                // Fix for "200% Presence" bug: normalize values
                let presence = gap.competitor_presence || 0;
                // If presence > 1, it's likely a raw count, so normalize it
                if (presence > 1) {
                  presence = presence / (competitorUrls.length || 1);
                }
                const percentage = Math.min(Math.round(presence * 100), 100);
                const count = gap.competitor_count || Math.round(presence * competitorUrls.length);
                
                return (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#1e293b' }}>
                            {gap.section}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                            Used by {count} of {competitorUrls.length} competitors
                        </Typography>
                      </Box>
                      <Tooltip title={`${percentage}% of your competitors have this section`}>
                        <Chip 
                          label={`${percentage}% Match`} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                          sx={{ fontWeight: 700, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }} 
                        />
                      </Tooltip>
                    </Paper>
                  </Grid>
                );
            })}
          </Grid>
        </Box>
      )}

      {benchmark?.keyword_hints && benchmark.keyword_hints.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LightbulbIcon color="warning" fontSize="small" />
            Keyword Opportunities (from URL patterns)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {benchmark.keyword_hints.map((hint, index) => (
              <Chip
                key={index}
                label={hint.keyword}
                color={hint.seen_in_url_patterns ? "success" : "default"}
                variant={hint.seen_in_url_patterns ? "filled" : "outlined"}
                icon={hint.seen_in_url_patterns ? <CheckIcon fontSize="small" /> : undefined}
                sx={{ borderColor: theme.palette.divider }}
              />
            ))}
          </Box>
        </Box>
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Website</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>Total Pages</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>Velocity (posts/week)</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>Avg Depth</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#1e293b' }}>Top Category</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* User Row */}
            <TableRow sx={{ bgcolor: theme.palette.primary.main + '08', '& td, & th': { borderBottom: '1px solid #e2e8f0' } }}>
              <TableCell component="th" scope="row">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={700} color="primary.main">Your Website</Typography>
                  <Chip label="You" size="small" color="primary" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>{user_summary.total_urls}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>{user_summary.publishing_velocity?.toFixed(2) || '0.00'}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>{user_summary.average_path_depth?.toFixed(2) || '0.00'}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>
                {Object.keys(user_summary.top_url_patterns || {})[0] || '-'}
              </TableCell>
            </TableRow>

            {/* Competitor Rows */}
            {competitorUrls.map((url, idx) => {
              const data = competitor_summaries[url];
              const domain = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
              return (
                <TableRow key={url} sx={{ bgcolor: '#ffffff', '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row" sx={{ color: '#475569', fontWeight: 500 }}>
                    {domain}
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#64748b' }}>{data?.total_urls || 0}</TableCell>
                  <TableCell align="right" sx={{ color: '#64748b' }}>{data?.publishing_velocity?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell align="right" sx={{ color: '#64748b' }}>{data?.average_path_depth?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell align="right" sx={{ color: '#64748b' }}>
                    {Object.keys(data?.top_url_patterns || {})[0] || '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

};
