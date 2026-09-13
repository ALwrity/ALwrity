import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ContentPillarsDashboardGrid } from '../ContentPillarsDashboardGrid';

const theme = createTheme();

const fiveCompetitors = [
  { website: 'https://c1.com', company_name: 'Comp One', content_pillars: ['Pillar A'] },
  { website: 'https://c2.com', company_name: 'Comp Two', content_pillars: ['Pillar B'] },
  { website: 'https://c3.com', company_name: 'Comp Three', content_pillars: ['Pillar C'] },
  { website: 'https://c4.com', company_name: 'Comp Four', content_pillars: ['Pillar D'] },
  { website: 'https://c5.com', company_name: 'Comp Five', content_pillars: ['Pillar E'] },
];

describe('ContentPillarsDashboardGrid', () => {
  it('renders centered section labels and five competitor cards on desktop layout', () => {
    render(
      <ThemeProvider theme={theme}>
        <ContentPillarsDashboardGrid
          targetCompany={{ domain: 'alwrity.com', content_pillars: ['Brand pillar'] }}
          competitors={fiveCompetitors}
          minListHeight={180}
        />
      </ThemeProvider>
    );

    const desktopGrid = screen.getByTestId('content-pillars-desktop-grid');
    expect(within(desktopGrid).getByTestId('brand-strategy-label')).toHaveTextContent(
      'Your alwrity.com Content Strategy'
    );
    expect(within(desktopGrid).getByTestId('competitor-pillars-label')).toHaveTextContent(
      'Competitor Pillars (5)'
    );
    expect(within(desktopGrid).getAllByTestId('content-pillar-guideline-card')).toHaveLength(6);
    expect(within(desktopGrid).getByText('Comp Four')).toBeInTheDocument();
    expect(within(desktopGrid).getByText('Comp Five')).toBeInTheDocument();
  });

  it('uses blue brand pill and grey competitor pill variants', () => {
    render(
      <ThemeProvider theme={theme}>
        <ContentPillarsDashboardGrid
          targetCompany={{ domain: 'alwrity.com', content_pillars: ['Brand pillar'] }}
          competitors={[fiveCompetitors[0]]}
          minListHeight={180}
        />
      </ThemeProvider>
    );

    const desktopGrid = screen.getByTestId('content-pillars-desktop-grid');
    const cards = within(desktopGrid).getAllByTestId('content-pillar-guideline-card');
    expect(cards[0]).toHaveAttribute('data-pillar-variant', 'brand');
    expect(cards[1]).toHaveAttribute('data-pillar-variant', 'competitor');
  });
});
