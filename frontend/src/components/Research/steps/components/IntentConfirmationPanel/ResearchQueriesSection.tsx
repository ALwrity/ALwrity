/**
 * ResearchQueriesSection Component
 * 
 * Accordion section for managing research queries (add, edit, delete, select).
 * Enhanced with expand/collapse functionality and cost breakdown.
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  Button,
  Divider,
  Chip,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import {
  ResearchQuery,
} from '../../../types/intent.types';
import { QueryEditor } from './QueryEditor';

interface ResearchQueriesSectionProps {
  queries: ResearchQuery[];
  selectedQueries: Set<number>;
  onQueriesChange: (queries: ResearchQuery[]) => void;
  onSelectionChange: (selected: Set<number>) => void;
}

// Cost estimation per provider (approximate)
const PROVIDER_COST_ESTIMATE = {
  exa: 0.02, // ~$0.02 per query
  tavily: 0.015, // ~$0.015 per query
  google: 0.001, // ~$0.001 per query (Gemini grounding)
};

export const ResearchQueriesSection: React.FC<ResearchQueriesSectionProps> = ({
  queries,
  selectedQueries,
  onQueriesChange,
  onSelectionChange,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [expandedQueries, setExpandedQueries] = useState<Set<number>>(new Set([0])); // First query expanded by default

  const handleQueryToggle = (index: number) => {
    const newSelected = new Set(selectedQueries);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    onSelectionChange(newSelected);
  };

  const handleQueryEdit = (index: number, field: keyof ResearchQuery, value: any) => {
    const updated = [...queries];
    updated[index] = { ...updated[index], [field]: value };
    onQueriesChange(updated);
  };

  const handleDeleteQuery = (index: number) => {
    const updated = queries.filter((_, idx) => idx !== index);
    onQueriesChange(updated);
    
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
    onSelectionChange(adjusted);
  };

  const handleAddQuery = () => {
    const newQuery: ResearchQuery = {
      query: '',
      purpose: 'key_statistics',
      provider: 'exa',
      priority: 3,
      expected_results: '',
    };
    onQueriesChange([...queries, newQuery]);
    const newSelected = new Set(selectedQueries);
    newSelected.add(queries.length);
    onSelectionChange(newSelected);
    // Expand the new query
    setExpandedQueries(new Set([...expandedQueries, queries.length]));
  };

  const handleToggleQueryExpansion = (index: number) => {
    const newExpanded = new Set(expandedQueries);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQueries(newExpanded);
  };

  // Calculate cost breakdown
  const costBreakdown = useMemo(() => {
    const selected = Array.from(selectedQueries);
    let totalCost = 0;
    const providerCosts: Record<string, number> = {};

    selected.forEach(idx => {
      const query = queries[idx];
      if (query) {
        const cost = PROVIDER_COST_ESTIMATE[query.provider] || 0.01;
        totalCost += cost;
        providerCosts[query.provider] = (providerCosts[query.provider] || 0) + cost;
      }
    });

    return {
      total: totalCost,
      perQuery: selected.length > 0 ? totalCost / selected.length : 0,
      providerCosts,
      queryCount: selected.length,
    };
  }, [selectedQueries, queries]);

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
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
            Research Queries ({queries.length})
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
          {selectedQueries.size > 0 && (
            <Tooltip
              title={
                <Box sx={{ p: 1 }}>
                  <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                    Cost Breakdown
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                    Estimated cost: ${costBreakdown.total.toFixed(3)}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                    Queries to fire: {costBreakdown.queryCount}
                  </Typography>
                  {Object.entries(costBreakdown.providerCosts).map(([provider, cost]) => (
                    <Typography key={provider} variant="caption" display="block" sx={{ fontSize: '0.7rem' }}>
                      {provider}: ${cost.toFixed(3)}
                    </Typography>
                  ))}
                  <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic', fontSize: '0.7rem' }}>
                    * Estimates may vary based on actual API usage
                  </Typography>
                </Box>
              }
              arrow
              placement="top"
            >
              <Chip
                size="small"
                label={`~$${costBreakdown.total.toFixed(3)}`}
                sx={{
                  ml: 1,
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  fontSize: '0.7rem',
                  height: 20,
                  fontWeight: 500,
                  cursor: 'help',
                }}
                icon={<InfoIcon sx={{ fontSize: 12 }} />}
              />
            </Tooltip>
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, backgroundColor: '#ffffff' }}>
        <List dense sx={{ backgroundColor: '#fafafa' }}>
          {queries.map((query, idx) => (
            <React.Fragment key={idx}>
              <QueryEditor
                query={query}
                index={idx}
                isSelected={selectedQueries.has(idx)}
                isExpanded={expandedQueries.has(idx)}
                onToggle={() => handleQueryToggle(idx)}
                onEdit={(field, value) => handleQueryEdit(idx, field, value)}
                onDelete={() => handleDeleteQuery(idx)}
                onToggleExpansion={() => handleToggleQueryExpansion(idx)}
                totalQueries={queries.length}
                selectedCount={selectedQueries.size}
                estimatedCost={PROVIDER_COST_ESTIMATE[query.provider] || 0.01}
              />
              {idx < queries.length - 1 && <Divider />}
            </React.Fragment>
          ))}
          <Box sx={{ p: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleAddQuery}
              sx={{
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
          </Box>
        </List>
      </AccordionDetails>
    </Accordion>
  );
};
