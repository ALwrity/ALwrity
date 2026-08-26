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
import BusinessIcon from '@mui/icons-material/Business';
import VoiceIcon from '@mui/icons-material/RecordVoiceOver';
import PositioningIcon from '@mui/icons-material/GpsFixed';
import ValuesIcon from '@mui/icons-material/Diamond';
import DifferentiationIcon from '@mui/icons-material/CompareArrows';
import TrustIcon from '@mui/icons-material/VerifiedUser';
import AuthorityIcon from '@mui/icons-material/School';
import InfoIcon from '@mui/icons-material/Info';

interface BrandAnalysis {
  brand_voice: string;
  brand_values: string[];
  brand_positioning: string;
  competitive_differentiation: string;
  trust_signals: string[];
  authority_indicators: string[];
}

interface BrandAnalysisSectionProps {
  brandAnalysis?: BrandAnalysis;
  isEditable?: boolean;
  onUpdate?: (field: string, value: any) => void;
  hideHeader?: boolean;
}

const BrandAnalysisSection: React.FC<BrandAnalysisSectionProps> = ({
  brandAnalysis,
  isEditable = false,
  onUpdate,
  hideHeader = false
}) => {
  if (!brandAnalysis) {
    return null;
  }

  // Helper to safely extract string/array value
  const safeValue = (val: any): string | string[] | undefined => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') {
      if (val.value) return val.value;
      return undefined;
    }
    return String(val);
  };

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
      'Identity', 
      'Brand Voice', 
      brandAnalysis.brand_voice, 
      "The distinct personality and style of communication used by your brand.", 
      <VoiceIcon color="primary" />,
      'brand_voice'
    ),
    createData(
      'Identity', 
      'Brand Positioning', 
      brandAnalysis.brand_positioning, 
      "How your brand occupies a distinct place in the minds of your target audience compared to competitors.", 
      <PositioningIcon color="secondary" />,
      'brand_positioning'
    ),
    createData(
      'Core', 
      'Brand Values', 
      brandAnalysis.brand_values, 
      "The fundamental beliefs and principles that guide your brand's actions and decisions.", 
      <ValuesIcon color="warning" />,
      'brand_values'
    ),
    createData(
      'Market', 
      'Competitive Differentiation', 
      brandAnalysis.competitive_differentiation, 
      "What makes your brand unique and superior to competitors in the eyes of customers.", 
      <DifferentiationIcon color="error" />,
      'competitive_differentiation'
    ),
    createData(
      'Trust', 
      'Trust Signals', 
      brandAnalysis.trust_signals, 
      "Elements that build credibility and confidence with your audience (e.g., testimonials, certifications).", 
      <TrustIcon color="success" />,
      'trust_signals'
    ),
    createData(
      'Authority', 
      'Authority Indicators', 
      brandAnalysis.authority_indicators, 
      "Evidence of your brand's expertise and leadership in its industry.", 
      <AuthorityIcon color="info" />,
      'authority_indicators'
    ),
  ].filter(row => isEditable || (row.value && (Array.isArray(row.value) ? row.value.length > 0 : row.value.trim() !== '')));

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
        <Typography 
          variant="h5" 
          sx={{
            mb: 2,
            color: '#1a202c',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <BusinessIcon sx={{ color: '#667eea' }} />
          Brand Analysis
        </Typography>
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="brand analysis table">
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
                        {row.icon}
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2d3748' }}>
                          {row.label}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                    {isEditable ? (
                      <TextField
                        value={Array.isArray(row.value) ? row.value.join(', ') : (row.value || '')}
                        onChange={(e) => {
                          const isArrayField = ['brand_values', 'trust_signals', 'authority_indicators'].includes(row.field);
                          const newValue = isArrayField 
                            ? e.target.value.split(',').map(s => s.trim()) 
                            : e.target.value;
                          onUpdate && onUpdate(row.field, newValue);
                        }}
                        variant="outlined"
                        size="small"
                        fullWidth
                        multiline
                        maxRows={4}
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
                      Array.isArray(row.value) ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.value.map((v, i) => (
                            <Chip 
                              key={i}
                              label={v} 
                              size="small" 
                              color="primary" 
                              variant="outlined" 
                              sx={{ fontWeight: 600 }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Chip 
                          label={row.value} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                          sx={{ fontWeight: 600 }}
                        />
                      )
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

export default BrandAnalysisSection;
