import React from 'react';
import { Box, Typography, Tooltip, Grid } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import SeoToolCard from './SeoToolCard';
import { SEO_TOOL_DEFS } from './toolDefs';

interface SeoToolsPanelProps {
  siteUrl: string;
}

// User-fired single-call SEO tools (Phase C). Replaces the Copilot-chat-only
// access with main-UI cards: same seoApiService methods, direct Run buttons,
// per-tool loading/error/result states, abortable requests.
const SeoToolsPanel: React.FC<SeoToolsPanelProps> = ({ siteUrl }) => {
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
        Fire any tool below — no chat needed.
      </Typography>
      <Grid container spacing={2}>
        {SEO_TOOL_DEFS.map((def) => (
          <Grid item xs={12} sm={6} md={4} key={def.id}>
            <SeoToolCard def={def} siteUrl={siteUrl} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SeoToolsPanel;
