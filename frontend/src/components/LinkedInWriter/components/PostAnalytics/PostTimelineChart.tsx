/**
 * PostTimelineChart — F2 Analytics Dashboard feature
 *
 * A dependency-free SVG line chart plotting engagement rate (or impressions)
 * over time from the existing posts array. Dots above average are green,
 * below average are amber. Clicking a dot fires an onSelectPost callback
 * so the parent can scroll/highlight the relevant PostCard.
 */
import React, { useMemo, useState } from 'react';
import type { LinkedInPost } from '../../../../services/postAnalyticsApi';

// ─── types & helpers ─────────────────────────────────────────────────────────

type MetricKey = 'engagement_rate' | 'impressions';

function getMetricValue(post: LinkedInPost, key: MetricKey): number {
  return key === 'engagement_rate'
    ? post.engagement.engagement_rate
    : post.engagement.impressions;
}

function formatLabel(post: LinkedInPost): string {
  const d = new Date(post.created_at);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatMetricValue(value: number, key: MetricKey): string {
  if (key === 'engagement_rate') return `${(value * 100).toFixed(1)}%`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(Math.round(value));
}

// ─── component ───────────────────────────────────────────────────────────────

interface PostTimelineChartProps {
  posts: LinkedInPost[];
  onSelectPost?: (postId: string) => void;
}

const SVG_H = 90;
const SVG_PADDING = { top: 10, right: 16, bottom: 22, left: 36 };
const DOT_R = 4;

export const PostTimelineChart: React.FC<PostTimelineChartProps> = ({ posts, onSelectPost }) => {
  const [metric, setMetric] = useState<MetricKey>('engagement_rate');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Chronological order (oldest → newest), capped at 30
  const sorted = useMemo(() =>
    [...posts]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-30),
    [posts]
  );

  const values = useMemo(() => sorted.map(p => getMetricValue(p, metric)), [sorted, metric]);

  const avg = useMemo(() =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    [values]
  );

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // We defer actual SVG width to the container; use a relative width placeholder
  const W = 300; // intrinsic SVG viewBox width — scales with container

  const innerW = W - SVG_PADDING.left - SVG_PADDING.right;
  const innerH = SVG_H - SVG_PADDING.top - SVG_PADDING.bottom;

  const points = sorted.map((post, i) => {
    const x = SVG_PADDING.left + (sorted.length > 1 ? (i / (sorted.length - 1)) * innerW : innerW / 2);
    const y = SVG_PADDING.top + innerH - ((values[i] - minVal) / range) * innerH;
    return { x, y, post, value: values[i] };
  });

  const avgY = SVG_PADDING.top + innerH - ((avg - minVal) / range) * innerH;

  // SVG polyline string
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  if (sorted.length < 3) return null;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Content Performance</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
            {sorted.length} posts · avg {formatMetricValue(avg, metric)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['engagement_rate', 'impressions'] as MetricKey[]).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: metric === k ? '#0a66c2' : '#f1f5f9',
                color: metric === k ? '#fff' : '#64748b',
              }}
            >
              {k === 'engagement_rate' ? 'Eng. Rate' : 'Impressions'}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${SVG_H}`}
          style={{ width: '100%', height: SVG_H, overflow: 'visible' }}
          aria-label="Post performance timeline"
        >
          {/* Y-axis labels */}
          <text x={SVG_PADDING.left - 4} y={SVG_PADDING.top + 4} textAnchor="end" fontSize={7} fill="#94a3b8">
            {formatMetricValue(maxVal, metric)}
          </text>
          <text x={SVG_PADDING.left - 4} y={SVG_PADDING.top + innerH} textAnchor="end" fontSize={7} fill="#94a3b8">
            {formatMetricValue(minVal, metric)}
          </text>

          {/* Average dashed line */}
          <line
            x1={SVG_PADDING.left}
            y1={avgY}
            x2={W - SVG_PADDING.right}
            y2={avgY}
            stroke="#94a3b8"
            strokeWidth={0.8}
            strokeDasharray="3,3"
          />
          <text x={W - SVG_PADDING.right + 2} y={avgY + 3} fontSize={6} fill="#94a3b8">avg</text>

          {/* Line */}
          {points.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#0a66c2"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}

          {/* Dots */}
          {points.map((p, i) => {
            const above = p.value >= avg;
            const isHovered = hoveredIdx === i;
            return (
              <g key={p.post.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? DOT_R + 2 : DOT_R}
                  fill={above ? '#10b981' : '#f59e0b'}
                  stroke="#fff"
                  strokeWidth={1.5}
                  style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectPost?.(p.post.id)}
                />
                {/* X-axis label for first, last, and every 5th */}
                {(i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 5)) === 0) && (
                  <text
                    x={p.x}
                    y={SVG_PADDING.top + innerH + 12}
                    textAnchor="middle"
                    fontSize={6.5}
                    fill="#94a3b8"
                  >
                    {formatLabel(p.post)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hovered && (
            <g>
              <rect
                x={Math.min(hovered.x - 22, W - SVG_PADDING.right - 44)}
                y={hovered.y - 24}
                width={44}
                height={14}
                rx={3}
                fill="#0f172a"
                opacity={0.85}
              />
              <text
                x={Math.min(hovered.x, W - SVG_PADDING.right - 22)}
                y={hovered.y - 13}
                textAnchor="middle"
                fontSize={7}
                fill="#fff"
              >
                {formatMetricValue(hovered.value, metric)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, justifyContent: 'flex-end' }}>
        <LegendDot color="#10b981" label="Above average" />
        <LegendDot color="#f59e0b" label="Below average" />
        <LegendDot color="#94a3b8" label="Average" dashed />
      </div>
    </div>
  );
};

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {dashed ? (
        <div style={{ width: 14, height: 1, borderTop: `2px dashed ${color}` }} />
      ) : (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      )}
      <span style={{ fontSize: 9, color: '#64748b' }}>{label}</span>
    </div>
  );
}
