import React from 'react';
import CheckCircle from '@mui/icons-material/CheckCircle';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import ImageIcon from '@mui/icons-material/Image';
import VideoLibrary from '@mui/icons-material/VideoLibrary';
import AudioFile from '@mui/icons-material/AudioFile';
import TextFields from '@mui/icons-material/TextFields';
import { Chip } from '@mui/material';

export const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return <CheckCircle sx={{ color: '#10b981', fontSize: 18 }} />;
    case 'processing':
      return <HourglassEmpty sx={{ color: '#f59e0b', fontSize: 18 }} />;
    case 'failed':
      return <ErrorIcon sx={{ color: '#ef4444', fontSize: 18 }} />;
    default:
      return <HourglassEmpty sx={{ color: '#6b7280', fontSize: 18 }} />;
  }
};

export const getStatusChip = (status: string) => {
  const statusLower = status?.toLowerCase() || 'completed';
  const colors: Record<string, { bg: string; color: string }> = {
    completed: { bg: 'rgba(16,185,129,0.2)', color: '#10b981' },
    processing: { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b' },
    failed: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444' },
    pending: { bg: 'rgba(107,114,128,0.2)', color: '#6b7280' },
  };
  const style = colors[statusLower] || colors.completed;
  return (
    <Chip
      icon={getStatusIcon(status)}
      label={statusLower}
      size="small"
      sx={{
        background: style.bg,
        color: style.color,
        fontWeight: 600,
        textTransform: 'capitalize',
        height: 28,
      }}
    />
  );
};

export const getAssetIcon = (assetType: string) => {
  switch (assetType) {
    case 'image':
      return <ImageIcon />;
    case 'video':
      return <VideoLibrary />;
    case 'audio':
      return <AudioFile />;
    case 'text':
      return <TextFields />;
    default:
      return <ImageIcon />;
  }
};

export const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const timezoneOffset = -date.getTimezoneOffset();
    const offsetHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, '0');
    const offsetMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, '0');
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} GMT${offsetSign}${offsetHours}.${offsetMinutes}`;
  } catch {
    return dateString;
  }
};

export const getModelName = (asset: any) => {
  if (asset.model) return asset.model;
  if (asset.provider) return `${asset.provider}/${asset.source_module.replace('_', ' ')}`;
  return asset.source_module.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
};
