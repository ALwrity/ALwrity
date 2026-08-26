import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import Upload from '@mui/icons-material/Upload';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Warning from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import ArrowBack from '@mui/icons-material/ArrowBack';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import { motion } from 'framer-motion';
import { ImageStudioLayout } from '../ImageStudio/ImageStudioLayout';
import { GlassyCard } from '../ImageStudio/ui/GlassyCard';
import { SectionHeader } from '../ImageStudio/ui/SectionHeader';
import { useCampaignCreator } from '../../hooks/useCampaignCreator';

interface AssetAuditPanelProps {
  onClose: () => void;
}

export const AssetAuditPanel: React.FC<AssetAuditPanelProps> = ({ onClose }) => {
  const { auditAsset, auditResult, isAuditing, error, clearAuditResult } = useCampaignCreator();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        await handleFile(file);
      }
    },
    []
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        await handleFile(file);
      }
    },
    []
  );

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setUploadedImage(base64);
      await auditAsset(base64);
    };
    reader.readAsDataURL(file);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <ErrorIcon />;
      case 'medium':
        return <Warning />;
      case 'low':
        return <CheckCircle />;
      default:
        return null;
    }
  };

  return (
    <ImageStudioLayout
      headerProps={{
        title: 'Asset Audit',
        subtitle: 'Upload existing assets for AI-powered quality assessment and enhancement recommendations',
      }}
    >
      <GlassyCard
        sx={{
          maxWidth: 1000,
          mx: 'auto',
          p: { xs: 3, md: 4 },
        }}
      >
        <Button startIcon={<ArrowBack />} onClick={onClose} sx={{ mb: 3 }}>
          Back to Dashboard
        </Button>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Upload Area */}
        {!uploadedImage && (
          <Box
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            sx={{
              border: `2px dashed ${dragActive ? '#7c3aed' : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 3,
              p: 6,
              textAlign: 'center',
              background: dragActive ? 'rgba(124, 58, 237, 0.1)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <Upload sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drag & drop an image here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              or click to browse
            </Typography>
            <Button variant="outlined" startIcon={<PhotoLibrary />}>
              Select Image
            </Button>
          </Box>
        )}

        {/* Uploaded Image Preview */}
        {uploadedImage && !auditResult && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Uploaded Image
            </Typography>
            <Paper
              sx={{
                p: 2,
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 2,
              }}
            >
              <Box
                component="img"
                src={uploadedImage}
                alt="Uploaded"
                sx={{
                  maxWidth: '100%',
                  maxHeight: 400,
                  borderRadius: 2,
                }}
              />
            </Paper>
            {isAuditing && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                  Analyzing asset quality...
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Audit Results */}
        {auditResult && (
          <Stack spacing={3}>
            <SectionHeader
              title="Audit Results"
              subtitle="AI-powered quality assessment and recommendations"
            />

            {/* Asset Info */}
            <GlassyCard sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h6" gutterBottom>
                  Asset Information
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  <Chip
                    label={`${auditResult.asset_info.width} × ${auditResult.asset_info.height}`}
                    icon={<PhotoLibrary />}
                  />
                  <Chip label={auditResult.asset_info.format} />
                  <Chip label={auditResult.asset_info.mode} />
                  <Chip
                    label={`Quality: ${(auditResult.asset_info.quality_score * 100).toFixed(0)}%`}
                    color={auditResult.asset_info.quality_score > 0.7 ? 'success' : 'warning'}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Quality Score
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={auditResult.asset_info.quality_score * 100}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              </Stack>
            </GlassyCard>

            {/* Status */}
            <Alert
              severity={
                auditResult.status === 'usable'
                  ? 'success'
                  : auditResult.status === 'needs_enhancement'
                  ? 'warning'
                  : 'error'
              }
            >
              <Typography variant="body1" fontWeight={700} gutterBottom>
                Status: {auditResult.status === 'usable' ? 'Ready to Use' : 'Needs Enhancement'}
              </Typography>
              {auditResult.status === 'needs_enhancement' && (
                <Typography variant="body2">
                  This asset may benefit from enhancement operations. See recommendations below.
                </Typography>
              )}
            </Alert>

            {/* Recommendations */}
            {auditResult.recommendations.length > 0 && (
              <GlassyCard sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Enhancement Recommendations
                </Typography>
                <List>
                  {auditResult.recommendations.map((rec, index) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemIcon>
                          {getPriorityIcon(rec.priority)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1" fontWeight={600}>
                                {rec.operation.replace('_', ' ').toUpperCase()}
                              </Typography>
                              <Chip
                                label={rec.priority}
                                size="small"
                                color={getPriorityColor(rec.priority) as any}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {rec.reason}
                              </Typography>
                              {rec.suggested_mode && (
                                <Typography variant="caption" color="text.secondary">
                                  Suggested mode: {rec.suggested_mode}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < auditResult.recommendations.length - 1 && (
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              </GlassyCard>
            )}

            {/* Actions */}
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => {
                setUploadedImage(null);
                clearAuditResult();
              }}>
                Upload Another
              </Button>
              <Button
                variant="contained"
                startIcon={<AutoAwesome />}
                onClick={() => {
                  // Navigate to Edit Studio or enhancement flow
                  alert('Enhancement flow coming soon');
                }}
                disabled={auditResult.status === 'error'}
              >
                Enhance Asset
              </Button>
            </Box>
          </Stack>
        )}
      </GlassyCard>
    </ImageStudioLayout>
  );
};

