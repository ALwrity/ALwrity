import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CalendarIcon from '@mui/icons-material/CalendarToday';
import EventIcon from '@mui/icons-material/Event';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingIcon from '@mui/icons-material/TrendingUp';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BusinessIcon from '@mui/icons-material/Business';
import TimelineIcon from '@mui/icons-material/Timeline';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import DescriptionIcon from '@mui/icons-material/Description';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';

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
      id={`calendar-tabpanel-${index}`}
      aria-labelledby={`calendar-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CalendarTab: React.FC = () => {
  const navigate = useNavigate();
  const { 
    calendarEvents, 
    createEvent, 
    updateEvent, 
    deleteEvent, 
    error,
    loadCalendarEvents,
    // New calendar generation state
    generatedCalendar,
    calendarGenerationError,
    dataLoading,
    calendarGenerationLoading
  } = useContentPlanningStore();
  
  const [tabValue, setTabValue] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    content_type: '',
    platform: '',
    scheduled_date: '',
    status: 'draft' as 'draft' | 'scheduled' | 'published'
  });

  const safeCalendarEvents = Array.isArray(calendarEvents) ? calendarEvents : [];

  useEffect(() => {
    loadCalendarData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCalendarData = async () => {
    try {
      // Load existing calendar events
      await loadCalendarEvents();
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
  };

  const handleOpenDialog = (event?: any) => {
    if (event) {
      setSelectedEvent(event);
      setEventForm({
        title: event.title,
        description: event.description,
        content_type: event.content_type,
        platform: event.platform,
        scheduled_date: event.scheduled_date || event.date,
        status: event.status as 'draft' | 'scheduled' | 'published'
      });
    } else {
      setSelectedEvent(null);
      setEventForm({
        title: '',
        description: '',
        content_type: '',
        platform: '',
        scheduled_date: '',
        status: 'draft' as 'draft' | 'scheduled' | 'published'
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedEvent(null);
  };

  const handleSaveEvent = async () => {
    try {
      const eventData = {
        title: eventForm.title,
        description: eventForm.description,
        content_type: eventForm.content_type,
        platform: eventForm.platform,
        date: eventForm.scheduled_date, // Map scheduled_date to date for API compatibility
        status: eventForm.status as 'draft' | 'scheduled' | 'published'
      };
      
      if (selectedEvent) {
        await updateEvent(selectedEvent.id, eventData);
      } else {
        await createEvent(eventData);
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(eventId);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleRefreshData = async () => {
    await loadCalendarData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'scheduled': return 'warning';
      case 'published': return 'success';
      default: return 'default';
    }
  };

  const renderGeneratedCalendar = () => {
    if (!generatedCalendar) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <AutoAwesomeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No AI-generated calendar available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate a calendar using the Calendar Wizard to see AI-powered content recommendations
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Calendar Overview */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              <AutoAwesomeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              AI-Generated Content Calendar
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip label={`Type: ${generatedCalendar.calendar_type || 'Monthly'}`} variant="outlined" />
              <Chip label={`Industry: ${generatedCalendar.industry || 'Technology'}`} variant="outlined" />
              <Chip label={`Business Size: ${generatedCalendar.business_size || 'SME'}`} variant="outlined" />
            </Box>
            {generatedCalendar.metadata && (
              <Typography variant="body2" color="text.secondary">
                Generated: {new Date(generatedCalendar.metadata.generated_at).toLocaleString()}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Daily Schedule */}
        {generatedCalendar.daily_schedule && generatedCalendar.daily_schedule.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Daily Schedule
              </Typography>
              <List>
                {generatedCalendar.daily_schedule.map((item: any, index: number) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <EventIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.topic || item.content_type}
                      secondary={`${item.platform} • ${item.content_type} • ${item.estimated_engagement}% engagement`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        )}

        {/* Weekly Themes */}
        {generatedCalendar.weekly_themes && generatedCalendar.weekly_themes.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Weekly Themes
              </Typography>
              <List>
                {generatedCalendar.weekly_themes.map((theme: any, index: number) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <LightbulbIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Week ${theme.week}: ${theme.theme}`}
                      secondary={`${theme.content_count} pieces • ${theme.platforms?.join(', ')}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        )}

        {/* Content Recommendations */}
        {generatedCalendar.content_recommendations && generatedCalendar.content_recommendations.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <TrendingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Content Recommendations
              </Typography>
              <List>
                {generatedCalendar.content_recommendations.map((rec: any, index: number) => (
                  <ListItem key={index} divider>
                    <ListItemIcon>
                      <CheckCircleIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${rec.type}: ${rec.topic}`}
                      secondary={`Priority: ${rec.priority} • ROI: ${(rec.estimated_roi * 100).toFixed(0)}%`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        )}

        {/* Performance Predictions */}
        {generatedCalendar.performance_predictions && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Performance Predictions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Estimated Engagement</Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={generatedCalendar.performance_predictions.estimated_engagement || 0} 
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2">{generatedCalendar.performance_predictions.estimated_engagement || 0}%</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Estimated Reach</Typography>
                  <Typography variant="h6">{generatedCalendar.performance_predictions.estimated_reach || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Estimated Conversions</Typography>
                  <Typography variant="h6">{generatedCalendar.performance_predictions.estimated_conversions || 0}</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* AI Insights */}
        {generatedCalendar.ai_insights && generatedCalendar.ai_insights.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <PsychologyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                AI Insights
              </Typography>
              <Grid container spacing={2}>
                {generatedCalendar.ai_insights.map((insight: any, index: number) => (
                  <Grid item xs={12} md={4} key={index}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Confidence: {(insight.confidence * 100).toFixed(0)}%
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {insight.insight}
                        </Typography>
                        <Typography variant="body2" color="primary">
                          Action: {insight.action}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Strategy Data */}
        {generatedCalendar.strategy_data && Object.keys(generatedCalendar.strategy_data).length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <BusinessIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Strategy Integration
              </Typography>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Strategy Analysis & Quality Indicators</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {generatedCalendar.strategy_analysis && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>Strategy Analysis</Typography>
                        <Typography variant="body2">
                          Completion: {generatedCalendar.strategy_analysis.completion_percentage || 0}%
                        </Typography>
                        <Typography variant="body2">
                          Filled Fields: {generatedCalendar.strategy_analysis.filled_fields || 0}/{generatedCalendar.strategy_analysis.total_fields || 30}
                        </Typography>
                      </Grid>
                    )}
                    {generatedCalendar.quality_indicators && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>Quality Indicators</Typography>
                        <Typography variant="body2">
                          Overall Quality: {generatedCalendar.quality_indicators.overall_quality_score || 0}%
                        </Typography>
                        <Typography variant="body2">
                          Strategic Alignment: {generatedCalendar.quality_indicators.strategic_alignment || 0}%
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Paper>
          </Grid>
        )}
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Content Calendar
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshData}
            disabled={dataLoading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Event
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {calendarGenerationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {calendarGenerationError}
        </Alert>
      )}

      {calendarGenerationLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={20} />
            <Typography>Generating AI-powered content calendar...</Typography>
          </Box>
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Calendar Events" icon={<CalendarIcon />} iconPosition="start" />
          <Tab label="AI-Generated Calendar" icon={<AutoAwesomeIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {/* Calendar Events Tab */}
        {dataLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  <CalendarIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Scheduled Events
                </Typography>
                
                {safeCalendarEvents.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <EventIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No events scheduled
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create your first content event to get started
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {safeCalendarEvents.map((event) => (
                      <Grid item xs={12} md={6} lg={4} key={event.id}>
                        <Card>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Typography variant="h6" component="div">
                                {event.title}
                              </Typography>
                              <Box>
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenDialog(event)}
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteEvent(event.id)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            </Box>
                            
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {event.description}
                            </Typography>
                            
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                              <Chip
                                label={event.platform}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                label={event.content_type}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                label={event.status}
                                size="small"
                                color={getStatusColor(event.status)}
                              />
                            </Box>
                            
                            <Typography variant="caption" color="text.secondary">
                              Scheduled: {new Date(event.scheduled_date || event.date || '').toLocaleDateString()}
                            </Typography>
                            {event.status !== 'published' && (
                            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                              {(event.platform === 'linkedin') && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  startIcon={<LinkedInIcon />}
                                  onClick={() => navigate('/linkedin', {
                                    state: { 
                                      calendarTopic: event.title, 
                                      calendarDescription: event.description,
                                      calendarEventId: event.id 
                                    }
                                  })}
                                >
                                  LinkedIn Post
                                </Button>
                              )}
                              {(event.content_type === 'blog_post' || event.content_type === 'blog') && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="secondary"
                                  startIcon={<DescriptionIcon />}
                                  onClick={() => navigate('/blog', {
                                    state: { 
                                      calendarTopic: event.title, 
                                      calendarDescription: event.description,
                                      calendarEventId: event.id 
                                    }
                                  })}
                                >
                                  Blog Post
                                </Button>
                              )}
                            </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* AI-Generated Calendar Tab */}
        {dataLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          renderGeneratedCalendar()
        )}
      </TabPanel>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedEvent ? 'Edit Event' : 'Add New Event'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
              label="Title"
              value={eventForm.title}
              onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                fullWidth
              />
              <TextField
              label="Description"
              value={eventForm.description}
              onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                multiline
                rows={3}
                fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Content Type</InputLabel>
              <Select
                value={eventForm.content_type}
                onChange={(e) => setEventForm({ ...eventForm, content_type: e.target.value })}
                label="Content Type"
              >
                <MenuItem value="blog_post">Blog Post</MenuItem>
                <MenuItem value="video">Video</MenuItem>
                <MenuItem value="social_post">Social Post</MenuItem>
                <MenuItem value="case_study">Case Study</MenuItem>
                <MenuItem value="whitepaper">Whitepaper</MenuItem>
              </Select>
            </FormControl>
              <FormControl fullWidth>
                <InputLabel>Platform</InputLabel>
                <Select
                value={eventForm.platform}
                onChange={(e) => setEventForm({ ...eventForm, platform: e.target.value })}
                  label="Platform"
                >
                  <MenuItem value="website">Website</MenuItem>
                  <MenuItem value="linkedin">LinkedIn</MenuItem>
                  <MenuItem value="twitter">Twitter</MenuItem>
                  <MenuItem value="instagram">Instagram</MenuItem>
                  <MenuItem value="youtube">YouTube</MenuItem>
                </Select>
              </FormControl>
            <TextField
              label="Scheduled Date"
              type="datetime-local"
              value={eventForm.scheduled_date}
              onChange={(e) => setEventForm({ ...eventForm, scheduled_date: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                value={eventForm.status}
                onChange={(e) => setEventForm({ ...eventForm, status: e.target.value as 'draft' | 'scheduled' | 'published' })}
                  label="Status"
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="scheduled">Scheduled</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                </Select>
              </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveEvent} variant="contained">
            {selectedEvent ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarTab; 