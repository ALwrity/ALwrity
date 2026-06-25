import React from 'react';

// Card layout
export const cardBase: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

export const headerRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
};

export const dismissBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  fontSize: 16,
  padding: '4px 8px',
  borderRadius: 4,
  lineHeight: 1,
};

// Row styles
export const rowBase: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '14px 16px',
};

// Colors
export const colors = {
  white: '#ffffff',
  cardBg: '#ffffff',
  rowBg: '#f8fafc',
  badgeBg: '#f0f4f8',
  border: '#e2e8f0',
  dashedBorder: '#d1d5db',
  textDark: '#0f172a',
  textMedium: '#475569',
  textBody: '#334155',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  textMuted: '#9ca3af',
  primary: '#0a66c2',
  primaryGreen: '#059669',
  successBg: '#dcfce7',
  successText: '#166534',
} as const;

// Button styles
export const primaryBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: colors.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};

export const secondaryBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: 'none',
  color: colors.textTertiary,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};

export const greenBtn: React.CSSProperties = {
  ...primaryBtn,
  background: colors.primaryGreen,
};

export const roundBtn: React.CSSProperties = {
  ...primaryBtn,
  borderRadius: 20,
  whiteSpace: 'nowrap',
};

// Score / confidence helpers
export const CONFIDENCE_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: '#dcfce7', text: '#166534' },
  medium: { bg: '#fef9c3', text: '#854d0e' },
  low: { bg: '#fee2e2', text: '#991b1b' },
};

export function scoreColor(score: number, high = 75, mid = 50): string {
  if (score >= high) return '#166534';
  if (score >= mid) return '#854d0e';
  return '#991b1b';
}

export function scoreBg(score: number, high = 75, mid = 50): string {
  if (score >= high) return '#dcfce7';
  if (score >= mid) return '#fef9c3';
  return '#fee2e2';
}

export function barColor(score: number, high = 75, mid = 50): string {
  if (score >= high) return '#22c55e';
  if (score >= mid) return '#eab308';
  return '#ef4444';
}
