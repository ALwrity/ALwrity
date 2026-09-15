/**
 * Phase 4: CanonicalProfileView — raw canonical_profile comparison viewer.
 *
 * A terminal accordion per top-level block; collapsed by default, each expands
 * to the raw pretty-printed JSON so the user can compare the curated identity
 * cards against the SSOT source of truth. Renders nothing when onboarding is
 * null.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CanonicalProfileView from '../CanonicalProfileView';
import type { BrandBrainOnboarding } from '../../../services/brandBrainApi';

const onboarding = {
  canonical_profile: {
    industry: 'SaaS Content',
    seo_profile: { homepage_seo_audit: { overall_score: 82 } },
    persona: { identity: { persona_name: 'Alex' } },
  },
  sources: { industry: 'website_analysis' },
  data_quality: {},
  onboarding_session: {},
  indexing: {},
} as BrandBrainOnboarding;

describe('CanonicalProfileView — Phase 4: raw profile viewer', () => {
  it('renders an accordion heading per top-level block', () => {
    render(<CanonicalProfileView onboarding={onboarding} />);
    expect(screen.getByRole('button', { name: /industry/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /seo profile/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /persona/i })).toBeTruthy();
  });

  it('starts collapsed (nothing expanded by default)', () => {
    render(<CanonicalProfileView onboarding={onboarding} />);
    for (const name of ['industry', 'seo profile', 'persona']) {
      expect(
        screen.getByRole('button', { name: new RegExp(name, 'i') }),
      ).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('expands a block to reveal the raw pretty-printed JSON on click', () => {
    render(<CanonicalProfileView onboarding={onboarding} />);
    fireEvent.click(
      screen.getByRole('button', { name: /persona/i }),
    );
    expect(screen.getByText(/"persona_name":\s*"Alex"/)).toBeTruthy();
  });

  it('expanding one block does not auto-expand the others', () => {
    render(<CanonicalProfileView onboarding={onboarding} />);
    fireEvent.click(screen.getByRole('button', { name: /seo profile/i }));
    expect(
      screen.getByRole('button', { name: /seo profile/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: /industry/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders nothing when onboarding has not started', () => {
    const { container } = render(<CanonicalProfileView onboarding={null} />);
    expect(container.firstChild).toBeNull();
  });
});