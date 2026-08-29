/**
 * PrimaryQuestionEditor Component
 * 
 * Editable primary question section.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import { Tooltip } from '@mui/material';
import { ResearchIntent } from '../../../types/intent.types';

interface PrimaryQuestionEditorProps {
  intent: ResearchIntent;
  onUpdate: (value: string) => void;
}

export const PrimaryQuestionEditor: React.FC<PrimaryQuestionEditorProps> = ({
  intent,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(intent.primary_question);

  useEffect(() => {
    setValue(intent.primary_question);
  }, [intent.primary_question]);

  const handleSave = () => {
    if (value.trim()) {
      onUpdate(value.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(intent.primary_question);
    setIsEditing(false);
  };

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 1,
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Tooltip
          title="The primary research question that guides the entire research process. This question will be used to generate targeted search queries and extract relevant information."
          arrow
          placement="top"
        >
          <Typography variant="caption" fontWeight={600} color="#0c4a6e" sx={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            Research Question:
            <InfoIcon sx={{ fontSize: 12, color: '#9ca3af' }} />
          </Typography>
        </Tooltip>
        {!isEditing && (
          <IconButton
            size="small"
            onClick={() => setIsEditing(true)}
            sx={{
              color: '#666',
              '&:hover': {
                backgroundColor: '#e0f2fe',
                color: '#0ea5e9',
              },
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      {isEditing ? (
        <Box display="flex" alignItems="flex-start" gap={1}>
          <TextField
            fullWidth
            multiline
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            sx={{ backgroundColor: '#ffffff' }}
            autoFocus
          />
          <Box display="flex" flexDirection="column" gap={0.5}>
            <IconButton
              size="small"
              onClick={handleSave}
              color="primary"
              sx={{ backgroundColor: '#e0f2fe' }}
            >
              <SaveIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleCancel}
              sx={{ color: '#666' }}
            >
              <CancelIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" fontWeight={500} color="#0c4a6e">
          {intent.primary_question}
        </Typography>
      )}
    </Box>
  );
};
