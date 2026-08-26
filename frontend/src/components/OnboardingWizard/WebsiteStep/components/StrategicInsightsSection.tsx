import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Fade,
  TextField
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoIcon from '@mui/icons-material/Info';
import CheckIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SectionHeader from './SectionHeader';

interface StrategicInsightsSectionProps {
  contentStrategy?: string;
  competitiveAdvantages?: string[];
  contentCalendarSuggestions?: string[];
  aiGenerationTips?: string[];
  isEditable?: boolean;
  onUpdate?: (field: string, value: any) => void;
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
      id={`strategic-tabpanel-${index}`}
      aria-labelledby={`strategic-tab-${index}`}
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

const StrategicInsightsSection: React.FC<StrategicInsightsSectionProps> = ({
  contentStrategy,
  competitiveAdvantages,
  contentCalendarSuggestions,
  aiGenerationTips,
  isEditable = false,
  onUpdate,
  hideHeader = false
}) => {
  const [value, setValue] = useState(0);

  // Check which sections have data (or are editable to allow adding data?)
  // For now, keep existing logic but maybe show all if editable?
  // Let's stick to showing if data exists to avoid clutter, or maybe show empty fields if editable?
  // Given the current structure, we only render tabs if data exists.
  // If we want to allow adding data where none exists, we'd need to change this logic.
  // For now, let's assume we are editing existing data.
  const hasStrategy = !!contentStrategy || isEditable;
  const hasAdvantages = (competitiveAdvantages && competitiveAdvantages.length > 0) || isEditable;
  const hasCalendar = (contentCalendarSuggestions && contentCalendarSuggestions.length > 0) || isEditable;
  const hasAiTips = (aiGenerationTips && aiGenerationTips.length > 0) || isEditable;

  if (!hasStrategy && !hasAdvantages && !hasCalendar && !hasAiTips) {
    return null;
  }

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleUpdate = (field: string, value: any) => {
    onUpdate && onUpdate(field, value);
  };

  const renderListItems = (items: string[], icon: React.ReactNode, color: string, field: string) => {
    if (isEditable) {
      return (
        <TextField
          fullWidth
          multiline
          minRows={4}
          variant="outlined"
          value={items.join('\n')} // Use newline for easier editing of lists
          onChange={(e) => {
            // Split by newline to get array
            const newValue = e.target.value.split('\n').filter(s => s.trim() !== '');
            handleUpdate(field, newValue);
          }}
          placeholder="Enter items separated by new lines..."
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
      );
    }

    return (
      <List dense>
        {items.map((item, index) => (
          <ListItem key={index} alignItems="flex-start">
            <ListItemIcon sx={{ minWidth: 36, mt: 0.5, color: color }}>
              {icon}
            </ListItemIcon>
            <ListItemText 
              primary={item} 
              primaryTypographyProps={{ variant: 'body2', color: 'text.primary', lineHeight: 1.6 }}
            />
          </ListItem>
        ))}
      </List>
    );
  };

  return (
    <Box sx={{ mt: 4 }}>
      {!hideHeader && (
        <SectionHeader 
          title="Strategic Action Plan" 
          icon={<AutoAwesomeIcon sx={{ color: '#667eea' }} />}
          tooltip="Actionable steps and strategies derived from the analysis."
        />
      )}
      
      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
        <Tabs 
          value={value} 
          onChange={handleChange} 
          variant="scrollable"
          scrollButtons="auto"
          aria-label="strategic insights tabs"
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
          {hasStrategy && (
            <Tab 
              icon={<BusinessIcon fontSize="small" />} 
              iconPosition="start" 
              label={
                <Tooltip title="High-level overview of your recommended content direction" arrow placement="top">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Strategy Overview
                    <InfoIcon fontSize="inherit" sx={{ opacity: 0.5, fontSize: 14 }} />
                  </Box>
                </Tooltip>
              } 
            />
          )}
          {hasAdvantages && (
            <Tab 
              icon={<TrendingUpIcon fontSize="small" />} 
              iconPosition="start" 
              label={
                <Tooltip title="Unique selling points that differentiate you from competitors" arrow placement="top">
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Competitive Edge
                    <InfoIcon fontSize="inherit" sx={{ opacity: 0.5, fontSize: 14 }} />
                  </Box>
                </Tooltip>
              } 
            />
          )}
          {hasCalendar && (
            <Tab 
              icon={<CalendarIcon fontSize="small" />} 
              iconPosition="start" 
              label={
                <Tooltip title="Suggested content topics and schedule ideas" arrow placement="top">
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Calendar Ideas
                    <InfoIcon fontSize="inherit" sx={{ opacity: 0.5, fontSize: 14 }} />
                  </Box>
                </Tooltip>
              } 
            />
          )}
          {hasAiTips && (
            <Tab 
              icon={<AutoAwesomeIcon fontSize="small" />} 
              iconPosition="start" 
              label={
                <Tooltip title="Tips for generating better AI content with your profile" arrow placement="top">
                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    AI Tips
                    <InfoIcon fontSize="inherit" sx={{ opacity: 0.5, fontSize: 14 }} />
                  </Box>
                </Tooltip>
              } 
            />
          )}
        </Tabs>

        {/* Since Tabs index logic depends on which props are present, we need to map the visible tabs to their content */}
        {(() => {
          let tabIndex = 0;
          const panels = [];

          if (hasStrategy) {
            panels.push(
              <TabPanel value={value} index={tabIndex++} key="strategy">
                <Box sx={{ p: 1 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon fontSize="small" />
                    Core Strategy
                  </Typography>
                  {isEditable ? (
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      variant="outlined"
                      value={contentStrategy || ''}
                      onChange={(e) => handleUpdate('content_strategy', e.target.value)}
                      placeholder="Enter core strategy..."
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
                      {contentStrategy}
                    </Typography>
                  )}
                </Box>
              </TabPanel>
            );
          }

          if (hasAdvantages) {
            panels.push(
              <TabPanel value={value} index={tabIndex++} key="advantages">
                 <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUpIcon fontSize="small" />
                    Your Competitive Advantages
                  </Typography>
                {renderListItems(competitiveAdvantages || [], <CheckIcon fontSize="small" />, 'success.main', 'competitive_advantages')}
              </TabPanel>
            );
          }

          if (hasCalendar) {
            panels.push(
              <TabPanel value={value} index={tabIndex++} key="calendar">
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'info.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon fontSize="small" />
                    Content Calendar Suggestions
                  </Typography>
                {renderListItems(contentCalendarSuggestions || [], <CalendarIcon fontSize="small" />, 'info.main', 'content_calendar_suggestions')}
              </TabPanel>
            );
          }

          if (hasAiTips) {
            panels.push(
              <TabPanel value={value} index={tabIndex++} key="aitips">
                 <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeIcon fontSize="small" />
                    AI Generation Tips
                  </Typography>
                {renderListItems(aiGenerationTips || [], <LightbulbIcon fontSize="small" />, 'secondary.main', 'ai_generation_tips')}
              </TabPanel>
            );
          }

          return panels;
        })()}
      </Paper>
    </Box>
  );
};

export default StrategicInsightsSection;
