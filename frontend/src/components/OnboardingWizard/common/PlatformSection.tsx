import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Button
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Launch as LaunchIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import PlatformCard from './PlatformCard';
import GSCPlatformCard from './GSCPlatformCard';
import WordPressOAuthPlatformCard from './WordPressOAuthPlatformCard';
import WixPlatformCard from './WixPlatformCard';
import LinkedInPlatformCard from './LinkedInPlatformCard';
import { type GSCSite } from '../../../api/gsc';

interface Platform {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'website' | 'social' | 'analytics';
  status: 'available' | 'connected' | 'coming_soon' | 'disabled';
  features: string[];
  benefits: string[];
  oauthUrl?: string;
  isEnabled: boolean;
}

interface PlatformSectionProps {
  title: string;
  description: string;
  platforms: Platform[];
  connectedPlatforms: string[];
  gscSites: GSCSite[] | null;
  isLoading: boolean;
  onConnect: (platformId: string) => void;
  onDisconnect?: (platformId: string) => void;
  setConnectedPlatforms?: (platforms: string[]) => void;
  fadeTimeout?: number;
}

const PlatformSection: React.FC<PlatformSectionProps> = ({
  title,
  description,
  platforms,
  connectedPlatforms,
  gscSites,
  isLoading,
  onConnect,
  onDisconnect,
  setConnectedPlatforms,
  fadeTimeout = 800
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'success';
      case 'available': return 'primary';
      case 'coming_soon': return 'warning';
      case 'disabled': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string): React.ReactElement => {
    switch (status) {
      case 'connected': return <CheckIcon />;
      case 'available': return <LaunchIcon />;
      case 'coming_soon': return <ScheduleIcon />;
      case 'disabled': return <ErrorIcon />;
      default: return <InfoIcon />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'available': return 'Connect';
      case 'coming_soon': return 'Coming Soon';
      case 'disabled': return 'Disabled';
      default: return 'Unknown';
    }
  };

  const platformsWithStatus = platforms.map(platform => ({
    ...platform,
    status: connectedPlatforms.includes(platform.id) ? 'connected' : platform.status
  }));

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 2 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
        {description}
      </Typography>
      
      <Grid container spacing={2}>
        {platformsWithStatus.map((platform) => (
          <Grid item xs={12} md={platform.category === 'social' ? 4 : 6} key={platform.id}>
            {platform.id === 'gsc' ? (
              <GSCPlatformCard
                platform={platform}
                gscSites={gscSites}
                isLoading={isLoading}
                onConnect={onConnect}
                getStatusIcon={getStatusIcon}
                getStatusText={getStatusText}
                getStatusColor={getStatusColor}
                onRefresh={() => {
                  // Trigger a refresh of GSC status
                  console.log('Refreshing GSC status...');
                }}
              />
            ) : platform.id === 'wordpress' ? (
              <WordPressOAuthPlatformCard
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                connectedPlatforms={connectedPlatforms}
                setConnectedPlatforms={setConnectedPlatforms || (() => {})}
              />
            ) : platform.id === 'wix' ? (
              <WixPlatformCard
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                connectedPlatforms={connectedPlatforms}
                setConnectedPlatforms={setConnectedPlatforms || (() => {})}
              />
            ) : platform.id === 'linkedin' ? (
              <LinkedInPlatformCard
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                connectedPlatforms={connectedPlatforms}
                setConnectedPlatforms={setConnectedPlatforms || (() => {})}
              />
            ) : platform.category === 'social' ? (
              <Card 
                sx={{
                  height: '100%',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  transition: 'all 0.2s ease',
                  opacity: platform.isEnabled ? 1 : 0.6,
                  '&:hover': {
                    boxShadow: platform.isEnabled ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
                    transform: platform.isEnabled ? 'translateY(-2px)' : 'none'
                  }
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ color: '#64748b' }}>
                      {platform.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {platform.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {platform.description}
                      </Typography>
                    </Box>
                    <Chip
                      icon={getStatusIcon(platform.status)}
                      label={getStatusText(platform.status)}
                      color={getStatusColor(platform.status) as any}
                      size="small"
                    />
                  </Stack>

                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    disabled={!platform.isEnabled}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      borderColor: '#e2e8f0',
                      color: '#64748b'
                    }}
                  >
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <PlatformCard
                id={platform.id}
                name={platform.name}
                description={platform.description}
                icon={platform.icon}
                status={platform.status}
                features={platform.features}
                isEnabled={platform.isEnabled}
                isLoading={isLoading}
                onConnect={onConnect}
              />
            )}
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default PlatformSection;
