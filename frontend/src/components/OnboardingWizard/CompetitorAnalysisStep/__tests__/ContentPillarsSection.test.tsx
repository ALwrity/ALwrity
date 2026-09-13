import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ContentPillarsSection } from '../ContentPillarsSection';
import { CONTENT_PILLARS_DESCRIPTION } from '../contentPillarsConstants';

const theme = createTheme();

const sampleData = {
  status: 'complete' as const,
  target_company: {
    domain: 'example.com',
    content_pillars: ['SEO guides', 'Product tutorials'],
  },
  competitors: [
    {
      website: 'https://rival.com',
      company_name: 'Rival Inc',
      content_pillars: ['Industry reports'],
    },
  ],
};

describe('ContentPillarsSection', () => {
  it('renders description below the header and maps competitors dynamically', () => {
    render(
      <ThemeProvider theme={theme}>
        <ContentPillarsSection
          data={sampleData}
          isLoading={false}
          onRefresh={vi.fn()}
          variant="dashboard"
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('heading', { level: 6, name: /Content Pillars/i })).toBeInTheDocument();
    expect(screen.getByTestId('content-pillars-description')).toHaveTextContent(CONTENT_PILLARS_DESCRIPTION);
    const desktopGrid = screen.getByTestId('content-pillars-desktop-grid');
    expect(within(desktopGrid).getByText('example.com')).toBeInTheDocument();
    expect(within(desktopGrid).getByTestId('brand-strategy-label')).toHaveTextContent(
      'Your example.com Content Strategy'
    );
    expect(within(desktopGrid).getByTestId('competitor-pillars-label')).toHaveTextContent(
      'Competitor Pillars (1)'
    );
    expect(within(desktopGrid).getByText('SEO guides')).toBeInTheDocument();
    expect(within(desktopGrid).getByText('Rival Inc')).toBeInTheDocument();
    expect(within(desktopGrid).getAllByTestId('content-pillar-guideline-card')).toHaveLength(2);
  });

  it('applies the same min list height to every rendered card', () => {
    render(
      <ThemeProvider theme={theme}>
        <ContentPillarsSection
          data={sampleData}
          isLoading={false}
          variant="dashboard"
        />
      </ThemeProvider>
    );

    const listCards = screen.getAllByTestId('content-pillar-list-card');
    const heights = listCards.map((card) => card.getAttribute('data-min-list-height'));
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBeTruthy();
  });
});
