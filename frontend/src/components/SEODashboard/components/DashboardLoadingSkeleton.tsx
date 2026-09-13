import React from 'react';
import { Box, Skeleton } from '@mui/material';
import { GlassCard } from '../../shared/styled';

/**
 * Per-card loading placeholder for the Overview tab.
 * Rendered in the content area while data loads so the header,
 * tabs, and layout persist (no page wipe, no layout shift).
 */
const DashboardLoadingSkeleton: React.FC = () => {
  return (
    <Box aria-busy="true" aria-label="Loading dashboard data">
      {/* Metrics row placeholder */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <GlassCard key={i} sx={{ p: 2, flex: 1 }}>
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="40%" height={36} />
          </GlassCard>
        ))}
      </Box>
      {/* Content cards placeholder */}
      <GlassCard sx={{ p: 3, mb: 3 }}>
        <Skeleton variant="text" width="35%" height={28} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
      </GlassCard>
      <GlassCard sx={{ p: 3 }}>
        <Skeleton variant="text" width="45%" height={28} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
      </GlassCard>
    </Box>
  );
};

export default DashboardLoadingSkeleton;
