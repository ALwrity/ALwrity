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
import BusinessIcon from '@mui/icons-material/Business';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CardViewIcon from '@mui/icons-material/ViewModule';
import ListViewIcon from '@mui/icons-material/ViewList';

export interface Competitor {
  url: string;
  domain: string;
  title: string;
  summary: string;
  relevance_score: number;
  highlights?: string[];
  subpages?: string[];
  favicon?: string;
  image?: string;
  published_date?: string;
  author?: string;
  competitive_insights: {
    threat_level?: string;
    competitive_strengths?: string[];
    competitive_weaknesses?: string[];
    market_share_estimate?: string;
    differentiation_opportunities?: string[];
    business_model: string;
    target_audience: string;
  };
  content_insights: {
    content_focus: string;
    target_audience?: string;
    content_types?: string[];
    publishing_frequency?: string;
    content_quality: string;
  };
  market_positioning?: {
    market_tier?: string;
    pricing_position?: string;
    brand_positioning?: string;
    competitive_advantage?: string;
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
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2.5,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'all 0.2s ease',
              '&:hover': {
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                borderColor: '#6366f1'
              },
              position: 'relative',
              bgcolor: '#fff'
            }}>
              {onRemoveCompetitor && (
                  <IconButton
                    size="small"
                    onClick={() => onRemoveCompetitor(index)}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,0.08)',
                        color: '#64748b',
                        '&:hover': { bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444' }
                    }}
                    title="Remove competitor"
                  >
                      <DeleteIcon fontSize="small" />
                  </IconButton>
              )}

              <CardContent sx={{ flexGrow: 1, pb: 0 }}>
                <Box display="flex" alignItems="flex-start" gap={1.5} mb={1.5}>
                  <Avatar sx={{ 
                    width: 36, height: 36, 
                    bgcolor: '#eef2ff', color: '#6366f1', 
                    fontSize: '0.85rem', fontWeight: 700, 
                    flexShrink: 0
                  }}>
                    {(competitor.title || competitor.domain || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box flex={1} minWidth={0} pr={onRemoveCompetitor ? 4 : 0}>
                    <Typography 
                      variant="subtitle2" 
                      fontWeight={600} 
                      noWrap
                      sx={{ color: '#1e293b', lineHeight: 1.3 }}
                    >
                      {competitor.title || competitor.domain}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ color: '#94a3b8', wordBreak: 'break-all' }}
                    >
                      {competitor.domain}
                    </Typography>
                  </Box>
                </Box>
                <Box display="flex" gap={0.75} flexWrap="wrap" mb={1.5}>
                  <Chip 
                    label={`${Math.round(competitor.relevance_score * 100)}% match`}
                    size="small"
                    sx={{ 
                      bgcolor: '#f0fdf4', color: '#15803d', 
                      fontWeight: 600, fontSize: '0.7rem', height: 22,
                      border: '1px solid #bbf7d0'
                    }}
                  />
                  {competitor.published_date && (
                    <Chip 
                      label={new Date(competitor.published_date).toLocaleDateString()}
                      variant="outlined"
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 22, borderColor: '#e2e8f0', color: '#64748b' }}
                    />
                  )}
                </Box>
                {competitor.summary?.length > 0 && (
                  <Typography 
                    variant="caption" 
                    sx={{ color: '#64748b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {competitor.summary}
                  </Typography>
                )}
              </CardContent>

              <CardActions sx={{ p: 1.5, pt: 0, mt: 'auto', gap: 0.5 }}>
                <Button 
                  size="small" 
                  startIcon={<OpenInNewIcon />}
                  onClick={() => competitor.url && window.open(competitor.url, '_blank')}
                  disabled={!competitor.url}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#6366f1' }}
                >
                  Visit
                </Button>
                {competitor.highlights && competitor.highlights.length > 0 && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => onShowHighlights(competitor)}
                    sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#64748b' }}
                  >
                    Insights
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem', py: 1.5 }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem', py: 1.5 }}>Domain</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem', py: 1.5 }}>Match</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem', py: 1.5, width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {competitors.map((competitor, index) => (
                  <TableRow key={index} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ py: 1 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#eef2ff', color: '#6366f1', fontSize: '0.7rem', fontWeight: 700 }}>
                        {(competitor.title || competitor.domain || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#1e293b' }}>{competitor.title || competitor.domain}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1 }}><Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>{competitor.domain}</Typography></TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip 
                      label={`${Math.round(competitor.relevance_score * 100)}%`} 
                      size="small" 
                      sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600, fontSize: '0.7rem', border: '1px solid #bbf7d0' }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Box display="flex" gap={0.5}>
                      <IconButton size="small" onClick={() => competitor.url && window.open(competitor.url, '_blank')} disabled={!competitor.url} title="Visit"><OpenInNewIcon fontSize="small" /></IconButton>
                      {onRemoveCompetitor && <IconButton size="small" onClick={() => onRemoveCompetitor(index)} title="Remove" sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}><DeleteIcon fontSize="small" /></IconButton>}
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
