/**
 * Website Step Rendering Utility Functions
 * Extracted rendering components for website analysis display
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Button,
  Slide,
  Zoom
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Psychology as PsychologyIcon,
  Analytics as AnalyticsIcon,
  Business as BusinessIcon,
  AutoAwesome as AutoAwesomeIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  AccountTree as SitemapIcon,
  Speed as SpeedIcon,
  Devices as DevicesIcon
} from '@mui/icons-material';

/**
 * Key Insight Card Component
 */
interface KeyInsightProps {
  title: string;
  value: string | string[];
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}

const KeyInsightCard: React.FC<KeyInsightProps> = ({ 
  title, 
  value, 
  icon, 
  color = 'primary' 
}) => {
  const theme = useTheme();
  
  const getPaletteColor = (colorKey: string) => {
    const palette = theme.palette as any;
    return palette[colorKey] || palette.primary;
  };
  
  const paletteColor = getPaletteColor(color);
  
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2.5, 
        mb: 0, 
        borderRadius: 2.5,
        color: '#1a202c !important',
        background: '#ffffff !important',
        backgroundImage: 'none !important',
        backgroundColor: '#ffffff !important',
        opacity: '1 !important',
        border: `2px solid`,
        borderColor: alpha(paletteColor.main, 0.35),
        borderLeftWidth: '5px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        mixBlendMode: 'normal',
        '& .MuiTypography-root': {
          color: '#111827 !important',
          WebkitTextFillColor: '#111827',
        },
        '&:hover': {
          background: '#ffffff !important',
          borderColor: alpha(paletteColor.main, 0.55),
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 40px ${alpha(paletteColor.main, 0.15)}`
        }
      }}
    >
      <Box display="flex" alignItems="center" gap={2}>
        <Box 
          sx={{ 
            color: `${color}.main`, 
            fontSize: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 2,
            background: alpha(paletteColor.main, 0.14),
          }}
        >
          {icon}
        </Box>
        <Box flex={1}>
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: 800, 
              fontSize: '0.78rem',
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: '#1f2937 !important',
              textShadow: '0 1px 0 rgba(255,255,255,0.6)',
              mb: 0.5,
              display: 'block',
              WebkitTextFillColor: '#1f2937',
              WebkitTextStroke: '0px transparent'
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              fontWeight: 700,
              fontSize: '1.1rem',
              color: '#111827 !important',
              lineHeight: 1.35,
              WebkitTextFillColor: '#111827',
              WebkitTextStroke: '0px transparent'
            }}
          >
            {Array.isArray(value) ? value.join(', ') : value}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

/**
 * Backward-compatible wrapper function for renderKeyInsight
 * @deprecated Use KeyInsightCard component directly instead
 */
export const renderKeyInsight = (
  title: string,
  value: string | string[],
  icon: React.ReactNode,
  color: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' = 'primary'
) => <KeyInsightCard title={title} value={value} icon={icon} color={color} />;

/**
 * Renders a guidelines card with title, items, and icon
 */
export const renderGuidelinesCard = (
  title: string, 
  items: string[], 
  icon: React.ReactNode, 
  color: string = 'primary'
) => (
  <Zoom in timeout={600}>
    <Card sx={{ mb: 2, border: `1px solid ${color}.light` }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Box sx={{ color: `${color}.main` }}>
            {icon}
          </Box>
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          {items.map((item, index) => (
            <Typography component="li" variant="body2" key={index} sx={{ mb: 1, lineHeight: 1.6 }}>
              {item}
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  </Zoom>
);

/**
 * Renders the pro upgrade alert
 */
export const renderProUpgradeAlert = () => (
  <Slide direction="up" in timeout={1000}>
    <Alert 
      severity="info" 
      sx={{ 
        mb: 3, 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        '& .MuiAlert-icon': { color: 'white' }
      }}
      action={
        <Button color="inherit" size="small" variant="outlined" sx={{ color: 'white', borderColor: 'white' }}>
          Learn More
        </Button>
      }
    >
      <Typography variant="subtitle2" gutterBottom>
        <StarIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Limited Analysis Scope
      </Typography>
      <Typography variant="body2">
        This analysis is based on your homepage only. <strong>ALwrity Pro</strong> can index your entire website and social media content for comprehensive personalized content generation.
      </Typography>
    </Alert>
  </Slide>
);

/**
 * Renders the brand analysis section
 */
export const renderBrandAnalysisSection = (brandAnalysis: any) => (
  <Zoom in timeout={700}>
    <Card sx={{ mb: 2, border: '2px solid info.light', background: 'info.50' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <BusinessIcon color="info" />
          <Typography variant="h6" fontWeight={600} color="info.main">
            Brand Analysis
          </Typography>
        </Box>
        
        <Grid container spacing={2}>
          {brandAnalysis.brand_voice && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Brand Voice:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {brandAnalysis.brand_voice}
              </Typography>
            </Grid>
          )}
          
          {brandAnalysis.brand_positioning && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Brand Positioning:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {brandAnalysis.brand_positioning}
              </Typography>
            </Grid>
          )}
          
          {brandAnalysis.brand_values && brandAnalysis.brand_values.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Brand Values:
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                {brandAnalysis.brand_values.map((value: string, index: number) => (
                  <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                    {value}
                  </Typography>
                ))}
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  </Zoom>
);

/**
 * Renders the content strategy insights section
 */
export const renderContentStrategyInsightsSection = (insights: any) => (
  <Zoom in timeout={800}>
    <Card sx={{ mb: 2, border: '2px solid secondary.light', background: 'secondary.50' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <AnalyticsIcon color="secondary" />
          <Typography variant="h6" fontWeight={600} color="secondary.main">
            Content Strategy Insights
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          {insights.strengths && insights.strengths.length > 0 && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="success.main" gutterBottom>
                ✅ Strengths:
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                {insights.strengths.map((strength: string, index: number) => (
                  <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                    {strength}
                  </Typography>
                ))}
              </Box>
            </Grid>
          )}
          
          {insights.opportunities && insights.opportunities.length > 0 && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="info.main" gutterBottom>
                🎯 Opportunities:
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                {insights.opportunities.map((opportunity: string, index: number) => (
                  <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                    {opportunity}
                  </Typography>
                ))}
              </Box>
            </Grid>
          )}
          
          {insights.recommended_improvements && insights.recommended_improvements.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                🔧 Recommended Improvements:
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                {insights.recommended_improvements.map((improvement: string, index: number) => (
                  <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                    {improvement}
                  </Typography>
                ))}
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  </Zoom>
);

/**
 * Renders the AI generation tips section
 */
export const renderAIGenerationTipsSection = (tips: string[]) => (
  <Zoom in timeout={900}>
    <Card sx={{ mb: 2, border: '2px solid primary.light', background: 'primary.50' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <AutoAwesomeIcon color="primary" />
          <Typography variant="h6" fontWeight={600} color="primary.main">
            AI Content Generation Tips
          </Typography>
        </Box>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          {tips.map((tip: string, index: number) => (
            <Typography component="li" variant="body2" key={index} sx={{ mb: 1, lineHeight: 1.6 }}>
              {tip}
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  </Zoom>
);

/**
 * Renders a best practices section card
 */
export const renderBestPracticesSection = (bestPractices: string[]) => (
  <Zoom in timeout={800}>
    <Card sx={{ border: '2px solid success.light', background: 'success.50' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <CheckIcon color="success" />
          <Typography variant="h6" fontWeight={600} color="success.main">
            Best Practices
          </Typography>
        </Box>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          {bestPractices.map((practice, index) => (
            <Typography component="li" variant="body2" key={index} sx={{ mb: 1, lineHeight: 1.6 }}>
              {practice}
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  </Zoom>
);

/**
 * Renders an avoid elements section card
 */
export const renderAvoidElementsSection = (avoidElements: string[]) => (
  <Zoom in timeout={1000}>
    <Card sx={{ border: '2px solid warning.light', background: 'warning.50' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <WarningIcon color="warning" />
          <Typography variant="h6" fontWeight={600} color="warning.main">
            Elements to Avoid
          </Typography>
        </Box>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          {avoidElements.map((element, index) => (
            <Typography component="li" variant="body2" key={index} sx={{ mb: 1, lineHeight: 1.6 }}>
              {element}
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  </Zoom>
);

/**
 * Renders a generic analysis section accordion
 */
export const renderAnalysisSection = (
  title: string, 
  data: any, 
  icon: React.ReactNode, 
  description?: string
) => (
  <Accordion key={title} sx={{ mb: 2 }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Box display="flex" alignItems="center" gap={1}>
        {icon}
        <Typography variant="h6">{title}</Typography>
      </Box>
    </AccordionSummary>
    <AccordionDetails>
      {description && (
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
      <Grid container spacing={2}>
        {Object.entries(data).map(([key, value]) => (
          <Grid item xs={12} md={6} key={key}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
            </Typography>
            <Typography variant="body2">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </Typography>
          </Grid>
        ))}
      </Grid>
    </AccordionDetails>
  </Accordion>
);

/**
 * Renders the SEO audit section
 */
export const renderSeoAuditSection = (seoAudit: any) => (
  <Zoom in timeout={900}>
    <Card sx={{ mb: 2, border: '2px solid primary.light', background: 'primary.50' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <SearchIcon color="primary" />
          <Typography variant="h6" fontWeight={600} color="primary.main">
            SEO Audit
          </Typography>
        </Box>
        
        <Grid container spacing={2}>
          {seoAudit.title_tag && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Title Tag:
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {seoAudit.title_tag}
              </Typography>
            </Grid>
          )}
          
          {seoAudit.meta_description && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Meta Description:
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {seoAudit.meta_description}
              </Typography>
            </Grid>
          )}
          
          {seoAudit.h1_tags && seoAudit.h1_tags.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                H1 Tags:
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                {seoAudit.h1_tags.map((tag: string, index: number) => (
                  <Typography component="li" variant="body2" key={index} sx={{ mb: 0.5 }}>
                    {tag}
                  </Typography>
                ))}
              </Box>
            </Grid>
          )}
          
          {seoAudit.page_load_speed && (
            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" gap={1}>
                <SpeedIcon color="action" fontSize="small" />
                <Typography variant="body2">
                  <strong>Load Speed:</strong> {seoAudit.page_load_speed}
                </Typography>
              </Box>
            </Grid>
          )}
          
          {seoAudit.mobile_friendliness && (
            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" gap={1}>
                <DevicesIcon color="action" fontSize="small" />
                <Typography variant="body2">
                  <strong>Mobile Friendly:</strong> {seoAudit.mobile_friendliness}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  </Zoom>
);

/**
 * Renders the sitemap analysis section
 */
export const renderSitemapAnalysisSection = (sitemapAnalysis: any) => (
  <Zoom in timeout={900}>
    <Card sx={{ mb: 2, border: '2px solid info.light', background: 'info.50' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <SitemapIcon color="info" />
          <Typography variant="h6" fontWeight={600} color="info.main">
            Sitemap Analysis
          </Typography>
        </Box>
        
        <Grid container spacing={2}>
          {sitemapAnalysis.total_pages && (
            <Grid item xs={6} sm={4}>
              <Typography variant="subtitle2" color="info.main">
                Total Pages
              </Typography>
              <Typography variant="h6">
                {sitemapAnalysis.total_pages}
              </Typography>
            </Grid>
          )}
          
          {sitemapAnalysis.content_types && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="info.main" gutterBottom>
                Content Types Distribution:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {Object.entries(sitemapAnalysis.content_types).map(([type, count]) => (
                  <Paper key={type} variant="outlined" sx={{ p: 1, borderColor: 'info.light' }}>
                    <Typography variant="body2">
                      <strong>{type}:</strong> {String(count)}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Grid>
          )}
          
          {sitemapAnalysis.structure_depth && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="info.main" gutterBottom>
                Site Structure:
              </Typography>
              <Typography variant="body2">
                Max Depth: {sitemapAnalysis.structure_depth} levels
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  </Zoom>
);

/**
 * Renders the guidelines section accordion
 */
export const renderGuidelinesSection = (guidelines: any) => (
  <Accordion sx={{ mb: 2 }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Box display="flex" alignItems="center" gap={1}>
        <PsychologyIcon color="primary" />
        <Typography variant="h6">Content Guidelines</Typography>
      </Box>
    </AccordionSummary>
    <AccordionDetails>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Personalized recommendations for improving your content creation based on your writing style analysis.
      </Typography>
      
      {guidelines.tone_recommendations && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" color="primary" gutterBottom>
            Tone Recommendations
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            {guidelines.tone_recommendations.map((rec: string, index: number) => (
              <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                {rec}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {guidelines.structure_guidelines && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" color="primary" gutterBottom>
            Structure Guidelines
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            {guidelines.structure_guidelines.map((guideline: string, index: number) => (
              <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                {guideline}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {guidelines.vocabulary_suggestions && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" color="primary" gutterBottom>
            Vocabulary Suggestions
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            {guidelines.vocabulary_suggestions.map((suggestion: string, index: number) => (
              <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                {suggestion}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {guidelines.engagement_tips && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" color="primary" gutterBottom>
            Engagement Tips
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            {guidelines.engagement_tips.map((tip: string, index: number) => (
              <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                {tip}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {guidelines.audience_considerations && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" color="primary" gutterBottom>
            Audience Considerations
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            {guidelines.audience_considerations.map((consideration: string, index: number) => (
              <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                {consideration}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </AccordionDetails>
  </Accordion>
);

/**
 * Renders the style patterns section accordion
 */
export const renderStylePatternsSection = (patterns: any) => (
  <Accordion sx={{ mb: 2 }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Box display="flex" alignItems="center" gap={1}>
        <AnalyticsIcon color="secondary" />
        <Typography variant="h6">Style Patterns</Typography>
      </Box>
    </AccordionSummary>
    <AccordionDetails>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Recurring patterns and characteristics identified in your writing style.
      </Typography>
      
      <Grid container spacing={2}>
        {Object.entries(patterns).map(([key, value]) => (
          <Grid item xs={12} md={6} key={key}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
            </Typography>
            <Typography variant="body2">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </Typography>
          </Grid>
        ))}
      </Grid>
    </AccordionDetails>
  </Accordion>
);



