import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Typography,
  CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { useContentPlanningStore } from '../../../stores/contentPlanningStore';

const HealthCheck: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<{
    api: boolean;
    database: boolean;
    loading: boolean;
  }>({
    api: false,
    database: false,
    loading: true
  });

  const { checkHealth, checkDatabaseHealth } = useContentPlanningStore();

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const [apiHealthy, dbHealthy] = await Promise.all([
          checkHealth(),
          checkDatabaseHealth()
        ]);

        setHealthStatus({
          api: apiHealthy,
          database: dbHealthy,
          loading: false
        });
      } catch (error) {
        console.error('Health check failed:', error);
        setHealthStatus({
          api: false,
          database: false,
          loading: false
        });
      }
    };

    checkBackendHealth();
  }, [checkHealth, checkDatabaseHealth]);

  if (healthStatus.loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption">Checking backend...</Typography>
      </Box>
    );
  }

  const allHealthy = healthStatus.api && healthStatus.database;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Chip
        icon={allHealthy ? <CheckCircleIcon /> : <WarningIcon />}
        label={allHealthy ? 'Connected' : 'Disconnected'}
        color={allHealthy ? 'success' : 'warning'}
        size="small"
        variant="outlined"
      />
      {!allHealthy && (
        <Typography variant="caption" color="text.secondary">
          {!healthStatus.api && !healthStatus.database && 'API & DB'}
          {!healthStatus.api && healthStatus.database && 'API'}
          {healthStatus.api && !healthStatus.database && 'DB'}
        </Typography>
      )}
    </Box>
  );
};

export default HealthCheck; 