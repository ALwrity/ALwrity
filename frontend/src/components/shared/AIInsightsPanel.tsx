import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import Info from '@mui/icons-material/Info';

interface Finding {
  title: string;
  evidence: string;
  actions?: string[];
}

interface AIInsightsPanelProps {
  aiError: string | null;
  aiInsights: {
    quick_summary?: string;
    prioritized_findings?: Finding[];
  } | null;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ aiError, aiInsights }) => {
  if (!aiError && !aiInsights) return null;

  return (
    <Box sx={{ mt: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle2">AI Insights</Typography>
        <Tooltip title="Summarizes all panels into simple recommendations for creators.">
          <Info fontSize="small" color="action" />
        </Tooltip>
      </Box>
      {aiError && <Alert severity="error" sx={{ mb: 1 }}>{aiError}</Alert>}
      {aiInsights && (
        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>{aiInsights.quick_summary}</Typography>
          {Array.isArray(aiInsights.prioritized_findings) && aiInsights.prioritized_findings.length > 0 && (
            <List dense>
              {aiInsights.prioritized_findings.slice(0, 3).map((f: Finding, i: number) => (
                <ListItem key={`ai-find-${i}`} sx={{ px: 0, alignItems: 'flex-start' }}>
                  <ListItemText
                    primary={f.title}
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#6b7280', display: 'block' }}>{f.evidence}</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                          {(f.actions || []).slice(0, 2).map((a: string, idx: number) => (
                            <Chip key={`act-${idx}`} label={a} size="small" />
                          ))}
                        </Box>
                      </Box>
                    }
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  );
};

export default AIInsightsPanel;
