import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  IconButton,
  Tooltip,
  Fade
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';

interface EditableTextFieldProps {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
  multiline?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  type?: 'text' | 'number';
  tooltipInfo?: {
    title: string;
    description: string;
    howWeCalculated: string;
    whyItMatters: string;
    example?: string;
  };
}

/**
 * Editable text field component with inline editing
 * Shows text display by default, switches to edit mode on click
 */
export const EditableTextField: React.FC<EditableTextFieldProps> = ({
  label,
  value,
  onChange,
  multiline = false,
  helperText,
  fullWidth = true,
  placeholder = 'Click to edit...',
  required = false,
  maxLength,
  type = 'text',
  tooltipInfo
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    if (required && !localValue.trim()) {
      return; // Don't save if required field is empty
    }
    onChange(localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value); // Reset to original value
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

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

  if (isEditing) {
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </Typography>
          {tooltipInfo && (
            <Tooltip title={renderTooltipContent()} arrow placement="right" enterDelay={200}>
              <InfoIcon sx={{ fontSize: 14, color: 'info.main', cursor: 'help' }} />
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <TextField
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            multiline={multiline}
            rows={multiline ? 3 : 1}
            fullWidth={fullWidth}
            placeholder={placeholder}
            autoFocus
            size="small"
            helperText={helperText}
            error={required && !localValue.trim()}
            inputProps={{
              maxLength: maxLength
            }}
            type={type}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#ffffff',
                fontSize: '0.875rem',
                '&:hover': {
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#3b82f6',
                  },
                },
                '&.Mui-focused': {
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                  },
                },
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 0.5, pt: 0.5 }}>
            <Tooltip title="Save (Enter)">
              <IconButton
                size="small"
                color="primary"
                onClick={handleSave}
                disabled={required && !localValue.trim()}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cancel (Esc)">
              <IconButton size="small" color="default" onClick={handleCancel}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{ 
        mb: 2, 
        position: 'relative',
        width: '100%',
        maxWidth: '100%'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>
          {label}
        </Typography>
        {tooltipInfo && (
          <Tooltip title={renderTooltipContent()} arrow placement="right" enterDelay={200}>
            <InfoIcon sx={{ fontSize: 14, color: 'info.main', cursor: 'help' }} />
          </Tooltip>
        )}
      </Box>
      <Box
        onClick={() => setIsEditing(true)}
        sx={{
          p: 1.5,
          borderRadius: 1,
          border: '1px solid #e2e8f0',
          backgroundColor: value ? '#f8fafc' : '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.2s',
          minHeight: multiline ? '60px' : '36px',
          display: 'flex',
          alignItems: multiline ? 'flex-start' : 'center',
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          '&:hover': {
            borderColor: '#3b82f6',
            backgroundColor: '#f1f5f9'
          }
        }}
      >
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            color: value ? '#1e293b' : '#94a3b8',
            whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: '0.875rem',
            lineHeight: multiline ? 1.4 : 1
          }}
        >
          {value || placeholder}
        </Typography>
        <Fade in={isHovered}>
          <IconButton
            size="small"
            sx={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: 0.7
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Fade>
      </Box>
      {helperText && (
        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block', fontSize: '0.75rem' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default EditableTextField;

