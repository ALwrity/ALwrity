/**
 * Content Type Analysis Section Component
 * Displays content type analysis in a grid layout matching the Key Insights pattern
 */

import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
  Chip,
  TextField
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BusinessIcon from '@mui/icons-material/Business';
import InfoIcon from '@mui/icons-material/Info';
import SectionHeader from './SectionHeader';

interface ContentType {
  primary_type?: string;
  secondary_types?: string[];
  purpose?: string;
  call_to_action?: string;
  conversion_focus?: string;
  educational_value?: string;
}

interface ContentTypeAnalysisSectionProps {
  contentType?: ContentType;
  isEditable?: boolean;
  onUpdate?: (field: string, value: any) => void;
  hideHeader?: boolean;
}

const ContentTypeAnalysisSection: React.FC<ContentTypeAnalysisSectionProps> = ({
  contentType,
  isEditable = false,
  onUpdate,
  hideHeader = false
}) => {
  // Helper to safely extract string value from potential object/metadata
  const safeValue = (val: any): string | undefined => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') {
      // If it has a value property, use it
      if (val.value) return String(val.value);
      // If it's a metadata object without value, return undefined to skip
      return undefined;
    }
    return String(val);
  };

  if (!contentType) {
    return null;
  }

  const createData = (
    category: string,
    label: string, 
    value: any, 
    tooltip: string,
    icon: React.ReactNode,
    field: string
  ) => {
    return { category, label, value: safeValue(value), tooltip, icon, field };
  };

  const rows = [
    createData(
      'Purpose', 
      'Content Purpose', 
      contentType.purpose, 
      "The primary goal of the content - whether to inform, entertain, persuade, or sell.", 
      <AutoAwesomeIcon color="primary" />,
      'purpose'
    ),
    createData(
      'Conversion', 
      'Call to Action Style', 
      contentType.call_to_action, 
      "How the content encourages users to take action - direct, subtle, or value-driven.", 
      <TrendingUpIcon color="success" />,
      'call_to_action'
    ),
    createData(
      'Conversion', 
      'Conversion Focus', 
      contentType.conversion_focus, 
      "The specific conversion metric the content aims to drive.", 
      <AnalyticsIcon color="info" />,
      'conversion_focus'
    ),
    createData(
      'Value', 
      'Educational Value', 
      contentType.educational_value, 
      "The depth of information and learning value provided to the reader.", 
      <LightbulbIcon color="warning" />,
      'educational_value'
    ),
    createData(
      'Structure', 
      'Secondary Content Types', 
      contentType.secondary_types && contentType.secondary_types.length > 0 ? contentType.secondary_types.join(', ') : undefined, 
      "Other content formats that complement the primary type.", 
      <BusinessIcon color="secondary" />,
      'secondary_types'
    ),
  ].filter(row => isEditable || (row.value && row.value.trim() !== ''));

  // Group rows by category
  const groupedRows = rows.reduce((acc, row) => {
    if (!acc[row.category]) {
      acc[row.category] = [];
    }
    acc[row.category].push(row);
    return acc;
  }, {} as Record<string, typeof rows>);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: hideHeader ? 0 : 4 }}>
      {!hideHeader && (
        <SectionHeader 
          title="Content Type Analysis" 
          icon={<BusinessIcon sx={{ color: '#667eea' }} />}
          tooltip="Categorization of your content's purpose and format."
        />
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="content type analysis table">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '40%' }}>Metric</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '60%' }}>Analysis Result</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(groupedRows).map(([category, categoryRows]) => (
              <React.Fragment key={category}>
                <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableCell colSpan={2} sx={{ fontWeight: 700, color: '#475569', py: 1 }}>
                    {category}
                  </TableCell>
                </TableRow>
                {categoryRows.map((row) => (
                  <TableRow
                    key={row.label}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { backgroundColor: '#f9f9f9' } }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {row.icon}
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2d3748' }}>
                          {row.label}
                        </Typography>
                        <Tooltip 
                          title={row.tooltip} 
                          arrow 
                          placement="top"
                          componentsProps={{
                            tooltip: {
                              sx: {
                                bgcolor: 'rgba(30, 41, 59, 0.95)',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                maxWidth: 250,
                                p: 1.5,
                                borderRadius: 2,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                lineHeight: 1.4,
                              }
                            },
                            arrow: {
                              sx: {
                                color: 'rgba(30, 41, 59, 0.95)'
                              }
                            }
                          }}
                        >
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              border: '1px solid #E2E8F0',
                              cursor: 'pointer',
                              color: '#94A3B8',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                borderColor: '#94A3B8',
                                color: '#64748B',
                                bgcolor: '#F1F5F9',
                              }
                            }}
                          >
                            <InfoIcon sx={{ fontSize: 12 }} />
                          </Box>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {isEditable ? (
                        <TextField
                          value={row.value || ''}
                          onChange={(e) => {
                            const newValue = row.field === 'secondary_types'
                              ? e.target.value.split(',').map(s => s.trim())
                              : e.target.value;
                            onUpdate && onUpdate(row.field, newValue);
                          }}
                          variant="outlined"
                          size="small"
                          fullWidth
                          sx={{ 
                            '& .MuiInputBase-input': {
                              color: '#1f2937',
                              fontWeight: 500
                            },
                            '& .MuiOutlinedInput-root': {
                              bgcolor: 'white',
                              color: '#1f2937'
                            }
                          }}
                        />
                      ) : (
                        <Chip 
                          label={row.value} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ContentTypeAnalysisSection;
