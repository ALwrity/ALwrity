/**
 * Keyword Analysis Component
 *
 * Displays comprehensive keyword analysis including keyword types, densities,
 * missing keywords, over-optimization, and distribution analysis.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import GpsFixed from '@mui/icons-material/GpsFixed';
import Search from '@mui/icons-material/Search';
import Warning from '@mui/icons-material/Warning';

interface KeywordAnalysisProps {
  detailedAnalysis?: {
    keyword_analysis?: {
      primary_keywords: string[];
      long_tail_keywords: string[];
      semantic_keywords: string[];
      keyword_density: Record<string, number>;
      keyword_distribution: Record<string, any>;
      missing_keywords: string[];
      over_optimization: string[];
      recommendations: string[];
    };
  };
}

const baseCardSx = {
  p: 3,
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 2,
  boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
  color: '#0f172a',
  minHeight: '100%'
} as const;

const subCard = (color: string) => ({
  p: 2,
  borderRadius: 2,
  border: `1px solid ${color}`,
  background: `linear-gradient(145deg, ${color}14, ${color}1f)`
});

export const KeywordAnalysis: React.FC<KeywordAnalysisProps> = ({ detailedAnalysis }) => {
  const keywordData = detailedAnalysis?.keyword_analysis;

  const renderDensityRow = (keyword: string, density: number) => {
    const status = density > 3 ? 'Over-optimized' : density < 1 ? 'Under-optimized' : 'Optimal';
    const chipColor = density > 3 ? 'error' : density < 1 ? 'warning' : 'success';

    return (
      <Box
        key={keyword}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          borderRadius: 2,
          backgroundColor: '#f1f5f9'
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
          {keyword}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            {status}
          </Typography>
          <Chip label={`${density.toFixed(1)}%`} color={chipColor} size="small" sx={{ fontWeight: 600 }} />
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <GpsFixed sx={{ color: 'primary.main' }} />
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700, letterSpacing: 0.2, color: '#0f172a' }}>
          Keyword Analysis
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Keyword Types Overview */}
        <Paper sx={baseCardSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
            Keyword Types Found
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box sx={subCard('rgba(34,197,94,0.5)')}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#16a34a', mb: 1 }}>
                  Primary Keywords
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                  {keywordData?.primary_keywords?.length || 0} found
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {keywordData?.primary_keywords?.slice(0, 3).map((keyword) => (
                    <Chip key={keyword} label={keyword} size="small" sx={{ fontWeight: 600 }} />
                  ))}
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={subCard('rgba(59,130,246,0.5)')}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2563eb', mb: 1 }}>
                  Long-tail Keywords
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                  {keywordData?.long_tail_keywords?.length || 0} found
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {keywordData?.long_tail_keywords?.slice(0, 3).map((keyword) => (
                    <Chip key={keyword} label={keyword} variant="outlined" size="small" sx={{ fontWeight: 600, borderColor: '#93c5fd', color: '#1d4ed8' }} />
                  ))}
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={subCard('rgba(168,85,247,0.5)')}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#9333ea', mb: 1 }}>
                  Semantic Keywords
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                  {keywordData?.semantic_keywords?.length || 0} found
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {keywordData?.semantic_keywords?.slice(0, 3).map((keyword) => (
                    <Chip key={keyword} label={keyword} variant="outlined" color="secondary" size="small" sx={{ fontWeight: 600, borderColor: '#d8b4fe' }} />
                  ))}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Keyword Densities */}
        <Paper sx={baseCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
              Keyword Densities
            </Typography>
            <Tooltip
              title={
                <Box sx={{ p: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                    Keyword Density Analysis
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                    Shows how frequently each keyword appears in your content as a percentage of total words.
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#64748b' }}>
                    <strong>Optimal Range:</strong> 1-3% for primary keywords
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#64748b' }}>
                    <strong>Too Low (&lt;1%):</strong> Keyword may not be prominent enough
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                    <strong>Too High (&gt;3%):</strong> Risk of keyword stuffing
                  </Typography>
                </Box>
              }
              arrow
            >
              <IconButton size="small" sx={{ color: 'primary.main' }}>
                <Search fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            {keywordData?.keyword_density && Object.keys(keywordData.keyword_density).length > 0 ? (
              Object.entries(keywordData.keyword_density).map(([keyword, density]) => renderDensityRow(keyword, density))
            ) : (
              <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                No keyword density data available. Make sure your research data includes target keywords.
              </Typography>
            )}
          </Box>
        </Paper>

        {/* Missing Keywords */}
        {keywordData?.missing_keywords && keywordData.missing_keywords.length > 0 && (
          <Paper sx={baseCardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#dc2626' }}>
                Missing Keywords
              </Typography>
              <Tooltip title="Keywords from your research that are not found in the content. Consider adding these to improve SEO." arrow>
                <IconButton size="small" sx={{ color: '#dc2626' }}>
                  <Warning fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {keywordData.missing_keywords.map((keyword) => (
                <Chip key={keyword} label={keyword} variant="outlined" size="small" sx={{ borderColor: '#fecaca', color: '#b91c1c', fontWeight: 600 }} />
              ))}
            </Box>
          </Paper>
        )}

        {/* Over-Optimized Keywords */}
        {keywordData?.over_optimization && keywordData.over_optimization.length > 0 && (
          <Paper sx={baseCardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#d97706' }}>
                Over-Optimized Keywords
              </Typography>
              <Tooltip title="Keywords that appear too frequently (over 3% density). Consider reducing their usage." arrow>
                <IconButton size="small" sx={{ color: '#d97706' }}>
                  <Warning fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {keywordData.over_optimization.map((keyword) => (
                <Chip key={keyword} label={keyword} variant="outlined" size="small" sx={{ borderColor: '#fcd34d', color: '#b45309', fontWeight: 600 }} />
              ))}
            </Box>
          </Paper>
        )}

        {/* Keyword Distribution Analysis */}
        {keywordData?.keyword_distribution && Object.keys(keywordData.keyword_distribution).length > 0 && (
          <Paper sx={baseCardSx}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
              Keyword Distribution Analysis
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Object.entries(keywordData.keyword_distribution).map(([keyword, data]: [string, any]) => (
                <Box
                  key={keyword}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
                    “{keyword}”
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Density: {data.density?.toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        In Headings: {data.in_headings ? 'Yes' : 'No'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        First Occurrence: Character {data.first_occurrence || 'Not found'}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Box>
          </Paper>
        )}
      </Box>
    </Box>
  );
};
