import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, CircularProgress, Typography, Chip, Paper } from '@mui/material';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import { useLinkedInSocialConnection } from '../../../../hooks/useLinkedInSocialConnection';

interface LinkedInIntegrationTabProps {
  connectedPlatforms: string[];
  setConnectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  linkedinProfile: any;
  setLinkedinProfile: React.Dispatch<React.SetStateAction<any>>;
}

const LinkedInIntegrationTab: React.FC<LinkedInIntegrationTabProps> = ({
  connectedPlatforms,
  setConnectedPlatforms,
  linkedinProfile,
  setLinkedinProfile,
}) => {
  const {
    connected,
    displayName,
    accountName,
    isConnecting,
    connectWithOAuth,
    disconnect,
    connectError,
  } = useLinkedInSocialConnection();

  const [email, setEmail] = useState('');

  // Sync connected status with connectedPlatforms
  useEffect(() => {
    if (connected) {
      if (!connectedPlatforms.includes('linkedin')) {
        setConnectedPlatforms((prev) => [...prev, 'linkedin']);
      }
    } else if (connectedPlatforms.includes('linkedin')) {
      setConnectedPlatforms((prev) => prev.filter((p) => p !== 'linkedin'));
    }
  }, [connected, connectedPlatforms, setConnectedPlatforms]);

  // Pre-fill email if connected and name is available
  useEffect(() => {
    if (connected && (displayName || accountName)) {
      setEmail(displayName || accountName || '');
    } else if (!connected) {
      setEmail('');
    }
  }, [connected, displayName, accountName]);

  const handleConnect = async () => {
    try {
      await connectWithOAuth();
    } catch (error) {
      console.error('LinkedIn connection failed:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      const success = await disconnect();
      if (success) {
        setConnectedPlatforms((prev) => prev.filter((p) => p !== 'linkedin'));
        setLinkedinProfile(null);
      }
    } catch (error) {
      console.error('LinkedIn disconnection failed:', error);
    }
  };

  const isConnected = connectedPlatforms.includes('linkedin');

  return (
    <Box sx={{ width: '100%' }}>
      {/* Input Card */}
      <Box sx={{ position: 'relative', mb: 2 }}>
        <TextField
          label="Your LinkedIn Email (e.g., name@domain.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          placeholder="Enter your LinkedIn email to connect your profile."
          disabled={isConnecting || isConnected}
          InputLabelProps={{ shrink: true }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              bgcolor: '#F8FAFC',
              pr: '180px', // Extra padding for the absolute button
              '& fieldset': { borderColor: '#CBD5E1' },
              '&:hover fieldset': { borderColor: '#0A66C2' },
              '&.Mui-focused fieldset': { borderColor: '#0A66C2', borderWidth: 2 },
            },
            '& .MuiInputLabel-root': {
              color: '#64748B',
              fontWeight: 500,
              '&.Mui-focused': { color: '#0A66C2' },
            },
            '& .MuiInputBase-input': {
              color: '#1E293B',
            },
          }}
        />
        <Button
          variant="contained"
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={isConnecting}
          startIcon={isConnecting ? <CircularProgress size={18} color="inherit" /> : <LinkedInIcon />}
          sx={{
            position: 'absolute',
            right: 6,
            top: 6,
            bottom: 6,
            borderRadius: '10px',
            textTransform: 'none',
            px: 2.5,
            py: 0,
            background: isConnected
              ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
              : 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: isConnected
              ? '0 2px 8px rgba(239, 68, 68, 0.3)'
              : '0 2px 8px rgba(10, 102, 194, 0.3)',
            zIndex: 1,
            '&:hover': {
              background: isConnected
                ? 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
                : 'linear-gradient(135deg, #004182 0%, #002D5A 100%)',
              boxShadow: isConnected
                ? '0 4px 12px rgba(239, 68, 68, 0.4)'
                : '0 4px 12px rgba(10, 102, 194, 0.4)',
            },
            '&.Mui-disabled': {
              background: isConnected
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(10, 102, 194, 0.3)',
              color: 'rgba(255,255,255,0.5)',
            },
          }}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect LinkedIn'}
        </Button>
      </Box>
      {connectError && (
        <Typography
          variant="caption"
          sx={{
            color: '#EF4444',
            mt: -0.5,
            mb: 2,
            display: 'block',
            fontWeight: 500,
            textAlign: 'left',
          }}
          role="alert"
        >
          {connectError}
        </Typography>
      )}

      {/* Profile Summary Card */}
      {isConnected && linkedinProfile && (
        <Box sx={{ mt: 2, p: 2, bgcolor: '#FFFFFF', borderRadius: 2, border: '1px solid #E2E8F0' }}>
          <Typography variant="subtitle2" sx={{ color: '#0A66C2', fontWeight: 600, mb: 1 }}>
            LinkedIn Profile Connected
          </Typography>
          {linkedinProfile.headline && (
            <Typography variant="body2" sx={{ color: '#334155', mb: 0.5 }}>
              {linkedinProfile.headline}
            </Typography>
          )}
          {linkedinProfile.industry && (
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>
              Industry: {linkedinProfile.industry}
            </Typography>
          )}
          {linkedinProfile.skills?.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {linkedinProfile.skills.map((skill: string) => (
                <Chip
                  key={skill}
                  label={skill}
                  size="small"
                  sx={{ bgcolor: '#EFF6FF', color: '#0A66C2', fontSize: '0.7rem', height: 22 }}
                />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default LinkedInIntegrationTab;
