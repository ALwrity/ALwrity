/**
 * Structured Data Tab Component
 * 
 * Displays and allows editing of JSON-LD structured data including:
 * - Article schema
 * - Author information
 * - Publisher details
 * - Publication dates
 * - Keywords and categories
 */

import React, { useState } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button
} from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';

interface StructuredDataTabProps {
  metadata: any;
  onMetadataEdit: (field: string, value: any) => void;
  onCopyToClipboard: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
}

export const StructuredDataTab: React.FC<StructuredDataTabProps> = ({
  metadata,
  onMetadataEdit,
  onCopyToClipboard,
  copiedItems
}) => {
  const [showRawJson, setShowRawJson] = useState(false);
  
  // Helpers for counters and consistent input styling
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

  const textInputSx = {
    '& .MuiInputBase-input': {
      color: '#202124'
    },
    '& .MuiInputLabel-root': {
      color: '#5f6368'
    }
  } as const;
  
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

  const handleAuthorFieldChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const currentSchema = metadata.json_ld_schema || {};
    const currentAuthor = currentSchema.author || {};
    onMetadataEdit('json_ld_schema', {
      ...currentSchema,
      author: {
        ...currentAuthor,
        [field]: event.target.value
      }
    });
  };

  const handlePublisherFieldChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const currentSchema = metadata.json_ld_schema || {};
    const currentPublisher = currentSchema.publisher || {};
    onMetadataEdit('json_ld_schema', {
      ...currentSchema,
      publisher: {
        ...currentPublisher,
        [field]: event.target.value
      }
    });
  };

  const handleSchemaFieldChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const currentSchema = metadata.json_ld_schema || {};
    onMetadataEdit('json_ld_schema', {
      ...currentSchema,
      [field]: event.target.value
    });
  };

  const getJsonLdSchema = () => {
    const schema = metadata.json_ld_schema || {};
    return JSON.stringify(schema, null, 2);
  };

  const copyJsonLdSchema = () => {
    onCopyToClipboard(getJsonLdSchema(), 'json_ld_schema');
  };

  const jsonLdSchema = metadata.json_ld_schema || {};
  const author = jsonLdSchema.author || {};
  const publisher = jsonLdSchema.publisher || {};

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
        <CodeIcon sx={{ color: 'primary.main' }} />
        Structured Data (JSON-LD)
      </Typography>

      <Grid container spacing={3}>
        {/* Article Information */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
              <CodeIcon />
              Article Schema
            </Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Headline
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(jsonLdSchema.headline || '', 'schema_headline')}
                    >
                      {copiedItems.has('schema_headline') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={jsonLdSchema.headline || ''}
                  onChange={handleSchemaFieldChange('headline')}
                  placeholder="Article headline"
                  sx={textInputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography
                          variant="caption"
                          color={getCharacterCountColor((jsonLdSchema.headline || '').length, 110)}
                        >
                          {getCharacterCountText((jsonLdSchema.headline || '').length, 110)}
                        </Typography>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Description
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(jsonLdSchema.description || '', 'schema_description')}
                    >
                      {copiedItems.has('schema_description') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={1}
                  value={jsonLdSchema.description || ''}
                  onChange={handleSchemaFieldChange('description')}
                  placeholder="Article description"
                  sx={textInputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography
                          variant="caption"
                          color={getCharacterCountColor((jsonLdSchema.description || '').length, 200)}
                        >
                          {getCharacterCountText((jsonLdSchema.description || '').length, 200)}
                        </Typography>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Main Entity URL
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(jsonLdSchema.mainEntityOfPage || '', 'schema_url')}
                    >
                      {copiedItems.has('schema_url') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={jsonLdSchema.mainEntityOfPage || ''}
                  onChange={handleSchemaFieldChange('mainEntityOfPage')}
                  placeholder="https://example.com/blog-post"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CodeIcon />
                      </InputAdornment>
                    )
                  }}
                  sx={textInputSx}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Word Count
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(jsonLdSchema.wordCount?.toString() || '', 'schema_wordcount')}
                    >
                      {copiedItems.has('schema_wordcount') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  type="number"
                  value={jsonLdSchema.wordCount || ''}
                  onChange={handleSchemaFieldChange('wordCount')}
                  placeholder="1500"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">words</InputAdornment>
                  }}
                  sx={textInputSx}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Author Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
              <PersonIcon />
              Author Information
            </Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Author Name
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(author.name || '', 'author_name')}
                    >
                      {copiedItems.has('author_name') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={author.name || ''}
                  onChange={handleAuthorFieldChange('name')}
                  placeholder="Author Name"
                  sx={textInputSx}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Author Type
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(author['@type'] || '', 'author_type')}
                    >
                      {copiedItems.has('author_type') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={author['@type'] || ''}
                  onChange={handleAuthorFieldChange('@type')}
                  placeholder="Person"
                  sx={textInputSx}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Publisher Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
              <BusinessIcon />
              Publisher Information
            </Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Publisher Name
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(publisher.name || '', 'publisher_name')}
                    >
                      {copiedItems.has('publisher_name') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={publisher.name || ''}
                  onChange={handlePublisherFieldChange('name')}
                  placeholder="Publisher Name"
                  sx={textInputSx}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Publisher Logo
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(publisher.logo || '', 'publisher_logo')}
                    >
                      {copiedItems.has('publisher_logo') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  value={publisher.logo || ''}
                  onChange={handlePublisherFieldChange('logo')}
                  placeholder="https://example.com/logo.png"
                  sx={textInputSx}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Publication Dates */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
              <CalendarIcon />
              Publication Dates
            </Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Date Published
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(jsonLdSchema.datePublished || '', 'date_published')}
                    >
                      {copiedItems.has('date_published') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  type="datetime-local"
                  value={jsonLdSchema.datePublished || ''}
                  onChange={handleSchemaFieldChange('datePublished')}
                  InputLabelProps={{ shrink: true }}
                  sx={textInputSx}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Date Modified
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard(jsonLdSchema.dateModified || '', 'date_modified')}
                    >
                      {copiedItems.has('date_modified') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  type="datetime-local"
                  value={jsonLdSchema.dateModified || ''}
                  onChange={handleSchemaFieldChange('dateModified')}
                  InputLabelProps={{ shrink: true }}
                  sx={textInputSx}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Keywords */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: '#202124' }}>
              <CodeIcon />
              Keywords & Categories
            </Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Keywords
                  </Typography>
                  <Tooltip title="Copy to clipboard">
                    <IconButton
                      size="small"
                      onClick={() => onCopyToClipboard((jsonLdSchema.keywords || []).join(', '), 'schema_keywords')}
                    >
                      {copiedItems.has('schema_keywords') ? <CheckIcon color="success" /> : <CopyIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={(jsonLdSchema.keywords || []).join(', ')}
                  onChange={(e) => {
                    const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                    handleSchemaFieldChange('keywords')({ target: { value: keywords } } as any);
                  }}
                  placeholder="keyword1, keyword2, keyword3"
                  helperText="Separate keywords with commas"
                  sx={textInputSx}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Raw JSON View */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon />
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#202124' }}>
                  Raw JSON-LD Schema
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#202124' }}>
                    Complete JSON-LD Schema
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={copiedItems.has('json_ld_schema') ? <CheckIcon /> : <CopyIcon />}
                    onClick={copyJsonLdSchema}
                  >
                    {copiedItems.has('json_ld_schema') ? 'Copied!' : 'Copy JSON'}
                  </Button>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={15}
                  value={getJsonLdSchema()}
                  InputProps={{
                    readOnly: true,
                    sx: {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      background: '#0f172a',
                      color: '#e2e8f0'
                    }
                  }}
                  sx={{
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }
                  }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Information Alert */}
        <Grid item xs={12}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>JSON-LD Structured Data:</strong> This schema helps search engines understand your content 
              and may enable rich snippets in search results. The data follows Schema.org Article guidelines.
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};
