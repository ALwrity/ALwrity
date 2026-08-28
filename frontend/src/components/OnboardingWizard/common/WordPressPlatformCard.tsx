/**
 * WordPress Platform Card Component
 * Handles WordPress site connection and management.
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider
} from '@mui/material';
import WordPressIcon from '@mui/icons-material/Web';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import { useWordPressConnection } from '../../../hooks/useWordPressConnection';

interface WordPressPlatformCardProps {
  onConnect?: (platform: string) => void;
  onDisconnect?: (platform: string) => void;
  connectedPlatforms: string[];
  setConnectedPlatforms: (platforms: string[]) => void;
}

const WordPressPlatformCard: React.FC<WordPressPlatformCardProps> = ({
  onConnect,
  onDisconnect,
  connectedPlatforms,
  setConnectedPlatforms
}) => {
  const {
    connected,
    sites,
    totalSites,
    isLoading,
    addSite,
    disconnectSite,
    testConnection,
    validateSiteUrl,
    formatSiteUrl,
    refreshStatus
  } = useWordPressConnection();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSitesDialog, setShowSitesDialog] = useState(false);
  const [formData, setFormData] = useState({
    site_url: '',
    site_name: '',
    username: '',
    app_password: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const isConnected = connected && totalSites > 0;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.site_url.trim()) {
      errors.site_url = 'Site URL is required';
    } else if (!validateSiteUrl(formData.site_url)) {
      errors.site_url = 'Please enter a valid site URL';
    }

    if (!formData.site_name.trim()) {
      errors.site_name = 'Site name is required';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }

    if (!formData.app_password.trim()) {
      errors.app_password = 'Application password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setTestResult(null);

      const success = await testConnection(formData);
      setTestResult({
        success,
        message: success ? 'Connection successful!' : 'Connection failed. Please check your credentials.'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection test failed. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSite = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      setTestResult(null);

      const success = await addSite(formData);
      
      if (success) {
        setShowAddDialog(false);
        setFormData({ site_url: '', site_name: '', username: '', app_password: '' });
        setConnectedPlatforms([...connectedPlatforms, 'wordpress']);
        onConnect?.('wordpress');
      } else {
        setTestResult({
          success: false,
          message: 'Failed to add WordPress site. Please try again.'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to add WordPress site. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnectSite = async (siteId: number) => {
    try {
      const success = await disconnectSite(siteId);
      if (success) {
        // Check if we still have connected sites
        const remainingSites = sites.filter(site => site.id !== siteId);
        if (remainingSites.length === 0) {
          setConnectedPlatforms(connectedPlatforms.filter(p => p !== 'wordpress'));
          onDisconnect?.('wordpress');
        }
        setShowSitesDialog(false);
      }
    } catch (error) {
      console.error('Error disconnecting WordPress site:', error);
    }
  };

  const getStatusIcon = () => {
    if (isLoading) return <CircularProgress size={20} />;
    if (isConnected) return <CheckCircleIcon color="success" />;
    return <ErrorIcon color="error" />;
  };

  const getStatusColor = () => {
    if (isConnected) return 'success';
    return 'default';
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    if (isConnected) return `Connected (${totalSites} site${totalSites > 1 ? 's' : ''})`;
    return 'Not Connected';
  };

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box display="flex" alignItems="center" mb={2}>
            <WordPressIcon sx={{ mr: 1, color: '#21759b' }} />
            <Typography variant="h6" component="h3">
              WordPress
            </Typography>
            <Box ml="auto">
              <Chip
                icon={getStatusIcon()}
                label={getStatusText()}
                color={getStatusColor() as any}
                size="small"
              />
            </Box>
          </Box>

          {/* Description */}
          <Typography variant="body2" color="text.secondary" mb={3}>
            Connect your WordPress sites for seamless content publishing and management.
          </Typography>

          {/* Features */}
          <Box mb={3}>
            <Typography variant="body2" fontWeight="medium" mb={1}>
              Features:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Direct publishing to WordPress<br />
              • Media library integration<br />
              • Category and tag management<br />
              • SEO optimization
            </Typography>
          </Box>

          {/* Actions */}
          <Box mt="auto">
            {isConnected ? (
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setShowSitesDialog(true)}
                  fullWidth
                >
                  Manage Sites ({totalSites})
                </Button>
                <Tooltip title="Refresh status">
                  <IconButton onClick={refreshStatus} disabled={isLoading}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowAddDialog(true)}
                fullWidth
                disabled={isLoading}
              >
                Connect WordPress
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Add Site Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Connect WordPress Site</DialogTitle>
        <DialogContent>
          <Box pt={1}>
            <TextField
              fullWidth
              label="Site URL"
              value={formData.site_url}
              onChange={(e) => handleInputChange('site_url', e.target.value)}
              error={!!formErrors.site_url}
              helperText={formErrors.site_url || 'e.g., mysite.com or https://mysite.com'}
              margin="normal"
            />
            
            <TextField
              fullWidth
              label="Site Name"
              value={formData.site_name}
              onChange={(e) => handleInputChange('site_name', e.target.value)}
              error={!!formErrors.site_name}
              helperText={formErrors.site_name || 'A friendly name for this site'}
              margin="normal"
            />
            
            <TextField
              fullWidth
              label="Username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              error={!!formErrors.username}
              helperText={formErrors.username || 'Your WordPress username'}
              margin="normal"
            />
            
            <TextField
              fullWidth
              label="Application Password"
              type="password"
              value={formData.app_password}
              onChange={(e) => handleInputChange('app_password', e.target.value)}
              error={!!formErrors.app_password}
              helperText={formErrors.app_password || 'Generate from WordPress Admin → Users → Profile → Application Passwords'}
              margin="normal"
            />

            {testResult && (
              <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                {testResult.message}
              </Alert>
            )}

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>How to get Application Password:</strong><br />
                1. Go to your WordPress Admin → Users → Profile<br />
                2. Scroll down to "Application Passwords"<br />
                3. Enter a name (e.g., "ALwrity") and click "Add New Application Password"<br />
                4. Copy the generated password (it won't be shown again)
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleTestConnection} disabled={isSubmitting}>
            Test Connection
          </Button>
          <Button 
            onClick={handleAddSite} 
            variant="contained" 
            disabled={isSubmitting || !testResult?.success}
          >
            {isSubmitting ? <CircularProgress size={20} /> : 'Connect Site'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Sites Dialog */}
      <Dialog open={showSitesDialog} onClose={() => setShowSitesDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Manage WordPress Sites</DialogTitle>
        <DialogContent>
          <List>
            {sites.map((site, index) => (
              <React.Fragment key={site.id}>
                <ListItem>
                  <ListItemText
                    primary={site.site_name}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {site.site_url}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Connected: {new Date(site.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Disconnect site">
                      <IconButton 
                        edge="end" 
                        onClick={() => handleDisconnectSite(site.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < sites.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSitesDialog(false)}>Close</Button>
          <Button onClick={() => { setShowSitesDialog(false); setShowAddDialog(true); }} variant="contained">
            Add New Site
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WordPressPlatformCard;
