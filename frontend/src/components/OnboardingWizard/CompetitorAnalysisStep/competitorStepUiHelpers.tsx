import React from 'react';
import { Box, Typography, Stack } from '@mui/material';

export const lightTheme = {
  surface: '#FFFFFF',
  text: '#0B1220',
  textSecondary: '#4B5563',
  border: '#E5E7EB',
  inputBg: '#FFFFFF',
  inputText: '#0B1220',
  placeholder: '#6B7280',
  primary: '#6C5CE7',
  primaryContrast: '#FFFFFF',
  shadowSm: '0 1px 2px rgba(16,24,40,0.06)',
  shadowMd: '0 4px 10px rgba(16,24,40,0.08)',
  radiusLg: '20px',
};

export const renderStringList = (title: string, items: string[]): React.ReactNode => (
  <Box>
    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0B1220', mb: 0.5 }}>
      {title}
    </Typography>
    <Stack spacing={0.5}>
      {items.map((item, i) => (
        <Typography key={i} variant="body2" sx={{ color: '#4B5563' }}>
          • {item}
        </Typography>
      ))}
    </Stack>
  </Box>
);

export const labelify = (key: string): string =>
  key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
