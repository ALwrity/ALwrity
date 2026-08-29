/**
 * DeliverablesSelector Component
 * 
 * Allows user to select/remove expected deliverables.
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {
  ResearchIntent,
  ExpectedDeliverable,
  DELIVERABLE_DISPLAY,
} from '../../../types/intent.types';

interface DeliverablesSelectorProps {
  intent: ResearchIntent;
  onToggle: (deliverable: ExpectedDeliverable) => void;
}

export const DeliverablesSelector: React.FC<DeliverablesSelectorProps> = ({
  intent,
  onToggle,
}) => {
  return (
    <Box
      mb={2}
      sx={{
        p: 2,
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 1,
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Tooltip
          title={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
                Research Deliverables
              </Typography>
              <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                These are the specific types of information ALwrity will extract from the research results. Click chips to toggle them on/off.
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                Selected deliverables will be highlighted in blue. Unselected ones will be skipped during research analysis.
              </Typography>
            </Box>
          }
          arrow
          placement="top"
        >
          <Typography variant="caption" color="#666" fontWeight={600} sx={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            What I'll find for you:
            <InfoIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
          </Typography>
        </Tooltip>
      </Box>
      <Box display="flex" flexWrap="wrap" gap={0.5}>
        {Object.entries(DELIVERABLE_DISPLAY).map(([key, label]) => {
          const isSelected = intent.expected_deliverables.includes(key as ExpectedDeliverable);
          return (
            <Chip
              key={key}
              label={label}
              size="small"
              onClick={() => onToggle(key as ExpectedDeliverable)}
              sx={{
                backgroundColor: isSelected ? '#dbeafe' : '#ffffff',
                border: `1px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
                color: isSelected ? '#1e40af' : '#374151',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: isSelected ? '#bfdbfe' : '#f3f4f6',
                  borderColor: isSelected ? '#2563eb' : '#9ca3af',
                },
                fontWeight: isSelected ? 600 : 400,
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};
