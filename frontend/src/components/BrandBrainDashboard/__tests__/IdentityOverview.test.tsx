/**
 * Phase 4: IdentityOverview — block card grid + provenance/source badges.
 *
 * All present canonical blocks render as an icon card (seed: BrandBrainView)
 * with a per-block provenance badge from `canonical_profile.sources`.
 * Absent blocks are skipped; `onboarding: null` renders the empty state.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IdentityOverview from '../IdentityOverview';
import type { BrandBrainOnboarding } from '../../../services/brandBrainApi';

const onboarding = {
  canonical_profile: {
    industry: 'SaaS Content',
    target_audience: 'Marketing leaders',
    writing_tone: 'Conversational',
    content_types: ['blog', 'email'],
    brand_colors: ['#00ff00', '#00ffff'],
    seo_profile: { homepage_seo_audit: { overall_score: 82 } },
  },
  sources: {
    industry: 'website_analysis',
    target_audience: 'research_preferences',
    seo_profile: 'website_analysis',
  },
  data_quality: {},
  onboarding_session: {},
  indexing: {},
} as BrandBrainOnboarding;

describe('IdentityOverview — Phase 4: identity cards + provenance', () => {
  it('renders block cards for every present canonical block', () => {
    render(<IdentityOverview onboarding={onboarding} />);
    expect(screen.getByText('Industry')).toBeTruthy();
    expect(screen.getByText('Target Audience')).toBeTruthy();
    expect(screen.getByText('Writing Tone')).toBeTruthy();
    expect(screen.getByText('Content Types')).toBeTruthy();
    expect(screen.getByText('Brand Colors')).toBeTruthy();
    expect(screen.getByText('SEO Profile')).toBeTruthy();
  });

  it('shows the block value text (compact arrays joined)', () => {
    render(<IdentityOverview onboarding={onboarding} />);
    expect(screen.getByText('SaaS Content')).toBeTruthy();
    expect(screen.getByText('blog, email')).toBeTruthy();
  });

  it('renders provenance/source badges from canonical_profile.sources', () => {
    render(<IdentityOverview onboarding={onboarding} />);
    expect(screen.getAllByText('website_analysis').length).toBeGreaterThan(0);
    expect(screen.getByText('research_preferences')).toBeTruthy();
  });

  it('skips blocks that are absent from the profile', () => {
    render(<IdentityOverview onboarding={onboarding} />);
    expect(screen.queryByText('Persona')).toBeNull();
    expect(screen.queryByText('Competitive Intelligence')).toBeNull();
  });

  it('renders the empty state when onboarding has not started', () => {
    render(<IdentityOverview onboarding={null} />);
    expect(
      screen.getByText(/complete onboarding first to build your brand brain/i),
    ).toBeTruthy();
  });
});