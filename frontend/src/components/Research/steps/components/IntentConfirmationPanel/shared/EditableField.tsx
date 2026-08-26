/**
 * EditableField Component
 * 
 * Reusable component for inline editing of fields with save/cancel functionality.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

interface EditableFieldProps {
  field: string;
  value: any;
  displayValue: string;
  options?: Array<{ key: string; label: string }>;
  onSave: (newValue: any) => void;
}

export const EditableField: React.FC<EditableFieldProps> = ({
  field,
  value,
  displayValue,
  options,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <Box display="flex" alignItems="center" gap={0.5}>
      {isEditing ? (
        <Box display="flex" alignItems="center" gap={0.5} flex={1}>
          {options ? (
            <FormControl size="small" fullWidth>
              <Select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                sx={{ backgroundColor: '#ffffff' }}
                autoFocus
              >
                {options.map(opt => (
                  <MenuItem key={opt.key} value={opt.key}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <TextField
              size="small"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              fullWidth
              sx={{ backgroundColor: '#ffffff' }}
              autoFocus
            />
          )}
          <IconButton size="small" onClick={handleSave} color="primary">
            <SaveIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={handleCancel} color="inherit">
            <CancelIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        <>
          <Typography variant="body2" fontWeight={500} color="#333" sx={{ flex: 1 }}>
            {displayValue}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setIsEditing(true)}
            sx={{
              color: '#666',
              '&:hover': {
                backgroundColor: '#f3f4f6',
                color: '#0ea5e9',
              },
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </>
      )}
    </Box>
  );
};
