import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CompetitorsGrid, { DISCOVERED_COMPETITORS_DESCRIPTION } from '../CompetitorsGrid';

const theme = createTheme();

const sampleCompetitor = {
  url: 'https://example.com',
  domain: 'example.com',
  title: 'Example Co',
  summary: 'A sample competitor',
  relevance_score: 0.9,
  highlights: ['Strong SEO'],
  competitive_insights: { business_model: 'SaaS', target_audience: 'SMBs' },
  content_insights: { content_focus: 'Blogs', content_quality: 'High' },
};

describe('CompetitorsGrid', () => {
  it('shows discovered competitors description under the section title', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorsGrid
          competitors={[sampleCompetitor]}
          onShowHighlights={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/Discovered Competitors \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(DISCOVERED_COMPETITORS_DESCRIPTION)).toBeInTheDocument();
  });

  it('renders visible view mode toggle controls', () => {
    render(
      <ThemeProvider theme={theme}>
        <CompetitorsGrid
          competitors={[sampleCompetitor]}
          onShowHighlights={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Card view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List view' })).toBeInTheDocument();
  });
});
