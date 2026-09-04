/**
 * Phase 3: Verify GroundingStatusBadge component displays correct grounding status.
 *
 * The badge shows:
 * - "Validated" (green) for grounding_status="validated"
 * - "Partial" (amber) for grounding_status="partial"
 * - "Error" (red) for grounding_status="error"
 * - "Not validated" (grey) for missing/unknown status
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import GroundingStatusBadge from '../GroundingStatusBadge';

describe('GroundingStatusBadge — Phase 3: grounding validation display', () => {
  it('renders "Validated" for grounding_status="validated"', () => {
    render(<GroundingStatusBadge status="validated" />);
    
    expect(screen.getByText(/Validated/i)).toBeTruthy();
  });

  it('renders "Partial" for grounding_status="partial"', () => {
    render(<GroundingStatusBadge status="partial" />);
    
    expect(screen.getByText(/Partial/i)).toBeTruthy();
  });

  it('renders "Validation Error" for grounding_status="error"', () => {
    render(<GroundingStatusBadge status="error" />);
    
    expect(screen.getByText(/Error/i)).toBeTruthy();
  });

  it('renders "Not validated" for missing status', () => {
    render(<GroundingStatusBadge status={undefined} />);
    
    expect(screen.getByText(/Not validated/i)).toBeTruthy();
  });

  it('renders "Not validated" for unrecognized status', () => {
    render(<GroundingStatusBadge status="foo" />);
    
    expect(screen.getByText(/Not validated/i)).toBeTruthy();
  });

  it('shows validation score when provided', () => {
    render(<GroundingStatusBadge status="validated" score={0.92} />);
    
    expect(screen.getByText(/92%/)).toBeTruthy();
  });
});