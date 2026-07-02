/** Plain-language labels for Phase 7 profile optimization enums. */

import type { CSSProperties } from 'react';

const SECTION_LABELS: Record<string, string> = {
  headline: 'Headline',
  summary: 'Summary',
  profile_photo: 'Profile photo',
  custom_url: 'Custom URL',
  experience: 'Experience',
  skills: 'Skills',
  recommendations: 'Recommendations',
  education: 'Education',
  certifications: 'Certifications',
  featured: 'Featured',
};

export function formatProfileSection(section: string): string {
  return SECTION_LABELS[section] ?? section.replace(/_/g, ' ');
}

/** TC-013: Iconography for impact badges */
export function formatOptimizationImpact(impact: string): string {
  switch (impact) {
    case 'High':
      return '🚀 High visibility impact';
    case 'Medium':
      return '⚖️ Moderate improvement';
    case 'Low':
      return '✓ Nice to have';
    default:
      return impact;
  }
}

/** TC-013: Iconography for effort badges */
export function formatOptimizationEffort(effort: string): string {
  switch (effort) {
    case 'Low':
      return '⚡ Quick win';
    case 'Medium':
      return '⏱️ Some effort';
    case 'High':
      return '🎯 Worth the investment';
    default:
      return effort;
  }
}

export function impactStyle(impact: string): CSSProperties {
  switch (impact) {
    case 'High':
      return { backgroundColor: '#ecfdf5', border: '1px solid #6ee7b7', color: '#047857' };
    case 'Medium':
      return { backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309' };
    default:
      return { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' };
  }
}

export function effortStyle(effort: string): CSSProperties {
  switch (effort) {
    case 'Low':
      return { backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' };
    case 'Medium':
      return { backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9' };
    default:
      return { backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' };
  }
}

const CHIP_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};

export function sectionBadgeStyle(): CSSProperties {
  return {
    ...CHIP_BASE,
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
  };
}

export function impactBadgeStyle(impact: string): CSSProperties {
  return { ...CHIP_BASE, ...impactStyle(impact) };
}

export function effortBadgeStyle(effort: string): CSSProperties {
  return { ...CHIP_BASE, ...effortStyle(effort) };
}
