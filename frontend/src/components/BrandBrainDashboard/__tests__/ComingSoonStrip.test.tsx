/**
 * ComingSoonStrip (Phase 7) — the §8.2 coming-soon surface.
 *
 * The four deferred workstreams (Re-index SIF, Unified onboarding index, Main
 * dashboard widget, Freshness gates) render as disabled "Coming soon" cards:
 * a visible roadmap on the Brand Brain dashboard without implying capability.
 * Nothing in the strip is interactive. The data contract (key/label/
 * description) is asserted directly so the surface can't silently drop a
 * promised workstream.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComingSoonStrip, { COMING_SOON_ITEMS } from '../ComingSoonStrip';

describe('COMING_SOON_ITEMS — §8.2 deferral contract', () => {
  it('exposes exactly the four deferred workstreams', () => {
    expect(COMING_SOON_ITEMS.map((item) => item.key)).toEqual([
      'reindex',
      'onboarding-as-one-doc',
      'maindashboard-embed',
      'freshness-gates',
    ]);
  });

  it('gives every item a label and a plain-language description', () => {
    for (const item of COMING_SOON_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});

describe('ComingSoonStrip', () => {
  it('renders the roadmap heading and one card per deferred item', () => {
    render(<ComingSoonStrip />);

    expect(screen.getByText('COMING SOON')).toBeTruthy();
    for (const item of COMING_SOON_ITEMS) {
      expect(screen.getByText(item.label)).toBeTruthy();
      expect(screen.getByText(item.description)).toBeTruthy();
    }
  });

  it('renders every card with a disabled "Coming soon" chip', () => {
    const { container } = render(<ComingSoonStrip />);

    expect(screen.getAllByText('Coming soon').length).toBe(COMING_SOON_ITEMS.length);
    expect(container.querySelectorAll('.Mui-disabled').length).toBeGreaterThanOrEqual(
      COMING_SOON_ITEMS.length,
    );
  });

  it('offers nothing interactive', () => {
    const { container } = render(<ComingSoonStrip />);

    expect(container.querySelectorAll('button').length).toBe(0);
  });
});