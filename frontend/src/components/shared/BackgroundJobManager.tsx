import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  ExpandMore,
  Analytics,
  DataUsage,
} from '@mui/icons-material';
import { apiClient } from '../../api/client';

interface Job {
  job_id: string;
  job_type: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result?: any;
  error?: string;
}

interface BackgroundJobManagerProps {
  siteUrl?: string;
  days?: number;
  onJobCompleted?: (job: Job) => void;
}

const BackgroundJobManager: React.FC<BackgroundJobManagerProps> = ({
  siteUrl,
  days = 30,
  onJobCompleted,
}) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [hasRunningJobs, setHasRunningJobs] = useState(false);

  // Fetch user jobs
  const fetchJobs = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/background-jobs/user-jobs?limit=10');
      if (response.data.success) {
        const newJobs = response.data.data.jobs || [];
        setJobs(newJobs);
        
        // Update running jobs state
        const runningJobs = newJobs.some((job: Job) => job.status === 'running' || job.status === 'pending');
        setHasRunningJobs(runningJobs);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  }, []);

  // Create Bing comprehensive insights job
  const createComprehensiveInsightsJob = async () => {
    if (!siteUrl) {
      alert('Cannot create job: no site URL configured');
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.post(
        `/api/background-jobs/bing/comprehensive-insights?site_url=${encodeURIComponent(siteUrl)}&days=${days}`
      );
      
      if (response.data.success) {
        const jobId = response.data.data.job_id;
        console.log('✅ Comprehensive insights job created:', jobId);
        
        // Refresh jobs list
        await fetchJobs();
        
        // Show success message
        alert(`Background job created successfully! Job ID: ${jobId}\n\nThis will generate comprehensive Bing insights in the background. Check the job status below for progress.`);
      }
    } catch (error) {
      console.error('Error creating comprehensive insights job:', error);
      alert('Failed to create background job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create Bing data collection job
  const createDataCollectionJob = async () => {
    if (!siteUrl) {
      alert('Cannot create job: no site URL configured');
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.post(
        `/api/background-jobs/bing/data-collection?site_url=${encodeURIComponent(siteUrl)}&days_back=${days}`
      );
      
      if (response.data.success) {
        const jobId = response.data.data.job_id;
        console.log('✅ Data collection job created:', jobId);
        
        // Refresh jobs list
        await fetchJobs();
        
        alert(`Background data collection job created successfully! Job ID: ${jobId}\n\nThis will collect fresh data from Bing API in the background.`);
      }
    } catch (error) {
      console.error('Error creating data collection job:', error);
      alert('Failed to create data collection job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Cancel job
  const cancelJob = async (jobId: string) => {
    try {
      const response = await apiClient.post(`/api/background-jobs/cancel/${jobId}`);
      
      if (response.data.success) {
        console.log('✅ Job cancelled:', jobId);
        await fetchJobs();
        alert('Job cancelled successfully');
      } else {
        alert(response.data.message || 'Failed to cancel job');
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      alert('Failed to cancel job. Please try again.');
    }
  };

  // View job details
  const viewJobDetails = async (jobId: string) => {
    try {
      const response = await apiClient.get(`/api/background-jobs/status/${jobId}`);
      
      if (response.data.success) {
        setSelectedJob(response.data.data);
        setJobDialogOpen(true);
        
        // Call onJobCompleted if job is completed
        if (response.data.data.status === 'completed' && onJobCompleted) {
          onJobCompleted(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      alert('Failed to fetch job details');
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'primary';
      case 'pending': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'failed': return <ErrorIcon />;
      case 'running': return <CircularProgress size={16} />;
      case 'pending': return <Schedule />;
      case 'cancelled': return <Stop />;
      default: return <Schedule />;
    }
  };

  // Format job type
  const formatJobType = (jobType: string) => {
    switch (jobType) {
      case 'bing_comprehensive_insights': return 'Bing Comprehensive Insights';
      case 'bing_data_collection': return 'Bing Data Collection';
      case 'analytics_refresh': return 'Analytics Refresh';
      default: return jobType;
    }
  };

  // One-run guard to prevent duplicate calls in StrictMode
  const jobsFetchedRef = useRef(false);

  // Poll for job updates
  useEffect(() => {
    if (jobsFetchedRef.current) return;
    jobsFetchedRef.current = true;
    
    fetchJobs();
    
    // Only start polling if there are running jobs
    let interval: NodeJS.Timeout | null = null;
    
    if (hasRunningJobs) {
      interval = setInterval(() => {
        fetchJobs().catch(console.error);
      }, 5000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchJobs, hasRunningJobs]); // Only depend on hasRunningJobs state

  return (
    <Box>
      {/* Action Buttons */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Background Job Actions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Run expensive operations in the background to avoid timeouts and improve user experience.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<Analytics />}
              onClick={createComprehensiveInsightsJob}
              disabled={loading}
              color="primary"
            >
              {loading ? 'Creating...' : 'Generate Comprehensive Bing Insights'}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<DataUsage />}
              onClick={createDataCollectionJob}
              disabled={loading}
              color="secondary"
            >
              {loading ? 'Creating...' : 'Collect Fresh Bing Data'}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchJobs}
              disabled={loading}
            >
              Refresh Jobs
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Background Jobs
          </Typography>
          
          {jobs.length === 0 ? (
            <Alert severity="info">
              No background jobs found. Create a job using the buttons above.
            </Alert>
          ) : (
            <List>
              {jobs.map((job) => (
                <Accordion key={job.job_id} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getStatusIcon(job.status)}
                        <Chip
                          label={job.status.toUpperCase()}
                          color={getStatusColor(job.status) as any}
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {formatJobType(job.job_type)}
                      </Typography>
                      
                      <Typography variant="caption" color="text.secondary">
                        {new Date(job.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  
                  <AccordionDetails>
                    <Box sx={{ width: '100%' }}>
                      {/* Progress Bar */}
                      {(job.status === 'running' || job.status === 'pending') && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            Progress: {job.progress}%
                          </Typography>
                          <LinearProgress variant="determinate" value={job.progress} />
                        </Box>
                      )}
                      
                      {/* Job Message */}
                      <Typography variant="body2" gutterBottom>
                        <strong>Status:</strong> {job.message}
                      </Typography>
                      
                      {/* Job Details */}
                      <Typography variant="body2" gutterBottom>
                        <strong>Job ID:</strong> {job.job_id}
                      </Typography>
                      
                      {job.started_at && (
                        <Typography variant="body2" gutterBottom>
                          <strong>Started:</strong> {new Date(job.started_at).toLocaleString()}
                        </Typography>
                      )}
                      
                      {job.completed_at && (
                        <Typography variant="body2" gutterBottom>
                          <strong>Completed:</strong> {new Date(job.completed_at).toLocaleString()}
                        </Typography>
                      )}
                      
                      {job.error && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                          <strong>Error:</strong> {job.error}
                        </Alert>
                      )}
                      
                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => viewJobDetails(job.job_id)}
                        >
                          View Details
                        </Button>
                        
                        {(job.status === 'pending' || job.status === 'running') && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => cancelJob(job.job_id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Job Details Dialog */}
      <Dialog
        open={jobDialogOpen}
        onClose={() => setJobDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Job Details - {selectedJob?.job_id}
        </DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box>
              <Typography variant="body1" gutterBottom>
                <strong>Type:</strong> {formatJobType(selectedJob.job_type)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Status:</strong> {selectedJob.status.toUpperCase()}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Message:</strong> {selectedJob.message}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Progress:</strong> {selectedJob.progress}%
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Created:</strong> {new Date(selectedJob.created_at).toLocaleString()}
              </Typography>
              
              {selectedJob.started_at && (
                <Typography variant="body1" gutterBottom>
                  <strong>Started:</strong> {new Date(selectedJob.started_at).toLocaleString()}
                </Typography>
              )}
              
              {selectedJob.completed_at && (
                <Typography variant="body1" gutterBottom>
                  <strong>Completed:</strong> {new Date(selectedJob.completed_at).toLocaleString()}
                </Typography>
              )}
              
              {selectedJob.result && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Results:
                  </Typography>
                  <pre style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: '16px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '400px'
                  }}>
                    {JSON.stringify(selectedJob.result, null, 2)}
                  </pre>
                </Box>
              )}
              
              {selectedJob.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <strong>Error:</strong> {selectedJob.error}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJobDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BackgroundJobManager;
