import React from 'react';
import { cardBase, colors } from './styles';

const skeletonPulse = `
  @keyframes postAnalyticsSkeletonPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
`;

function SkeletonBlock({ width, height, radius = 6 }: { width: string | number; height: number; radius?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: '#e2e8f0',
        animation: 'postAnalyticsSkeletonPulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

function SkeletonCard() {
  return (
    <div style={cardBase} aria-hidden="true">
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <SkeletonBlock width={48} height={48} radius={24} />
        <div style={{ flex: 1 }}>
          <SkeletonBlock width="40%" height={14} />
          <div style={{ height: 8 }} />
          <SkeletonBlock width="60%" height={12} />
          <div style={{ height: 6 }} />
          <SkeletonBlock width="30%" height={10} />
        </div>
      </div>
      <SkeletonBlock width="100%" height={12} />
      <div style={{ height: 8 }} />
      <SkeletonBlock width="92%" height={12} />
      <div style={{ height: 8 }} />
      <SkeletonBlock width="78%" height={12} />
      <div style={{ height: 16 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <SkeletonBlock width={80} height={28} radius={999} />
        <SkeletonBlock width={80} height={28} radius={999} />
        <SkeletonBlock width={80} height={28} radius={999} />
      </div>
    </div>
  );
}

export const LoadingState: React.FC = React.memo(() => (
  <div role="status" aria-label="Loading LinkedIn posts">
    <style>{skeletonPulse}</style>
    <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary }}>
      Loading your LinkedIn posts…
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  </div>
));

LoadingState.displayName = 'PostAnalyticsLoadingState';
