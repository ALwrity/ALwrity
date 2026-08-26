/**
 * Readability Analysis Component
 *
 * Displays comprehensive readability analysis including readability metrics,
 * content statistics, sentence/paragraph analysis, and target audience information.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import MenuBook from '@mui/icons-material/MenuBook';

interface ReadabilityAnalysisProps {
  detailedAnalysis?: {
    readability_analysis?: {
      metrics: Record<string, number>;
      avg_sentence_length: number;
      avg_paragraph_length: number;
      readability_score: number;
      target_audience: string;
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
  };
  visualizationData?: {
    content_stats: {
      word_count: number;
      sections: number;
      paragraphs: number;
    };
  };
}

const cardStyles = {
  p: 3,
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 2,
  boxShadow: '0 12px 30px rgba(15,23,42,0.08)',
  color: '#0f172a',
  minHeight: '100%'
} as const;

const sectionTitleSx = {
  fontWeight: 700,
  letterSpacing: 0.2,
  color: '#0f172a',
  mb: 2
} as const;

const statRowSx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  py: 0.5
} as const;

const statLabelSx = {
  color: '#475569',
  fontWeight: 500
} as const;

const statValueSx = {
  color: '#0f172a',
  fontWeight: 700
} as const;

const metricRowSx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.65rem 0.85rem',
  borderRadius: 12,
  backgroundColor: '#f1f5f9',
  cursor: 'help',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 10px 20px rgba(15,23,42,0.08)'
  }
} as const;

export const ReadabilityAnalysis: React.FC<ReadabilityAnalysisProps> = ({
  detailedAnalysis,
  visualizationData
}) => {
  const readabilityMetrics = detailedAnalysis?.readability_analysis?.metrics ?? {};

  const getMetricDetails = (metric: string, value: number) => {
    const tooltips: Record<string, { description: string; interpretation: string }> = {
      flesch_reading_ease: {
        description: 'Measures how easy text is to read (0-100 scale).',
        interpretation: value >= 80 ? 'Very Easy' : value >= 60 ? 'Standard' : 'Challenging'
      },
      flesch_kincaid_grade: {
        description: 'U.S. grade level required to understand the text.',
        interpretation: value <= 8 ? 'Easy' : value <= 12 ? 'Moderate' : 'Advanced'
      },
      gunning_fog: {
        description: 'Years of formal education needed for comprehension.',
        interpretation: value <= 12 ? 'Easy' : value <= 16 ? 'Moderate' : 'Advanced'
      },
      smog_index: {
        description: 'Estimates the years of education needed to understand the text.',
        interpretation: value <= 8 ? 'Easy' : value <= 12 ? 'Moderate' : 'Advanced'
      },
      automated_readability: {
        description: 'Automated readability score based on characters per word.',
        interpretation: value <= 8 ? 'Easy' : value <= 12 ? 'Moderate' : 'Advanced'
      },
      coleman_liau: {
        description: 'Readability based on characters per word and sentence length.',
        interpretation: value <= 8 ? 'Easy' : value <= 12 ? 'Moderate' : 'Advanced'
      }
    };

    return (
      tooltips[metric] || {
        description: 'Readability metric',
        interpretation: 'No interpretation available'
      }
    );
  };

  const renderStatRow = (label: React.ReactNode, value: React.ReactNode) => (
    <Box sx={statRowSx}>
      <Typography variant="body2" sx={statLabelSx}>
        {label}
      </Typography>
      <Typography variant="body2" sx={statValueSx}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <MenuBook sx={{ color: 'primary.main' }} />
        <Typography
          variant="h6"
          component="h3"
          sx={{ fontWeight: 700, letterSpacing: 0.3, color: '#0f172a' }}
        >
          Readability Analysis
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={cardStyles}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="subtitle1" sx={sectionTitleSx}>
                Readability Metrics
              </Typography>
              <Tooltip
                title={
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                      Readability Analysis
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                      Measures how easy your content is to read and understand.
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.75, color: '#64748b' }}>
                      <strong>Flesch Reading Ease:</strong> 90-100 (Very Easy), 80-89 (Easy), 70-79 (Fairly Easy), 60-69 (Standard)
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.75, color: '#64748b' }}>
                      <strong>Sentence Length:</strong> 15-20 words is optimal
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }}>
                      <strong>Syllables per Word:</strong> 1.5-1.7 keeps content approachable
                    </Typography>
                  </Box>
                }
                arrow
              >
                <IconButton size="small" sx={{ color: 'primary.main' }}>
                  <MenuBook fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {Object.keys(readabilityMetrics).length > 0 ? (
                Object.entries(readabilityMetrics).map(([metric, value]) => {
                  const { description, interpretation } = getMetricDetails(metric, value);
                  const label = metric.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

                  return (
                    <Tooltip
                      key={metric}
                      title={
                        <Box sx={{ p: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
                            {label}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
                            {description}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            <strong>Interpretation:</strong> {interpretation}
                          </Typography>
                        </Box>
                      }
                      arrow
                      placement="top"
                    >
                      <Box sx={metricRowSx}>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize', color: '#334155' }}>
                          {metric.replace('_', ' ')}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {value.toFixed(1)}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })
              ) : (
                <Typography variant="body2" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                  No readability metrics available. This may indicate an issue with the content analysis.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={cardStyles}>
            <Typography variant="subtitle1" sx={sectionTitleSx}>
              Content Statistics
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {renderStatRow('Word Count', detailedAnalysis?.content_quality?.word_count || visualizationData?.content_stats.word_count || 'N/A')}
              {renderStatRow('Sections', detailedAnalysis?.content_structure?.total_sections || visualizationData?.content_stats.sections || 'N/A')}
              {renderStatRow('Paragraphs', detailedAnalysis?.content_structure?.total_paragraphs || visualizationData?.content_stats.paragraphs || 'N/A')}
              {renderStatRow('Sentences', detailedAnalysis?.content_structure?.total_sentences || 'N/A')}
              {renderStatRow('Unique Words', detailedAnalysis?.content_quality?.unique_words || 'N/A')}
              {renderStatRow(
                'Vocabulary Diversity',
                detailedAnalysis?.content_quality?.vocabulary_diversity !== undefined
                  ? `${(detailedAnalysis.content_quality.vocabulary_diversity * 100).toFixed(1)}%`
                  : 'N/A'
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={cardStyles}>
            <Typography variant="subtitle1" sx={sectionTitleSx}>
              Sentence & Paragraph Analysis
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {renderStatRow(
                'Average Sentence Length',
                detailedAnalysis?.readability_analysis?.avg_sentence_length !== undefined
                  ? `${detailedAnalysis.readability_analysis.avg_sentence_length.toFixed(1)} words`
                  : 'N/A'
              )}
              {renderStatRow(
                'Average Paragraph Length',
                detailedAnalysis?.readability_analysis?.avg_paragraph_length !== undefined
                  ? `${detailedAnalysis.readability_analysis.avg_paragraph_length.toFixed(1)} words`
                  : 'N/A'
              )}
              {renderStatRow(
                'Transition Words Used',
                detailedAnalysis?.content_quality?.transition_words_used || 'N/A'
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={cardStyles}>
            <Typography variant="subtitle1" sx={sectionTitleSx}>
              Target Audience
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {renderStatRow('Reading Level', detailedAnalysis?.readability_analysis?.target_audience || 'N/A')}
              {renderStatRow('Content Depth Score', detailedAnalysis?.content_quality?.content_depth_score || 'N/A')}
              {renderStatRow('Flow Score', detailedAnalysis?.content_quality?.flow_score || 'N/A')}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
