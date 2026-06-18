import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  Alert,
  Autocomplete,
  InputAdornment,
  Button,
  Collapse
} from '@mui/material';
import {
  Help as HelpIcon,
  AutoAwesome as AutoAwesomeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useStrategyBuilderStore } from '../../../../stores/strategyBuilderStore';
import StructuredJsonField from './components/StructuredJsonField';
import { JSON_FIELD_SCHEMAS } from './utils/jsonFieldSchemas';

interface StrategicInputFieldProps {
  fieldId: string;
  value: any;
  error?: string;
  autoPopulated?: boolean;
  dataSource?: string;
  confidenceLevel?: number;
  dataQuality?: string;
  personalizationData?: {
    explanation?: string;
    data_sources?: {
      website_analysis?: boolean;
      audience_insights?: boolean;
      ai_recommendations?: boolean;
      research_config?: boolean;
    };
    personalization_factors?: {
      website_url?: string;
      industry_focus?: string;
      writing_tone?: string;
      expertise_level?: string;
      business_size?: string;
    };
  };
  onChange: (value: any) => void;
  onValidate: () => boolean;
  onShowTooltip: () => void;
  onViewDataSource?: () => void; // Add callback for viewing data source
  accentColorKey?: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error';
  isCompact?: boolean;
}

// Define proper types for field configurations
interface BaseFieldConfig {
  type: string;
  label: string;
  required: boolean;
}

interface TextFieldConfig extends BaseFieldConfig {
  type: 'text' | 'number' | 'json';
  placeholder: string;
}

interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select';
  options: string[];
}

interface MultiSelectFieldConfig extends BaseFieldConfig {
  type: 'multiselect';
  options: string[];
  placeholder?: string;
}

interface BooleanFieldConfig extends BaseFieldConfig {
  type: 'boolean';
}

type FieldConfig = TextFieldConfig | SelectFieldConfig | MultiSelectFieldConfig | BooleanFieldConfig;

const StrategicInputField: React.FC<StrategicInputFieldProps> = ({
  fieldId,
  value,
  error,
  autoPopulated = false,
  dataSource,
  confidenceLevel,
  dataQuality,
  personalizationData,
  onChange,
  onValidate,
  onShowTooltip,
  onViewDataSource,
  accentColorKey = 'primary',
  isCompact = false
}) => {
  // Since getTooltipData is not in strategyBuilderStore, we'll create a simple implementation
  const getTooltipData = (fieldId: string) => {
    // This is a simplified tooltip data implementation
    return {
      title: `About ${fieldId.replace(/_/g, ' ')}`,
      description: `Information about ${fieldId.replace(/_/g, ' ')}`,
      tips: [`Tip for ${fieldId}`]
    };
  };
  const [isEditing, setIsEditing] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);

  const getAccent = (theme: any) => (theme?.palette?.[accentColorKey] ?? theme?.palette?.primary);

  const sourceMeta = autoPopulated && dataSource
    ? {
        website_analysis: { label: 'Website', color: 'primary' as const },
        ai_generated: { label: 'AI', color: 'secondary' as const },
        onboarding_session: { label: 'Onboarding', color: 'success' as const },
        competitor_analysis: { label: 'Competitor', color: 'warning' as const },
        analytics_data: { label: 'Analytics', color: 'info' as const },
        research_preferences: { label: 'Research', color: 'info' as const },
        persona_data: { label: 'Persona', color: 'error' as const },
        api_keys_data: { label: 'API Keys', color: 'default' as const },
        deep_competitor_analysis: { label: 'Deep Comp.', color: 'warning' as const },
        gsc_analytics: { label: 'GSC', color: 'info' as const },
        bing_analytics: { label: 'Bing', color: 'info' as const },
        unified: { label: 'Unified', color: 'primary' as const },
      }[dataSource]
    : null;

  // Get field configuration from store with proper null checking
  const tooltipData = getTooltipData(fieldId);
  
  // Field configuration mapping (this would come from the store)
  const fieldConfig: Record<string, FieldConfig> = {
    business_objectives: {
      type: 'json',
      label: 'Business Objectives',
      placeholder: 'Enter your primary and secondary business goals',
      required: true
    },
    target_metrics: {
      type: 'json',
      label: 'Target Metrics',
      placeholder: 'Define your KPIs and success metrics',
      required: true
    },
    content_budget: {
      type: 'number',
      label: 'Content Budget',
      placeholder: 'Enter your content budget',
      required: false
    },
    team_size: {
      type: 'number',
      label: 'Team Size',
      placeholder: 'Enter team size',
      required: false
    },
    implementation_timeline: {
      type: 'select',
      label: 'Implementation Timeline',
      options: ['3 months', '6 months', '1 year', '2 years', 'Ongoing'],
      required: false
    },
    market_share: {
      type: 'text',
      label: 'Market Share',
      placeholder: 'Enter market share percentage',
      required: false
    },
    competitive_position: {
      type: 'select',
      label: 'Competitive Position',
      options: ['Leader', 'Challenger', 'Niche', 'Emerging'],
      required: false
    },
    performance_metrics: {
      type: 'json',
      label: 'Current Performance Metrics',
      placeholder: 'Enter current performance data',
      required: false
    },
    content_preferences: {
      type: 'json',
      label: 'Content Preferences',
      placeholder: 'Define content preferences',
      required: true
    },
    consumption_patterns: {
      type: 'json',
      label: 'Consumption Patterns',
      placeholder: 'Describe consumption patterns',
      required: false
    },
    audience_pain_points: {
      type: 'json',
      label: 'Audience Pain Points',
      placeholder: 'List audience pain points',
      required: false
    },
    buying_journey: {
      type: 'json',
      label: 'Buying Journey',
      placeholder: 'Define buying journey stages',
      required: false
    },
    seasonal_trends: {
      type: 'json',
      label: 'Seasonal Trends',
      placeholder: 'Describe seasonal content patterns',
      required: false
    },
    engagement_metrics: {
      type: 'json',
      label: 'Engagement Metrics',
      placeholder: 'Define engagement tracking metrics',
      required: false
    },
    top_competitors: {
      type: 'json',
      label: 'Top Competitors',
      placeholder: 'List your main competitors',
      required: false
    },
    competitor_content_strategies: {
      type: 'json',
      label: 'Competitor Content Strategies',
      placeholder: 'Analyze competitor content approaches',
      required: false
    },
    market_gaps: {
      type: 'json',
      label: 'Market Gaps',
      placeholder: 'Identify content gaps in the market',
      required: false
    },
    industry_trends: {
      type: 'json',
      label: 'Industry Trends',
      placeholder: 'Describe relevant industry trends',
      required: false
    },
    emerging_trends: {
      type: 'json',
      label: 'Emerging Trends',
      placeholder: 'Identify emerging content trends',
      required: false
    },
    preferred_formats: {
      type: 'multiselect',
      label: 'Preferred Formats',
      options: ['Blog Posts', 'Videos', 'Infographics', 'Webinars', 'Podcasts', 'Case Studies', 'Whitepapers', 'Social Media Posts'],
      required: true
    },
    content_mix: {
      type: 'json',
      label: 'Content Mix',
      placeholder: 'Define your content mix strategy',
      required: false
    },
    content_frequency: {
      type: 'select',
      label: 'Content Frequency',
      options: ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'],
      required: false
    },
    optimal_timing: {
      type: 'json',
      label: 'Optimal Timing',
      placeholder: 'Define optimal posting times',
      required: false
    },
    quality_metrics: {
      type: 'json',
      label: 'Quality Metrics',
      placeholder: 'Define content quality standards',
      required: false
    },
    editorial_guidelines: {
      type: 'json',
      label: 'Editorial Guidelines',
      placeholder: 'Define editorial guidelines',
      required: false
    },
    brand_voice: {
      type: 'json',
      label: 'Brand Voice',
      placeholder: 'Define your brand voice',
      required: false
    },
    traffic_sources: {
      type: 'multiselect',
      label: 'Traffic Sources',
      options: ['Organic Search', 'Social Media', 'Email Marketing', 'Direct Traffic', 'Referral Traffic', 'Paid Search', 'Display Advertising', 'Content Marketing', 'Influencer Marketing', 'Video Platforms'],
      required: false
    },
    conversion_rates: {
      type: 'json',
      label: 'Conversion Rates',
      placeholder: 'Define target conversion rates',
      required: false
    },
    content_roi_targets: {
      type: 'json',
      label: 'Content ROI Targets',
      placeholder: 'Define ROI targets for content',
      required: false
    },
    ab_testing_capabilities: {
      type: 'boolean',
      label: 'A/B Testing Capabilities',
      required: false
    }
  };

  // Get the field configuration with fallback
  const config = fieldConfig[fieldId] || {
    type: 'text',
    label: fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    placeholder: `Enter ${fieldId.replace(/_/g, ' ')}`,
    required: false
  };

  const handleChange = (newValue: any) => {
    onChange(newValue);
    if (autoPopulated && !isEditing) {
      setIsEditing(true);
    }
  };

  const renderInput = () => {
    // Safety check for config
    if (!config) {
      return (
        <TextField
          fullWidth
          label={fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Enter ${fieldId.replace(/_/g, ' ')}`}
          error={!!error}
          helperText={error}
          required={false}
        />
      );
    }

    switch (config.type) {
      case 'text':
        return (
          <TextField
            fullWidth
            label={config.label || fieldId}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={(config as TextFieldConfig).placeholder || `Enter ${fieldId}`}
            error={!!error}
            helperText={error}
            required={config.required || false}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={onShowTooltip} size="small">
                    <HelpIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={config.label || fieldId}
            value={value || ''}
            onChange={(e) => handleChange(Number(e.target.value))}
            placeholder={(config as TextFieldConfig).placeholder || `Enter ${fieldId}`}
            error={!!error}
            helperText={error}
            required={config.required || false}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={onShowTooltip} size="small">
                    <HelpIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        );

      case 'select':
        const selectConfig = config as SelectFieldConfig;
        return (
          <FormControl fullWidth error={!!error} required={config.required || false}>
            <InputLabel>{config.label || fieldId}</InputLabel>
            <Select
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              label={config.label || fieldId}
              endAdornment={
                <IconButton onClick={onShowTooltip} size="small">
                  <HelpIcon />
                </IconButton>
              }
            >
              {(selectConfig.options || []).map((option: string) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'multiselect':
        const multiSelectConfig = config as MultiSelectFieldConfig;
        return (
          <Autocomplete
            multiple
            options={multiSelectConfig.options || []}
            isOptionEqualToValue={(option, value) => {
              // Custom equality test that handles various formats
              if (typeof option === 'string' && typeof value === 'string') {
                return option.toLowerCase() === value.toLowerCase();
              }
              return option === value;
            }}
            value={(() => {
              let parsedValues: string[] = [];

              if (Array.isArray(value)) {
                parsedValues = value;
              } else if (typeof value === 'object' && value !== null) {
                // Handle object values (convert to array of keys or values)
                if (typeof value === 'object' && !Array.isArray(value)) {
                  // Convert object to array of keys or values based on context
                  const objectKeys = Object.keys(value);
                  
                  // For traffic_sources, we might want to use the keys or convert percentages to options
                  if (fieldId === 'traffic_sources') {
                    // Convert percentage object to traffic source options
                    const trafficMapping: { [key: string]: string } = {
                      'organic': 'Organic Search',
                      'social': 'Social Media',
                      'direct': 'Direct Traffic',
                      'referral': 'Referral Traffic',
                      'paid': 'Paid Search',
                      'display': 'Display Advertising',
                      'content': 'Content Marketing',
                      'influencer': 'Influencer Marketing',
                      'video': 'Video Platforms',
                      'email': 'Email Marketing'
                    };
                    
                    parsedValues = objectKeys
                      .map(key => trafficMapping[key.toLowerCase()])
                      .filter(Boolean);
                  } else {
                    // For other fields, use object keys
                    parsedValues = objectKeys;
                  }
                }
              } else if (typeof value === 'string') {
                try {
                  // Try to parse as JSON array
                  const parsed = JSON.parse(value);
                  if (Array.isArray(parsed)) {
                    parsedValues = parsed;
                  }
                } catch (error) {
                  // If not valid JSON, try to extract array-like content
                  if (value.startsWith('[') && value.endsWith(']')) {
                    // Remove outer brackets and try to parse as comma-separated
                    const content = value.slice(1, -1);
                    // Split by comma but be careful with nested quotes
                    parsedValues = content.split(',').map(item => {
                      // Remove quotes and trim
                      return item.trim().replace(/^["']|["']$/g, '');
                    }).filter(item => item);
                  } else if (value.includes(',')) {
                    // If not array-like, try simple comma splitting
                    parsedValues = value.split(',').map(item => item.trim()).filter(item => item);
                  }
                }
              }

              // Filter values to only include valid options and improve matching
              const validOptions = multiSelectConfig.options || [];
              const filteredValues = parsedValues.filter(val => {
                // Check for exact match
                if (validOptions.includes(val)) {
                  return true;
                }
                // Check for partial match (case-insensitive) with better logic
                const partialMatch = validOptions.find(option => {
                  const optionLower = option.toLowerCase();
                  const valLower = val.toLowerCase();
                  
                  // Check if option contains the value or vice versa
                  return optionLower.includes(valLower) || valLower.includes(optionLower);
                });
                
                return !!partialMatch;
              });

              // Map partial matches to exact options
              const mappedValues = filteredValues.map(val => {
                const exactMatch = validOptions.find(option => option === val);
                if (exactMatch) return exactMatch;
                
                // Find the best partial match
                const partialMatch = validOptions.find(option => {
                  const optionLower = option.toLowerCase();
                  const valLower = val.toLowerCase();
                  return optionLower.includes(valLower) || valLower.includes(optionLower);
                });
                
                return partialMatch || val;
              });

              return mappedValues;
            })()}
            onChange={(_, newValue) => handleChange(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={config.label || fieldId}
                placeholder={multiSelectConfig.placeholder || `Select ${fieldId}`}
                error={!!error}
                helperText={error}
                required={config.required || false}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={onShowTooltip} size="small">
                        <HelpIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option}
                  {...getTagProps({ index })}
                  key={option}
                />
              ))
            }
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={!!value}
                onChange={(e) => handleChange(e.target.checked)}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {config.label || fieldId}
                <IconButton onClick={onShowTooltip} size="small">
                  <HelpIcon />
                </IconButton>
              </Box>
            }
          />
        );

      case 'json':
        // Check if we have a schema for this field - use structured form
        const jsonSchema = JSON_FIELD_SCHEMAS[fieldId];
        if (jsonSchema) {
          return (
            <Box sx={{ width: '100%' }}>
              <StructuredJsonField
                fieldId={fieldId}
                value={value}
                onChange={handleChange}
                schema={jsonSchema}
                label={config.label || fieldId}
                error={error}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Tooltip title="Get help with this field">
                  <IconButton onClick={onShowTooltip} size="small">
                    <HelpIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          );
        }

        // Fallback to raw JSON textarea for fields without schemas
        const formatJsonValue = (val: any): string => {
          if (val === null || val === undefined) {
            return '';
          }
          if (typeof val === 'string') {
            try {
              const parsed = JSON.parse(val);
              return JSON.stringify(parsed, null, 2);
            } catch {
              return val;
            }
          }
          if (typeof val === 'object') {
            if (Array.isArray(val) && val.length === 0) {
              return '';
            }
            if (!Array.isArray(val) && Object.keys(val).length === 0) {
              return '';
            }
          }
          return JSON.stringify(val, null, 2);
        };

        const displayValue = formatJsonValue(value);
        const isEmpty = !displayValue || displayValue.trim() === '' || 
                       displayValue === '{}' || displayValue === '[]';

        return (
          <TextField
            fullWidth
            multiline
            rows={isEmpty ? 2 : 4}
            label={config.label || fieldId}
            value={displayValue}
            onChange={(e) => {
              const inputValue = e.target.value.trim();
              if (!inputValue || inputValue === '' || inputValue === '{}' || inputValue === '[]') {
                if (fieldId === 'audience_pain_points' || fieldId.includes('trends') || fieldId.includes('competitors')) {
                  handleChange([]);
                } else {
                  handleChange({});
                }
              } else {
                try {
                  const parsed = JSON.parse(inputValue);
                  handleChange(parsed);
                } catch {
                  handleChange(inputValue);
                }
              }
            }}
            placeholder={
              isEmpty 
                ? (config as TextFieldConfig).placeholder || `Enter ${fieldId.replace(/_/g, ' ')} as JSON`
                : (config as TextFieldConfig).placeholder || `Enter ${fieldId.replace(/_/g, ' ')} as JSON`
            }
            error={!!error}
            helperText={error || (isEmpty ? 'No data available. Please enter values or use autofill.' : '')}
            required={config.required || false}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={onShowTooltip} size="small">
                    <HelpIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: 1.5
              }
            }}
          />
        );

      default:
        return (
          <TextField
            fullWidth
            label={(config as any).label || fieldId}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Enter ${fieldId}`}
            error={!!error}
            helperText={error}
            required={(config as any).required || false}
          />
        );
    }
  };

  return (
    <Box sx={{ 
      position: 'relative',
      mb: isCompact ? 1.25 : 2,
      p: isCompact ? 1 : 1.5,
      borderRadius: 2,
      bgcolor: 'rgba(255,255,255,0.9)',
      border: '1px solid',
      borderColor: error ? 'error.main' : 'rgba(148, 163, 184, 0.35)',
      boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      '&:hover': {
        borderColor: (theme) => getAccent(theme).main,
        boxShadow: (theme) => `0 10px 24px rgba(0,0,0,0.08), 0 0 0 2px ${getAccent(theme).main}22`
      }
    }}>
      {/* Field input - Enhanced styling */}
      <Box sx={{ 
        '& .MuiTextField-root, & .MuiFormControl-root': {
          '& .MuiInputBase-root': {
            borderRadius: 1,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: (theme) => getAccent(theme).main,
              boxShadow: (theme) => `0 0 0 2px ${getAccent(theme).main}22`
            },
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: (theme) => getAccent(theme).main
              }
            }
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.9rem',
            fontWeight: 600,
            letterSpacing: '0.15px',
            color: (theme) => theme.palette.text.primary,
            '&.Mui-focused': {
              color: (theme) => getAccent(theme).main
            }
          },
          '& .MuiInputBase-input': {
            fontSize: '0.92rem',
            padding: isCompact ? '7px 10px' : '8px 12px'
          }
        }
      }}>
        {renderInput()}
      </Box>

      {/* Data Transparency and Auto-population Indicators */}
      <Box sx={{ 
        mt: 1,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1
      }}>
        {/* Left side - Validation and Quality indicators */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Validation status */}
          {value && !error && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: (theme) => getAccent(theme).main }} />
              <Typography variant="caption" color="success.main" sx={{ fontSize: '0.7rem' }}>
                Valid
              </Typography>
            </Box>
          )}

          {/* Source badge */}
          {sourceMeta && (
            <Chip
              label={sourceMeta.label}
              size="small"
              variant="filled"
              color={sourceMeta.color}
              sx={{
                fontSize: '0.6rem',
                height: 20,
                fontWeight: 600,
                '& .MuiChip-label': { px: 1 }
              }}
            />
          )}

          {/* Data Quality indicator */}
          {dataQuality && (
            <Chip
              icon={<InfoIcon sx={{ fontSize: 12 }} />}
              label={dataQuality}
              size="small"
              variant="outlined"
              color={accentColorKey as any}
              sx={{ 
                fontSize: '0.6rem',
                height: 20,
                '& .MuiChip-label': { px: 1 }
              }}
            />
          )}

          {/* Confidence Level indicator - REMOVED (Area 1) */}
          {/* {confidenceLevel && (
            <Chip
              label={`${Math.round(confidenceLevel * 100)}% confidence`}
              size="small"
              variant="outlined"
              color={confidenceLevel > 0.8 ? 'success' : confidenceLevel > 0.6 ? 'warning' : 'error'}
              sx={{ 
                fontSize: '0.6rem',
                height: 20,
                '& .MuiChip-label': { px: 1 }
              }}
            />
          )} */}
        </Box>

        {/* Right side - Auto-population indicator - REMOVED (Area 2) */}
        {/* {autoPopulated && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: 12 }} />}
              label={`Auto-populated from ${dataSource}`}
              color="info"
              size="small"
              variant="outlined"
              sx={{ 
                fontSize: '0.6rem',
                height: 20,
                '& .MuiChip-label': { px: 1 }
              }}
            />
            {!isEditing && (
              <Tooltip title="Edit auto-populated value">
                <IconButton size="small" onClick={() => setIsEditing(true)} sx={{ width: 20, height: 20 }}>
                  <EditIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )} */}

        {/* Confidence + View details row */}
        {(confidenceLevel || onViewDataSource) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            {confidenceLevel && (
              <Chip
                label={`${Math.round(confidenceLevel * 100)}% confidence`}
                size="small"
                variant="outlined"
                color={confidenceLevel > 0.8 ? 'success' : confidenceLevel > 0.6 ? 'warning' : 'error'}
                sx={{ 
                  fontSize: '0.5rem',
                  height: 16,
                  '& .MuiChip-label': { px: 0.5 }
                }}
              />
            )}
            {onViewDataSource && (
              <Button
                size="small"
                variant="text"
                onClick={onViewDataSource}
                sx={{ 
                  fontSize: '0.6rem',
                  minWidth: 'auto',
                  px: 1,
                  py: 0.25,
                  color: (theme) => getAccent(theme).main,
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: (theme) => `${getAccent(theme).main}1A`
                  }
                }}
              >
                View details
              </Button>
            )}
          </Box>
        )}

        {/* Personalization Information */}
        {personalizationData && (
          <Box sx={{ 
            mt: 0.5,
            p: 0.5,
            bgcolor: 'rgba(76, 175, 80, 0.08)',
            borderRadius: 1,
            border: '1px solid rgba(76, 175, 80, 0.2)'
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.05)' },
              borderRadius: 0.5,
              p: 0.25
            }}
            onClick={() => setShowPersonalization(!showPersonalization)}
            >
              <PersonIcon sx={{ fontSize: 12, color: 'success.main' }} />
              <Typography variant="caption" color="success.main" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
                Personalized for your business
              </Typography>
              {showPersonalization ? (
                <ExpandLessIcon sx={{ fontSize: 12, color: 'success.main' }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 12, color: 'success.main' }} />
              )}
            </Box>
            
            <Collapse in={showPersonalization}>
              <Box sx={{ mt: 0.5, pl: 1.5 }}>
                {/* Personalization Explanation */}
                {personalizationData.explanation && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', mb: 0.5 }}>
                    {personalizationData.explanation}
                  </Typography>
                )}
                
                {/* Personalization Factors */}
                {personalizationData.personalization_factors && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    {Object.entries(personalizationData.personalization_factors).map(([key, value]) => (
                      value && (
                        <Chip
                          key={key}
                          label={`${key.replace(/_/g, ' ')}: ${value}`}
                          size="small"
                          variant="outlined"
                          color="success"
                          sx={{ 
                            fontSize: '0.5rem',
                            height: 16,
                            '& .MuiChip-label': { px: 0.5 }
                          }}
                        />
                      )
                    ))}
                  </Box>
                )}
                
                {/* Data Sources Used */}
                {personalizationData.data_sources && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {Object.entries(personalizationData.data_sources).map(([source, used]) => (
                      used && (
                        <Chip
                          key={source}
                          label={source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{ 
                            fontSize: '0.5rem',
                            height: 16,
                            '& .MuiChip-label': { px: 0.5 }
                          }}
                        />
                      )
                    ))}
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mt: 1, py: 0.5, '& .MuiAlert-message': { py: 0 } }}>
          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
            {error}
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default StrategicInputField; 