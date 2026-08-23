/**
 * SelectWithCustom Component
 * 
 * A select dropdown that allows users to choose from predefined options
 * or enter a custom value. Shows custom input when "Custom" option is selected.
 */

import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormHelperText,
  Box,
  Typography,
  Tooltip,
  IconButton,
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { selectSx, labelSx, helperSx, inputSx, selectMenuProps, tooltipPopperProps } from '../styles';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectWithCustomProps {
  label: string;
  value: string;
  options: SelectOption[];
  customValue: string;
  onSelectChange: (value: string) => void;
  onCustomChange: (value: string) => void;
  helperText?: string;
  tooltipText?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  sx?: any;
}

export const SelectWithCustom: React.FC<SelectWithCustomProps> = ({
  label,
  value,
  options,
  customValue,
  onSelectChange,
  onCustomChange,
  helperText,
  tooltipText,
  placeholder,
  required = false,
  multiline = false,
  rows = 1,
  sx,
}) => {
  const [isCustom, setIsCustom] = useState(false);

  // Check if current value is custom (not in options)
  useEffect(() => {
    const isCustomValue = Boolean(value && !options.some(opt => opt.value === value));
    setIsCustom(isCustomValue);
  }, [value, options]);

  const handleSelectChange = (newValue: string) => {
    if (newValue === '__custom__') {
      setIsCustom(true);
      // Don't change the main value yet - wait for custom input
    } else {
      setIsCustom(false);
      onSelectChange(newValue);
      // Clear custom value when selecting a predefined option
      if (customValue) {
        onCustomChange('');
      }
    }
  };

  const handleCustomChange = (newValue: string) => {
    onCustomChange(newValue);
    // Update main value immediately as user types
    onSelectChange(newValue);
  };

  const handleCustomBlur = () => {
    // Trim the value when losing focus
    const trimmed = customValue.trim();
    if (trimmed !== customValue) {
      onCustomChange(trimmed);
      onSelectChange(trimmed);
    }
  };

  return (
    <Box sx={sx}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <InputLabel sx={labelSx} required={required}>
          {label}
        </InputLabel>
        {tooltipText && (
          <Tooltip title={tooltipText} arrow placement="top" PopperProps={tooltipPopperProps}>
            <IconButton size="small" sx={{ ml: 0.5, p: 0.25, color: '#64748b' }}>
              <InfoOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {!isCustom ? (
        <FormControl fullWidth>
          <Select
            value={value || ''}
            onChange={(e) => handleSelectChange(e.target.value)}
            sx={selectSx}
            displayEmpty
            MenuProps={selectMenuProps}
          >
            <MenuItem value="">
              <em>Select an option...</em>
            </MenuItem>
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#0f172a' }}>
                    {option.label}
                  </Typography>
                  {option.description && (
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
                      {option.description}
                    </Typography>
                  )}
                </Box>
              </MenuItem>
            ))}
            <MenuItem value="__custom__">
              <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#667eea' }}>
                + Enter custom...
              </Typography>
            </MenuItem>
          </Select>
          {helperText && (
            <FormHelperText sx={helperSx}>{helperText}</FormHelperText>
          )}
        </FormControl>
      ) : (
        <TextField
          value={customValue}
          onChange={(e) => handleCustomChange(e.target.value)}
          onBlur={handleCustomBlur}
          placeholder={placeholder}
          multiline={multiline}
          rows={multiline ? rows : undefined}
          fullWidth
          autoFocus
          sx={inputSx}
          InputLabelProps={{ sx: labelSx }}
          FormHelperTextProps={{ sx: helperSx }}
          helperText={helperText || 'Enter your custom value'}
        />
      )}
    </Box>
  );
};

