/**
 * Phase 4: QualityStrip — data_quality assessment surfaced beside identity.
 *
 * Shows the quality level + the numeric assessment dimensions (overall_score,
 * completeness, freshness, accuracy, relevance, consistency, confidence) from
 * DataQualityService.assess_onboarding_data_quality. Renders nothing when the
 * block has no keys.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QualityStrip from '../QualityStrip';

const dataQuality = {
  overall_score: 0.72,
  completeness: 0.75,
  freshness: 0.8,
  accuracy: 0.7,
  relevance: 0.6,
  consistency: 0.75,
  confidence: 0.72,
  quality_level: 'good',
};

describe('QualityStrip — Phase 4: data quality + freshness', () => {
  it('renders the quality level', () => {
    render(<QualityStrip dataQuality={dataQuality} />);
    expect(screen.getByText('good')).toBeTruthy();
  });

  it('renders the overall score as a percentage', () => {
    render(<QualityStrip dataQuality={dataQuality} />);
    expect(screen.getAllByText('72%').length).toBeGreaterThan(0);
  });

  it('renders the numeric assessment dimensions', () => {
    render(<QualityStrip dataQuality={dataQuality} />);
    expect(screen.getByText(/Completeness/i)).toBeTruthy();
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    expect(screen.getByText(/Freshness/i)).toBeTruthy();
  });

  it('renders nothing when data_quality has no keys', () => {
    const { container } = render(<QualityStrip dataQuality={{}} />);
    expect(container.firstChild).toBeNull();
  });
});