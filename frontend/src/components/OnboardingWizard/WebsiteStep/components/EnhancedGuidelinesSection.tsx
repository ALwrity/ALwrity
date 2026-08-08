/**
 * Enhanced Guidelines Section Component
 * Displays comprehensive content guidelines for the analyzed website
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid
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
}

const EnhancedGuidelinesSection: React.FC<EnhancedGuidelinesSectionProps> = ({
  guidelines,
  domainName,
  bestPractices,
  avoidElements,
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
      </Grid>
    </Box>
  );
};

export default EnhancedGuidelinesSection;
