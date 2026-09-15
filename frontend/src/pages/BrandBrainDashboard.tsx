/**
 * Brand Brain Dashboard — Phases 3–7 page.
 *
 * Full-page /brand-brain view of the user's Brand Brain: the structural SSOT
 * (canonical_profile) plus the SIF semantic memory. This shell establishes the
 * terminal-themed scaffold (mirroring SchedulerDashboard) and wires the lazy
 * route's data layer (`useBrandBrainDashboard` + `services/brandBrainApi`).
 * The four sections are delegated to the dedicated components:
 *   - Phase 4: <IdentityOverview /> + <CanonicalProfileView />
 *   - Phase 5: <SifIndexHealthStrip /> + <SemanticQuery />
 * Phase 6 gates the whole surface on the feature flag: when
 * `isBrandBrainDashboardEnabled()` is false the page renders a disabled alert
 * and `useBrandBrainDashboard(false)` never fires a request.
 * Phase 7 wraps every section in a ComponentErrorBoundary (one crashing
 * section surfaces an error card instead of blanking the page) and adds the
 * ComingSoonStrip roadmap for the §8.2 deferred workstreams.
 */

import React, { useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { styled } from '@mui/material/styles';
import HeaderControls from '../components/shared/HeaderControls';
import ComponentErrorBoundary from '../components/shared/ComponentErrorBoundary';
import { TerminalAlert } from '../components/SchedulerDashboard/terminalTheme';
import { isBrandBrainDashboardEnabled } from '../config/brandBrainConfig';
import { useBrandBrainDashboard } from '../hooks/useBrandBrainDashboard';
import IdentityOverview from '../components/BrandBrainDashboard/IdentityOverview';
import CanonicalProfileView from '../components/BrandBrainDashboard/CanonicalProfileView';
import SifIndexHealthStrip from '../components/BrandBrainDashboard/SifIndexHealthStrip';
import SemanticQuery from '../components/BrandBrainDashboard/SemanticQuery';
import ComingSoonStrip from '../components/BrandBrainDashboard/ComingSoonStrip';

// Terminal-themed scaffold — inline tokens mirror SchedulerDashboard.tsx.
const TerminalContainer = styled(Container)(({ theme }) => ({
  backgroundColor: '#0a0a0a',
  minHeight: '100vh',
  color: '#00ff00',
  fontFamily: '"Courier New", "Monaco", "Consolas", "Fira Code", monospace',
  padding: theme.spacing(3),
  '& *': {
    fontFamily: 'inherit',
  },
}));

const TerminalHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 24,
  paddingBottom: 16,
  borderBottom: '2px solid #00ff00',
});

const TerminalTitle = styled(Typography)<{ component?: React.ElementType }>(() => ({
  color: '#00ff00',
  fontFamily: 'inherit',
  fontSize: '1.75rem',
  fontWeight: 'bold',
  textShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
  letterSpacing: '2px',
}));

const TerminalSubtitle = styled(Typography)({
  color: '#00ff88',
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  marginTop: 4,
  opacity: 0.8,
});

const TerminalIconButton = styled(IconButton)({
  color: '#00ff00',
  border: '1px solid #00ff00',
  '&:hover': {
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    boxShadow: '0 0 10px rgba(0, 255, 0, 0.3)',
  },
  '&:disabled': {
    color: '#004400',
    borderColor: '#004400',
  },
});

const BrandBrainDashboard: React.FC = () => {
  const enabled = isBrandBrainDashboardEnabled();
  const { data, loading, error, refresh } = useBrandBrainDashboard(enabled);
  const triggerRefresh = useCallback(() => refresh(), [refresh]);
  const onboarding = data?.onboarding ?? null;

  return (
    <TerminalContainer maxWidth="xl">
      <TerminalHeader>
        <Box>
          <TerminalTitle component="h1">BRAND BRAIN DASHBOARD</TerminalTitle>
          <TerminalSubtitle>
            Your brand's structural SSOT and SIF semantic memory
          </TerminalSubtitle>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title="Refresh Brand Brain dashboard">
            <span>
              <TerminalIconButton onClick={triggerRefresh} disabled={loading}>
                <RefreshIcon />
              </TerminalIconButton>
            </span>
          </Tooltip>
          <HeaderControls colorMode="dark" />
        </Box>
      </TerminalHeader>

      {!enabled && (
        <TerminalAlert severity="warning" sx={{ mb: 3 }}>
          The Brand Brain dashboard is currently disabled. Enable the
          BRAND_BRAIN_DASHBOARD_ENABLED feature flag to use it.
        </TerminalAlert>
      )}

      {enabled && loading && (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {enabled && !loading && error && (
        <TerminalAlert severity="error" sx={{ mb: 3 }}>
          {error}
        </TerminalAlert>
      )}

      {enabled && !loading && !error && (
        <Box display="flex" flexDirection="column" gap={2}>
          {/* Identity Overview (Phase 4: full blocks + provenance badges). */}
          <ComponentErrorBoundary componentName="Identity Overview">
            <IdentityOverview onboarding={onboarding} />
          </ComponentErrorBoundary>

          {/* Raw canonical profile (Phase 4: comparison viewer). */}
          <ComponentErrorBoundary componentName="Canonical Profile View">
            <CanonicalProfileView onboarding={onboarding} />
          </ComponentErrorBoundary>

          {/* SIF Health strip (Phase 5: 3-domain status + disabled Re-index). */}
          <ComponentErrorBoundary componentName="Sif Health Strip">
            <SifIndexHealthStrip payload={data} />
          </ComponentErrorBoundary>

          {/* Semantic Query (Phase 5: scope chips + presets + passages). */}
          <ComponentErrorBoundary componentName="Semantic Query">
            <SemanticQuery />
          </ComponentErrorBoundary>

          {/* §8.2 coming-soon roadmap (Phase 7: disabled, not yet wired). */}
          <ComponentErrorBoundary componentName="Coming Soon Strip">
            <ComingSoonStrip />
          </ComponentErrorBoundary>
        </Box>
      )}
    </TerminalContainer>
  );
};

export default BrandBrainDashboard;