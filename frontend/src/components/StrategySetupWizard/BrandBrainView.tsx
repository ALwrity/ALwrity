import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Alert,
  Divider,
  Button,
} from '@mui/material';
import {
  Psychology as BrainIcon,
  Store as IndustryIcon,
  People as AudienceIcon,
  Style as VoiceIcon,
  Category as ContentIcon,
  Palette as BrandIcon,
  Cloud as PlatformIcon,
  BarChart as SeoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { apiClient } from '../../api/client';

interface BrandBrainViewProps {
  onDataLoaded?: (data: any) => void;
}

const BrandBrainView: React.FC<BrandBrainViewProps> = ({ onDataLoaded }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadBrandBrain();
  }, []);

  const loadBrandBrain = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/api/content-planning/enhanced-strategies/onboarding-data');
      const data = res.data?.data;
      const canonical = data?.canonical_profile || data;
      setProfile(canonical);
      onDataLoaded?.(canonical);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('Complete onboarding first to build your Brand Brain.');
      } else {
        setError(err?.response?.data?.detail || 'Failed to load Brand Brain');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={300} height={40} />
        <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 2 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="info"
        icon={<BrainIcon />}
        sx={{ m: 3 }}
        action={
          <Button size="small" startIcon={<RefreshIcon />} onClick={loadBrandBrain}>
            Retry
          </Button>
        }
      >
        <Typography variant="subtitle1" fontWeight={600}>Brand Brain</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>{error}</Typography>
      </Alert>
    );
  }

  if (!profile) {
    return (
      <Alert
        severity="info"
        sx={{ mx: 3 }}
        action={
          <Button size="small" color="primary" variant="outlined" href="/onboarding">
            Go to Onboarding
          </Button>
        }
      >
        <Typography variant="subtitle1" fontWeight={600}>Brand Brain</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          No Brand Brain data found. Complete the onboarding process first to build your canonical profile.
        </Typography>
      </Alert>
    );
  }

  const sections = [
    {
      label: 'Industry',
      icon: <IndustryIcon />,
      value: profile.industry,
      color: 'primary',
    },
    {
      label: 'Target Audience',
      icon: <AudienceIcon />,
      value: profile.target_audience
        ? typeof profile.target_audience === 'string'
          ? profile.target_audience
          : JSON.stringify(profile.target_audience.demographics || profile.target_audience)
        : null,
      color: 'success',
    },
    {
      label: 'Writing Style',
      icon: <VoiceIcon />,
      value: [profile.writing_tone, profile.writing_voice, profile.writing_complexity]
        .filter(Boolean)
        .join(' · '),
      color: 'secondary',
    },
    {
      label: 'Content Types',
      icon: <ContentIcon />,
      value: Array.isArray(profile.content_types)
        ? profile.content_types.join(', ')
        : null,
      color: 'info',
    },
    {
      label: 'Brand Identity',
      icon: <BrandIcon />,
      value: Array.isArray(profile.brand_values)
        ? profile.brand_values.join(', ')
        : null,
      color: 'warning',
    },
    {
      label: 'Platforms',
      icon: <PlatformIcon />,
      value: Array.isArray(profile.platform_preferences)
        ? profile.platform_preferences.join(', ')
        : null,
      color: 'info',
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <BrainIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700}>
          Brand Brain
        </Typography>
        <Chip label="SSOT" size="small" color="primary" variant="outlined" sx={{ ml: 1 }} />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Your Brand Brain is the canonical profile built from onboarding — the single source of truth
        that powers your strategy. All data below is read-only and sourced from your onboarding.
      </Typography>

      <Grid container spacing={2}>
        {sections.map((section) => {
          if (!section.value) return null;
          return (
            <Grid item xs={12} sm={6} md={4} key={section.label}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Box sx={{ color: `${section.color}.main` }}>{section.icon}</Box>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                      {section.label}
                    </Typography>
                  </Box>
                  <Typography variant="body2">
                    {section.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {profile.strategy_insights && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Strategy Insights
          </Typography>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {typeof profile.strategy_insights === 'string'
                  ? profile.strategy_insights
                  : JSON.stringify(profile.strategy_insights, null, 2)}
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default BrandBrainView;
