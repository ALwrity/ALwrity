/**
 * ResearchQueriesSection Component
 * 
 * Manages research queries with selection, editing, adding, and deleting.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemSecondaryAction,
  Checkbox,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Button,
  IconButton,
  Divider,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  ResearchQuery,
  ExpectedDeliverable,
  DELIVERABLE_DISPLAY,
} from '../../../../types/intent.types';

interface ResearchQueriesSectionProps {
  queries: ResearchQuery[];
  onQueriesChange: (queries: ResearchQuery[]) => void;
  onSelectionChange: (selectedIndices: Set<number>) => void;
}

export const ResearchQueriesSection: React.FC<ResearchQueriesSectionProps> = ({
  queries: initialQueries,
  onQueriesChange,
  onSelectionChange,
}) => {
  const [showQueries, setShowQueries] = useState(true);
  const [editedQueries, setEditedQueries] = useState<ResearchQuery[]>(initialQueries);
  const [selectedQueries, setSelectedQueries] = useState<Set<number>>(
    new Set(initialQueries.map((_, idx) => idx))
  );

  useEffect(() => {
    setEditedQueries(initialQueries);
    setSelectedQueries(new Set(initialQueries.map((_, idx) => idx)));
  }, [initialQueries]);

  useEffect(() => {
    onQueriesChange(editedQueries);
  }, [editedQueries, onQueriesChange]);

  useEffect(() => {
    onSelectionChange(selectedQueries);
  }, [selectedQueries, onSelectionChange]);

  const handleQueryToggle = (index: number) => {
    const newSelected = new Set(selectedQueries);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedQueries(newSelected);
  };

  const handleQueryEdit = (index: number, field: keyof ResearchQuery, value: any) => {
    const updated = [...editedQueries];
    updated[index] = { ...updated[index], [field]: value };
    setEditedQueries(updated);
  };

  const handleDeleteQuery = (index: number) => {
    const updated = editedQueries.filter((_, idx) => idx !== index);
    setEditedQueries(updated);
    const newSelected = new Set(selectedQueries);
    newSelected.delete(index);
    const adjusted = new Set<number>();
    newSelected.forEach(idx => {
      if (idx > index) {
        adjusted.add(idx - 1);
      } else if (idx < index) {
        adjusted.add(idx);
      }
    });
    setSelectedQueries(adjusted);
  };

  const handleAddQuery = () => {
    const newQuery: ResearchQuery = {
      query: '',
      purpose: 'key_statistics',
      provider: 'exa',
      priority: 3,
      expected_results: '',
    };
    setEditedQueries([...editedQueries, newQuery]);
    setSelectedQueries(new Set([...selectedQueries, editedQueries.length]));
  };

  return (
    <Accordion
      expanded={showQueries}
      onChange={() => setShowQueries(!showQueries)}
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
          backgroundColor: '#f9fafb',
          '&:hover': { backgroundColor: '#f3f4f6' },
        }}
      >
        <Box display="flex" alignItems="center" gap={1} flex={1}>
          <SearchIcon sx={{ color: '#666', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={600} color="#333">
            Research Queries ({editedQueries.length})
          </Typography>
          <Chip
            size="small"
            label={`${selectedQueries.size} selected`}
            sx={{
              ml: 1,
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              fontSize: '0.7rem',
              height: 20,
              fontWeight: 500,
            }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, backgroundColor: '#ffffff' }}>
        <List dense sx={{ backgroundColor: '#fafafa' }}>
          {editedQueries.map((query, idx) => (
            <React.Fragment key={idx}>
              <ListItem
                sx={{
                  backgroundColor: selectedQueries.has(idx) ? '#e0f2fe' : '#ffffff',
                  borderLeft: selectedQueries.has(idx) ? '3px solid #0ea5e9' : '3px solid transparent',
                  '&:hover': { backgroundColor: selectedQueries.has(idx) ? '#bae6fd' : '#f9fafb' },
                  py: 1.5,
                }}
              >
                <Checkbox
                  checked={selectedQueries.has(idx)}
                  onChange={() => handleQueryToggle(idx)}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Box flex={1}>
                  <TextField
                    fullWidth
                    size="small"
                    value={query.query}
                    onChange={(e) => handleQueryEdit(idx, 'query', e.target.value)}
                    placeholder="Enter research query"
                    sx={{
                      mb: 1,
                      backgroundColor: '#ffffff',
                      '& .MuiOutlinedInput-root': {
                        '&:hover fieldset': { borderColor: '#0ea5e9' },
                        '&.Mui-focused fieldset': { borderColor: '#0ea5e9' },
                      },
                    }}
                  />
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <Select
                        value={query.provider}
                        onChange={(e) => handleQueryEdit(idx, 'provider', e.target.value)}
                        sx={{
                          backgroundColor: '#ffffff',
                          fontSize: '0.75rem',
                        }}
                      >
                        <MenuItem value="exa">Exa</MenuItem>
                        <MenuItem value="tavily">Tavily</MenuItem>
                        <MenuItem value="google">Google</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <Select
                        value={query.purpose}
                        onChange={(e) => handleQueryEdit(idx, 'purpose', e.target.value)}
                        sx={{
                          backgroundColor: '#ffffff',
                          fontSize: '0.75rem',
                        }}
                      >
                        {Object.entries(DELIVERABLE_DISPLAY).map(([key, label]) => (
                          <MenuItem key={key} value={key}>{label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      type="number"
                      value={query.priority}
                      onChange={(e) => handleQueryEdit(idx, 'priority', parseInt(e.target.value) || 1)}
                      inputProps={{ min: 1, max: 5 }}
                      sx={{
                        width: 90,
                        backgroundColor: '#ffffff',
                        fontSize: '0.75rem',
                      }}
                      label="Priority"
                    />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    value={query.expected_results}
                    onChange={(e) => handleQueryEdit(idx, 'expected_results', e.target.value)}
                    placeholder="What we expect to find"
                    sx={{
                      mt: 1,
                      backgroundColor: '#ffffff',
                      fontSize: '0.75rem',
                      '& .MuiOutlinedInput-root': {
                        '&:hover fieldset': { borderColor: '#0ea5e9' },
                      },
                    }}
                  />
                </Box>
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleDeleteQuery(idx)}
                    sx={{
                      color: '#dc2626',
                      '&:hover': { backgroundColor: '#fee2e2' },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
              {idx < editedQueries.length - 1 && <Divider />}
            </React.Fragment>
          ))}
          <ListItem>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleAddQuery}
              sx={{
                mt: 1,
                borderStyle: 'dashed',
                borderColor: '#d1d5db',
                color: '#666',
                '&:hover': {
                  borderColor: '#0ea5e9',
                  backgroundColor: '#f0f9ff',
                },
              }}
            >
              + Add Query
            </Button>
          </ListItem>
        </List>
      </AccordionDetails>
    </Accordion>
  );
};
