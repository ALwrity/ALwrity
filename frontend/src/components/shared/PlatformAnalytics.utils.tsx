import React from 'react';
import {
  Search,
  Web,
  Info,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
} from '@mui/icons-material';

export const getPlatformIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'gsc':
      return <Search color="primary" />;
    case 'wix':
      return <Web color="secondary" />;
    case 'wordpress':
      return <Web color="info" />;
    case 'bing':
      return <Search color="primary" />;
    default:
      return <Web />;
  }
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'partial':
      return 'warning';
    default:
      return 'default';
  }
};

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return <CheckCircle color="success" fontSize="small" />;
    case 'error':
      return <ErrorIcon color="error" fontSize="small" />;
    case 'partial':
      return <Warning color="warning" fontSize="small" />;
    default:
      return <Info fontSize="small" />;
  }
};

export const isValidHttpUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};
