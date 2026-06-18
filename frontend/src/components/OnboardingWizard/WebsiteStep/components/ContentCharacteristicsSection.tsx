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
import {
  Analytics as AnalyticsIcon,
  Language as LanguageIcon,
  Speed as SpeedIcon,
  Palette as PaletteIcon,
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import SectionHeader from './SectionHeader';

interface ContentCharacteristics {
  sentence_structure?: string;
  vocabulary_level?: string;
  paragraph_organization?: string;
  content_flow?: string;
  readability_score?: string;
  content_density?: string;
  visual_elements_usage?: string;
}

interface ContentCharacteristicsSectionProps {
  contentCharacteristics?: ContentCharacteristics;
  isEditable?: boolean;
  onUpdate?: (field: string, value: any) => void;
  hideHeader?: boolean;
}

const ContentCharacteristicsSection: React.FC<ContentCharacteristicsSectionProps> = ({
  contentCharacteristics,
  isEditable = false,
  onUpdate,
  hideHeader = false
}) => {
  const safeValue = (val: any): string | undefined => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') {
      if (val.value) return String(val.value);
      return undefined;
    }
    return String(val);
  };

  if (!contentCharacteristics) {
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
      'Readability',
      'Vocabulary Level',
      contentCharacteristics.vocabulary_level,
      'The complexity and sophistication of words used in the content',
      <LanguageIcon />,
      'vocabulary_level'
    ),
    createData(
      'Readability',
      'Readability Score',
      contentCharacteristics.readability_score,
      'How easy it is for readers to understand the content',
      <SpeedIcon />,
      'readability_score'
    ),
    createData(
      'Readability',
      'Content Density',
      contentCharacteristics.content_density,
      'How much information is packed into each section',
      <PaletteIcon />,
      'content_density'
    ),
    createData(
      'Structure',
      'Sentence Structure',
      contentCharacteristics.sentence_structure,
      'The variety and complexity of sentence patterns used',
      <AnalyticsIcon />,
      'sentence_structure'
    ),
    createData(
      'Structure',
      'Paragraph Organization',
      contentCharacteristics.paragraph_organization,
      'How paragraphs are structured and organized',
      <AnalyticsIcon />,
      'paragraph_organization'
    ),
    createData(
      'Structure',
      'Content Flow',
      contentCharacteristics.content_flow,
      'How smoothly the content moves from one idea to the next',
      <TrendingUpIcon />,
      'content_flow'
    ),
    createData(
      'Presentation',
      'Visual Elements Usage',
      contentCharacteristics.visual_elements_usage,
      'How often images, charts, and other visual elements support the text',
      <PaletteIcon />,
      'visual_elements_usage'
    ),
  ].filter(row => isEditable || (row.value && row.value.trim() !== ''));

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
          title="Content Characteristics" 
          icon={<AnalyticsIcon sx={{ color: '#667eea' }} />}
          tooltip="Readability, structure, and presentation patterns in your content."
        />
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="content characteristics table">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '30%' }}>Metric</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '40%' }}>Analysis Result</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '30%' }}>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(groupedRows).map(([category, categoryRows]) => (
              <React.Fragment key={category}>
                <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableCell colSpan={3} sx={{ fontWeight: 700, color: '#475569', py: 1 }}>
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
                        <Box sx={{ color: '#667eea', display: 'flex' }}>{row.icon}</Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2d3748' }}>
                          {row.label}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {isEditable ? (
                        <TextField
                          value={row.value || ''}
                          onChange={(e) => onUpdate && onUpdate(row.field, e.target.value)}
                          variant="outlined"
                          size="small"
                          fullWidth
                          sx={{ 
                            '& .MuiInputBase-input': { color: '#1f2937', fontWeight: 500 },
                            '& .MuiOutlinedInput-root': { bgcolor: 'white', color: '#1f2937' }
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
                    <TableCell>
                      <Tooltip title={row.tooltip} arrow placement="top">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                          <InfoIcon fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            What is this?
                          </Typography>
                        </Box>
                      </Tooltip>
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

export default ContentCharacteristicsSection;
