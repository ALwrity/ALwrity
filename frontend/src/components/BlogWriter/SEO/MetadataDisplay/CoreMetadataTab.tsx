/**
 * Core Metadata Tab Component
 * 
 * Displays and allows editing of core SEO metadata including:
 * - SEO Title
 * - Meta Description
 * - URL Slug
 * - Blog Tags
 * - Blog Categories
 * - Social Hashtags
 * - Reading Time
 * - Focus Keyword
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Alert
} from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import TagIcon from '@mui/icons-material/Tag';
import CategoryIcon from '@mui/icons-material/Category';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface CoreMetadataTabProps {
  metadata: any;
  onMetadataEdit: (field: string, value: any) => void;
  onCopyToClipboard: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
}

export const CoreMetadataTab: React.FC<CoreMetadataTabProps> = ({
  metadata,
  onMetadataEdit,
  onCopyToClipboard,
  copiedItems
}) => {
  const handleTextFieldChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onMetadataEdit(field, event.target.value);
  };

  const handleTagsChange = (field: string) => (event: any) => {
    const value = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;
    onMetadataEdit(field, value);
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#ca8a04';
    return '#dc2626';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#202124', fontWeight: 600 }}>
          <SearchIcon sx={{ color: 'primary.main' }} />
          Core SEO Metadata
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {metadata.optimization_score != null && (
            <Tooltip title="AI-generated metadata quality score">
              <Chip
                label={`Score: ${metadata.optimization_score}/100`}
                size="small"
                sx={{
                  fontWeight: 600,
                  color: '#fff',
                  bgcolor: getScoreColor(metadata.optimization_score),
                }}
              />
            </Tooltip>
          )}
          {metadata.generated_at && (
            <Typography variant="caption" sx={{ color: '#5f6368' }}>
              Generated: {formatDate(metadata.generated_at)}
            </Typography>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* SEO Title */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
                <SearchIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                SEO Title
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton
                  size="small"
                  onClick={() => onCopyToClipboard(metadata.seo_title || '', 'seo_title')}
                >
                  {copiedItems.has('seo_title') ? <CheckIcon color="success" /> : <CopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>

            {/* Title options selector */}
            {metadata.title_options && metadata.title_options.length > 1 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: '#5f6368', mb: 1, display: 'block', fontWeight: 500 }}>
                  Choose a title option:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {metadata.title_options.map((opt: string, idx: number) => (
                    <Chip
                      key={idx}
                      label={opt}
                      size="small"
                      variant={metadata.seo_title === opt ? 'filled' : 'outlined'}
                      onClick={() => onMetadataEdit('seo_title', opt)}
                      sx={{
                        justifyContent: 'flex-start',
                        height: 'auto',
                        py: 0.5,
                        '& .MuiChip-label': { whiteSpace: 'normal', display: 'block' },
                        ...(metadata.seo_title === opt ? { bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 } : {}),
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <TextField
              fullWidth
              multiline
              rows={2}
              value={metadata.seo_title || ''}
              onChange={handleTextFieldChange('seo_title')}
              placeholder="Enter SEO-optimized title (50-60 characters)"
              sx={textInputSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography
                      variant="caption"
                      color={getCharacterCountColor((metadata.seo_title || '').length, 60)}
                    >
                      {getCharacterCountText((metadata.seo_title || '').length, 60)}
                    </Typography>
                  </InputAdornment>
                )
              }}
            />
            <Typography variant="caption" sx={{ mt: 1, color: '#5f6368', display: 'block' }}>
              Include your primary keyword and keep between 50–60 characters
            </Typography>
          </Paper>
        </Grid>

        {/* Meta Description */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
                <SearchIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                Meta Description
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton
                  size="small"
                  onClick={() => onCopyToClipboard(metadata.meta_description || '', 'meta_description')}
                >
                  {copiedItems.has('meta_description') ? <CheckIcon color="success" /> : <CopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>

            {/* Meta description options selector */}
            {metadata.meta_descriptions && metadata.meta_descriptions.length > 1 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: '#5f6368', mb: 1, display: 'block', fontWeight: 500 }}>
                  Choose a description option:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {metadata.meta_descriptions.map((opt: string, idx: number) => (
                    <Chip
                      key={idx}
                      label={opt}
                      size="small"
                      variant={metadata.meta_description === opt ? 'filled' : 'outlined'}
                      onClick={() => onMetadataEdit('meta_description', opt)}
                      sx={{
                        justifyContent: 'flex-start',
                        height: 'auto',
                        py: 0.5,
                        '& .MuiChip-label': { whiteSpace: 'normal', display: 'block' },
                        ...(metadata.meta_description === opt ? { bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 } : {}),
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <TextField
              fullWidth
              multiline
              rows={3}
              value={metadata.meta_description || ''}
              onChange={handleTextFieldChange('meta_description')}
              placeholder="Enter compelling meta description (150-160 characters)"
              sx={textInputSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography
                      variant="caption"
                      color={getCharacterCountColor((metadata.meta_description || '').length, 160)}
                    >
                      {getCharacterCountText((metadata.meta_description || '').length, 160)}
                    </Typography>
                  </InputAdornment>
                )
              }}
            />
            <Typography variant="caption" sx={{ mt: 1, color: '#5f6368', display: 'block' }}>
              Aim for 150–160 characters with a clear value proposition
            </Typography>
          </Paper>
        </Grid>

        {/* URL Slug */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
                <LinkIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                URL Slug
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton
                  size="small"
                  onClick={() => onCopyToClipboard(metadata.url_slug || '', 'url_slug')}
                >
                  {copiedItems.has('url_slug') ? <CheckIcon color="success" /> : <CopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            <TextField
              fullWidth
              value={metadata.url_slug || ''}
              onChange={handleTextFieldChange('url_slug')}
              placeholder="seo-friendly-url-slug"
              helperText="Use lowercase letters, numbers, and hyphens only"
              sx={textInputSx}
              FormHelperTextProps={{ sx: { color: '#5f6368' } }}
            />
          </Paper>
        </Grid>

        {/* Focus Keyword */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
                <TrendingUpIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                Focus Keyword
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton
                  size="small"
                  onClick={() => onCopyToClipboard(metadata.focus_keyword || '', 'focus_keyword')}
                >
                  {copiedItems.has('focus_keyword') ? <CheckIcon color="success" /> : <CopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            <TextField
              fullWidth
              value={metadata.focus_keyword || ''}
              onChange={handleTextFieldChange('focus_keyword')}
              placeholder="primary-keyword"
              helperText="Your main SEO keyword for this post"
              sx={textInputSx}
              FormHelperTextProps={{ sx: { color: '#5f6368' } }}
            />
          </Paper>
        </Grid>

        {/* Blog Tags */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
                <TagIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                Blog Tags
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton
                  size="small"
                  onClick={() => onCopyToClipboard((metadata.blog_tags || []).join(', '), 'blog_tags')}
                >
                  {copiedItems.has('blog_tags') ? <CheckIcon color="success" /> : <CopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#5f6368' }}>Tags</InputLabel>
              <Select
                multiple
                value={metadata.blog_tags || []}
                onChange={handleTagsChange('blog_tags')}
                input={<OutlinedInput label="Tags" sx={{ color: '#202124', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dadce0' } }} />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value: string) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {(metadata.blog_tags || []).map((tag: string) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" sx={{ mt: 1, color: '#5f6368', display: 'block' }}>
              Add 3–6 relevant tags for better categorization and discoverability
            </Typography>
          </Paper>
        </Grid>

        {/* Blog Categories */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
                <CategoryIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                Blog Categories
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton
                  size="small"
                  onClick={() => onCopyToClipboard((metadata.blog_categories || []).join(', '), 'blog_categories')}
                >
                  {copiedItems.has('blog_categories') ? <CheckIcon color="success" /> : <CopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#5f6368' }}>Categories</InputLabel>
              <Select
                multiple
                value={metadata.blog_categories || []}
                onChange={handleTagsChange('blog_categories')}
                input={<OutlinedInput label="Categories" sx={{ color: '#202124', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dadce0' } }} />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value: string) => (
                      <Chip key={value} label={value} size="small" color="primary" />
                    ))}
                  </Box>
                )}
              >
                {(metadata.blog_categories || []).map((category: string) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" sx={{ mt: 1, color: '#5f6368', display: 'block' }}>
              Select 1–3 primary categories for your content
            </Typography>
          </Paper>
        </Grid>

        {/* Social Hashtags */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
                <TagIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                Social Hashtags
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton
                  size="small"
                  onClick={() => onCopyToClipboard((metadata.social_hashtags || []).join(' '), 'social_hashtags')}
                >
                  {copiedItems.has('social_hashtags') ? <CheckIcon color="success" /> : <CopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#5f6368' }}>Hashtags</InputLabel>
              <Select
                multiple
                value={metadata.social_hashtags || []}
                onChange={handleTagsChange('social_hashtags')}
                input={<OutlinedInput label="Hashtags" sx={{ color: '#202124', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dadce0' } }} />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value: string) => (
                      <Chip key={value} label={value} size="small" color="secondary" />
                    ))}
                  </Box>
                )}
              >
                {(metadata.social_hashtags || []).map((hashtag: string) => (
                  <MenuItem key={hashtag} value={hashtag}>
                    {hashtag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" sx={{ mt: 1, color: '#5f6368', display: 'block' }}>
              Include # symbol (e.g., #multimodalAI). 3–5 hashtags recommended.
            </Typography>
          </Paper>
        </Grid>

        {/* Reading Time */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
                <ScheduleIcon sx={{ fontSize: 20, color: '#5f6368' }} />
                Reading Time
              </Typography>
              <Tooltip title="Copy to clipboard">
                <IconButton
                  size="small"
                  onClick={() => onCopyToClipboard(`${metadata.reading_time || 0} minutes`, 'reading_time')}
                >
                  {copiedItems.has('reading_time') ? <CheckIcon color="success" /> : <CopyIcon />}
                </IconButton>
              </Tooltip>
            </Box>
            <TextField
              fullWidth
              type="number"
              value={metadata.reading_time || 0}
              onChange={handleTextFieldChange('reading_time')}
              placeholder="5"
              InputProps={{
                endAdornment: <InputAdornment position="end">minutes</InputAdornment>
              }}
              helperText="Estimated reading time for your content"
              sx={textInputSx}
              FormHelperTextProps={{ sx: { color: '#5f6368' } }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
