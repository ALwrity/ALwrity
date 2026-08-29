import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Fade,
  Tooltip,
  TextField
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PsychologyIcon from '@mui/icons-material/Psychology';
import InfoIcon from '@mui/icons-material/Info';
import TimelineIcon from '@mui/icons-material/Timeline';
import StarIcon from '@mui/icons-material/Star';
import SectionHeader from './SectionHeader';

interface StyleAnalysisSectionProps {
  patterns?: {
    [key: string]: string | string[];
  };
  consistency?: string;
  uniqueElements?: string[];
  domainName: string;
  isEditable?: boolean;
  onUpdate?: (section: string, field: string, value: any) => void;
  hideHeader?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`style-tabpanel-${index}`}
      aria-labelledby={`style-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Fade in={value === index}>
          <Box sx={{ p: 3 }}>
            {children}
          </Box>
        </Fade>
      )}
    </div>
  );
}

const StyleAnalysisSection: React.FC<StyleAnalysisSectionProps> = ({
  patterns,
  consistency,
  uniqueElements,
  domainName,
  isEditable = false,
  onUpdate,
  hideHeader = false
}) => {
  const [value, setValue] = useState(0);

  const hasPatterns = (patterns && Object.keys(patterns).length > 0) || isEditable;
  const hasConsistency = !!consistency || isEditable;
  const hasUniqueElements = (uniqueElements && uniqueElements.length > 0) || isEditable;

  if (!hasPatterns && !hasConsistency && !hasUniqueElements) {
    return null;
  }

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleUpdate = (section: string, field: string, value: any) => {
    onUpdate && onUpdate(section, field, value);
  };

  // Convert patterns object to array for table
  const patternRows = patterns 
    ? Object.entries(patterns)
        .filter(([_, value]) => {
          // Filter out null/undefined
          if (!value) return false;
          // Keep primitives
          if (typeof value !== 'object') return true;
          // Keep arrays
          if (Array.isArray(value)) return true;
          // Filter out plain objects (likely nested data or metadata that causes crashes)
          return false;
        })
        .map(([key, value]) => ({
        key: key,
        category: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: value,
        tooltip: `Analysis of ${key.replace(/_/g, ' ')} found in your content.`
      }))
    : [];

  return (
    <Box sx={{ mt: 4 }}>
      {!hideHeader && (
        <SectionHeader 
          title={`Style Analysis for ${domainName}`}
          icon={<PsychologyIcon sx={{ color: '#805ad5' }} />}
          tooltip="Advanced analysis of your writing patterns, consistency, and unique stylistic elements."
        />
      )}
      
      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={value} 
          onChange={handleChange} 
          variant="scrollable"
          scrollButtons="auto"
          aria-label="style analysis tabs"
          sx={{ 
            backgroundColor: '#f8fafc', 
            borderBottom: '1px solid #e0e0e0',
            '& .MuiTab-root': { 
              textTransform: 'none', 
              fontWeight: 600,
              minHeight: 56
            }
          }}
        >
          {hasPatterns && (
            <Tab 
              icon={<TimelineIcon fontSize="small" />} 
              iconPosition="start" 
              label={
                <Tooltip title="Recurring patterns in sentence structure and vocabulary" arrow placement="top">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Style Patterns
                    <InfoIcon fontSize="inherit" sx={{ opacity: 0.5, fontSize: 14 }} />
                  </Box>
                </Tooltip>
              } 
            />
          )}
          {hasConsistency && (
            <Tab 
              icon={<AnalyticsIcon fontSize="small" />} 
              iconPosition="start" 
              label={
                <Tooltip title="How consistent your tone and style are across different pages" arrow placement="top">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Consistency
                    <InfoIcon fontSize="inherit" sx={{ opacity: 0.5, fontSize: 14 }} />
                  </Box>
                </Tooltip>
              } 
            />
          )}
          {hasUniqueElements && (
            <Tab 
              icon={<StarIcon fontSize="small" />} 
              iconPosition="start" 
              label={
                <Tooltip title="Distinctive elements that make your brand unique" arrow placement="top">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Unique Elements
                    <InfoIcon fontSize="inherit" sx={{ opacity: 0.5, fontSize: 14 }} />
                  </Box>
                </Tooltip>
              } 
            />
          )}
        </Tabs>

        {/* Dynamic Tab Panels */}
        {(() => {
          let tabIndex = 0;
          const panels = [];

          if (hasPatterns) {
            panels.push(
              <TabPanel value={value} index={tabIndex++} key="patterns">
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 1 }}>
                  <Table sx={{ minWidth: 500 }} size="small" aria-label="style patterns table">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 600, width: '30%' }}>Pattern Type</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Observation</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {patternRows.map((row) => (
                        <TableRow
                          key={row.category}
                          sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { backgroundColor: '#f9f9f9' } }}
                        >
                          <TableCell component="th" scope="row" sx={{ fontWeight: 500, color: 'primary.main' }}>
                            {row.category}
                          </TableCell>
                          <TableCell>
                            {isEditable ? (
                              <TextField
                                value={Array.isArray(row.value) ? row.value.join(', ') : (row.value || '')}
                                onChange={(e) => {
                                  const newValue = Array.isArray(row.value)
                                    ? e.target.value.split(',').map(s => s.trim())
                                    : e.target.value;
                                  handleUpdate('style_patterns', row.key, newValue);
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
                                      variant="outlined" 
                                      sx={{ bgcolor: 'white' }}
                                    />
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  {row.value}
                                </Typography>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>
            );
          }

          if (hasConsistency) {
            panels.push(
              <TabPanel value={value} index={tabIndex++} key="consistency">
                <Box sx={{ p: 1 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AnalyticsIcon fontSize="small" color="secondary" />
                    Overall Consistency
                  </Typography>
                  {isEditable ? (
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      variant="outlined"
                      value={consistency || ''}
                      onChange={(e) => handleUpdate('style_consistency', 'style_consistency', e.target.value)}
                      sx={{ 
                        mt: 1,
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
                    <Typography variant="body1" sx={{ lineHeight: 1.7, color: 'text.secondary' }}>
                      {consistency}
                    </Typography>
                  )}
                </Box>
              </TabPanel>
            );
          }

          if (hasUniqueElements) {
            panels.push(
              <TabPanel value={value} index={tabIndex++} key="unique">
                 <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AnalyticsIcon fontSize="small" color="info" />
                    Unique Elements
                  </Typography>
                  {isEditable ? (
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      variant="outlined"
                      value={uniqueElements?.join('\n') || ''}
                      onChange={(e) => handleUpdate('unique_elements', 'unique_elements', e.target.value.split('\n').filter(s => s.trim() !== ''))}
                      placeholder="Enter unique elements separated by new lines..."
                      sx={{ 
                        mt: 1,
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
                    <Box component="ul" sx={{ pl: 2 }}>
                      {uniqueElements?.map((element, index) => (
                        <Typography component="li" variant="body2" key={index} sx={{ color: 'text.secondary', mb: 0.5 }}>
                          {element}
                        </Typography>
                      ))}
                    </Box>
                  )}
              </TabPanel>
            );
          }

          return panels;
        })()}
      </Paper>
    </Box>
  );
};

export default StyleAnalysisSection;
