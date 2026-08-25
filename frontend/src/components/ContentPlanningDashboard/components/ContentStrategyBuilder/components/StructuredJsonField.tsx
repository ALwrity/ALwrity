import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Divider,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import EditIcon from '@mui/icons-material/Edit';
import { JsonFieldSchema, FieldDefinition } from '../utils/jsonFieldSchemas';

interface StructuredJsonFieldProps {
  fieldId: string;
  value: any;
  onChange: (value: any) => void;
  schema: JsonFieldSchema;
  label: string;
  error?: string;
}

const StructuredJsonField: React.FC<StructuredJsonFieldProps> = ({
  fieldId,
  value,
  onChange,
  schema,
  label,
  error
}) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJsonValue, setRawJsonValue] = useState('');

  // Initialize value if empty
  useEffect(() => {
    if (!value || (schema.type === 'object' && Object.keys(value).length === 0) || 
        (schema.type === 'array' && Array.isArray(value) && value.length === 0)) {
      if (schema.type === 'object') {
        const initialValue: Record<string, any> = {};
        if (schema.fields) {
          Object.keys(schema.fields).forEach(key => {
            const fieldDef = schema.fields![key];
            if (fieldDef.type === 'multiselect') {
              initialValue[key] = [];
            } else if (fieldDef.type === 'number') {
              initialValue[key] = '';
            } else {
              initialValue[key] = '';
            }
          });
        }
        onChange(initialValue);
      } else {
        onChange([]);
      }
    }
  }, []);

  // Update raw JSON when value changes
  useEffect(() => {
    if (value) {
      try {
        setRawJsonValue(JSON.stringify(value, null, 2));
      } catch (e) {
        setRawJsonValue('');
      }
    }
  }, [value]);

  const handleObjectFieldChange = (key: string, newValue: any) => {
    const updated = { ...value };
    updated[key] = newValue;
    onChange(updated);
  };

  const handleArrayItemAdd = () => {
    if (schema.type === 'array') {
      if (schema.itemType === 'object' && schema.itemFields) {
        const newItem: Record<string, any> = {};
        Object.keys(schema.itemFields).forEach(key => {
          const fieldDef = schema.itemFields![key];
          if (fieldDef.type === 'multiselect') {
            newItem[key] = [];
          } else if (fieldDef.type === 'number') {
            newItem[key] = '';
          } else {
            newItem[key] = '';
          }
        });
        onChange([...(value || []), newItem]);
      } else if (schema.itemType === 'string') {
        onChange([...(value || []), '']);
      } else {
        onChange([...(value || []), '']);
      }
    }
  };

  const handleArrayItemChange = (index: number, newValue: any) => {
    const updated = [...(value || [])];
    updated[index] = newValue;
    onChange(updated);
  };

  const handleArrayItemRemove = (index: number) => {
    const updated = [...(value || [])];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleObjectInArrayChange = (index: number, key: string, newValue: any) => {
    const updated = [...(value || [])];
    if (!updated[index]) {
      updated[index] = {};
    }
    updated[index] = { ...updated[index], [key]: newValue };
    onChange(updated);
  };

  const renderField = (fieldKey: string, fieldDef: FieldDefinition, fieldValue: any, onChangeHandler: (val: any) => void) => {
    switch (fieldDef.type) {
      case 'text':
        return (
          <TextField
            fullWidth
            label={fieldDef.label}
            value={fieldValue || ''}
            onChange={(e) => onChangeHandler(e.target.value)}
            placeholder={fieldDef.placeholder}
            required={fieldDef.required}
            helperText={fieldDef.helperText}
            size="small"
          />
        );
      
      case 'multiline':
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            label={fieldDef.label}
            value={fieldValue || ''}
            onChange={(e) => onChangeHandler(e.target.value)}
            placeholder={fieldDef.placeholder}
            required={fieldDef.required}
            helperText={fieldDef.helperText}
            size="small"
          />
        );
      
      case 'select':
        return (
          <FormControl fullWidth size="small" required={fieldDef.required}>
            <InputLabel>{fieldDef.label}</InputLabel>
            <Select
              value={fieldValue || ''}
              onChange={(e) => onChangeHandler(e.target.value)}
              label={fieldDef.label}
            >
              <MenuItem value="">
                <em>Select {fieldDef.label}</em>
              </MenuItem>
              {fieldDef.options?.map(option => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
            {fieldDef.helperText && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {fieldDef.helperText}
              </Typography>
            )}
          </FormControl>
        );
      
      case 'multiselect':
        return (
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              {fieldDef.label} {fieldDef.required && '*'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              {fieldDef.options?.map(option => {
                const isSelected = Array.isArray(fieldValue) && fieldValue.includes(option);
                return (
                  <Chip
                    key={option}
                    label={option}
                    onClick={() => {
                      const current = Array.isArray(fieldValue) ? [...fieldValue] : [];
                      if (isSelected) {
                        onChangeHandler(current.filter(v => v !== option));
                      } else {
                        onChangeHandler([...current, option]);
                      }
                    }}
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    sx={{ cursor: 'pointer' }}
                  />
                );
              })}
            </Box>
            {fieldDef.helperText && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {fieldDef.helperText}
              </Typography>
            )}
          </Box>
        );
      
      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={fieldDef.label}
            value={fieldValue || ''}
            onChange={(e) => onChangeHandler(e.target.value ? Number(e.target.value) : '')}
            placeholder={fieldDef.placeholder}
            required={fieldDef.required}
            helperText={fieldDef.helperText}
            size="small"
          />
        );
      
      default:
        return (
          <TextField
            fullWidth
            label={fieldDef.label}
            value={fieldValue || ''}
            onChange={(e) => onChangeHandler(e.target.value)}
            placeholder={fieldDef.placeholder}
            size="small"
          />
        );
    }
  };

  const renderObjectField = () => {
    if (schema.type !== 'object' || !schema.fields) return null;

    const objValue = value || {};

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {schema.fields && Object.entries(schema.fields).map(([key, fieldDef]) => (
          <Box key={key}>
            {renderField(key, fieldDef, objValue[key], (newVal) => handleObjectFieldChange(key, newVal))}
          </Box>
        ))}
      </Box>
    );
  };

  const renderArrayField = () => {
    if (schema.type !== 'array') return null;

    const arrayValue = Array.isArray(value) ? value : [];

    if (schema.itemType === 'object' && schema.itemFields) {
      // Array of objects
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {arrayValue.map((item, index) => (
            <Accordion key={index} defaultExpanded={index === arrayValue.length - 1}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {schema.itemLabel || 'Item'} {index + 1}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArrayItemRemove(index);
                    }}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {schema.itemFields && Object.entries(schema.itemFields).map(([key, fieldDef]) => (
                    <Box key={key}>
                      {renderField(key, fieldDef, item?.[key], (newVal) => handleObjectInArrayChange(index, key, newVal))}
                    </Box>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={handleArrayItemAdd}
            variant="outlined"
            size="small"
            sx={{ alignSelf: 'flex-start' }}
          >
            Add {schema.itemLabel || 'Item'}
          </Button>
        </Box>
      );
    } else {
      // Array of strings
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {arrayValue.map((item, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                value={item || ''}
                onChange={(e) => handleArrayItemChange(index, e.target.value)}
                placeholder={`Enter ${schema.itemLabel || 'item'}`}
                size="small"
              />
              <IconButton
                onClick={() => handleArrayItemRemove(index)}
                size="small"
                sx={{ color: 'error.main', mt: 0.5 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={handleArrayItemAdd}
            variant="outlined"
            size="small"
            sx={{ alignSelf: 'flex-start' }}
          >
            Add {schema.itemLabel || 'Item'}
          </Button>
        </Box>
      );
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {label}
        </Typography>
        <Tooltip title={showRawJson ? "Switch to form view" : "Switch to JSON view"}>
          <IconButton
            size="small"
            onClick={() => setShowRawJson(!showRawJson)}
            sx={{ color: 'text.secondary' }}
          >
            {showRawJson ? <EditIcon fontSize="small" /> : <CodeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {showRawJson ? (
        // Raw JSON view
        <TextField
          fullWidth
          multiline
          rows={6}
          value={rawJsonValue}
          onChange={(e) => {
            setRawJsonValue(e.target.value);
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              // Invalid JSON, don't update
            }
          }}
          placeholder="Enter JSON..."
          error={!!error}
          helperText={error || "Edit JSON directly"}
          sx={{
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontSize: '0.85rem'
            }
          }}
        />
      ) : (
        // Structured form view
        <Box sx={{ width: '100%' }}>
          {schema.type === 'object' && renderObjectField()}
          {schema.type === 'array' && renderArrayField()}
        </Box>
      )}
    </Box>
  );
};

export default StructuredJsonField;
