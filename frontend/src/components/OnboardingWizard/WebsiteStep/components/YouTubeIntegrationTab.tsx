import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Paper, Typography } from '@mui/material';
import YouTubeIcon from '@mui/icons-material/YouTube';

interface YouTubeIntegrationTabProps {
  youtubeConnected: boolean;
  setConnectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  connectedPlatforms: string[];
}

const YouTubeIntegrationTab: React.FC<YouTubeIntegrationTabProps> = ({
  youtubeConnected,
  setConnectedPlatforms,
  connectedPlatforms,
}) => {
  const [channelInput, setChannelInput] = useState('');

  // Sync state with connectedPlatforms
  useEffect(() => {
    if (youtubeConnected && !channelInput) {
      setChannelInput('Connected YouTube Channel');
    } else if (!youtubeConnected) {
      setChannelInput('');
    }
  }, [youtubeConnected]);

  const handleConnect = () => {
    setConnectedPlatforms((prev) => [...prev, 'youtube']);
  };

  const handleDisconnect = () => {
    setConnectedPlatforms((prev) => prev.filter((p) => p !== 'youtube'));
  };

  const isConnected = connectedPlatforms.includes('youtube');

  return (
    <Box sx={{ width: '100%' }}>
      {/* Input Card */}
      <Box sx={{ position: 'relative', mb: 2 }}>
        <TextField
          label="Your YouTube Channel URL or Email"
          value={channelInput}
          onChange={(e) => setChannelInput(e.target.value)}
          fullWidth
          placeholder="Enter your YouTube channel URL or email to connect."
          disabled={isConnected}
          InputLabelProps={{ shrink: true }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              bgcolor: '#F8FAFC',
              pr: '180px', // Extra padding for absolute button
              '& fieldset': { borderColor: '#CBD5E1' },
              '&:hover fieldset': { borderColor: '#FF0000' },
              '&.Mui-focused fieldset': { borderColor: '#FF0000', borderWidth: 2 },
            },
            '& .MuiInputLabel-root': {
              color: '#64748B',
              fontWeight: 500,
              '&.Mui-focused': { color: '#FF0000' },
            },
            '& .MuiInputBase-input': {
              color: '#1E293B',
            },
          }}
        />
        <Button
          variant="contained"
          onClick={isConnected ? handleDisconnect : handleConnect}
          startIcon={<YouTubeIcon />}
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
              : 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: isConnected
              ? '0 2px 8px rgba(239, 68, 68, 0.3)'
              : '0 2px 8px rgba(255, 0, 0, 0.3)',
            zIndex: 1,
            '&:hover': {
              background: isConnected
                ? 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
                : 'linear-gradient(135deg, #CC0000 0%, #990000 100%)',
              boxShadow: isConnected
                ? '0 4px 12px rgba(239, 68, 68, 0.4)'
                : '0 4px 12px rgba(255, 0, 0, 0.4)',
            },
          }}
        >
          {isConnected ? 'Disconnect' : 'Connect YouTube'}
        </Button>
      </Box>

      {/* Connection Success Card */}
      {isConnected && (
        <Box sx={{ mt: 2, p: 2, bgcolor: '#FFFFFF', borderRadius: 2, border: '1px solid #E2E8F0' }}>
          <Typography variant="subtitle2" sx={{ color: '#FF0000', fontWeight: 600, mb: 0.5 }}>
            YouTube Channel Connected
          </Typography>
          <Typography variant="body2" sx={{ color: '#334155' }}>
            Your channel has been successfully linked. Automated video publishing and performance analytics are now enabled.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default YouTubeIntegrationTab;
