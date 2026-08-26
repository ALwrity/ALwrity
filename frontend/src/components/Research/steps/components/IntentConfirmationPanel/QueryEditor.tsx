/**
 * QueryEditor Component
 * 
 * Compact, professional query editor with tooltips and helpful messaging.
 * Each query targets a specific deliverable and uses the optimal provider.
 */

import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  IconButton,
  ListItem,
  ListItemSecondaryAction,
  Tooltip,
  Typography,
  Chip,
  InputAdornment,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import ProviderIcon from '@mui/icons-material/Storage';
import PurposeIcon from '@mui/icons-material/Category';
import PriorityIcon from '@mui/icons-material/PriorityHigh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  ResearchQuery,
  ExpectedDeliverable,
  DELIVERABLE_DISPLAY,
} from '../../../types/intent.types';

interface QueryEditorProps {
  query: ResearchQuery;
  index: number;
  isSelected: boolean;
  isExpanded?: boolean;
  onToggle: () => void;
  onEdit: (field: keyof ResearchQuery, value: any) => void;
  onDelete: () => void;
  onToggleExpansion?: () => void;
  totalQueries?: number;
  selectedCount?: number;
  estimatedCost?: number;
}

// Provider descriptions for tooltips
const PROVIDER_INFO = {
  exa: {
    name: 'Exa',
    description: 'Semantic search engine. Best for deep research, academic papers, and comprehensive content.',
    color: '#6366f1',
  },
  tavily: {
    name: 'Tavily',
    description: 'AI-powered real-time search. Best for news, trends, and current events.',
    color: '#10b981',
  },
  google: {
    name: 'Google',
    description: 'Factual web search. Best for general information and quick facts.',
    color: '#3b82f6',
  },
};

export const QueryEditor: React.FC<QueryEditorProps> = ({
  query,
  index,
  isSelected,
  isExpanded = true,
  onToggle,
  onEdit,
  onDelete,
  onToggleExpansion,
  totalQueries = 0,
  selectedCount = 0,
  estimatedCost = 0.01,
}) => {
  const providerInfo = PROVIDER_INFO[query.provider as keyof typeof PROVIDER_INFO] || PROVIDER_INFO.exa;
  const deliverableLabel = DELIVERABLE_DISPLAY[query.purpose as ExpectedDeliverable] || query.purpose;
  const isFirstQuery = index === 0;

  // Generate justification text based on query properties
  const getJustification = () => {
    const parts: string[] = [];
    
    // Provider justification
    if (query.provider === 'exa') {
      parts.push(`This query uses Exa because it's best for finding ${deliverableLabel.toLowerCase()} in academic papers, technical reports, and comprehensive content.`);
    } else if (query.provider === 'tavily') {
      parts.push(`This query uses Tavily because it excels at finding ${deliverableLabel.toLowerCase()} in recent news, trends, and real-time information.`);
    } else {
      parts.push(`This query uses Google for general factual information and quick answers.`);
    }

    // Purpose justification
    parts.push(`It targets "${deliverableLabel}" to extract specific ${deliverableLabel.toLowerCase()} from the research results.`);

    // Priority justification
    if (query.priority >= 4) {
      parts.push(`High priority (${query.priority}/5) - this query is essential for answering your research question.`);
    } else if (query.priority <= 2) {
      parts.push(`Lower priority (${query.priority}/5) - this query provides supplementary information.`);
    }

    return parts.join(' ');
  };

  const getComprehensiveTooltip = () => {
    return (
      <Box sx={{ p: 1.5, maxWidth: 400 }}>
        <Typography variant="caption" fontWeight={700} display="block" gutterBottom sx={{ fontSize: '0.85rem', mb: 1 }}>
          Research Query #{index + 1}
        </Typography>
        
        <Typography variant="caption" fontWeight={600} display="block" gutterBottom sx={{ fontSize: '0.75rem', mt: 1 }}>
          What is this query?
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 1 }}>
          {query.query || 'No query text'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 1, color: '#64748b' }}>
          This query will search for: {query.expected_results || deliverableLabel}
        </Typography>

        <Typography variant="caption" fontWeight={600} display="block" gutterBottom sx={{ fontSize: '0.75rem', mt: 1 }}>
          How was it suggested?
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 1 }}>
          ALwrity's AI analyzed your research question and automatically generated this query to find the specific information you need. It's designed to target "{deliverableLabel}" using the {providerInfo.name} provider.
        </Typography>

        <Typography variant="caption" fontWeight={600} display="block" gutterBottom sx={{ fontSize: '0.75rem', mt: 1 }}>
          Why this query?
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 1 }}>
          {getJustification()}
        </Typography>

        <Typography variant="caption" fontWeight={600} display="block" gutterBottom sx={{ fontSize: '0.75rem', mt: 1 }}>
          What can you do?
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
          • <strong>Select/Deselect:</strong> Check/uncheck to include or exclude this query
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
          • <strong>Edit:</strong> Click on the query text or parameters to modify
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
          • <strong>Delete:</strong> Remove this query if not needed
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 1 }}>
          • <strong>Change Provider:</strong> Switch between Exa, Tavily, or Google
        </Typography>

        <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <Typography variant="caption" fontWeight={600} display="block" gutterBottom sx={{ fontSize: '0.75rem' }}>
            Cost & Execution
          </Typography>
          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
            Estimated cost: <strong>${estimatedCost.toFixed(3)}</strong> per query
          </Typography>
          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
            Total queries: {totalQueries} ({selectedCount} selected)
          </Typography>
          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#9ca3af' }}>
            * Costs are estimates and may vary based on API response length
          </Typography>
        </Box>
      </Box>
    );
  };

  // Collapsed view (for queries after the first one)
  if (!isExpanded && !isFirstQuery) {
    return (
      <ListItem
        onMouseEnter={onToggleExpansion}
        sx={{
          backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
          borderLeft: isSelected ? '4px solid #0ea5e9' : '4px solid transparent',
          border: '1px solid',
          borderColor: isSelected ? '#bae6fd' : '#e5e7eb',
          borderRadius: 1,
          mb: 1,
          py: 1,
          px: 2,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: isSelected ? '#e0f2fe' : '#f9fafb',
            borderColor: isSelected ? '#7dd3fc' : '#0ea5e9',
            boxShadow: '0 2px 8px rgba(14, 165, 233, 0.15)',
          },
          transition: 'all 0.2s ease',
        }}
      >
        <Checkbox
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          size="small"
          sx={{
            mr: 1.5,
            color: '#0ea5e9',
            '&.Mui-checked': {
              color: '#0ea5e9',
            },
          }}
          onClick={(e) => e.stopPropagation()}
        />
        
        <Box flex={1} sx={{ minWidth: 0 }} onClick={onToggleExpansion}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <SearchIcon sx={{ fontSize: 16, color: '#6b7280', flexShrink: 0 }} />
            <Tooltip title={getComprehensiveTooltip()} arrow placement="right">
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: '#1f2937',
                  fontSize: '0.875rem',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'help',
                }}
              >
                {query.query || 'Empty query'}
              </Typography>
            </Tooltip>
          </Box>
          
          <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
            <Chip
              size="small"
              label={providerInfo.name}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                backgroundColor: `${providerInfo.color}15`,
                color: providerInfo.color,
                border: `1px solid ${providerInfo.color}40`,
              }}
              icon={
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: providerInfo.color,
                    ml: 0.5,
                  }}
                />
              }
            />
            <Chip
              size="small"
              label={deliverableLabel}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                backgroundColor: '#f3f4f6',
                color: '#4b5563',
              }}
            />
            <Chip
              size="small"
              label={`~$${estimatedCost.toFixed(3)}`}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                backgroundColor: '#fef3c7',
                color: '#92400e',
              }}
            />
          </Box>
        </Box>

        <ListItemSecondaryAction>
          <Tooltip title="Remove this query" arrow>
            <IconButton
              edge="end"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              sx={{
                color: '#dc2626',
                '&:hover': {
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ListItemSecondaryAction>
      </ListItem>
    );
  }

  // Expanded view (default for first query, or when hovered/clicked)
  return (
    <ListItem
      sx={{
        backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
        borderLeft: isSelected ? '4px solid #0ea5e9' : '4px solid transparent',
        border: '1px solid',
        borderColor: isSelected ? '#bae6fd' : '#e5e7eb',
        borderRadius: 1,
        mb: 1,
        py: 1.5,
        px: 2,
        '&:hover': {
          backgroundColor: isSelected ? '#e0f2fe' : '#f9fafb',
          borderColor: isSelected ? '#7dd3fc' : '#d1d5db',
        },
        transition: 'all 0.2s ease',
      }}
    >
      <Checkbox
        checked={isSelected}
        onChange={onToggle}
        size="small"
        sx={{
          mr: 1.5,
          color: '#0ea5e9',
          '&.Mui-checked': {
            color: '#0ea5e9',
          },
        }}
      />
      
      <Box flex={1} sx={{ minWidth: 0 }}>
        {/* Query Header with Tooltip */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1} flex={1}>
            <Tooltip title={getComprehensiveTooltip()} arrow placement="top">
              <InfoIcon
                sx={{
                  fontSize: 18,
                  color: '#0ea5e9',
                  cursor: 'help',
                  flexShrink: 0,
                }}
              />
            </Tooltip>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
              Query #{index + 1} • {deliverableLabel} • {providerInfo.name}
            </Typography>
          </Box>
          {!isFirstQuery && onToggleExpansion && (
            <Tooltip title="Click to collapse" arrow>
              <IconButton
                size="small"
                onClick={onToggleExpansion}
                sx={{
                  color: '#9ca3af',
                  '&:hover': { color: '#0ea5e9' },
                }}
              >
                <ExpandMoreIcon sx={{ transform: 'rotate(180deg)' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Main Query Input - Enhanced Focus */}
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <SearchIcon sx={{ fontSize: 18, color: '#0ea5e9', flexShrink: 0 }} />
          <TextField
            fullWidth
            size="small"
            value={query.query}
            onChange={(e) => onEdit('query', e.target.value)}
            placeholder="Research query (e.g., 'AI trends 2024')"
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#ffffff',
                color: '#1f2937',
                fontSize: '0.9rem',
                fontWeight: 500,
                '& input': {
                  color: '#0c4a6e',
                  py: 1,
                  fontWeight: 500,
                },
                '& fieldset': {
                  borderColor: '#0ea5e9',
                  borderWidth: '2px',
                },
                '&:hover fieldset': {
                  borderColor: '#0284c7',
                  borderWidth: '2px',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#0284c7',
                  borderWidth: '2.5px',
                  boxShadow: '0 0 0 3px rgba(14, 165, 233, 0.1)',
                },
              },
            }}
          />
        </Box>

        {/* Compact Controls Row */}
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          {/* Provider Selector with Tooltip */}
          <Tooltip
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                  {providerInfo.name}
                </Typography>
                <Typography variant="caption" display="block">
                  {providerInfo.description}
                </Typography>
              </Box>
            }
            arrow
            placement="top"
          >
            <FormControl
              size="small"
              sx={{
                minWidth: 100,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#ffffff',
                  fontSize: '0.8125rem',
                  height: '32px',
                },
              }}
            >
              <Select
                value={query.provider}
                onChange={(e) => onEdit('provider', e.target.value)}
                sx={{
                  color: '#1f2937',
                  '& .MuiSelect-select': {
                    color: '#1f2937',
                    py: 0.5,
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d1d5db',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0ea5e9',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0ea5e9',
                  },
                }}
                startAdornment={
                  <Box
                    component="span"
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: providerInfo.color,
                      mr: 1,
                      display: 'inline-block',
                    }}
                  />
                }
              >
                <MenuItem value="exa" sx={{ fontSize: '0.8125rem', color: '#1f2937' }}>
                  Exa
                </MenuItem>
                <MenuItem value="tavily" sx={{ fontSize: '0.8125rem', color: '#1f2937' }}>
                  Tavily
                </MenuItem>
                <MenuItem value="google" sx={{ fontSize: '0.8125rem', color: '#1f2937' }}>
                  Google
                </MenuItem>
              </Select>
            </FormControl>
          </Tooltip>

          {/* Purpose/Deliverable Selector with Tooltip */}
          <Tooltip
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                  Deliverable Type
                </Typography>
                <Typography variant="caption" display="block">
                  What type of information this query will find: statistics, quotes, case studies, trends, etc.
                </Typography>
              </Box>
            }
            arrow
            placement="top"
          >
            <FormControl
              size="small"
              sx={{
                minWidth: 140,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#ffffff',
                  fontSize: '0.8125rem',
                  height: '32px',
                },
              }}
            >
              <Select
                value={query.purpose}
                onChange={(e) => onEdit('purpose', e.target.value)}
                sx={{
                  color: '#1f2937',
                  '& .MuiSelect-select': {
                    color: '#1f2937',
                    py: 0.5,
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d1d5db',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0ea5e9',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0ea5e9',
                  },
                }}
              >
                {Object.entries(DELIVERABLE_DISPLAY).map(([key, label]) => (
                  <MenuItem
                    key={key}
                    value={key}
                    sx={{ fontSize: '0.8125rem', color: '#1f2937' }}
                  >
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Tooltip>

          {/* Priority Input with Tooltip */}
          <Tooltip
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                  Priority (1-5)
                </Typography>
                <Typography variant="caption" display="block">
                  Higher priority queries are executed first. Use 5 for most important, 1 for optional.
                </Typography>
              </Box>
            }
            arrow
            placement="top"
          >
            <TextField
              size="small"
              type="number"
              value={query.priority}
              onChange={(e) => onEdit('priority', parseInt(e.target.value) || 1)}
              inputProps={{ min: 1, max: 5 }}
              sx={{
                width: 75,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#ffffff',
                  fontSize: '0.8125rem',
                  height: '32px',
                  color: '#1f2937',
                  '& input': {
                    color: '#1f2937',
                    textAlign: 'center',
                    py: 0.5,
                  },
                  '& fieldset': {
                    borderColor: '#d1d5db',
                  },
                  '&:hover fieldset': {
                    borderColor: '#0ea5e9',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#0ea5e9',
                  },
                },
              }}
              placeholder="1-5"
            />
          </Tooltip>

          {/* Expected Results - Compact Display */}
          {query.expected_results && (
            <Chip
              label={query.expected_results}
              size="small"
              sx={{
                height: '24px',
                fontSize: '0.75rem',
                backgroundColor: '#f3f4f6',
                color: '#4b5563',
                border: '1px solid #e5e7eb',
                maxWidth: '200px',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            />
          )}
        </Box>

        {/* Expected Results Input - Collapsible/Compact */}
        <Box mt={1}>
          <TextField
            fullWidth
            size="small"
            value={query.expected_results || ''}
            onChange={(e) => onEdit('expected_results', e.target.value)}
            placeholder="What we expect to find (optional)"
            variant="outlined"
            multiline
            maxRows={2}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#ffffff',
                color: '#1f2937',
                fontSize: '0.8125rem',
                '& textarea': {
                  color: '#1f2937',
                  py: 0.5,
                },
                '& fieldset': {
                  borderColor: '#d1d5db',
                },
                '&:hover fieldset': {
                  borderColor: '#0ea5e9',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#0ea5e9',
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Tooltip
                    title="Describe what type of information this query should find. This helps the AI understand the research goal."
                    arrow
                    placement="top"
                  >
                    <InfoIcon
                      sx={{
                        fontSize: 16,
                        color: '#9ca3af',
                        cursor: 'help',
                      }}
                    />
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>

      <ListItemSecondaryAction>
        <Tooltip title="Remove this query" arrow>
          <IconButton
            edge="end"
            size="small"
            onClick={onDelete}
            sx={{
              color: '#dc2626',
              '&:hover': {
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
              },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItem>
  );
};
