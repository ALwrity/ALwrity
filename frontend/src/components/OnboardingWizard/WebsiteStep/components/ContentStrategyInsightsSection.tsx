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
import AnalyticsIcon from '@mui/icons-material/Analytics';
import StrengthsIcon from '@mui/icons-material/CheckCircle';
import WeaknessesIcon from '@mui/icons-material/Cancel';
import OpportunitiesIcon from '@mui/icons-material/TrendingUp';
import ThreatsIcon from '@mui/icons-material/Warning';
import ImprovementsIcon from '@mui/icons-material/Build';
import GapsIcon from '@mui/icons-material/Rule';
import InfoIcon from '@mui/icons-material/Info';
import SectionHeader from './SectionHeader';

export interface ContentStrategyInsights {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  recommended_improvements: string[];
  content_gaps: string[];
}

interface ContentStrategyInsightsSectionProps {
  insights?: ContentStrategyInsights;
  isEditable?: boolean;
  onUpdate?: (field: string, value: any) => void;
  hideHeader?: boolean;
}

const ContentStrategyInsightsSection: React.FC<ContentStrategyInsightsSectionProps> = ({
  insights,
  isEditable = false,
  onUpdate,
  hideHeader = false
}) => {
  if (!insights) {
    return null;
  }

  // Helper to safely extract string array
  const safeArray = (val: any): string[] | undefined => {
    if (val === null || val === undefined) return undefined;
    if (Array.isArray(val)) {
      return val.map(v => {
        if (typeof v === 'string') return v;
        if (typeof v === 'number') return String(v);
        if (typeof v === 'object') {
          if (v?.value) return String(v.value);
          return ''; // Skip complex objects if they don't have value
        }
        return String(v);
      }).filter(v => v !== '');
    }
    if (typeof val === 'object') {
      if (val.value) return [String(val.value)];
      return undefined;
    }
    if (typeof val === 'string') return [val];
    return undefined;
  };

  const createData = (
    category: string,
    label: string, 
    value: any, 
    tooltip: string,
    icon: React.ReactNode,
    field: string,
    color: 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary' | 'default' = 'primary'
  ) => {
    return { category, label, value: safeArray(value), tooltip, icon, field, color };
  };

  const rows = [
    createData(
      'SWOT', 
      'Strengths', 
      insights.strengths, 
      "Internal positive attributes of your content strategy that give you an advantage.", 
      <StrengthsIcon color="success" />,
      'strengths',
      'success'
    ),
    createData(
      'SWOT', 
      'Weaknesses', 
      insights.weaknesses, 
      "Internal negative attributes that place your content strategy at a disadvantage.", 
      <WeaknessesIcon color="error" />,
      'weaknesses',
      'error'
    ),
    createData(
      'SWOT', 
      'Opportunities', 
      insights.opportunities, 
      "External factors that you can capitalize on to improve your content performance.", 
      <OpportunitiesIcon color="info" />,
      'opportunities',
      'info'
    ),
    createData(
      'SWOT', 
      'Threats', 
      insights.threats, 
      "External factors that could cause trouble for your content strategy.", 
      <ThreatsIcon color="warning" />,
      'threats',
      'warning'
    ),
    createData(
      'Actionable', 
      'Recommended Improvements', 
      insights.recommended_improvements, 
      "Specific actions you can take to enhance your content quality and effectiveness.", 
      <ImprovementsIcon color="primary" />,
      'recommended_improvements',
      'primary'
    ),
    createData(
      'Actionable', 
      'Content Gaps', 
      insights.content_gaps, 
      "Topics or areas relevant to your audience that you are currently not covering.", 
      <GapsIcon color="secondary" />,
      'content_gaps',
      'secondary'
    ),
  ].filter(row => isEditable || (row.value && row.value.length > 0));

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
    <Box sx={{ mt: 4 }}>
      {!hideHeader && (
        <SectionHeader 
          title="Content Strategy Insights" 
          icon={<AnalyticsIcon sx={{ color: '#667eea' }} />}
          tooltip="SWOT analysis and actionable insights for your content strategy."
        />
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="content strategy insights table">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '30%' }}>Insight Area</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#1a202c', width: '40%' }}>Key Points</TableCell>
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
                        value={row.value?.join(', ') || ''}
                        onChange={(e) => {
                          const newValue = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
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
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {row.value?.map((v, i) => (
                          <Chip 
                            key={i}
                            label={v} 
                            size="small" 
                            color={row.color as any} 
                            variant="outlined" 
                            sx={{ fontWeight: 600 }}
                          />
                        ))}
                      </Box>
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

export default ContentStrategyInsightsSection;
