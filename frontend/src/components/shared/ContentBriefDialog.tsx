import React from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

interface BriefQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
}

interface ContentBriefDialogProps {
  open: boolean;
  onClose: () => void;
  briefData: { page: string; queries: BriefQuery[] } | null;
}

const ContentBriefDialog: React.FC<ContentBriefDialogProps> = ({ open, onClose, briefData }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create Content Brief</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Page URL"
            value={briefData?.page || ''}
            InputProps={{ readOnly: true }}
            fullWidth
            size="small"
          />
          <Box>
            <Typography variant="subtitle2" gutterBottom>Recent queries pointing to this page</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(briefData?.queries || []).slice(0, 10).map((q, i) => (
                <Chip
                  key={`${q.query}-${i}`}
                  label={`${q.query} • ${q.clicks}c/${q.impressions}i • ${q.ctr.toFixed(1)}%`}
                  size="small"
                />
              ))}
              {(briefData?.queries || []).length === 0 && (
                <Typography variant="caption" color="text.secondary">No query mappings available for this window.</Typography>
              )}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            try {
              const prefill = {
                page: briefData?.page || '',
                queries: briefData?.queries || [],
                created_at: new Date().toISOString(),
                source: 'platform_analytics_top_pages',
              };
              localStorage.setItem('alwrity_brief_prefill', JSON.stringify(prefill));
            } catch {}
            onClose();
          }}
        >
          Start Brief
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContentBriefDialog;
