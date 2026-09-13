import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ContentPillarGuidelineCard } from '../ContentPillarGuidelineCard';

const theme = createTheme();

describe('ContentPillarGuidelineCard', () => {
  it('renders brand pill with white background and list items', () => {
    render(
      <ThemeProvider theme={theme}>
        <ContentPillarGuidelineCard
          title="alwrity.com"
          items={['AI Writing Assistants', 'Content Marketing Strategy']}
          variant="brand"
          minListHeight={180}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('alwrity.com')).toBeInTheDocument();
    expect(screen.getByText('AI Writing Assistants')).toBeInTheDocument();
    expect(screen.getByTestId('content-pillar-guideline-card')).toHaveAttribute('data-pillar-variant', 'brand');
    expect(screen.getByTestId('content-pillar-list-card')).toHaveStyle({ minHeight: '180px' });
  });

  it('renders competitor pill with colored frame variant', () => {
    render(
      <ThemeProvider theme={theme}>
        <ContentPillarGuidelineCard
          title="Jasper"
          items={['AI copywriting']}
          variant="competitor"
          minListHeight={180}
        />
      </ThemeProvider>
    );

    expect(screen.getByTestId('content-pillar-guideline-card')).toHaveAttribute('data-pillar-variant', 'competitor');
  });
});
