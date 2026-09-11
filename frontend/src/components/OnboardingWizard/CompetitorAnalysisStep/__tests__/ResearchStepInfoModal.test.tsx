import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ResearchStepInfoModal } from '../ResearchStepInfoModal';

const theme = createTheme();

describe('ResearchStepInfoModal', () => {
  it('renders centered title and What/Why/How labels', () => {
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepInfoModal open onClose={() => {}} />
      </ThemeProvider>
    );

    expect(screen.getByText('What ALwrity does?')).toBeInTheDocument();
    expect(screen.getByText('What')).toBeInTheDocument();
    expect(screen.getByText('Why')).toBeInTheDocument();
    expect(screen.getByText('How')).toBeInTheDocument();
  });

  it('styles What/Why/How with Discovered Competitors section color', () => {
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepInfoModal open onClose={() => {}} />
      </ThemeProvider>
    );

    expect(screen.getByText('What')).toHaveStyle({ color: 'rgb(26, 32, 44)' });
    expect(screen.getByText('Why')).toHaveStyle({ color: 'rgb(26, 32, 44)' });
    expect(screen.getByText('How')).toHaveStyle({ color: 'rgb(26, 32, 44)' });
  });

  it('calls onClose when the dialog close control is clicked', () => {
    const onClose = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepInfoModal open onClose={onClose} />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('onboarding-dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
