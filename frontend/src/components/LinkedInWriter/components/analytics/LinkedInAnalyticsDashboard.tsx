import React, { useMemo } from 'react';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import {
  useLinkedInAnalyticsDashboard,
  type LinkedInAnalyticsTab,
} from '../../../../hooks/useLinkedInAnalyticsDashboard';
import { linkedInPlaceholderCardStyles } from '../linkedInPlaceholderStyles';
import { AnalyticsDateRangeLabel } from './AnalyticsDateRangeLabel';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';
import { AnalyticsMetricGrid } from './AnalyticsMetricGrid';
import { AvatarTabSwitcher } from './AvatarTabSwitcher';
import { metricsForTab } from './analyticsMetricConfig';

interface LinkedInAnalyticsDashboardProps {
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  disconnectError?: string | null;
}

export const LinkedInAnalyticsDashboard: React.FC<LinkedInAnalyticsDashboardProps> = ({
  onDisconnect,
  isDisconnecting = false,
  disconnectError,
}) => {
  const {
    isLoading,
    error,
    dateRange,
    personal,
    organization,
    activeTab,
    setActiveTab,
    refresh,
  } = useLinkedInAnalyticsDashboard();

  const showOrgTab = organization != null;

  const avatarTabs = useMemo(() => {
    const tabs: Array<{
      id: LinkedInAnalyticsTab;
      avatarUrl?: string | null;
      fallbackInitials: string;
      isOrg: boolean;
    }> = [
      {
        id: 'personal',
        avatarUrl: personal?.avatarUrl,
        fallbackInitials: 'ME',
        isOrg: false,
      },
    ];
    if (showOrgTab) {
      tabs.push({
        id: 'organization',
        avatarUrl: organization?.avatarUrl,
        fallbackInitials: 'CO',
        isOrg: true,
      });
    }
    return tabs;
  }, [personal?.avatarUrl, organization?.avatarUrl, showOrgTab]);

  const activeMetrics = metricsForTab(activeTab);
  const activeAnalytics =
    activeTab === 'personal'
      ? personal?.analytics ?? {}
      : organization?.analytics ?? {};

  const tabError =
    activeTab === 'personal' ? personal?.error : organization?.error;

  const showGlobalError = Boolean(error);

  return (
    <div style={linkedInPlaceholderCardStyles.wrapper}>
      <div style={linkedInPlaceholderCardStyles.inner}>
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background:
              'radial-gradient(circle, rgba(10, 102, 194, 0.08) 0%, transparent 70%)',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Last 7 days
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tooltip title="Refresh analytics">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => refresh()}
                    disabled={isLoading}
                    aria-label="Refresh analytics"
                    sx={{ color: '#0A66C2' }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              {onDisconnect && (
                <button
                  type="button"
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid #fca5a5',
                    backgroundColor: '#fff',
                    color: '#b91c1c',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isDisconnecting ? 'default' : 'pointer',
                    opacity: isDisconnecting ? 0.7 : 1,
                  }}
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>

          {disconnectError && (
            <p
              role="alert"
              style={{
                margin: '8px 0 0',
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {disconnectError}
            </p>
          )}

          <AvatarTabSwitcher
            tabs={avatarTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <AnalyticsDateRangeLabel dateRange={dateRange} />

          {showGlobalError && (
            <p
              role="alert"
              style={{
                margin: '16px 0 0',
                padding: '12px',
                borderRadius: 8,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                lineHeight: 1.5,
                textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}

          {tabError && (
            <p
              role="alert"
              style={{
                margin: '16px 0 0',
                padding: '12px',
                borderRadius: 8,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: 13,
                lineHeight: 1.5,
                textAlign: 'center',
              }}
            >
              {tabError}
            </p>
          )}

          {!showGlobalError && !isLoading && !tabError && Object.keys(activeAnalytics).length === 0 && (
            <AnalyticsEmptyState message="No analytics data available for this period." />
          )}

          {!showGlobalError && (isLoading || !tabError) && (
            <AnalyticsMetricGrid
              metrics={activeMetrics}
              analytics={activeAnalytics}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};
