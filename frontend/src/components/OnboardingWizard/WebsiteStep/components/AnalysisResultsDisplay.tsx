/**
 * AnalysisResultsDisplay Component
 * Displays the comprehensive website analysis results
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Checkbox,
  FormControlLabel,
  Alert,
  Paper,
  Switch,
  Button
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Verified as VerifiedIcon,
  Analytics as AnalyticsIcon,
  Info as InfoIcon,
  Link as LinkIcon,
  Save as SaveIcon
} from '@mui/icons-material';

// Import extracted components
import { 
  EnhancedGuidelinesSection, 
  KeyInsightsGrid,
  SEOAuditSection,
  SitemapAnalysisSection,
  CombinedAnalysisSection,
  CombinedStrategySection,
  CrawlResultSections
} from './index';
import SectionHeader from './SectionHeader';
import { useOnboardingStyles } from '../../common/useOnboardingStyles';

import { apiClient } from '../../../../api/client';

export interface StyleAnalysis {
  id?: number;
  guidelines?: {
    tone_recommendations?: string[];
    structure_guidelines?: string[];
    vocabulary_suggestions?: string[];
    engagement_tips?: string[];
    audience_considerations?: string[];
    brand_alignment?: string[];
    seo_optimization?: string[];
    conversion_optimization?: string[];
  } | null;
  writing_style?: {
    tone: string;
    voice: string;
    complexity: string;
    engagement_level: string;
    brand_personality?: string;
    formality_level?: string;
    emotional_appeal?: string;
  };
  content_characteristics?: {
    sentence_structure: string;
    vocabulary_level: string;
    paragraph_organization: string;
    content_flow: string;
    readability_score?: string;
    content_density?: string;
    visual_elements_usage?: string;
  };
  target_audience?: {
    demographics: string[];
    expertise_level: string;
    industry_focus: string;
    geographic_focus: string;
    psychographic_profile?: string;
    pain_points?: string[];
    motivations?: string[];
  };
  content_type?: {
    primary_type: string;
    secondary_types: string[];
    purpose: string;
    call_to_action: string;
    conversion_focus?: string;
    educational_value?: string;
  };
  brand_analysis?: {
    brand_voice: string;
    brand_values: string[];
    brand_positioning: string;
    competitive_differentiation: string;
    trust_signals: string[];
    authority_indicators: string[];
    brand_story?: string;
    unique_selling_propositions?: string[];
  };
  strategic_insights?: {
    content_strategy: string;
    competitive_advantages: string[];
    content_calendar_suggestions: string[];
    ai_generation_tips: string[];
  };
  content_strategy_insights?: any;
  style_guidelines?: any;
  style_patterns?: any;
  seo_audit?: any;
  sitemap_analysis?: any;
  best_practices?: string[];
  avoid_elements?: string[];
}

interface AnalysisResultsDisplayProps {
  analysis: StyleAnalysis;
  domainName: string;
  useAnalysisForGenAI: boolean;
  onUseAnalysisChange: (use: boolean) => void;
  crawlResult?: any;
  onAnalysisUpdate?: (updatedAnalysis: StyleAnalysis) => void;
   warning?: string;
  onSave?: () => void;
}

const AnalysisResultsDisplay: React.FC<AnalysisResultsDisplayProps> = ({
  analysis,
  domainName,
  useAnalysisForGenAI,
  onUseAnalysisChange,
  crawlResult,
  onAnalysisUpdate,
  warning,
  onSave
}) => {
  const styles = useOnboardingStyles();
  const [isEditable, setIsEditable] = useState(false);

  const warningParts = warning ? warning.split('|').map(part => part.trim()).filter(Boolean) : [];
  const guidelineWarning = warningParts.find(part => part.toLowerCase().startsWith('guidelines generation failed'));
  const sitemapWarning = warningParts.find(part => part.toLowerCase().startsWith('sitemap analysis failed'));

  // Helper to handle section updates
  const handleSectionUpdate = (section: string, fieldPath: string, value: any) => {
    if (!onAnalysisUpdate) return;
    
    const newAnalysis = { ...analysis };
    
    // Check if we are updating a nested field or the section itself
    // If section and fieldPath are same, it's a direct update of a top-level property
    if (section === fieldPath) {
        (newAnalysis as any)[section] = value;
    } else {
        // Nested update
        // Handle style_patterns specifically as it might be undefined initially
        if (section === 'style_patterns' || section === 'patterns') {
            const sectionData: any = { ...((newAnalysis as any)[section] || {}) };
            sectionData[fieldPath] = value;
            (newAnalysis as any)[section] = sectionData;
        } 
        // Handle guidelines specifically
        else if (section === 'guidelines') {
            const sectionData: any = { ...((newAnalysis as any)[section] || {}) };
            sectionData[fieldPath] = value;
            (newAnalysis as any)[section] = sectionData;
        }
        else if (
          typeof (newAnalysis as any)[section] === 'object' &&
          (newAnalysis as any)[section] !== null &&
          !Array.isArray((newAnalysis as any)[section])
        ) {
            // Generic object update
            const sectionData: any = { ...((newAnalysis as any)[section] || {}) };
            sectionData[fieldPath] = value;
            (newAnalysis as any)[section] = sectionData;
        }
    }
      
    onAnalysisUpdate(newAnalysis);
  };

  const handleRunSEOAudit = async (url: string) => {
    try {
      const response = await apiClient.post('/api/seo/on-page-analysis', {
        url: url,
        analyze_images: true,
        analyze_content_quality: true
      });
      return response.data;
    } catch (error) {
      console.error('Failed to run SEO audit:', error);
      throw error;
    }
  };

  if (!analysis) {
    return null;
  }

  return (
    <Box sx={{
      ...styles.analysisContainer,
      // Global readability hard overrides for Step 2 display area
      '& .MuiTypography-root': {
        color: '#111827 !important',
        WebkitTextFillColor: '#111827',
      },
      '& .MuiPaper-root': {
        backgroundColor: '#ffffff !important',
        backgroundImage: 'none !important',
      },
      '& .MuiCard-root': {
        backgroundColor: '#ffffff !important',
        backgroundImage: 'none !important',
      }
    }}>
      {/* Pro Upgrade Alert removed per request */}
      
      {/* Main Analysis Results */}
      <Card sx={styles.analysisHeaderCard}>
        <CardContent sx={styles.analysisCardContent}>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <VerifiedIcon sx={{ ...styles.analysisHeaderIcon, fontSize: 32 }} />
                <Box>
                  <Typography 
                    variant="h4" 
                    sx={{
                      ...styles.analysisHeaderTitle,
                      color: '#1a202c !important',
                      fontWeight: '700 !important',
                      mb: 0.5
                    }} 
                  >
                    {domainName} Style Analysis
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ color: '#4a5568 !important' }}
                  >
                    AI-powered analysis of your brand voice and content strategy
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {onSave && (
                  <Button
                    startIcon={<SaveIcon />}
                    variant="contained"
                    onClick={onSave}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      '&:hover': {
                         background: 'linear-gradient(135deg, #5a6fd6 0%, #663d91 100%)',
                      }
                    }}
                  >
                    Save Analysis
                  </Button>
                )}
                {onAnalysisUpdate && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isEditable}
                        onChange={(e) => setIsEditable(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Edit Mode"
                    sx={{ 
                      '& .MuiTypography-root': { color: '#4a5568 !important' } 
                    }}
                  />
                )}
              </Box>
            </Box>

            <Alert 
              severity="info" 
              icon={<AutoAwesomeIcon />}
              sx={{ 
                mb: 3, 
                borderRadius: 2,
                '& .MuiAlert-message': { color: '#1e293b' },
                '& .MuiAlert-icon': { color: '#3b82f6' }
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                AI Analysis Complete
              </Typography>
              <Typography variant="body2">
                We've analyzed your content to understand your brand voice, audience, and strategy. 
                Use these insights to generate on-brand content automatically.
              </Typography>
            </Alert>

            <FormControlLabel
              control={
                <Checkbox
                  checked={useAnalysisForGenAI}
                  onChange={(e) => onUseAnalysisChange(e.target.checked)}
                  color="primary"
                  sx={{ '&.Mui-checked': { color: '#764ba2' } }}
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1f2937 !important' }}>
                    Use this analysis for AI generation
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#4b5563 !important' }}>
                    Apply these style guidelines to all future content generated by ALwrity
                  </Typography>
                </Box>
              }
              sx={{ 
                mt: 1,
                p: 2,
                borderRadius: 2,
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                width: '100%',
                ml: 0
              }}
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Key Insights Grid */}
          <KeyInsightsGrid 
            writing_style={analysis.writing_style}
            target_audience={analysis.target_audience}
            content_type={analysis.content_type}
          />

          {/* Brand Analysis Section — shown via CombinedAnalysisSection tab */}

          {(analysis.guidelines || guidelineWarning) && (
            <Box sx={{ mt: 4 }}>
              <SectionHeader 
                title="Style Guidelines" 
                icon={<AutoAwesomeIcon />} 
              />
              {guidelineWarning && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {guidelineWarning}
                </Alert>
              )}
              {analysis.guidelines && (
                <EnhancedGuidelinesSection 
                  guidelines={analysis.guidelines}
                  domainName={domainName}
                />
              )}
            </Box>
          )}

          {/* SEO Audit Section */}
          <Box sx={{ mt: 4 }}>
             <SectionHeader 
              title="SEO Audit" 
              icon={<AnalyticsIcon />} 
            />
             <SEOAuditSection
               seoAudit={analysis.seo_audit}
               domainName={domainName}
               onRunAudit={() => handleRunSEOAudit(domainName)}
             />
          </Box>

          <Box sx={{ mt: 4 }}>
             <SectionHeader 
              title="Sitemap Analysis" 
              icon={<LinkIcon />} 
            />
             {sitemapWarning && (
               <Alert severity="warning" sx={{ mb: 2 }}>
                 {sitemapWarning}
               </Alert>
             )}
             <SitemapAnalysisSection
               sitemapAnalysis={analysis.sitemap_analysis}
               domainName={domainName}
             />
          </Box>

          {/* Combined Analysis Section (Legacy Support) */}
          <Box sx={{ mt: 4 }}>
            <CombinedAnalysisSection 
              contentCharacteristics={analysis.content_characteristics}
              targetAudience={analysis.target_audience}
              contentType={analysis.content_type}
              brandAnalysis={analysis.brand_analysis}
              contentStrategyInsights={analysis.content_strategy_insights}
              isEditable={isEditable}
              onUpdate={handleSectionUpdate}
            />
          </Box>

          {/* Combined Strategy Section (Legacy Support) */}
          <Box sx={{ mt: 4 }}>
             <CombinedStrategySection 
               contentStrategy={analysis.strategic_insights?.content_strategy}
               competitiveAdvantages={analysis.strategic_insights?.competitive_advantages}
               contentCalendarSuggestions={analysis.strategic_insights?.content_calendar_suggestions}
               aiGenerationTips={analysis.strategic_insights?.ai_generation_tips}
               stylePatterns={analysis.style_patterns}
               domainName={domainName}
               isEditable={isEditable}
               onUpdate={handleSectionUpdate}
             />
          </Box>
          
          {/* Crawl Result Sections */}
          {crawlResult && (
            <CrawlResultSections crawlResult={crawlResult} />
          )}

        </CardContent>
      </Card>
    </Box>
  );
};

export default AnalysisResultsDisplay;
