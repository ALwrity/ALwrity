/**
 * EditableListField Component
 * 
 * Editable list field for managing arrays of strings (e.g., focus areas, also answering).
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  IconButton,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';

interface EditableListFieldProps {
  label: string;
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder?: string;
  tooltip?: string;
  maxItems?: number;
}

export const EditableListField: React.FC<EditableListFieldProps> = ({
  label,
  items,
  onUpdate,
  placeholder = 'Add item...',
  tooltip,
  maxItems,
}) => {
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleAdd = () => {
    if (newItem.trim() && (!maxItems || items.length < maxItems)) {
      onUpdate([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleDelete = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(items[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingValue.trim()) {
      const updated = [...items];
      updated[editingIndex] = editingValue.trim();
      onUpdate(updated);
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box display="flex" alignItems="center" gap={0.5} mb={1}>
        <Typography variant="caption" color="#666" fontWeight={600}>
          {label}:
        </Typography>
        {tooltip && (
          <Tooltip title={tooltip} arrow>
            <InfoIcon sx={{ fontSize: 14, color: '#9ca3af', cursor: 'help' }} />
          </Tooltip>
        )}
      </Box>

      {/* Existing Items */}
      {items.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={0.5} mb={1}>
          {items.map((item, idx) => (
            <Chip
              key={idx}
              label={
                editingIndex === idx ? (
                  <TextField
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit();
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    autoFocus
                    size="small"
                    sx={{
                      width: '120px',
                      '& .MuiInputBase-root': {
                        fontSize: '0.75rem',
                        height: '20px',
                        color: '#1e293b',
                        backgroundColor: '#ffffff',
                      },
                      '& .MuiInputBase-input': {
                        color: '#1e293b',
                      },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: '#d1d5db',
                        },
                      },
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  item
                )
              }
              size="small"
              onDelete={editingIndex === idx ? undefined : () => handleDelete(idx)}
              deleteIcon={editingIndex === idx ? undefined : <DeleteIcon sx={{ fontSize: 14 }} />}
              onClick={() => editingIndex !== idx && handleStartEdit(idx)}
              sx={{
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                color: '#374151',
                cursor: editingIndex === idx ? 'default' : 'pointer',
                '&:hover': {
                  backgroundColor: '#e5e7eb',
                },
                '& .MuiChip-label': {
                  padding: editingIndex === idx ? '0 4px' : '0 8px',
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Add New Item */}
      {(!maxItems || items.length < maxItems) && (
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newItem.trim()) {
              handleAdd();
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleAdd}
                  disabled={!newItem.trim()}
                  sx={{ p: 0.5 }}
                >
                  <AddIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiInputBase-root': {
              fontSize: '0.875rem',
              color: '#1e293b',
              backgroundColor: '#ffffff',
            },
            '& .MuiInputBase-input': {
              color: '#1e293b',
              '&::placeholder': {
                color: '#9ca3af',
                opacity: 1,
              },
            },
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: '#d1d5db',
              },
              '&:hover fieldset': {
                borderColor: '#9ca3af',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#0ea5e9',
                borderWidth: '2px',
              },
            },
          }}
        />
      )}
    </Box>
  );
};
