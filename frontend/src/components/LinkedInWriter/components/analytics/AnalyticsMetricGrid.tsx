import React from 'react';
import type { MetricConfig } from './analyticsMetricConfig';

interface AnalyticsMetricGridProps {
  metrics: MetricConfig[];
  analytics: Record<string, number | string | null | undefined>;
  isLoading?: boolean;
}

const TILE_STYLE: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 12,
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
};

const SKELETON_STYLE: React.CSSProperties = {
  ...TILE_STYLE,
  minHeight: 72,
  background:
    'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
  backgroundSize: '200% 100%',
  animation: 'linkedinAnalyticsShimmer 1.2s ease-in-out infinite',
};

export const AnalyticsMetricGrid: React.FC<AnalyticsMetricGridProps> = ({
  metrics,
  analytics,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <>
        <style>{`
          @keyframes linkedinAnalyticsShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
            marginTop: 20,
          }}
        >
          {metrics.map((m) => (
            <div key={m.key} style={SKELETON_STYLE} aria-hidden />
          ))}
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
        marginTop: 20,
      }}
    >
      {metrics.map((metric) => {
        const raw = analytics[metric.key];
        const display = metric.format(raw);
        return (
          <div key={metric.key} style={TILE_STYLE}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1e293b',
                lineHeight: 1.2,
                marginBottom: 4,
              }}
              aria-label={`${metric.label}: ${display}`}
            >
              {display}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {metric.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
