import React, { useEffect, useState } from 'react';
import { Box, Typography, Tooltip, Grid } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import SeoToolCard from './SeoToolCard';
import { SEO_TOOL_DEFS } from './toolDefs';
import { onboardingSeoInsightsApi } from '../../../../api/onboardingSeoInsights';

interface SeoToolsPanelProps {
  siteUrl: string;
}

// User-fired single-call SEO tools (Phase C). Replaces the Copilot-chat-only
// access with main-UI cards: same seoApiService methods, direct Run buttons,
// per-tool loading/error/result states, abortable requests.
const SeoToolsPanel: React.FC<SeoToolsPanelProps> = ({ siteUrl }) => {
  // Phase 12 (plan C3): onboarding content pillars prefill the meta tool.
  // Self-fetched and best-effort — absent onboarding data means no prefill.
  const [metaPrefill, setMetaPrefill] = useState<Record<string, string> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    onboardingSeoInsightsApi
      .getPrefill()
      .then((prefill) => {
        if (cancelled) return;
        const keywords = (prefill?.keywords ?? []).filter(Boolean);
        if (keywords.length > 0) {
          setMetaPrefill({ keywords: keywords.join(', ') });
        }
      })
      .catch(() => {
        /* prefill is optional; no onboarding data => no prefill */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
          🧰 SEO Tools
        </Typography>
        <Tooltip title="Run single-page SEO tools directly. Each tool fires on demand with your site URL prefilled.">
          <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
        </Tooltip>
      </Box>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
        Fire any tool below - no chat needed.
      </Typography>
      <Grid container spacing={2}>
        {SEO_TOOL_DEFS.map((def) => (
          <Grid item xs={12} sm={6} md={4} key={def.id}>
            <SeoToolCard
              def={def}
              siteUrl={siteUrl}
              prefill={def.id === 'meta' ? metaPrefill : undefined}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SeoToolsPanel;
