/**
 * CompetitorsGrid Component
 * Displays discovered competitors in a grid layout
 */

import React, { useState } from 'react';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  Button,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  Business as BusinessIcon,
  OpenInNew as OpenInNewIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ViewModule as CardViewIcon,
  ViewList as ListViewIcon,
} from '@mui/icons-material';

export interface Competitor {
  url: string;
  domain: string;
  title: string;
  summary: string;
  relevance_score: number;
  highlights?: string[];
  favicon?: string;
  image?: string;
  published_date?: string;
  author?: string;
  competitive_insights: {
    business_model: string;
    target_audience: string;
  };
  content_insights: {
    content_focus: string;
    content_quality: string;
  };
}

interface CompetitorsGridProps {
  competitors: Competitor[];
  onShowHighlights: (competitor: Competitor) => void;
  onRemoveCompetitor?: (index: number) => void;
  onAddCompetitor?: (competitor: Competitor) => void;
}

// Utility function to get favicon URL
const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
};

const CompetitorsGrid: React.FC<CompetitorsGridProps> = ({
  competitors,
  onShowHighlights,
  onRemoveCompetitor,
  onAddCompetitor
}) => {
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const handleAddSubmit = () => {
    if (!newCompetitorUrl) return;
    
    try {
      // Create a basic competitor object
      // In a real implementation, you might want to fetch metadata here or let the parent handle it
      let domain = '';
      try {
        domain = new URL(newCompetitorUrl).hostname;
      } catch {
        domain = newCompetitorUrl;
      }

      const newCompetitor: Competitor = {
        url: newCompetitorUrl.startsWith('http') ? newCompetitorUrl : `https://${newCompetitorUrl}`,
        domain: domain,
        title: domain,
        summary: 'Manually added competitor',
        relevance_score: 1.0,
        competitive_insights: {
          business_model: 'Unknown',
          target_audience: 'Unknown'
        },
        content_insights: {
          content_focus: 'Unknown',
          content_quality: 'Unknown'
        }
      };

      if (onAddCompetitor) {
        onAddCompetitor(newCompetitor);
      }
      setOpenAddDialog(false);
      setNewCompetitorUrl('');
    } catch (error) {
      console.error('Error adding competitor:', error);
    }
  };

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={1}>
        <Typography variant="h6" fontWeight={600} sx={{ color: '#1a202c !important' }}>
          <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#667eea !important' }} />
          Discovered Competitors ({competitors.length})
        </Typography>
        <Box display="flex" gap={1}>
          {competitors.length > 0 && (
            <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small">
              <ToggleButton value="card"><CardViewIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="table"><ListViewIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          )}
          {onAddCompetitor && (
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setOpenAddDialog(true)} sx={{ textTransform: 'none' }}>Add Competitor</Button>
          )}
        </Box>
      </Box>

      {viewMode === 'card' ? (
        <Grid container spacing={3}>
        {competitors.map((competitor, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={index}>
            <Card sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              background: 'linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%)',
              border: '1px solid #81d4fa',
              boxShadow: '0 4px 12px rgba(3, 169, 244, 0.15)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 20px rgba(3, 169, 244, 0.25)'
              },
              position: 'relative'
            }}>
              {onRemoveCompetitor && (
                  <IconButton
                    size="small"
                    onClick={() => onRemoveCompetitor(index)}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(255,255,255,0.7)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.9)', color: 'error.main' }
                    }}
                  >
                      <DeleteIcon fontSize="small" />
                  </IconButton>
              )}

              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
                  <Avatar sx={{ width: 40, height: 40, bgcolor: '#eef2ff', color: '#6366f1', fontSize: '1.1rem', fontWeight: 700, border: '1px solid #c7d2fe' }}>
                    {(competitor.title || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box flex={1} pr={onRemoveCompetitor ? 3 : 0}>
                    <Typography 
                      variant="h6" 
                      fontWeight={600} 
                      gutterBottom
                      sx={{ color: '#1a202c !important', wordBreak: 'break-word' }} // Force dark text for readability
                    >
                      {competitor.title}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      gutterBottom
                      sx={{ color: '#4a5568 !important', wordBreak: 'break-all' }} // Force dark text for readability
                    >
                      {competitor.domain}
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      <Chip 
                        label={`${Math.round(competitor.relevance_score * 100)}% Match`}
                        color="primary"
                        size="small"
                      />
                      {competitor.published_date && (
                        <Chip 
                          label={new Date(competitor.published_date).toLocaleDateString()}
                          variant="outlined"
                          size="small"
                          sx={{ 
                            fontSize: '0.7rem',
                            height: 20,
                            '& .MuiChip-label': { px: 1 }
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>

                <Typography 
                  variant="body2" 
                  mb={2}
                  sx={{ color: '#2d3748 !important' }} // Force dark text for readability
                >
                  {competitor.summary.length > 150 
                    ? `${competitor.summary.substring(0, 150)}...` 
                    : competitor.summary
                  }
                </Typography>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button size="small" startIcon={<OpenInNewIcon />}
                  onClick={() => competitor.url && window.open(competitor.url, '_blank')}
                  disabled={!competitor.url}>Visit Website</Button>
                {competitor.highlights && competitor.highlights.length > 0 && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onShowHighlights(competitor)}
                  >
                    Highlights
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>Domain</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>Match</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem' }}>Highlights</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155', fontSize: '0.8rem', width: 120 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {competitors.map((competitor, index) => (
                <TableRow key={index} sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 24, height: 24, bgcolor: '#eef2ff', color: '#6366f1', fontSize: '0.7rem', fontWeight: 700 }}>
                        {(competitor.title || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#1e293b' }}>{competitor.title}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="body2" sx={{ color: '#64748b', wordBreak: 'break-all', fontSize: '0.8rem' }}>{competitor.domain}</Typography></TableCell>
                  <TableCell><Chip label={`${Math.round(competitor.relevance_score * 100)}%`} color="primary" size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    {competitor.highlights?.length ? competitor.highlights.slice(0, 2).map((h, i) => (
                      <Typography key={i} variant="caption" sx={{ color: '#475569', lineHeight: 1.3, display: 'block' }}>{h}</Typography>
                    )) : <Typography variant="caption" sx={{ color: '#94a3b8' }}>—</Typography>}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      <IconButton size="small" onClick={() => competitor.url && window.open(competitor.url, '_blank')} disabled={!competitor.url} title={competitor.url ? 'Visit' : 'No website'}><OpenInNewIcon fontSize="small" /></IconButton>
                      {competitor.highlights && competitor.highlights.length > 0 && <IconButton size="small" onClick={() => onShowHighlights(competitor)} title="Highlights"><BusinessIcon fontSize="small" /></IconButton>}
                      {onRemoveCompetitor && <IconButton size="small" onClick={() => onRemoveCompetitor(index)} title="Remove" sx={{ color: '#ef4444' }}><DeleteIcon fontSize="small" /></IconButton>}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}


      {/* Add Competitor Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Add Competitor Manually</DialogTitle>
        <DialogContent>
            <Typography variant="body2" color="textSecondary" paragraph>
                Enter the URL of a competitor website to include in the analysis.
            </Typography>
            <TextField
                autoFocus
                margin="dense"
                label="Competitor URL"
                type="url"
                fullWidth
                variant="outlined"
                value={newCompetitorUrl}
                onChange={(e) => setNewCompetitorUrl(e.target.value)}
                placeholder="https://example.com"
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddSubmit} variant="contained" disabled={!newCompetitorUrl}>
                Add Competitor
            </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CompetitorsGrid;
