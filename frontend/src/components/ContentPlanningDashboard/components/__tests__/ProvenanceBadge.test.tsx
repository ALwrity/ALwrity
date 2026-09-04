/**
 * Phase 3: Verify ProvenanceBadge component displays correct data provenance.
 *
 * The badge shows:
 * - "Fresh AI Analysis" for recent AI-generated data (data_source="ai_analysis", generated_at < 1hr)
 * - "Cached (X hours old)" for stale cached data
 * - "DB-Grounded" for database-sourced data (data_source="db")
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ProvenanceBadge from '../ProvenanceBadge';

describe('ProvenanceBadge — Phase 3: data provenance display', () => {
  it('renders "Fresh AI Analysis" for recent AI-generated data', () => {
    const oneHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    
    render(<ProvenanceBadge dataSource="ai_analysis" generatedAt={oneHourAgo} />);
    
    expect(screen.getByText(/Fresh AI Analysis/i)).toBeTruthy();
  });

  it('renders "Cached (X hours old)" for stale AI data', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    
    render(<ProvenanceBadge dataSource="ai_analysis" generatedAt={threeHoursAgo} />);
    
    expect(screen.getByText(/Cached/i)).toBeTruthy();
    expect(screen.getByText(/3 hours old/i)).toBeTruthy();
  });

  it('renders "DB-Grounded" for database-sourced data', () => {
    render(<ProvenanceBadge dataSource="db" />);
    
    expect(screen.getByText(/DB-Grounded/i)).toBeTruthy();
  });

  it('renders "AI-Assisted" for ai_assisted source', () => {
    render(<ProvenanceBadge dataSource="ai_assisted" />);
    
    expect(screen.getByText(/AI-Assisted/i)).toBeTruthy();
  });

  it('renders "Unknown" for missing/undefined data source', () => {
    render(<ProvenanceBadge dataSource={undefined} />);
    
    expect(screen.getByText(/Unknown/i)).toBeTruthy();
  });

  it('shows exact age for very recent data (<1hr)', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    render(<ProvenanceBadge dataSource="ai_analysis" generatedAt={thirtyMinAgo} />);
    
    // Should show "30 minutes old" or similar
    expect(screen.getByText(/30 minutes/i)).toBeTruthy();
  });
});