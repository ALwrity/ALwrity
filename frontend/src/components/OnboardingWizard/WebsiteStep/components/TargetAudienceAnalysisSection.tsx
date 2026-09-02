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
import GroupIcon from '@mui/icons-material/Group';
import BusinessIcon from '@mui/icons-material/Business';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PsychologyIcon from '@mui/icons-material/Psychology';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoIcon from '@mui/icons-material/Info';
import SectionHeader from './SectionHeader';

interface TargetAudience {
  demographics?: string[];
  expertise_level?: string;
  industry_focus?: string;
  geographic_focus?: string;
  psychographic_profile?: string;
  pain_points?: string[];
  motivations?: string[];
}

interface TargetAudienceAnalysisSectionProps {
  targetAudience?: TargetAudience;
  isEditable?: boolean;
  onUpdate?: (field: string, value: any) => void;
  hideHeader?: boolean;
}

const TargetAudienceAnalysisSection: React.FC<TargetAudienceAnalysisSectionProps> = ({
  targetAudience,
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

  if (!targetAudience) {
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
      'Demographics',
      'Demographics',
      targetAudience.demographics,
      'The demographic profile of your target readers',
      <GroupIcon />,
      'demographics'
    ),
    createData(
      'Demographics',
      'Expertise Level',
      targetAudience.expertise_level,
      'The skill level and experience of the intended readers',
      <PsychologyIcon />,
      'expertise_level'
    ),
    createData(
      'Demographics',
      'Geographic Focus',
      targetAudience.geographic_focus,
      'The geographical regions the content is primarily intended for',
      <AnalyticsIcon />,
      'geographic_focus'
    ),
    createData(
      'Industry',
      'Industry Focus',
      targetAudience.industry_focus,
      'The specific industry or sector your content addresses',
      <BusinessIcon />,
      'industry_focus'
    ),
    createData(
      'Psychographics',
      'Psychographic Profile',
      targetAudience.psychographic_profile,
      'Attitudes, values, and lifestyle characteristics of your audience',
      <PsychologyIcon />,
      'psychographic_profile'
    ),
    createData(
      'Psychographics',
      'Pain Points',
      targetAudience.pain_points,
      'Challenges and problems your audience is trying to solve',
      <WarningIcon />,
      'pain_points'
    ),
    createData(
      'Psychographics',
      'Motivations',
      targetAudience.motivations,
      'Goals and desires that drive your audience to seek content',
      <TrendingUpIcon />,
      'motivations'
    ),
  ].filter(row => {
    if (isEditable) return true;
    if (row.field === 'demographics' && targetAudience.demographics && targetAudience.demographics.length > 0) return true;
    return row.value && row.value.trim() !== '';
  });

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
          title="Target Audience Analysis" 
          icon={<GroupIcon sx={{ color: '#667eea' }} />}
          tooltip="Who your content speaks to — demographics, psychographics, and motivations."
        />
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="target audience analysis table">
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
                        <Box sx={{ color: '#667eea', display: 'flex' }}>{row.icon}</Box>
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
                          label={row.value || (row.field === 'demographics' && targetAudience.demographics ? targetAudience.demographics.join(', ') : '—')} 
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

export default TargetAudienceAnalysisSection;
