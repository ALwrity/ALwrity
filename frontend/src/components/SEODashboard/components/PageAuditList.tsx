import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Button,
  Paper,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { GlassCard } from '../../shared/styled';

interface PageAudit {
  id: number;
  page_url: string;
  overall_score: number;
  status: string;
  issues: any[];
  recommendations: any[];
  last_analyzed_at: string;
}

const PageAuditList: React.FC = () => {
  const [pages, setPages] = useState<PageAudit[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/seo-dashboard/pages');
      setPages(response.data);
    } catch (error) {
      console.error('Error fetching pages:', error);
      setError('Failed to load analyzed pages.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(pages.map((n) => n.page_url));
    } else {
      setSelected([]);
    }
  };

  const handleClick = (name: string) => {
    const selectedIndex = selected.indexOf(name);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, name);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1),
      );
    }
    setSelected(newSelected);
  };

  const handleRunAI = async () => {
    if (selected.length === 0) return;
    
    setAiLoading(true);
    try {
      await axios.post('/api/seo-dashboard/analyze-urls-ai', { urls: selected });
      await fetchPages(); // Refresh to show updates
      setSelected([]);
    } catch (error) {
      console.error('Error running AI analysis:', error);
      setError('Failed to run AI analysis.');
    } finally {
      setAiLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const hasAiInsights = (page: PageAudit) => {
    return page.recommendations && page.recommendations.some((r: any) => r.source === 'ai_on_demand');
  };

  return (
    <GlassCard sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
          📄 Full Site Analysis
        </Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchPages}
            disabled={loading || aiLoading}
            sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleRunAI}
            disabled={selected.length === 0 || aiLoading}
            sx={{
              background: 'linear-gradient(45deg, #9C27B0, #E040FB)',
              '&:disabled': {
                background: 'rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.3)'
              }
            }}
          >
            {aiLoading ? 'Analyzing...' : `Get AI Insights (${selected.length})`}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
        <Table sx={{ minWidth: 650 }} aria-label="page audit table">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  indeterminate={selected.length > 0 && selected.length < pages.length}
                  checked={pages.length > 0 && selected.length === pages.length}
                  onChange={handleSelectAll}
                  inputProps={{ 'aria-label': 'select all pages' }}
                  sx={{ color: 'rgba(255,255,255,0.5)' }}
                />
              </TableCell>
              <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>Page URL</TableCell>
              <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>Score</TableCell>
              <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>Status</TableCell>
              <TableCell align="center" sx={{ color: 'rgba(255,255,255,0.7)' }}>AI Insights</TableCell>
              <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)' }}>Last Analyzed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pages.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ color: 'rgba(255,255,255,0.5)', py: 3 }}>
                  No pages analyzed yet. The background scan will populate this list shortly.
                </TableCell>
              </TableRow>
            ) : (
              pages.map((row) => {
                const isItemSelected = selected.indexOf(row.page_url) !== -1;
                const labelId = `enhanced-table-checkbox-${row.id}`;

                return (
                  <TableRow
                    hover
                    onClick={() => handleClick(row.page_url)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={row.id}
                    selected={isItemSelected}
                    sx={{ 
                      cursor: 'pointer',
                      '&.Mui-selected': { bgcolor: 'rgba(33, 150, 243, 0.08) !important' },
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05) !important' }
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        inputProps={{ 'aria-labelledby': labelId }}
                        sx={{ color: 'rgba(255,255,255,0.5)' }}
                      />
                    </TableCell>
                    <TableCell component="th" id={labelId} scope="row" sx={{ color: 'white', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={row.page_url}>
                        <span>{row.page_url}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={row.overall_score || 'N/A'} 
                        color={getScoreColor(row.overall_score)} 
                        size="small" 
                        variant="outlined" 
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>
                      {row.status?.replace('_', ' ')}
                    </TableCell>
                    <TableCell align="center">
                      {hasAiInsights(row) ? (
                        <Chip 
                          icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />} 
                          label="Ready" 
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(156, 39, 176, 0.2)', 
                            color: '#E040FB',
                            borderColor: '#E040FB',
                            border: '1px solid'
                          }} 
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(row.last_analyzed_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </GlassCard>
  );
};

export default PageAuditList;
