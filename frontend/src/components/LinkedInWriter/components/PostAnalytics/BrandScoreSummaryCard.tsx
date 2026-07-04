/**
 * BrandScoreSummaryCard — F4 Analytics Dashboard feature
 *
 * Surfaces the Brand Scorecard from the alwrity_growth_engine sessionStorage
 * cache at the top of PostAnalyticsPanel. Zero API calls when cache is warm.
 * Includes a "Improve Brand Score" CTA that navigates to the Growth Engine tab.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { BrandScorecardResponse } from '../../../../services/linkedInGrowthApi';

const GROWTH_CACHE_KEY = 'alwrity_growth_engine';

interface GrowthCache {
  data: { brand_scorecard?: BrandScorecardResponse | null };
  cachedAt: number;
}

function readBrandScorecard(): BrandScorecardResponse | null {
  try {
    const raw = sessionStorage.getItem(GROWTH_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as GrowthCache;
    return cache?.data?.brand_scorecard ?? null;
  } catch { return null; }
}

function openGrowthTab() {
  window.dispatchEvent(
    new CustomEvent('linkedinwriter:switchTab', { detail: { tab: 'growth' } })
  );
}

// ─── score colour helper ─────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

// ─── SVG circular gauge ──────────────────────────────────────────────────────

function CircleGauge({ score }: { score: number }) {
  const R = 22;
  const C = 2 * Math.PI * R;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const dash = pct * C;
  const color = scoreColor(score);

  return (
    <svg width={60} height={60} viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle cx={30} cy={30} r={R} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      {/* Arc */}
      <circle
        cx={30}
        cy={30}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${dash} ${C}`}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
      />
      {/* Score text */}
      <text x={30} y={30} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={800} fill={color}>
        {Math.round(score)}
      </text>
      <text x={30} y={42} textAnchor="middle" fontSize={6} fill="#94a3b8">/100</text>
    </svg>
  );
}

// ─── dimension bar ───────────────────────────────────────────────────────────

function DimBar({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <div style={{ width: 90, color: '#475569', fontWeight: 500, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 5, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <div style={{ width: 28, textAlign: 'right', fontWeight: 700, color, flexShrink: 0 }}>
        {Math.round(score)}
      </div>
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export const BrandScoreSummaryCard: React.FC = () => {
  const [scorecard, setScorecard] = useState<BrandScorecardResponse | null>(null);

  useEffect(() => {
    setScorecard(readBrandScorecard());
    // Re-read when growth engine updates
    const handler = () => setScorecard(readBrandScorecard());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const topDims = useMemo(
    () => (scorecard?.dimensions ?? []).slice(0, 5),
    [scorecard]
  );

  // No scorecard in cache → compact placeholder
  if (!scorecard) {
    return (
      <div
        style={{
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            Brand Score — not yet analysed
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Run the Growth Engine to see your personal brand health score across 5 dimensions.
          </div>
        </div>
        <button
          type="button"
          onClick={openGrowthTab}
          style={{
            padding: '8px 14px',
            background: '#0a66c2',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Run Analysis →
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Brand Health Score</div>
        <button
          type="button"
          onClick={openGrowthTab}
          style={{
            padding: '5px 10px',
            background: '#eff6ff',
            color: '#0a66c2',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Improve Score →
        </button>
      </div>

      {/* Gauge + dimensions */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <CircleGauge score={scorecard.overall_score} />
          <div style={{ fontSize: 9, color: '#64748b', textAlign: 'center', maxWidth: 62 }}>
            Overall
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {topDims.map(d => (
            <DimBar key={d.dimension} label={d.dimension} score={d.score} />
          ))}
        </div>
      </div>

      {/* Top recommendation */}
      {scorecard.top_recommendation && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            fontSize: 12,
            color: '#1e40af',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 700 }}>Tip: </span>
          {scorecard.top_recommendation}
        </div>
      )}
    </div>
  );
};
