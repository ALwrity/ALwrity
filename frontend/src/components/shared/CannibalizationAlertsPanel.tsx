import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Button,
} from '@mui/material';
import MouseOutlined from '@mui/icons-material/MouseOutlined';
import Info from '@mui/icons-material/Info';
import ChipLegend from './ChipLegend';

interface CannibalizationPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
}

interface CannibalizationAlert {
  query: string;
  total_clicks: number;
  recommended_target_page?: string;
  pages?: CannibalizationPage[];
}

interface CannibalizationAlertsPanelProps {
  alerts: CannibalizationAlert[];
  formatNumber: (n: number) => string;
  isValidHttpUrl: (url: string) => boolean;
  onOpenBrief: (page: string, query: string, totalClicks: number) => void;
}

const CannibalizationAlertsPanel: React.FC<CannibalizationAlertsPanelProps> = ({
  alerts,
  formatNumber,
  isValidHttpUrl,
  onOpenBrief,
}) => {
  return (
    <Card sx={{ mt: 2, bgcolor: '#ffffff !important', color: '#1f2937 !important', border: '1px solid #e5e7eb !important', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1) !important' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1">Cannibalization Alerts</Typography>
            <Tooltip title="The same search query points to multiple pages on your site, splitting clicks. Choose one target page and consolidate overlapping pages or add internal links.">
              <Info fontSize="small" color="action" />
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary">Queries competing across pages</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {"\u201C"}No cannibalization{"\u201D"} is normal for tightly targeted sites or low‑traffic windows. For demos we can relax sensitivity.
        </Typography>
        <ChipLegend
          items={[
            {
              label: 'Competing page',
              icon: <MouseOutlined fontSize="small" />,
              tooltip: 'Each chip is a page that shares the same query. Text shows URL • clicks • impressions • CTR.',
              sx: {
                backgroundImage: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                fontWeight: 700,
              },
            },
            {
              label: 'Higher CTR',
              tooltip: 'Greener backgrounds mean this page converts searchers relatively well.',
              sx: {
                backgroundImage: 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)',
                color: '#065f46',
                border: '1px solid #86efac',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                fontWeight: 700,
              },
            },
            {
              label: 'Weaker CTR',
              tooltip: 'Redder backgrounds flag pages that may need consolidation or updates.',
              sx: {
                backgroundImage: 'linear-gradient(135deg, #fee2e2 0%, #fff1f2 100%)',
                color: '#7f1d1d',
                border: '1px solid #fecdd3',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                fontWeight: 700,
              },
            },
          ]}
        />
        {(!alerts || alerts.length === 0) ? (
          <Alert severity="info">No cannibalization detected for this window.</Alert>
        ) : (
          <List dense>
            {alerts.slice(0, 10).map((a, idx) => (
              <ListItem key={`${a.query}-${idx}`} sx={{ px: 0, alignItems: 'flex-start' }}>
                <ListItemText
                  primary={a.query}
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 0.5 }}>
                        Total clicks: {formatNumber(a.total_clicks || 0)} • Target: {a.recommended_target_page || 'N/A'}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {(a.pages || []).map((p, i) => {
                          const clicks = Number(p.clicks || 0);
                          const impressions = Number(p.impressions || 0);
                          const ctr = Number(p.ctr || 0);
                          const ctrColor = ctr >= 3 ? '#065f46' : ctr >= 1 ? '#92400e' : '#7f1d1d';
                          const ctrBg = ctr >= 3
                            ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)'
                            : ctr >= 1
                            ? 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)'
                            : 'linear-gradient(135deg, #fee2e2 0%, #fff1f2 100%)';
                          const label = `${String(p.page || '').replace(/^https?:\/\//, '').slice(0, 40)} • ${formatNumber(clicks)}c/${formatNumber(impressions)}i • ${ctr.toFixed(1)}%`;
                          return (
                            <Tooltip
                              key={`${p.page}-${i}`}
                              title={`Clicks ${clicks}, impressions ${impressions}, CTR ${ctr.toFixed(1)}% for this page`}
                            >
                              <Chip
                                label={label}
                                size="small"
                                sx={{
                                  backgroundImage: ctrBg,
                                  color: ctrColor,
                                  border: '1px solid rgba(0,0,0,0.06)',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                  fontWeight: 700,
                                  maxWidth: 260,
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </Box>
                  }
                  primaryTypographyProps={{ variant: 'body2' }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ mr: 1, textTransform: 'none' }}
                  disabled={!a.recommended_target_page || !isValidHttpUrl(String(a.recommended_target_page))}
                  onClick={() => {
                    if (a.recommended_target_page && isValidHttpUrl(String(a.recommended_target_page))) {
                      window.open(String(a.recommended_target_page), '_blank');
                    }
                  }}
                >
                  Open Target Page
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  sx={{ textTransform: 'none' }}
                  onClick={() => {
                    const page = String(a.recommended_target_page || '');
                    onOpenBrief(page, a.query, a.total_clicks || 0);
                  }}
                >
                  Create Brief
                </Button>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default CannibalizationAlertsPanel;
