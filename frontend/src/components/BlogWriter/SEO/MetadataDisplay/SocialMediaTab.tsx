/**
 * Social Media Tab Component
 * 
 * Displays and allows editing of social media metadata including:
 * - Open Graph tags (Facebook, LinkedIn)
 * - Twitter Card tags
 * - Social media previews
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  InputAdornment,
  Alert,
  Card,
  CardContent,
  Divider,
  Chip
} from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ShareIcon from '@mui/icons-material/Share';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';

interface SocialMediaTabProps {
  metadata: any;
  onMetadataEdit: (field: string, value: any) => void;
  onCopyToClipboard: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
}

export const SocialMediaTab: React.FC<SocialMediaTabProps> = ({
  metadata,
  onMetadataEdit,
  onCopyToClipboard,
  copiedItems
}) => {
  const handleTextFieldChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onMetadataEdit(field, event.target.value);
  };

  const handleNestedFieldChange = (parentField: string, childField: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = metadata[parentField] || {};
    onMetadataEdit(parentField, {
      ...currentValue,
      [childField]: event.target.value
    });
  };

  const getCharacterCountColor = (current: number, max: number) => {
    if (current > max) return 'error';
    if (current > max * 0.9) return 'warning';
    return 'success';
  };

  const getCharacterCountText = (current: number, max: number) => {
    if (current > max) return `${current}/${max} (Too long)`;
    if (current > max * 0.9) return `${current}/${max} (Near limit)`;
    return `${current}/${max}`;
  };

  // Consistent text input styling for better contrast
  const textInputSx = {
    '& .MuiInputBase-input': {
      color: '#202124'
    },
    '& .MuiInputLabel-root': {
      color: '#5f6368'
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#dadce0'
    }
  } as const;

  const openGraph = metadata.open_graph || {};
  const twitterCard = metadata.twitter_card || {};

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: '#202124', fontWeight: 600 }}>
        <ShareIcon sx={{ color: 'primary.main' }} />
        Social Media Metadata
      </Typography>

      <Grid container spacing={3}>
        {/* Open Graph Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <FacebookIcon sx={{ color: '#1877F2' }} />
              <LinkedInIcon sx={{ color: '#0077B5' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#202124' }}>
                Open Graph Tags
              </Typography>
              <Chip label="Facebook & LinkedIn" size="small" color="primary" />
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    OG Title
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(openGraph.title || '', 'og_title')}
                    >
                      {copiedItems.has('og_title') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={openGraph.title || ''}
                  onChange={handleNestedFieldChange('open_graph', 'title')}
                  placeholder="Open Graph title (60 characters max)"
                  sx={textInputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography
                          variant="caption"
                          color={getCharacterCountColor((openGraph.title || '').length, 60)}
                        >
                          {getCharacterCountText((openGraph.title || '').length, 60)}
                        </Typography>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    OG Description
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(openGraph.description || '', 'og_description')}
                    >
                      {copiedItems.has('og_description') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={openGraph.description || ''}
                  onChange={handleNestedFieldChange('open_graph', 'description')}
                  placeholder="Open Graph description (160 characters max)"
                  sx={textInputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography
                          variant="caption"
                          color={getCharacterCountColor((openGraph.description || '').length, 160)}
                        >
                          {getCharacterCountText((openGraph.description || '').length, 160)}
                        </Typography>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    OG Image URL
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(openGraph.image || '', 'og_image')}
                    >
                      {copiedItems.has('og_image') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={openGraph.image || ''}
                  onChange={handleNestedFieldChange('open_graph', 'image')}
                  placeholder="https://example.com/image.jpg"
                  sx={textInputSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ImageIcon />
                      </InputAdornment>
                    )
                  }}
                />
                {openGraph.image && (
                  <Box
                    component="img"
                    src={openGraph.image}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty('display');
                    }}
                    sx={{
                      mt: 1, height: 120, width: '100%', objectFit: 'cover', borderRadius: 1,
                      border: '1px solid', borderColor: 'divider', display: 'block'
                    }}
                  />
                )}
                <Box sx={{
                  mt: 1, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 1, border: '1px dashed', borderColor: 'divider', bgcolor: 'grey.50',
                  ...(openGraph.image ? { display: 'none' } : {})
                }}>
                  <Typography variant="caption" color="text.secondary">No preview</Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    OG URL
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(openGraph.url || '', 'og_url')}
                    >
                      {copiedItems.has('og_url') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={openGraph.url || ''}
                  onChange={handleNestedFieldChange('open_graph', 'url')}
                  placeholder="https://example.com/blog-post"
                  sx={textInputSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
            </Grid>

            <Typography variant="caption" sx={{ mt: 2, color: '#5f6368', display: 'block' }}>
              Open Graph tags are used by Facebook, LinkedIn, and others to display rich previews.
            </Typography>
          </Paper>
        </Grid>

        {/* Twitter Card Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <TwitterIcon sx={{ color: '#1DA1F2' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#202124' }}>
                Twitter Card Tags
              </Typography>
              <Chip label="Twitter & X" size="small" color="info" />
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Twitter Title
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(twitterCard.title || '', 'twitter_title')}
                    >
                      {copiedItems.has('twitter_title') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={twitterCard.title || ''}
                  onChange={handleNestedFieldChange('twitter_card', 'title')}
                  placeholder="Twitter card title (70 characters max)"
                  sx={textInputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography
                          variant="caption"
                          color={getCharacterCountColor((twitterCard.title || '').length, 70)}
                        >
                          {getCharacterCountText((twitterCard.title || '').length, 70)}
                        </Typography>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Twitter Description
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(twitterCard.description || '', 'twitter_description')}
                    >
                      {copiedItems.has('twitter_description') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={twitterCard.description || ''}
                  onChange={handleNestedFieldChange('twitter_card', 'description')}
                  placeholder="Twitter card description (200 characters max)"
                  sx={textInputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography
                          variant="caption"
                          color={getCharacterCountColor((twitterCard.description || '').length, 200)}
                        >
                          {getCharacterCountText((twitterCard.description || '').length, 200)}
                        </Typography>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Twitter Image URL
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(twitterCard.image || '', 'twitter_image')}
                    >
                      {copiedItems.has('twitter_image') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={twitterCard.image || ''}
                  onChange={handleNestedFieldChange('twitter_card', 'image')}
                  placeholder="https://example.com/twitter-image.jpg"
                  sx={textInputSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ImageIcon />
                      </InputAdornment>
                    )
                  }}
                />
                {twitterCard.image && (
                  <Box
                    component="img"
                    src={twitterCard.image}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty('display');
                    }}
                    sx={{
                      mt: 1, height: 120, width: '100%', objectFit: 'cover', borderRadius: 1,
                      border: '1px solid', borderColor: 'divider', display: 'block'
                    }}
                  />
                )}
                <Box sx={{
                  mt: 1, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 1, border: '1px dashed', borderColor: 'divider', bgcolor: 'grey.50',
                  ...(twitterCard.image ? { display: 'none' } : {})
                }}>
                  <Typography variant="caption" color="text.secondary">No preview</Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Twitter Site Handle
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(twitterCard.site || '', 'twitter_site')}
                    >
                      {copiedItems.has('twitter_site') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={twitterCard.site || ''}
                  onChange={handleNestedFieldChange('twitter_card', 'site')}
                  placeholder="@yourwebsite"
                  sx={textInputSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <TwitterIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
            </Grid>

            <Typography variant="caption" sx={{ mt: 2, color: '#5f6368', display: 'block' }}>
              Twitter cards provide rich previews when your content is shared on Twitter/X.
            </Typography>
          </Paper>
        </Grid>

        {/* Social Media Preview */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
              <ShareIcon />
              Social Media Preview
            </Typography>
            
            <Grid container spacing={2}>
              {/* Facebook Preview */}
              <Grid item xs={12} md={6}>
                <Card sx={{ border: '1px solid #e0e0e0', boxShadow: 'none', background: '#ffffff' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <FacebookIcon sx={{ color: '#1877F2' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                        Facebook Preview
                      </Typography>
                    </Box>
                    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2.5, bgcolor: '#fafafa' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#202124' }}>
                        {openGraph.title || 'Your Blog Title'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#5f6368', mb: 1, display: 'block' }}>
                        {openGraph.url || 'yourwebsite.com'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', color: '#5f6368' }}>
                        {openGraph.description || 'Your meta description will appear here...'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Twitter Preview */}
              <Grid item xs={12} md={6}>
                <Card sx={{ border: '1px solid #e0e0e0', boxShadow: 'none', background: '#ffffff' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <TwitterIcon sx={{ color: '#1DA1F2' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                        Twitter Preview
                      </Typography>
                    </Box>
                    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2.5, bgcolor: '#fafafa' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#202124' }}>
                        {twitterCard.title || 'Your Blog Title'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#5f6368', mb: 1, display: 'block' }}>
                        {twitterCard.site || '@yourwebsite'}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', color: '#5f6368' }}>
                        {twitterCard.description || 'Your Twitter description will appear here...'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
