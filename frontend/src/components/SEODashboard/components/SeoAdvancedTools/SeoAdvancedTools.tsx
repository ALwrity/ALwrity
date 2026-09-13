import React from 'react';
import { Box, Typography, Tooltip, Grid } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import AdvancedToolCard from './AdvancedToolCard';
import { ADVANCED_TOOL_DEFS, type AdvancedToolContext } from './advancedToolDefs';

export type SeoAdvancedToolsProps = AdvancedToolContext;

// Advanced enterprise/GSC/LLM tools as user-fired cards (Phase D). Payloads
// are prefilled from live audit/GSC context and editable before firing;
// cards without required context stay disabled instead of fabricating input.
const SeoAdvancedTools: React.FC<SeoAdvancedToolsProps> = (props) => {
  const { websiteUrl, targetKeywords, auditResult, gscResult } = props;
  const ctx: AdvancedToolContext = { websiteUrl, targetKeywords, auditResult, gscResult };

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
          🚀 Advanced SEO Tools
        </Typography>
        <Tooltip title="Enterprise audits, GSC opportunities, and LLM insights. Payloads prefill from your latest results and are editable before each run.">
          <InfoIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 18 }} />
        </Tooltip>
      </Box>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
        Deep tools for completed analyses — run an audit above to unlock context tools.
      </Typography>
      <Grid container spacing={2}>
        {ADVANCED_TOOL_DEFS.map((def) => (
          <Grid item xs={12} sm={6} md={4} key={def.id}>
            <AdvancedToolCard def={def} ctx={ctx} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SeoAdvancedTools;
