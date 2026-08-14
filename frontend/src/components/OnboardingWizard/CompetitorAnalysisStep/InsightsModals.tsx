import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Lightbulb as LightbulbIcon,
  Search as SearchIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

function safeText(item: any): string {
  if (typeof item === 'string') return item;
  if (typeof item?.action === 'string') return item.action;
  if (typeof item?.finding === 'string') return item.finding;
  if (typeof item?.type === 'string') return item.type;
  if (typeof item?.title === 'string') return item.title;
  return JSON.stringify(item);
}

interface InsightsModalsProps {
  sitemapAnalysis: any;
  showBenchmarks: boolean;
  showStrategy: boolean;
  showPublishing: boolean;
  showStructure: boolean;
  onCloseBenchmarks: () => void;
  onCloseStrategy: () => void;
  onClosePublishing: () => void;
  onCloseStructure: () => void;
}

export const InsightsModals: React.FC<InsightsModalsProps> = ({
  sitemapAnalysis,
  showBenchmarks,
  showStrategy,
  showPublishing,
  showStructure,
  onCloseBenchmarks,
  onCloseStrategy,
  onClosePublishing,
  onCloseStructure,
}) => {
  return (
    <>
      {/* Industry Benchmarks Modal */}
      <Dialog open={showBenchmarks} onClose={onCloseBenchmarks} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2, bgcolor: '#ffffff' } }}>
        <DialogTitle sx={{ pb: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="span" fontWeight={700} sx={{ color: '#0f172a' }}>Industry Benchmarks</Typography>
          <IconButton size="small" onClick={onCloseBenchmarks} aria-label="close" sx={{ color: '#64748b' }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, bgcolor: '#ffffff' }}>
          {sitemapAnalysis?.analysis_data?.onboarding_insights?.industry_benchmarks?.map((benchmark: any, i: number) => {
            const text = typeof benchmark === 'string' ? benchmark : benchmark?.finding || benchmark?.title || JSON.stringify(benchmark);
            return (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: '#f8fafc', borderColor: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#94a3b8', flexShrink: 0 }} />
              <Typography variant="body2" color="#334155">{text}</Typography>
            </Paper>
          )})}
        </DialogContent>
      </Dialog>

      {/* Content Strategy & SEO Modal */}
      <Dialog open={showStrategy} onClose={onCloseStrategy} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2, bgcolor: '#ffffff' } }}>
        <DialogTitle sx={{ pb: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="span" fontWeight={700} sx={{ color: '#0f172a' }}>Content Strategy & SEO Insights</Typography>
          <IconButton size="small" onClick={onCloseStrategy} aria-label="close" sx={{ color: '#64748b' }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, bgcolor: '#ffffff' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
            Actionable recommendations from AI analysis of your site structure and competitor landscape.
          </Typography>
          {sitemapAnalysis?.analysis_data?.ai_insights?.content_strategy?.length > 0 && (
            <Box mb={2}>
              <Typography variant="subtitle2" fontWeight={600} color="#0c4a6e" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LightbulbIcon sx={{ fontSize: 16, color: '#f59e0b' }} /> Content Strategy
              </Typography>
              <List dense disablePadding>
                {sitemapAnalysis.analysis_data.ai_insights.content_strategy.map((item: any, i: number) => {
                  const text = safeText(item);
                  return (
                  <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#94a3b8' }} /></ListItemIcon>
                    <ListItemText primary={text} primaryTypographyProps={{ variant: 'body2', color: '#334155' }} />
                  </ListItem>
                )})}
              </List>
            </Box>
          )}
          {sitemapAnalysis?.analysis_data?.ai_insights?.seo_opportunities?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="#0c4a6e" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SearchIcon sx={{ fontSize: 16, color: '#0284c7' }} /> SEO Opportunities
              </Typography>
              <List dense disablePadding>
                {sitemapAnalysis.analysis_data.ai_insights.seo_opportunities.map((item: any, i: number) => {
                  const text = safeText(item);
                  return (
                  <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#94a3b8' }} /></ListItemIcon>
                    <ListItemText primary={text} primaryTypographyProps={{ variant: 'body2', color: '#334155' }} />
                  </ListItem>
                )})}
              </List>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Publishing Patterns Modal */}
      <Dialog open={showPublishing} onClose={onClosePublishing} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2, bgcolor: '#ffffff' } }}>
        <DialogTitle sx={{ pb: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="span" fontWeight={700} sx={{ color: '#0f172a' }}>Publishing Patterns &amp; Trends</Typography>
          <IconButton size="small" onClick={onClosePublishing} aria-label="close" sx={{ color: '#64748b' }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, bgcolor: '#ffffff' }}>
          <Typography variant="body2" sx={{ mb: 2.5, color: '#475569', fontSize: '0.85rem' }}>
            How often you publish, when content was created, and optimization opportunities found in your sitemap.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
            {sitemapAnalysis?.analysis_data?.content_trends?.publishing_velocity != null && (
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 140, p: 2, textAlign: 'center', bgcolor: '#f0f9ff', borderColor: '#bae6fd' }}>
                <Typography variant="h4" sx={{ color: '#0369a1', fontWeight: 700 }}>
                  {typeof sitemapAnalysis.analysis_data.content_trends.publishing_velocity === 'number'
                    ? sitemapAnalysis.analysis_data.content_trends.publishing_velocity.toFixed(2)
                    : sitemapAnalysis.analysis_data.content_trends.publishing_velocity}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>Posts per day</Typography>
              </Paper>
            )}
            {sitemapAnalysis?.analysis_data?.content_trends?.date_range?.span_days != null && (
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 140, p: 2, textAlign: 'center', bgcolor: '#fef2f2', borderColor: '#fecaca' }}>
                <Typography variant="h4" sx={{ color: '#b91c1c', fontWeight: 700 }}>
                  {sitemapAnalysis.analysis_data.content_trends.date_range.span_days}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>Days of content history</Typography>
              </Paper>
            )}
            {sitemapAnalysis?.analysis_data?.structure_analysis?.total_urls != null && (
              <Paper variant="outlined" sx={{ flex: 1, minWidth: 140, p: 2, textAlign: 'center', bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <Typography variant="h4" sx={{ color: '#15803d', fontWeight: 700 }}>
                  {sitemapAnalysis.analysis_data.structure_analysis.total_urls}
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569' }}>Total URLs in sitemap</Typography>
              </Paper>
            )}
          </Box>

          {sitemapAnalysis?.analysis_data?.content_trends?.trends?.length > 0 && (
            <Box mb={2.5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Trends</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {sitemapAnalysis.analysis_data.content_trends.trends.map((item: string, i: number) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: '#ffffff', borderColor: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#3b82f6', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: '#1e293b' }}>{item}</Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {sitemapAnalysis?.analysis_data?.publishing_patterns?.optimization_opportunities?.length > 0 && (
            <Box mb={2.5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Sitemap Optimization Tips</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {sitemapAnalysis.analysis_data.publishing_patterns.optimization_opportunities.map((item: string, i: number) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, bgcolor: '#fffbeb', borderColor: '#fde68a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#d97706', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: '#92400e' }}>{item}</Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {sitemapAnalysis?.analysis_data?.competitors_analyzed?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Competitors Compared</Typography>
              <Box display="flex" flexWrap="wrap" gap={0.75}>
                {sitemapAnalysis.analysis_data.competitors_analyzed.map((domain: string, i: number) => (
                  <Chip key={i} label={domain} size="small" sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 500 }} />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Site Structure Modal */}
      <Dialog open={showStructure} onClose={onCloseStructure} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2, bgcolor: '#ffffff' } }}>
        <DialogTitle sx={{ pb: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="span" fontWeight={700} sx={{ color: '#0f172a' }}>Topics Your Site Covers</Typography>
          <IconButton size="small" onClick={onCloseStructure} aria-label="close" sx={{ color: '#64748b' }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, bgcolor: '#ffffff' }}>
          <Typography variant="body2" sx={{ mb: 2.5, color: '#475569', fontSize: '0.85rem' }}>
            A high-contrast snapshot of the main topics, content pillars, and structure quality found across your website.
          </Typography>

          {sitemapAnalysis?.analysis_data?.structure_analysis?.keyword_clusters && (
            <Box mb={2.5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1 }}>Top Topics</Typography>
              <Box display="flex" flexWrap="wrap" gap={0.75}>
                {Object.entries(sitemapAnalysis.analysis_data.structure_analysis.keyword_clusters).map(([topic, count]: [string, any], i: number) => (
                  <Chip key={i} label={`${topic} (${count})`} size="small" sx={{ bgcolor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: 600 }} />
                ))}
              </Box>
            </Box>
          )}

          {sitemapAnalysis?.analysis_data?.structure_analysis?.strategic_pillars && (
            <Box mb={2.5}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a', mb: 1.5 }}>Content Mix</Typography>
              {(() => {
                const entries = Object.entries(sitemapAnalysis.analysis_data.structure_analysis.strategic_pillars);
                const maxCount = Math.max(...entries.map(([, c]) => c as number), 1);
                return (
                  <Box display="flex" flexDirection="column" gap={1.25}>
                    {entries.map(([pillar, count]: [string, any], i: number) => (
                      <Box key={i}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#1e293b' }}>{pillar}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>{count} URLs</Typography>
                        </Box>
                        <Box sx={{ width: '100%', height: 10, bgcolor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                          <Box sx={{ width: `${((count as number) / maxCount) * 100}%`, height: '100%', bgcolor: '#6366f1', borderRadius: 5 }} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </Box>
          )}

          {sitemapAnalysis?.analysis_data?.structure_analysis?.structure_quality && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#166534', mb: 0.5 }}>Structure Quality</Typography>
              <Typography variant="body2" sx={{ color: '#15803d' }}>{sitemapAnalysis.analysis_data.structure_analysis.structure_quality}</Typography>
            </Paper>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
