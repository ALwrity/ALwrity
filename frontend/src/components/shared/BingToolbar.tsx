import React, { useState } from 'react';
import { TextField, Button } from '@mui/material';
import { PlatformConnectionStatus } from '../../api/analytics';
import { apiClient } from '../../api/client';

interface BingToolbarProps {
  siteUrl: string;
  onSiteUrlChange: (url: string) => void;
  collectMsg: string | null;
  onCollectMsgChange: (msg: string | null) => void;
  rangeDays: number;
  bingStatus: PlatformConnectionStatus | undefined;
  metrics: any;
  onForceRefresh: () => Promise<void>;
}

const BingToolbar: React.FC<BingToolbarProps> = ({
  siteUrl,
  onSiteUrlChange,
  collectMsg,
  onCollectMsgChange,
  rangeDays,
  bingStatus,
  metrics,
  onForceRefresh,
}) => {
  const [collecting, setCollecting] = useState<boolean>(false);

  return (
    <>
      <TextField
        size="small"
        placeholder="https://www.example.com/"
        value={siteUrl}
        onChange={(e) => onSiteUrlChange(e.target.value)}
        sx={{ minWidth: 280 }}
        label="Bing Site URL"
      />
      <Button
        variant="outlined"
        size="small"
        disabled={collecting}
        onClick={async () => {
          try {
            onCollectMsgChange(null);
            setCollecting(true);
            const statusSites: any[] = Array.isArray(bingStatus?.sites) ? bingStatus!.sites : [];
            const metricsSites: any[] = Array.isArray(metrics?.sites) ? metrics.sites : [];
            const candidates = [...statusSites, ...metricsSites];
            let resolvedUrl: string =
              (candidates.find(s => typeof s?.Url === 'string')?.Url) ||
              (candidates.find(s => typeof s?.url === 'string')?.url) ||
              '';
            if (siteUrl && typeof siteUrl === 'string') {
              resolvedUrl = siteUrl.trim();
            }
            if (!resolvedUrl) {
              onCollectMsgChange('No Bing site found to collect.');
              return;
            }
            await apiClient.post('/bing-analytics/collect-data', null, {
              params: { site_url: resolvedUrl, days_back: Math.max(7, Math.min(90, rangeDays)) }
            });
            onCollectMsgChange('Bing storage refresh started…');
            setTimeout(() => {
              onForceRefresh().catch(() => {});
            }, 3500);
          } catch (e: any) {
            onCollectMsgChange(e?.message || 'Failed to start Bing collection');
          } finally {
            setCollecting(false);
          }
        }}
        sx={{ textTransform: 'none' }}
      >
        {collecting ? 'Refreshing…' : 'Refresh Bing Storage'}
      </Button>
    </>
  );
};

export default BingToolbar;
