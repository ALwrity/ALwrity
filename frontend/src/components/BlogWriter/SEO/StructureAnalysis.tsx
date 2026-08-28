/**
 * Structure Analysis Component
 *
 * Displays comprehensive content structure analysis including structure overview,
 * content elements detection, and heading structure analysis.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Tooltip
} from '@mui/material';
import BarChart from '@mui/icons-material/BarChart';

interface StructureAnalysisProps {
  detailedAnalysis?: {
    content_structure?: {
      total_sections: number;
      total_paragraphs: number;
      total_sentences: number;
      has_introduction: boolean;
      has_conclusion: boolean;
      has_call_to_action: boolean;
      structure_score: number;
      recommendations: string[];
    };
    content_quality?: {
      word_count: number;
      unique_words: number;
      vocabulary_diversity: number;
      transition_words_used: number;
      content_depth_score: number;
      flow_score: number;
      recommendations: string[];
    };
    heading_structure?: {
      h1_count: number;
      h2_count: number;
      h3_count: number;
      h1_headings: string[];
      h2_headings: string[];
      h3_headings: string[];
      heading_hierarchy_score: number;
      recommendations: string[];
    };
  };
}

const baseCard = {
  p: 3,
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 2,
  boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
  color: '#0f172a',
  minHeight: '100%'
} as const;

const infoRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 0',
  cursor: 'help'
} as const;

const statLabel = {
  color: '#475569',
  fontWeight: 500
} as const;

const statValue = {
  color: '#0f172a',
  fontWeight: 700
} as const;

const highlightCard = (borderColor: string) => ({
  p: 2,
  borderRadius: 2,
  border: `1px solid ${borderColor}`,
  background: `linear-gradient(140deg, ${borderColor}15, ${borderColor}22)`
});

export const StructureAnalysis: React.FC<StructureAnalysisProps> = ({ detailedAnalysis }) => {
  const structure = detailedAnalysis?.content_structure;
  const quality = detailedAnalysis?.content_quality;
  const headings = detailedAnalysis?.heading_structure;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <BarChart sx={{ color: 'primary.main' }} />
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700, letterSpacing: 0.2, color: '#0f172a' }}>
          Content Structure Analysis
        </Typography>
      </Box>
      <Grid container spacing={3}>
        {/* Content Structure Overview */}
        <Grid item xs={12} md={6}>
          <Paper sx={baseCard}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#0f172a' }}>
              Structure Overview
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Tooltip
                title={
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                      Total Sections
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                      Number of main content sections (H2 headings) in your blog post.
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#64748b' }}>
                      <strong>Optimal Range:</strong> 3-8 sections for most blog posts
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                      <strong>Why it matters:</strong> Good sectioning improves readability and structure.
                    </Typography>
                  </Box>
                }
                arrow
              >
                <Box sx={infoRow}>
                  <Typography variant="body2" sx={statLabel}>Total Sections</Typography>
                  <Typography variant="body2" sx={statValue}>
                    {structure?.total_sections || 'N/A'}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip
                title={
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                      Total Paragraphs
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                      Number of paragraphs in your content (excluding headings).
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                      <strong>Optimal Range:</strong> 8-20 paragraphs for most blog posts
                    </Typography>
                  </Box>
                }
                arrow
              >
                <Box sx={infoRow}>
                  <Typography variant="body2" sx={statLabel}>Total Paragraphs</Typography>
                  <Typography variant="body2" sx={statValue}>
                    {structure?.total_paragraphs || 'N/A'}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip
                title={
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                      Total Sentences
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                      Total number of sentences in your content.
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                      <strong>Optimal Range:</strong> 40-100 sentences for most blog posts
                    </Typography>
                  </Box>
                }
                arrow
              >
                <Box sx={infoRow}>
                  <Typography variant="body2" sx={statLabel}>Total Sentences</Typography>
                  <Typography variant="body2" sx={statValue}>
                    {structure?.total_sentences || 'N/A'}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip
                title={
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                      Structure Score
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                      Overall score (0-100) for your content's structural organization.
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                      <strong>Scoring Factors:</strong> Section count, paragraph count, intro/conclusion presence.
                    </Typography>
                  </Box>
                }
                arrow
              >
                <Box sx={infoRow}>
                  <Typography variant="body2" sx={statLabel}>Structure Score</Typography>
                  <Typography variant="body2" sx={statValue}>
                    {structure?.structure_score || 'N/A'}
                  </Typography>
                </Box>
              </Tooltip>
            </Box>
          </Paper>
        </Grid>

        {/* Content Elements */}
        <Grid item xs={12} md={6}>
          <Paper sx={baseCard}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#0f172a' }}>
              Content Elements
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Tooltip
                title="Whether your content has a clear introduction that sets context and expectations."
                arrow
              >
                <Box sx={infoRow}>
                  <Typography variant="body2" sx={statLabel}>Has Introduction</Typography>
                  <Chip
                    label={structure?.has_introduction ? 'Yes' : 'No'}
                    color={structure?.has_introduction ? 'success' : 'error'}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              </Tooltip>

              <Tooltip
                title="Whether your content ends with a clear conclusion summarizing key points."
                arrow
              >
                <Box sx={infoRow}>
                  <Typography variant="body2" sx={statLabel}>Has Conclusion</Typography>
                  <Chip
                    label={structure?.has_conclusion ? 'Yes' : 'No'}
                    color={structure?.has_conclusion ? 'success' : 'error'}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              </Tooltip>

              <Tooltip
                title="Whether your content includes a clear call to action for readers."
                arrow
              >
                <Box sx={infoRow}>
                  <Typography variant="body2" sx={statLabel}>Has Call to Action</Typography>
                  <Chip
                    label={structure?.has_call_to_action ? 'Yes' : 'No'}
                    color={structure?.has_call_to_action ? 'success' : 'error'}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              </Tooltip>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Content Quality Metrics */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper sx={baseCard}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#0f172a' }}>
              Content Quality Metrics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Tooltip
                  title="Total number of words in your content. Longer content typically ranks better."
                  arrow
                >
                  <Box sx={highlightCard('rgba(34,197,94,0.65)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#15803d', mb: 1 }}>
                      Word Count
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {quality?.word_count || 'N/A'}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>

              <Grid item xs={12} md={4}>
                <Tooltip
                  title="Ratio of unique words to total words, indicating content variety and richness."
                  arrow
                >
                  <Box sx={highlightCard('rgba(59,130,246,0.65)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1d4ed8', mb: 1 }}>
                      Vocabulary Diversity
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {quality?.vocabulary_diversity !== undefined
                        ? `${(quality.vocabulary_diversity * 100).toFixed(1)}%`
                        : 'N/A'}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>

              <Grid item xs={12} md={4}>
                <Tooltip
                  title="Score (0-100) indicating how comprehensive and detailed your content is."
                  arrow
                >
                  <Box sx={highlightCard('rgba(168,85,247,0.65)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#7c3aed', mb: 1 }}>
                      Content Depth Score
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {quality?.content_depth_score || 'N/A'}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>

              <Grid item xs={12} md={4}>
                <Tooltip
                  title="Score (0-100) indicating how well your content flows from one idea to the next."
                  arrow
                >
                  <Box sx={highlightCard('rgba(14,165,233,0.6)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0284c7', mb: 1 }}>
                      Flow Score
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {quality?.flow_score || 'N/A'}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>

              <Grid item xs={12} md={4}>
                <Tooltip
                  title="Number of transition words used – higher values suggest smoother narrative flow."
                  arrow
                >
                  <Box sx={highlightCard('rgba(251,191,36,0.6)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#b45309', mb: 1 }}>
                      Transition Words Used
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {quality?.transition_words_used || 'N/A'}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>

              <Grid item xs={12} md={4}>
                <Tooltip
                  title="Average unique words used throughout the article. Indicates lexical richness."
                  arrow
                >
                  <Box sx={highlightCard('rgba(244,114,182,0.6)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#be185d', mb: 1 }}>
                      Unique Words
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {quality?.unique_words || 'N/A'}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Heading Structure */}
      {headings && (
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Paper sx={baseCard}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#0f172a' }}>
                Heading Structure
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={highlightCard('rgba(59,130,246,0.45)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1d4ed8', mb: 1 }}>
                      H1 Headings
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {headings.h1_count}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      {headings.h1_headings?.[0] ? `Primary: ${headings.h1_headings[0]}` : 'Primary heading analysis'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={highlightCard('rgba(34,197,94,0.45)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#15803d', mb: 1 }}>
                      H2 Headings
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {headings.h2_count}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      {headings.h2_headings?.slice(0, 2).join(', ') || 'Summary of subtopics'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={highlightCard('rgba(14,165,233,0.45)')}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0ea5e9', mb: 1 }}>
                      H3 Headings
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {headings.h3_count}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      {headings.h3_headings?.slice(0, 2).join(', ') || 'Supportive outline points'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};
