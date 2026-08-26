/**
 * Preview Card Component
 * 
 * Displays live previews of how the metadata will appear in:
 * - Search engine results
 * - Social media platforms
 * - Rich snippets
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  Tabs,
  Tab,
  Tooltip,
  IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import GoogleIcon from '@mui/icons-material/Google';
import InfoIcon from '@mui/icons-material/Info';

interface PreviewCardProps {
  metadata: any;
  blogTitle: string;
  previewTabValue: string;
  onPreviewTabChange: (value: string) => void;
}

export const PreviewCard: React.FC<PreviewCardProps> = ({
  metadata,
  blogTitle,
  previewTabValue,
  onPreviewTabChange
}) => {
  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Box>
      {/* Title with Tooltip */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <SearchIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Live Preview
        </Typography>
        <Tooltip 
          title="This is how your blog post will appear in search results and social media platforms"
          arrow
          placement="top"
        >
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Platform Sub-Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={previewTabValue}
          onChange={(e, newValue) => onPreviewTabChange(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minHeight: 48
            },
            '& .Mui-selected': {
              fontWeight: 600
            }
          }}
        >
          <Tab 
            icon={<GoogleIcon />} 
            iconPosition="start" 
            label="Google Search Results" 
            value="google"
          />
          <Tab 
            icon={<FacebookIcon />} 
            iconPosition="start" 
            label="Facebook Preview" 
            value="facebook"
          />
          <Tab 
            icon={<TwitterIcon />} 
            iconPosition="start" 
            label="Twitter Preview" 
            value="twitter"
          />
          <Tab 
            icon={<CodeIcon />} 
            iconPosition="start" 
            label="Rich Snippets Preview" 
            value="richsnippets"
          />
        </Tabs>
      </Box>

      {/* Google Search Results Preview */}
      {previewTabValue === 'google' && (
        <Paper 
          sx={{ 
            p: 3, 
            background: '#ffffff', 
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <GoogleIcon sx={{ color: '#4285F4', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#202124' }}>
              Google Search Results
            </Typography>
          </Box>

          {/* Google SERP Preview - Light Theme (matches actual Google) */}
          <Card 
            sx={{ 
              background: '#ffffff',
              border: 'none',
              boxShadow: 'none',
              maxWidth: 600
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              {/* URL - Google Blue */}
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#202124',
                  fontSize: '14px',
                  lineHeight: 1.3,
                  mb: 0.5,
                  display: 'block',
                  fontFamily: 'arial, sans-serif'
                }}
              >
                {metadata.canonical_url || 'https://yourwebsite.com/blog-post'}
              </Typography>
              
              {/* Title - Google Blue, hover underline */}
              <Typography 
                variant="h6" 
                sx={{ 
                  color: '#1a0dab',
                  fontWeight: 400,
                  fontSize: '20px',
                  lineHeight: 1.3,
                  mb: 0.5,
                  cursor: 'pointer',
                  fontFamily: 'arial, sans-serif',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                {metadata.seo_title || blogTitle}
              </Typography>
              
              {/* Description - Google Gray */}
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#4d5156',
                  lineHeight: 1.58,
                  fontSize: '14px',
                  fontFamily: 'arial, sans-serif',
                  mb: 1
                }}
              >
                {metadata.meta_description || 'Your meta description will appear here in Google search results...'}
              </Typography>
              
              {/* Additional Info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#70757a',
                    fontSize: '14px',
                    fontFamily: 'arial, sans-serif'
                  }}
                >
                  {getCurrentDate()}
                </Typography>
                <Typography variant="caption" sx={{ color: '#70757a', fontSize: '14px' }}>
                  • {metadata.reading_time || 5} min read
                </Typography>
                {metadata.blog_tags && metadata.blog_tags.length > 0 && (
                  <>
                    <Typography variant="caption" sx={{ color: '#70757a', fontSize: '14px' }}>
                      • {metadata.blog_tags.slice(0, 2).join(', ')}
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Paper>
      )}

      {/* Facebook Preview */}
      {previewTabValue === 'facebook' && (
        <Paper 
          sx={{ 
            p: 3, 
            background: '#ffffff', 
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <FacebookIcon sx={{ color: '#1877F2', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1c1e21' }}>
              Facebook Preview
            </Typography>
            <Chip label="Open Graph" size="small" sx={{ bgcolor: '#e7f3ff', color: '#1877F2' }} />
          </Box>

          {/* Facebook Card Preview */}
          <Card 
            sx={{ 
              border: '1px solid #dadde1',
              borderRadius: 2,
              boxShadow: 'none',
              maxWidth: 500,
              background: '#ffffff',
              overflow: 'hidden'
            }}
          >
            <CardContent sx={{ p: 0 }}>
              {/* Image */}
              <Box sx={{ height: 262, bgcolor: '#f2f3f5', borderBottom: '1px solid #dadde1', position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="caption" sx={{ color: '#65676b' }}>
                    {metadata.open_graph?.image ? 'Loading image...' : 'No image set'}
                  </Typography>
                </Box>
                {metadata.open_graph?.image && (
                  <Box
                    component="img"
                    src={metadata.open_graph.image}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </Box>
              
              <Box sx={{ p: 2.5, bgcolor: '#ffffff' }}>
                {/* URL */}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#65676b',
                    fontSize: '12px',
                    mb: 0.75,
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {metadata.canonical_url ? new URL(metadata.canonical_url).hostname : 'yourwebsite.com'}
                </Typography>
                
                {/* Title */}
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    fontWeight: 600, 
                    mb: 1, 
                    lineHeight: 1.33,
                    fontSize: '17px',
                    color: '#050505',
                    fontFamily: 'Helvetica, Arial, sans-serif'
                  }}
                >
                  {metadata.open_graph?.title || metadata.seo_title || blogTitle}
                </Typography>
                
                {/* Description */}
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#65676b', 
                    lineHeight: 1.33,
                    fontSize: '15px',
                    fontFamily: 'Helvetica, Arial, sans-serif'
                  }}
                >
                  {metadata.open_graph?.description || metadata.meta_description || 'Your description will appear here...'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Paper>
      )}

      {/* Twitter Preview */}
      {previewTabValue === 'twitter' && (
        <Paper 
          sx={{ 
            p: 3, 
            background: '#ffffff', 
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <TwitterIcon sx={{ color: '#1DA1F2', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f1419' }}>
              Twitter Preview
            </Typography>
            <Chip label="Twitter Card" size="small" sx={{ bgcolor: '#e1f5fe', color: '#1DA1F2' }} />
          </Box>

          {/* Twitter Card Preview */}
          <Card 
            sx={{ 
              border: '1px solid #eff3f4',
              borderRadius: 2,
              boxShadow: 'none',
              maxWidth: 500,
              background: '#ffffff',
              overflow: 'hidden'
            }}
          >
            <CardContent sx={{ p: 0 }}>
              {/* Image */}
              <Box sx={{ height: 262, bgcolor: '#f7f9fa', borderBottom: '1px solid #eff3f4', position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="caption" sx={{ color: '#536471' }}>
                    {metadata.twitter_card?.image ? 'Loading image...' : 'No image set'}
                  </Typography>
                </Box>
                {metadata.twitter_card?.image && (
                  <Box
                    component="img"
                    src={metadata.twitter_card.image}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                    sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </Box>
              
              <Box sx={{ p: 2.5, bgcolor: '#ffffff' }}>
                {/* URL */}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#536471',
                    fontSize: '13px',
                    mb: 0.75,
                    display: 'block',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  {metadata.canonical_url ? new URL(metadata.canonical_url).hostname : 'yourwebsite.com'}
                </Typography>
                
                {/* Title */}
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    fontWeight: 600, 
                    mb: 1, 
                    lineHeight: 1.33,
                    fontSize: '15px',
                    color: '#0f1419',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  {metadata.twitter_card?.title || metadata.seo_title || blogTitle}
                </Typography>
                
                {/* Description */}
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#536471', 
                    lineHeight: 1.33,
                    fontSize: '15px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  {metadata.twitter_card?.description || metadata.meta_description || 'Your description will appear here...'}
                </Typography>
                
                {/* Twitter handle */}
                {metadata.twitter_card?.site && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#536471', 
                      mt: 1, 
                      display: 'block',
                      fontSize: '13px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}
                  >
                    {metadata.twitter_card.site}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Paper>
      )}

      {/* Rich Snippets Preview */}
      {previewTabValue === 'richsnippets' && (
        <Paper 
          sx={{ 
            p: 3, 
            background: '#ffffff', 
            border: '1px solid #e0e0e0',
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <CodeIcon sx={{ color: '#34A853', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#202124' }}>
              Rich Snippets Preview
            </Typography>
            <Chip label="JSON-LD Schema" size="small" sx={{ bgcolor: '#e8f5e9', color: '#34A853' }} />
          </Box>

          {/* Rich Snippets Card */}
          <Card 
            sx={{ 
              background: '#ffffff',
              border: '1px solid #e0e0e0',
              borderRadius: 2,
              boxShadow: 'none',
              maxWidth: 600
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Article Schema Preview */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#202124' }}>
                  {metadata.json_ld_schema?.headline || metadata.seo_title || blogTitle}
                </Typography>
                <Chip label="Article" size="small" sx={{ bgcolor: '#e8f5e9', color: '#34A853' }} />
              </Box>
              
              <Typography 
                variant="body1" 
                sx={{ 
                  color: '#4d5156', 
                  mb: 2,
                  lineHeight: 1.6,
                  fontSize: '14px'
                }}
              >
                {metadata.json_ld_schema?.description || metadata.meta_description || 'Article description...'}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                {metadata.json_ld_schema?.author?.name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#70757a', fontSize: '13px' }}>
                      By {metadata.json_ld_schema.author.name}
                    </Typography>
                  </Box>
                )}
                
                {metadata.json_ld_schema?.datePublished && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#70757a', fontSize: '13px' }}>
                      {new Date(metadata.json_ld_schema.datePublished).toLocaleDateString()}
                    </Typography>
                  </Box>
                )}
                
                {metadata.reading_time && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#70757a', fontSize: '13px' }}>
                      {metadata.reading_time} min read
                    </Typography>
                  </Box>
                )}
                
                {metadata.json_ld_schema?.wordCount && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#70757a', fontSize: '13px' }}>
                      {metadata.json_ld_schema.wordCount} words
                    </Typography>
                  </Box>
                )}
              </Box>
              
              {metadata.json_ld_schema?.keywords && metadata.json_ld_schema.keywords.length > 0 && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                  <Typography variant="caption" sx={{ color: '#70757a', display: 'block', mb: 1, fontWeight: 500 }}>
                    Keywords:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {metadata.json_ld_schema.keywords.slice(0, 5).map((keyword: string, index: number) => (
                      <Chip 
                        key={index} 
                        label={keyword} 
                        size="small" 
                        variant="outlined" 
                        sx={{ borderColor: '#e0e0e0', color: '#4d5156' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Paper>
      )}
    </Box>
  );
};
