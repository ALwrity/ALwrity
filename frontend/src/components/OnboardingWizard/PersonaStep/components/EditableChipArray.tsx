import React, { useState } from 'react';
import {
  Box,
  Chip,
  TextField,
  IconButton,
  Typography,
  Tooltip,
  Paper,
  Stack
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';

interface EditableChipArrayProps {
  label: string;
  values: string[];
  onChange: (newValues: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  helperText?: string;
  allowDuplicates?: boolean;
  tooltipInfo?: {
    title: string;
    description: string;
    howWeCalculated: string;
    whyItMatters: string;
    example?: string;
  };
}

/**
 * Editable array of chips (tags) component
 * Allows adding, removing, and managing string arrays
 */
export const EditableChipArray: React.FC<EditableChipArrayProps> = ({
  label,
  values = [],
  onChange,
  placeholder = 'Type and press Enter to add...',
  maxItems,
  color = 'primary',
  helperText,
  allowDuplicates = false,
  tooltipInfo
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  
  const renderTooltipContent = () => {
    if (!tooltipInfo) return '';
    return (
      <Box sx={{ maxWidth: 400, p: 1 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          {tooltipInfo.title}
        </Typography>
        <Typography variant="body2" paragraph>
          {tooltipInfo.description}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600, mt: 1 }}>
          🔍 How we calculated this:
        </Typography>
        <Typography variant="caption" display="block" paragraph>
          {tooltipInfo.howWeCalculated}
        </Typography>
        <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
          💡 Why it matters:
        </Typography>
        <Typography variant="caption" display="block" paragraph>
          {tooltipInfo.whyItMatters}
        </Typography>
        {tooltipInfo.example && (
          <>
            <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
              📝 Example:
            </Typography>
            <Typography variant="caption" display="block" sx={{ fontStyle: 'italic' }}>
              {tooltipInfo.example}
            </Typography>
          </>
        )}
      </Box>
    );
  };

  const handleAdd = () => {
    const trimmedValue = inputValue.trim();
    
    if (!trimmedValue) {
      setError('Value cannot be empty');
      return;
    }

    if (!allowDuplicates && values.includes(trimmedValue)) {
      setError('This value already exists');
      return;
    }

    if (maxItems && values.length >= maxItems) {
      setError(`Maximum ${maxItems} items allowed`);
      return;
    }

    onChange([...values, trimmedValue]);
    setInputValue('');
    setError('');
  };

  const handleRemove = (indexToRemove: number) => {
    onChange(values.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setInputValue('');
      setError('');
    }
  };

  const canAdd = !maxItems || values.length < maxItems;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {tooltipInfo && (
          <Tooltip title={renderTooltipContent()} arrow placement="right" enterDelay={200}>
            <InfoIcon sx={{ fontSize: 14, color: 'info.main', cursor: 'help' }} />
          </Tooltip>
        )}
        {maxItems && (
          <Typography
            component="span"
            variant="caption"
            color="text.disabled"
            sx={{ ml: 'auto' }}
          >
            ({values.length}/{maxItems})
          </Typography>
        )}
      </Box>

      {/* Input field for adding new items */}
      {canAdd && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <TextField
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            size="small"
            fullWidth
            error={!!error}
            helperText={error || helperText}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'background.paper'
              }
            }}
          />
          <Tooltip title="Add item (Enter)">
            <span>
              <IconButton
                onClick={handleAdd}
                color="primary"
                disabled={!inputValue.trim()}
                size="small"
                sx={{
                  height: 40,
                  width: 40
                }}
              >
                <AddIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}

      {/* Display chips */}
      {values.length > 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            backgroundColor: 'background.default',
            minHeight: 60
          }}
        >
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {values.map((value, index) => (
              <Chip
                key={`${value}-${index}`}
                label={value}
                color={color}
                size="small"
                onDelete={() => handleRemove(index)}
                deleteIcon={
                  <Tooltip title="Remove">
                    <DeleteIcon />
                  </Tooltip>
                }
                sx={{
                  mb: 0.5,
                  '& .MuiChip-deleteIcon': {
                    fontSize: '16px'
                  }
                }}
              />
            ))}
          </Stack>
        </Paper>
      ) : (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            backgroundColor: 'background.default',
            textAlign: 'center'
          }}
        >
          <Typography variant="body2" color="text.disabled">
            No items added yet. {canAdd ? 'Add some above!' : ''}
          </Typography>
        </Paper>
      )}

      {!canAdd && (
        <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
          Maximum items reached. Remove some to add more.
        </Typography>
      )}
    </Box>
  );
};

export default EditableChipArray;

