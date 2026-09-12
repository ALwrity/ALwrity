import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CompetitorHighlightsDialog } from '../CompetitorHighlightsDialog';

const theme = createTheme();

const competitor = {
  url: 'https://rival.com',
  domain: 'rival.com',
  title: 'Rival Inc',
  summary: 'Direct competitor in the same niche.',
  relevance_score: 0.82,
  highlights: ['Strong organic traffic', 'Active blog cadence'],
  competitive_insights: {
    business_model: 'Subscription',
    target_audience: 'Enterprise',
    threat_level: 'medium',
  },
  content_insights: {
    content_focus: 'Thought leadership',
    content_quality: 'High',
  },
};

describe('CompetitorHighlightsDialog', () => {
  it('renders readable highlight text with LinkedIn-style dialog surface', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorHighlightsDialog open competitor={competitor} onClose={vi.fn()} />
      </ThemeProvider>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Rival Inc')).toBeInTheDocument();
    expect(screen.getByText('Strong organic traffic')).toBeVisible();
    expect(screen.getByText('Active blog cadence')).toBeVisible();
    expect(screen.getByText('Direct competitor in the same niche.')).toBeVisible();
  });
});
