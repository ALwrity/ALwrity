/**
 * Enhanced Guidelines Section Component
 * Displays comprehensive content guidelines for the analyzed website
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  Language as LanguageIcon,
  Web as WebIcon,
  Business as BusinessIcon,
  Group as GroupIcon,
  Lightbulb as LightbulbIcon
} from '@mui/icons-material';

// Import rendering utilities
import { renderGuidelinesCard } from '../utils/renderUtils';
import { useOnboardingStyles } from '../../common/useOnboardingStyles';

interface Guidelines {
  tone_recommendations?: string[];
  structure_guidelines?: string[];
  vocabulary_suggestions?: string[];
  engagement_tips?: string[];
  audience_considerations?: string[];
  brand_alignment?: string[];
  seo_optimization?: string[];
  conversion_optimization?: string[];
}

interface EnhancedGuidelinesSectionProps {
  guidelines?: Guidelines | null;
  domainName: string;
  bestPractices?: string[];
  avoidElements?: string[];
  contentTemplates?: Array<{type: string; headline: string; structure: string[]; tone_notes: string}>;
  headlineFormulas?: Array<{pattern: string; example: string; category: string}>;
  contentBriefs?: Array<{topic: string; target_keyword: string; target_audience: string; word_count: number; suggested_sections: string[]}>;
  competitiveAngles?: Array<{angle: string; differentiator: string; headline_example: string}>;
}

const EnhancedGuidelinesSection: React.FC<EnhancedGuidelinesSectionProps> = ({
  guidelines,
  domainName,
  bestPractices,
  avoidElements,
  contentTemplates,
  headlineFormulas,
  contentBriefs,
  competitiveAngles,
}) => {
  const styles = useOnboardingStyles();

  if (!guidelines) {
    return null;
  }

  return (
    <Box sx={styles.analysisSection}>
      <Typography variant="h5" sx={styles.analysisSectionHeader} gutterBottom>
        <LightbulbIcon color="primary" />
        Enhanced Content Guidelines for {domainName}
      </Typography>
      
      <Grid container spacing={3}>
        {guidelines.tone_recommendations && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'Tone Recommendations',
              guidelines.tone_recommendations,
              <PsychologyIcon />,
              'primary'
            )}
          </Grid>
        )}
        
        {guidelines.structure_guidelines && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'Structure Guidelines',
              guidelines.structure_guidelines,
              <AnalyticsIcon />,
              'secondary'
            )}
          </Grid>
        )}
        
        {guidelines.engagement_tips && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'Engagement Tips',
              guidelines.engagement_tips,
              <TrendingUpIcon />,
              'success'
            )}
          </Grid>
        )}
        
        {guidelines.vocabulary_suggestions && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'Vocabulary Suggestions',
              guidelines.vocabulary_suggestions,
              <LanguageIcon />,
              'info'
            )}
          </Grid>
        )}
        
        {guidelines.brand_alignment && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'Brand Alignment',
              guidelines.brand_alignment,
              <BusinessIcon />,
              'warning'
            )}
          </Grid>
        )}
        
        {guidelines.seo_optimization && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'SEO Optimization',
              guidelines.seo_optimization,
              <WebIcon />,
              'primary'
            )}
          </Grid>
        )}
        
        {guidelines.conversion_optimization && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'Conversion Optimization',
              guidelines.conversion_optimization,
              <TrendingUpIcon />,
              'success'
            )}
          </Grid>
        )}
        
        {guidelines.audience_considerations && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'Audience Considerations',
              guidelines.audience_considerations,
              <GroupIcon />,
              'info'
            )}
          </Grid>
        )}
        
        {bestPractices && bestPractices.length > 0 && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'Best Practices',
              bestPractices,
              <LightbulbIcon />,
              'success'
            )}
          </Grid>
        )}
        
        {avoidElements && avoidElements.length > 0 && (
          <Grid item xs={12} md={6}>
            {renderGuidelinesCard(
              'What to Avoid',
              avoidElements,
              <TrendingUpIcon />,
              'warning'
            )}
          </Grid>
        )}
        
        {contentTemplates && contentTemplates.length > 0 && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LightbulbIcon color="primary" fontSize="small" /> Content Templates
              </Typography>
              <Grid container spacing={1}>
                {contentTemplates.slice(0, 2).map((t, i) => (
                  <Grid item xs={12} md={6} key={i}>
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f8fafc' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.type || t.headline}</Typography>
                      {t.tone_notes && <Typography variant="caption" color="text.secondary">{t.tone_notes}</Typography>}
                      {t.structure && t.structure.length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                          {t.structure.map((s, si) => (
                            <Typography key={si} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>• {s}</Typography>
                          ))}
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {headlineFormulas && headlineFormulas.length > 0 && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Headline Formulas</Typography>
              <Grid container spacing={1}>
                {headlineFormulas.slice(0, 6).map((h, i) => (
                  <Grid item xs={12} sm={6} md={4} key={i}>
                    <Paper variant="outlined" sx={{ p: 1, bgcolor: '#fafafa', height: '100%' }}>
                      <Chip size="small" label={h.category} variant="outlined" sx={{ mb: 0.5, fontSize: '0.65rem', height: 18 }} />
                      <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontWeight: 600 }}>{h.pattern}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>{h.example}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {contentBriefs && contentBriefs.length > 0 && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Content Briefs</Typography>
              <Grid container spacing={1}>
                {contentBriefs.slice(0, 3).map((b, i) => (
                  <Grid item xs={12} md={4} key={i}>
                    <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.topic}</Typography>
                      {b.target_keyword && <Chip size="small" label={b.target_keyword} variant="outlined" sx={{ my: 0.5, fontSize: '0.65rem', height: 18 }} />}
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Audience: {b.target_audience}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Length: {b.word_count} words</Typography>
                        {b.suggested_sections?.slice(0, 3).map((s, si) => (
                          <Typography key={si} variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>• {s}</Typography>
                        ))}
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {competitiveAngles && competitiveAngles.length > 0 && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Competitive Positioning Angles</Typography>
              <Grid container spacing={1}>
                {competitiveAngles.slice(0, 3).map((c, i) => (
                  <Grid item xs={12} md={4} key={i}>
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.angle}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{c.differentiator}</Typography>
                      {c.headline_example && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', color: '#15803d' }}>
                          "{c.headline_example}"
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default EnhancedGuidelinesSection;
