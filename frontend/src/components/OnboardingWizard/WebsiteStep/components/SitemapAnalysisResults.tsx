/**
 * SitemapAnalysisResults Component
 * Displays sitemap analysis results with competitive insights
 */

import React from 'react';
import {
  Typography,
  Paper,
  Grid,
  Box,
  Chip,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BusinessIcon from '@mui/icons-material/Business';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import MetricTooltip from '../../../shared/MetricTooltip';
import { getMetricTooltip } from '../../../shared/metricTooltips';

interface StructureAnalysis {
  total_urls?: number;
  average_path_depth?: number;
  url_patterns?: { [key: string]: number };
}

interface ContentTrends {
  publishing_velocity?: number;
  date_range?: {
    span_days: number;
  };
}

interface PublishingPatterns {
  monthly_distribution?: { [key: string]: number };
}

interface OnboardingInsights {
  competitive_positioning?: string;
  content_gaps?: string[];
  growth_opportunities?: string[];
  industry_benchmarks?: string[];
  strategic_recommendations?: string[];
}

interface SitemapAnalysisData {
  structure_analysis?: StructureAnalysis;
  content_trends?: ContentTrends;
  publishing_patterns?: PublishingPatterns;
  onboarding_insights?: OnboardingInsights;
}

interface SitemapAnalysisResultsProps {
  analysisData: SitemapAnalysisData;
  userUrl: string;
  sitemapUrl: string;
  isLoading?: boolean;
  discoveryMethod?: string;
}

const SitemapAnalysisResults: React.FC<SitemapAnalysisResultsProps> = ({
  analysisData,
  userUrl,
  sitemapUrl,
  isLoading = false,
  discoveryMethod
}) => {
  const structureAnalysis: StructureAnalysis = analysisData.structure_analysis || {};
  const contentTrends: ContentTrends = analysisData.content_trends || {};
  // const publishingPatterns: PublishingPatterns = analysisData.publishing_patterns || {};
  const onboardingInsights: OnboardingInsights = analysisData.onboarding_insights || {};

  if (isLoading) {
    return (
      <Paper sx={{ 
        p: 3, 
        mb: 4,
        background: 'linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%)',
        border: '1px solid #81d4fa',
        borderRadius: 2
      }}>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <AssessmentIcon sx={{ color: '#667eea', fontSize: '2rem' }} />
          <Box>
            <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c !important' }}>
              Analyzing Your Website Structure
            </Typography>
            <Typography variant="body2" sx={{ color: '#4a5568 !important' }}>
              Examining sitemap and content patterns...
            </Typography>
          </Box>
        </Box>
        <LinearProgress sx={{ height: 8, borderRadius: 4 }} />
      </Paper>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ 
        p: 3, 
        mb: 4,
        background: 'linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%)',
        border: '1px solid #81d4fa',
        borderRadius: 2,
        boxShadow: '0 4px 12px rgba(3, 169, 244, 0.15)'
      }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <AssessmentIcon sx={{ color: '#667eea', fontSize: '2rem' }} />
          <Box>
            <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c !important' }}>
              Website Structure Analysis
            </Typography>
            <Typography variant="body2" sx={{ color: '#4a5568 !important' }}>
              Sitemap: {sitemapUrl}
            </Typography>
            {discoveryMethod && discoveryMethod !== 'fallback' && (
              <Typography variant="caption" sx={{ color: '#059669 !important', fontStyle: 'italic' }}>
                ✓ Discovered via {discoveryMethod.replace('_', ' ')}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Key Metrics */}
        <Grid container spacing={3} mt={1}>
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="primary">
                {structureAnalysis.total_urls || 0}
              </Typography>
              <Typography variant="body2" sx={{ color: '#4a5568 !important', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                Total URLs
                <MetricTooltip title={getMetricTooltip('total_urls_found')} />
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="primary">
                {structureAnalysis.average_path_depth?.toFixed(1) || '0.0'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#4a5568 !important', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                Avg. Path Depth
                <MetricTooltip title={getMetricTooltip('avg_path_depth')} />
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="primary">
                {contentTrends.publishing_velocity?.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#4a5568 !important', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                Posts/Day
                <MetricTooltip title={getMetricTooltip('posts_per_day')} />
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="primary">
                {Object.keys(structureAnalysis.url_patterns || {}).length}
              </Typography>
              <Typography variant="body2" sx={{ color: '#4a5568 !important', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                Content Categories
                <MetricTooltip title={getMetricTooltip('content_categories')} />
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Competitive Positioning */}
      {onboardingInsights.competitive_positioning && (
        <Paper sx={{ 
          p: 4, 
          mb: 4,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '2px solid #e2e8f0',
          borderRadius: 3,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
          }
        }}>
          <Typography 
            variant="h6" 
            fontWeight={700} 
            sx={{ 
              color: '#1a202c !important',
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              fontSize: '1.25rem'
            }}
          >
            <Box sx={{
              p: 1,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BusinessIcon sx={{ color: '#ffffff !important', fontSize: '1.25rem' }} />
            </Box>
            Competitive Positioning
            <MetricTooltip title={getMetricTooltip('competitive_positioning')} />
          </Typography>
          <Box sx={{
            p: 3,
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 2,
            border: '1px solid #e2e8f0'
          }}>
            <Box sx={{
              color: '#2d3748 !important', 
              lineHeight: 1.7,
              fontSize: '1rem',
              '& strong': {
                color: '#1a202c !important',
                fontWeight: 600
              },
              '& h1, & h2, & h3, & h4, & h5, & h6': {
                color: '#1a202c !important',
                fontWeight: 600,
                marginTop: 2,
                marginBottom: 1
              },
              '& ul, & ol': {
                paddingLeft: 3,
                marginBottom: 2
              },
              '& li': {
                marginBottom: 0.5
              },
              '& p': {
                marginBottom: 1.5
              }
            }}>
              {onboardingInsights.competitive_positioning?.split('\n').map((line, index) => {
                // Handle bold text with **text**
                if (line.includes('**')) {
                  const parts = line.split(/(\*\*.*?\*\*)/g);
                  return (
                    <Box key={index} sx={{ mb: line.trim() === '' ? 0 : 1 }}>
                      {parts.map((part, partIndex) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return (
                            <Box component="span" key={partIndex} sx={{ fontWeight: 600, color: '#1a202c !important' }}>
                              {part.slice(2, -2)}
                            </Box>
                          );
                        }
                        return part;
                      })}
                    </Box>
                  );
                }
                
                // Handle bullet points with -
                if (line.trim().startsWith('- ')) {
                  return (
                    <Box key={index} sx={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      mb: 0.5,
                      ml: 2
                    }}>
                      <Box sx={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: '#667eea', 
                        mt: 0.75, 
                        mr: 1.5,
                        flexShrink: 0
                      }} />
                      <Box sx={{ color: '#2d3748 !important' }}>
                        {line.replace(/^- /, '')}
                      </Box>
                    </Box>
                  );
                }
                
                // Handle numbered lists
                if (/^\d+\./.test(line.trim())) {
                  return (
                    <Box key={index} sx={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      mb: 0.5,
                      ml: 2
                    }}>
                      <Box sx={{ 
                        color: '#667eea',
                        fontWeight: 600,
                        mr: 1.5,
                        minWidth: '20px',
                        flexShrink: 0
                      }}>
                        {line.match(/^\d+\./)?.[0]}
                      </Box>
                      <Box sx={{ color: '#2d3748 !important' }}>
                        {line.replace(/^\d+\.\s*/, '')}
                      </Box>
                    </Box>
                  );
                }
                
                // Handle headings
                if (line.trim().startsWith('#')) {
                  const level = line.match(/^#+/)?.[0].length || 1;
                  const text = line.replace(/^#+\s*/, '');
                  const Component = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
                  
                  return (
                    <Box 
                      key={index}
                      component={Component}
                      sx={{ 
                        color: '#1a202c !important',
                        fontWeight: 600,
                        fontSize: level === 1 ? '1.25rem' : level === 2 ? '1.125rem' : '1rem',
                        mt: index === 0 ? 0 : 2,
                        mb: 1
                      }}
                    >
                      {text}
                    </Box>
                  );
                }
                
                // Regular text
                if (line.trim()) {
                  return (
                    <Box key={index} sx={{ mb: 1 }}>
                      {line}
                    </Box>
                  );
                }
                
                // Empty lines
                return <Box key={index} sx={{ height: '8px' }} />;
              })}
            </Box>
          </Box>
        </Paper>
      )}

      {/* Content Gaps & Opportunities */}
      <Grid container spacing={3} mb={3}>
        {/* Content Gaps */}
        {onboardingInsights.content_gaps && onboardingInsights.content_gaps.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              height: '100%',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '1px solid #f59e0b',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
            }}>
              <CardContent>
                <Typography 
                  variant="h6" 
                  fontWeight={600} 
                  mb={2}
                  sx={{ color: '#1a202c !important' }}
                >
                  <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#d97706 !important' }} />
                  Content Gaps
                  <MetricTooltip title={getMetricTooltip('content_gaps')} />
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {onboardingInsights.content_gaps.map((gap: string, index: number) => (
                    <Typography 
                      key={index} 
                      component="li" 
                      variant="body2" 
                      sx={{ 
                        mb: 1, 
                        color: '#2d3748 !important',
                        lineHeight: 1.5
                      }}
                    >
                      {gap}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Growth Opportunities */}
        {onboardingInsights.growth_opportunities && onboardingInsights.growth_opportunities.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              height: '100%',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '1px solid #10b981',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
            }}>
              <CardContent>
                <Typography 
                  variant="h6" 
                  fontWeight={600} 
                  mb={2}
                  sx={{ color: '#1a202c !important' }}
                >
                  <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#059669 !important' }} />
                  Growth Opportunities
                  <MetricTooltip title={getMetricTooltip('growth_opportunities')} />
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {onboardingInsights.growth_opportunities.map((opportunity: string, index: number) => (
                    <Typography 
                      key={index} 
                      component="li" 
                      variant="body2" 
                      sx={{ 
                        mb: 1, 
                        color: '#2d3748 !important',
                        lineHeight: 1.5
                      }}
                    >
                      {opportunity}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Strategic Recommendations */}
      {onboardingInsights.strategic_recommendations && onboardingInsights.strategic_recommendations.length > 0 && (
        <Paper sx={{ 
          p: 3, 
          mb: 3,
          background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
          border: '1px solid #ec4899',
          borderRadius: 2
        }}>
          <Typography 
            variant="h6" 
            fontWeight={600} 
            mb={2}
            sx={{ color: '#1a202c !important' }}
          >
            <LightbulbIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#be185d !important' }} />
            Strategic Recommendations
            <MetricTooltip title={getMetricTooltip('strategic_recommendations')} />
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            {onboardingInsights.strategic_recommendations.map((recommendation: string, index: number) => (
              <Typography 
                key={index} 
                component="li" 
                variant="body1" 
                sx={{ 
                  mb: 1.5, 
                  color: '#2d3748 !important',
                  lineHeight: 1.6
                }}
              >
                {recommendation}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}

      {/* Content Categories */}
      {structureAnalysis.url_patterns && Object.keys(structureAnalysis.url_patterns).length > 0 && (
        <Paper sx={{ 
          p: 4,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '2px solid #e2e8f0',
          borderRadius: 3,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #64748b 0%, #475569 100%)'
          }
        }}>
          <Typography 
            variant="h6" 
            fontWeight={700} 
            sx={{ 
              color: '#1a202c !important', 
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              fontSize: '1.25rem'
            }}
          >
            <Box sx={{
              p: 1,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AnalyticsIcon sx={{ color: '#ffffff !important', fontSize: '1.25rem' }} />
            </Box>
            Content Categories
            <MetricTooltip title={getMetricTooltip('content_categories')} />
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1.5}>
            {Object.entries(structureAnalysis.url_patterns)
              .sort(([,a], [,b]) => (b as number) - (a as number))
              .slice(0, 12)
              .map(([category, count], index) => {
                // Create different color schemes for variety
                const colorSchemes = [
                  { bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '#3b82f6', text: '#1e40af', hover: '#93c5fd' },
                  { bg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', border: '#22c55e', text: '#15803d', hover: '#86efac' },
                  { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#f59e0b', text: '#d97706', hover: '#fcd34d' },
                  { bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', border: '#ec4899', text: '#be185d', hover: '#f9a8d4' },
                  { bg: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', border: '#6366f1', text: '#4338ca', hover: '#a5b4fc' },
                  { bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '#16a34a', text: '#15803d', hover: '#86efac' }
                ];
                const scheme = colorSchemes[index % colorSchemes.length];
                
                return (
                  <Chip
                    key={category}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: scheme.text }}>
                          {category}
                        </Typography>
                        <Typography variant="caption" sx={{ 
                          color: scheme.text, 
                          opacity: 0.8,
                          fontWeight: 500,
                          backgroundColor: 'rgba(255, 255, 255, 0.6)',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1
                        }}>
                          {count}
                        </Typography>
                      </Box>
                    }
                    sx={{
                      background: scheme.bg,
                      border: `2px solid ${scheme.border}`,
                      color: scheme.text,
                      fontWeight: 600,
                      height: 'auto',
                      py: 1,
                      px: 1.5,
                      borderRadius: 2,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        background: scheme.hover,
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
                      },
                      '& .MuiChip-label': {
                        px: 0
                      }
                    }}
                  />
                );
              })}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default SitemapAnalysisResults;
