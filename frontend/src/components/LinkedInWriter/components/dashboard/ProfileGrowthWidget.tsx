/**
 * ProfileGrowthWidget — F1 Analytics Dashboard feature
 *
 * Surfaces profile-level aggregates from GET /analytics/personal
 * (Unipile post metrics summed for posts published in the window).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  getLinkedInPersonalAnalytics,
  getLinkedInSocialErrorMessage,
  type LinkedInAnalyticsPresetDays,
  type LinkedInPersonalAnalyticsResponse,
} from '../../../../api/linkedinSocial';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtNum(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtPct(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  // API returns fractional (0–1) or percentage already — normalise
  const pct = n > 1 ? n : n * 100;
  return `${pct.toFixed(1)}%`;
}

const PRESETS: { label: string; days: LinkedInAnalyticsPresetDays }[] = [
  { label: '7d', days: 7 },
  { label: '28d', days: 28 },
  { label: '90d', days: 90 },
];

const METRIC_DEFS = [
  { key: 'impressions',    label: 'Impressions',  color: '#0a66c2', format: fmtNum },
  { key: 'reach',          label: 'Reach',        color: '#0891b2', format: fmtNum },
  { key: 'reactions',      label: 'Reactions',    color: '#059669', format: fmtNum },
  { key: 'shares',         label: 'Shares',       color: '#ea580c', format: fmtNum },
  { key: 'engagementRate', label: 'Eng. Rate',    color: '#7c3aed', format: fmtPct },
  { key: 'followers_gained', label: 'Followers',  color: '#10b981', format: fmtNum },
] as const;

type MetricKey = typeof METRIC_DEFS[number]['key'];

// ─── component ──────────────────────────────────────────────────────────────

interface ProfileGrowthWidgetProps {
  onViewAnalytics?: () => void;
}

export const ProfileGrowthWidget: React.FC<ProfileGrowthWidgetProps> = ({ onViewAnalytics }) => {
  const [preset, setPreset] = useState<LinkedInAnalyticsPresetDays>(28);
  const [data, setData] = useState<LinkedInPersonalAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetch = useCallback(async (days: LinkedInAnalyticsPresetDays) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await getLinkedInPersonalAnalytics({ presetDays: days });
      setData(res);
    } catch (err) {
      setData(null);
      setErrorMessage(getLinkedInSocialErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(preset); }, [fetch, preset]);

  const analytics = data?.personal?.analytics ?? {};
  const emptyReason = data?.personal?.error ?? null;
  const hasMetrics = Object.keys(analytics).length > 0;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Profile Growth
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {PRESETS.map(p => (
            <button
              key={p.days}
              type="button"
              onClick={() => setPreset(p.days)}
              style={{
                padding: '2px 6px',
                fontSize: 8,
                fontWeight: 700,
                borderRadius: 3,
                border: 'none',
                cursor: 'pointer',
                background: preset === p.days ? '#0a66c2' : '#e2e8f0',
                color: preset === p.days ? '#fff' : '#64748b',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', padding: '6px 0' }}>
          Loading profile analytics…
        </div>
      )}

      {/* Request error */}
      {errorMessage && !loading && (
        <div style={{ fontSize: 9, color: '#dc2626', padding: '4px 0' }}>
          {errorMessage}{' '}
          <button
            type="button"
            onClick={() => void fetch(preset)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0a66c2',
              cursor: 'pointer',
              fontSize: 9,
              padding: 0,
              fontWeight: 700,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Honest empty (connected, but no posts in window) */}
      {!loading && !errorMessage && data && !hasMetrics && (
        <div style={{ fontSize: 9, color: '#64748b', padding: '4px 0' }}>
          {emptyReason || 'No post metrics available for this range.'}
        </div>
      )}

      {/* Metrics grid */}
      {!loading && !errorMessage && data && hasMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 4 }}>
          {METRIC_DEFS.map(m => {
            const raw = analytics[m.key as MetricKey];
            const formatted = m.format(raw);
            return (
              <div
                key={m.key}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 5,
                  padding: '5px 6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 8, color: '#64748b', marginBottom: 2, lineHeight: 1.2 }}>{m.label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: formatted === '—' ? '#94a3b8' : m.color }}>
                  {formatted}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Date range label */}
      {data?.dateRange?.label && !loading && !errorMessage && (
        <div style={{ fontSize: 7, color: '#94a3b8', marginBottom: 3, textAlign: 'right' }}>
          {data.dateRange.label}
        </div>
      )}

      {/* View full link */}
      {onViewAnalytics && (
        <button
          type="button"
          onClick={onViewAnalytics}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 8, color: '#0a66c2', cursor: 'pointer', fontWeight: 700 }}
        >
          View full analytics →
        </button>
      )}

      <div style={{ height: 1, background: '#e2e8f0', margin: '6px 0 2px' }} />
    </div>
  );
};
