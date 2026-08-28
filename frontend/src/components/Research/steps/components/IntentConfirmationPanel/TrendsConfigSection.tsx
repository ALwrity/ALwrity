/**
 * TrendsConfigSection Component
 * 
 * Google Trends configuration section with keywords, expected insights, and settings.
 * Enhanced with editing capabilities and educational modal.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Chip,
  Tooltip,
  TextField,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendIcon from '@mui/icons-material/TrendingUp';
import CheckIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HelpIcon from '@mui/icons-material/HelpOutline';
import { TrendsConfig } from '../../../types/intent.types';
import { TrendsKnowMoreModal } from './TrendsKnowMoreModal';

interface TrendsConfigSectionProps {
  trendsConfig: TrendsConfig;
  onUpdate?: (updatedConfig: TrendsConfig) => void;
}

// Common timeframe options
const TIMEFRAME_OPTIONS = [
  { value: 'today 12-m', label: 'Past 12 months' },
  { value: 'today 3-m', label: 'Past 3 months' },
  { value: 'today 1-m', label: 'Past month' },
  { value: 'today 7-d', label: 'Past 7 days' },
  { value: 'today 5-y', label: 'Past 5 years' },
];

// Common region options (top regions)
const REGION_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IN', label: 'India' },
  { value: 'JP', label: 'Japan' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
];

export const TrendsConfigSection: React.FC<TrendsConfigSectionProps> = ({
  trendsConfig,
  onUpdate,
}) => {
  const [showKnowMoreModal, setShowKnowMoreModal] = useState(false);
  const [editingKeywords, setEditingKeywords] = useState(false);
  const [editingTimeframe, setEditingTimeframe] = useState(false);
  const [editingRegion, setEditingRegion] = useState(false);
  const [editedKeywords, setEditedKeywords] = useState<string[]>(trendsConfig.keywords);
  const [newKeyword, setNewKeyword] = useState('');
  const [editedTimeframe, setEditedTimeframe] = useState(trendsConfig.timeframe);
  const [editedRegion, setEditedRegion] = useState(trendsConfig.geo);

  if (!trendsConfig.enabled) {
    return null;
  }

  const handleSaveKeywords = () => {
    if (onUpdate) {
      onUpdate({
        ...trendsConfig,
        keywords: editedKeywords.filter(k => k.trim().length > 0),
      });
    }
    setEditingKeywords(false);
  };

  const handleCancelKeywords = () => {
    setEditedKeywords(trendsConfig.keywords);
    setEditingKeywords(false);
    setNewKeyword('');
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      setEditedKeywords([...editedKeywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const handleDeleteKeyword = (index: number) => {
    setEditedKeywords(editedKeywords.filter((_, idx) => idx !== index));
  };

  const handleSaveTimeframe = () => {
    if (onUpdate) {
      onUpdate({
        ...trendsConfig,
        timeframe: editedTimeframe,
      });
    }
    setEditingTimeframe(false);
  };

  const handleSaveRegion = () => {
    if (onUpdate) {
      onUpdate({
        ...trendsConfig,
        geo: editedRegion,
      });
    }
    setEditingRegion(false);
  };

  return (
    <Accordion
      defaultExpanded={true}
      sx={{
        mb: 2,
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        '&:before': { display: 'none' },
        boxShadow: 'none',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: '#666' }} />}
        sx={{
          backgroundColor: '#f0fdf4',
          '&:hover': { backgroundColor: '#dcfce7' },
        }}
      >
        <Box display="flex" alignItems="center" gap={1} flex={1}>
          <TrendIcon sx={{ color: '#10b981', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={600} color="#333">
            Google Trends Analysis
          </Typography>
          <Chip
            size="small"
            label="Auto-enabled"
            sx={{
              ml: 1,
              backgroundColor: '#dcfce7',
              color: '#166534',
              fontSize: '0.7rem',
              height: 20,
              fontWeight: 500,
            }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 2, backgroundColor: '#ffffff' }}>
        {/* Trends Keywords - Editable */}
        <Box
          mb={2}
          sx={{
            padding: '12px',
            background: 'rgba(241, 245, 249, 0.5)',
            border: '1px solid rgba(203, 213, 225, 0.3)',
            borderRadius: '8px',
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                }}
              >
                Trends Keywords ({editingKeywords ? editedKeywords.length : trendsConfig.keywords.length})
              </Typography>
              <Chip
                label="Know More"
                size="small"
                onClick={() => setShowKnowMoreModal(true)}
                icon={<HelpIcon sx={{ fontSize: 14 }} />}
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: '#bae6fd',
                  },
                }}
              />
            </Box>
            {!editingKeywords && onUpdate && (
              <IconButton
                size="small"
                onClick={() => setEditingKeywords(true)}
                sx={{
                  color: '#64748b',
                  '&:hover': { color: '#0ea5e9', backgroundColor: '#f0f9ff' },
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          {editingKeywords ? (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  mb: 1.5,
                }}
              >
                {editedKeywords.map((keyword, idx) => (
                  <Chip
                    key={idx}
                    label={keyword}
                    onDelete={() => handleDeleteKeyword(idx)}
                    sx={{
                      padding: '5px 10px',
                      background: 'white',
                      border: '1px solid rgba(203, 213, 225, 0.5)',
                      fontSize: '12px',
                      color: '#334155',
                      fontWeight: 500,
                      '& .MuiChip-deleteIcon': {
                        color: '#dc2626',
                        fontSize: '16px',
                        '&:hover': { color: '#b91c1c' },
                      },
                    }}
                  />
                ))}
              </Box>
              <Box display="flex" gap={1} mb={1}>
                <TextField
                  size="small"
                  placeholder="Add keyword"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddKeyword();
                    }
                  }}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root': {
                      fontSize: '0.8125rem',
                      backgroundColor: '#ffffff',
                    },
                  }}
                />
                <IconButton
                  size="small"
                  onClick={handleAddKeyword}
                  disabled={!newKeyword.trim()}
                  sx={{
                    backgroundColor: '#0ea5e9',
                    color: 'white',
                    '&:hover': { backgroundColor: '#0284c7' },
                    '&:disabled': { backgroundColor: '#d1d5db' },
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box display="flex" gap={1} justifyContent="flex-end">
                <IconButton
                  size="small"
                  onClick={handleCancelKeywords}
                  sx={{ color: '#64748b' }}
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleSaveKeywords}
                  sx={{
                    color: '#10b981',
                    '&:hover': { backgroundColor: '#dcfce7' },
                  }}
                >
                  <SaveIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {trendsConfig.keywords.map((keyword, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      padding: '5px 10px',
                      background: 'white',
                      border: '1px solid rgba(203, 213, 225, 0.5)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#334155',
                      fontWeight: 500,
                    }}
                  >
                    {keyword}
                  </Box>
                ))}
              </Box>
              {trendsConfig.keywords_justification && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    marginTop: '8px',
                    color: '#64748b',
                    fontSize: '11px',
                    fontStyle: 'italic',
                  }}
                >
                  {trendsConfig.keywords_justification}
                </Typography>
              )}
            </>
          )}
        </Box>


        {/* Settings with Justifications - Editable */}
        <Box
          sx={{
            p: 1.5,
            backgroundColor: '#f9fafb',
            borderRadius: 1,
            border: '1px solid #e5e7eb',
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="#666" fontWeight={500}>
                  Timeframe
                </Typography>
                {!editingTimeframe && onUpdate && (
                  <IconButton
                    size="small"
                    onClick={() => setEditingTimeframe(true)}
                    sx={{
                      color: '#64748b',
                      '&:hover': { color: '#0ea5e9', backgroundColor: '#f0f9ff' },
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              {editingTimeframe ? (
                <Box>
                  <FormControl fullWidth size="small">
                    <Select
                      value={editedTimeframe}
                      onChange={(e) => setEditedTimeframe(e.target.value)}
                      sx={{
                        backgroundColor: '#ffffff',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {TIMEFRAME_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box display="flex" gap={0.5} mt={1} justifyContent="flex-end">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditedTimeframe(trendsConfig.timeframe);
                        setEditingTimeframe(false);
                      }}
                      sx={{ color: '#64748b' }}
                    >
                      <CancelIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleSaveTimeframe}
                      sx={{
                        color: '#10b981',
                        '&:hover': { backgroundColor: '#dcfce7' },
                      }}
                    >
                      <SaveIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Typography variant="body2" fontWeight={500} color="#333">
                    {TIMEFRAME_OPTIONS.find(opt => opt.value === trendsConfig.timeframe)?.label || trendsConfig.timeframe}
                  </Typography>
                  <Tooltip title={trendsConfig.timeframe_justification || 'Time period for trends analysis'} arrow>
                    <InfoIcon sx={{ fontSize: 14, color: '#9ca3af', cursor: 'help' }} />
                  </Tooltip>
                </Box>
              )}
            </Grid>
            <Grid item xs={6}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="#666" fontWeight={500}>
                  Region
                </Typography>
                {!editingRegion && onUpdate && (
                  <IconButton
                    size="small"
                    onClick={() => setEditingRegion(true)}
                    sx={{
                      color: '#64748b',
                      '&:hover': { color: '#0ea5e9', backgroundColor: '#f0f9ff' },
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              {editingRegion ? (
                <Box>
                  <FormControl fullWidth size="small">
                    <Select
                      value={editedRegion}
                      onChange={(e) => setEditedRegion(e.target.value)}
                      sx={{
                        backgroundColor: '#ffffff',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {REGION_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box display="flex" gap={0.5} mt={1} justifyContent="flex-end">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditedRegion(trendsConfig.geo);
                        setEditingRegion(false);
                      }}
                      sx={{ color: '#64748b' }}
                    >
                      <CancelIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleSaveRegion}
                      sx={{
                        color: '#10b981',
                        '&:hover': { backgroundColor: '#dcfce7' },
                      }}
                    >
                      <SaveIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Typography variant="body2" fontWeight={500} color="#333">
                    {REGION_OPTIONS.find(opt => opt.value === trendsConfig.geo)?.label || trendsConfig.geo}
                  </Typography>
                  <Tooltip title={trendsConfig.geo_justification || 'Geographic region for trends analysis'} arrow>
                    <InfoIcon sx={{ fontSize: 14, color: '#9ca3af', cursor: 'help' }} />
                  </Tooltip>
                </Box>
              )}
            </Grid>
          </Grid>
        </Box>

        {/* Know More Modal */}
        <TrendsKnowMoreModal
          open={showKnowMoreModal}
          onClose={() => setShowKnowMoreModal(false)}
          trendsConfig={trendsConfig}
        />
      </AccordionDetails>
    </Accordion>
  );
};
