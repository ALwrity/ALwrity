import React from 'react';
import { Box, Typography } from '@mui/material';

const WebsiteStepHeader: React.FC = () => {
  return (
    <Box sx={{ mb: 3, mt: 0 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontWeight: 700,
          mb: 1,
          fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
          letterSpacing: '-0.02em',
        }}
      >
        <Box
          component="span"
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #6b75e3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Where should{' '}
        </Box>
        <Box
          component="span"
          sx={{
            background: 'linear-gradient(135deg, #6f72db 0%, #764ba2 60%, #6a4190 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          I begin ?
        </Box>
      </Typography>
      <Typography
        variant="h6"
        component="h2"
        sx={{
          fontWeight: 500,
          color: '#64748B',
          fontSize: { xs: '0.95rem', sm: '1.05rem', md: '1.15rem' },
          lineHeight: 1.5,
        }}
      >
        Choose a source and let ALwrity Learn Your Brand
      </Typography>
    </Box>
  );
};

export default WebsiteStepHeader;
