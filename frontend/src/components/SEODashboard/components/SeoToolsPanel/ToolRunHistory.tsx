import React from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import type { ToolRunRecord } from './seoToolsHistory';

// Per-tool run history (Phase T3). Display-only: entries are re-viewed from
// stored results, never re-executed. Renders nothing when there are no runs.

interface ToolRunHistoryProps {
  runs: ToolRunRecord[];
  onView: (run: ToolRunRecord) => void;
  onClear: () => void;
}

export const ToolRunHistory: React.FC<ToolRunHistoryProps> = ({ runs, onView, onClear }) => {
  if (runs.length === 0) return null;

  return (
    <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
          Run history
        </Typography>
        <Button
          size="small"
          variant="text"
          onClick={onClear}
          sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', p: 0, minWidth: 0 }}
        >
          Clear
        </Button>
      </Box>
      {runs.map((run) => {
        const when = new Date(run.ranAt).toLocaleTimeString();
        return (
          <Box key={run.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.55)', minWidth: 58, fontSize: '0.66rem' }}
            >
              {when}
            </Typography>
            <Chip
              size="small"
              label={run.status === 'success' ? 'Success' : 'Failed'}
              variant="outlined"
              sx={{
                fontSize: '0.62rem',
                height: 20,
                color: run.status === 'success' ? '#4CAF50' : '#F44336',
                borderColor: 'currentColor',
              }}
            />
            {run.status === 'success' && run.result !== undefined && (
              <Button
                size="small"
                variant="text"
                onClick={() => onView(run)}
                sx={{ color: '#90CAF9', textTransform: 'none', p: 0, minWidth: 0 }}
              >
                View
              </Button>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default ToolRunHistory;