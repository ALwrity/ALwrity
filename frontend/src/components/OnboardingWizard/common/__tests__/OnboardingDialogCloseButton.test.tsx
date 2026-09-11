import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { OnboardingDialogCloseButton } from '../OnboardingDialogCloseButton';

const theme = createTheme();

describe('OnboardingDialogCloseButton', () => {
  it('renders a circular LinkedIn-style close control', () => {
    render(
      <ThemeProvider theme={theme}>
        <OnboardingDialogCloseButton onClick={() => {}} />
      </ThemeProvider>
    );

    const button = screen.getByTestId('onboarding-dialog-close');
    expect(button).toHaveAttribute('aria-label', 'Close dialog');
    expect(button).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('invokes onClick when pressed', () => {
    const onClick = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <OnboardingDialogCloseButton onClick={onClick} ariaLabel="Close" />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
