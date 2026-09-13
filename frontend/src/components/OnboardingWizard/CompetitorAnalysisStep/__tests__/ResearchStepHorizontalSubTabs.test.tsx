import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import GridViewIcon from '@mui/icons-material/GridView';
import { ResearchStepHorizontalSubTabs } from '../ResearchStepHorizontalSubTabs';

const theme = createTheme();

const items = [
  { id: 'competitors', label: 'Discovered Competitors', icon: <GridViewIcon fontSize="small" /> },
  { id: 'pillars', label: 'Content Pillars', icon: <GridViewIcon fontSize="small" /> },
];

describe('ResearchStepHorizontalSubTabs', () => {
  it('renders horizontal scrollable tabs and switches active tab', () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepHorizontalSubTabs items={items} activeId="competitors" onChange={onChange} />
      </ThemeProvider>
    );

    expect(screen.getByTestId('research-horizontal-subtabs')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Content Pillars'));
    expect(onChange).toHaveBeenCalledWith('pillars');
  });
});
